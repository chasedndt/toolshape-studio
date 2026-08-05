import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { MemoryStudioJobGateway, STUDIO_SCHEMA_VERSION, StudioKernel } from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import {
  StudioSdk,
  contractEnvelopeToKernel,
  type ContractOperationEnvelope,
  type ContractOperationResult,
} from "@toolshape/studio-sdk";
import {
  MCP_PROTOCOL_VERSION,
  SessionRegistry,
  StudioMcpServer,
  UnauthorizedError,
  buildEnvelope,
  findTool,
  STUDIO_TOOLS,
  serveHttp,
  type StudioSession,
} from "../src/index";

const roots: string[] = [];
const openRepositories: SqliteStudioRepository[] = [];

afterEach(async () => {
  // Close every handle before unlinking: a test that fails mid-way would
  // otherwise leave SQLite holding the file and cleanup fails with EBUSY.
  for (const repository of openRepositories.splice(0)) {
    try {
      repository.close();
    } catch {
      // Already closed by the test itself.
    }
  }
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-mcp-"));
  roots.push(root);
  return root;
}

function track(repository: SqliteStudioRepository): SqliteStudioRepository {
  openRepositories.push(repository);
  return repository;
}

const SESSION: StudioSession = {
  principalId: "operator-1",
  agentId: "agent-1",
  harnessId: "hermes",
  grantIds: ["studio.*"],
};

async function createServer(): Promise<{ server: StudioMcpServer; projectId: string; repository: SqliteStudioRepository }> {
  const root = await temporaryRoot();
  const repository = track(new SqliteStudioRepository(path.join(root, "studio.sqlite")));
  const project = createGoldenStudioProject();
  repository.createProject(project);
  const invoker = new StudioSdk(new StudioKernel(repository, new MemoryStudioJobGateway()));
  return {
    server: new StudioMcpServer({ invoker, schemaVersion: STUDIO_SCHEMA_VERSION }),
    projectId: project.id,
    repository,
  };
}

function call(server: StudioMcpServer, name: string, args: Record<string, unknown>, id = 1) {
  return server.handle(
    { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } },
    SESSION,
  );
}

function payloadOf(response: unknown): Record<string, unknown> {
  const result = (response as { result?: { content?: Array<{ text: string }> } }).result;
  const text = result?.content?.[0]?.text;
  if (!text) throw new Error("Response carried no tool content.");
  return JSON.parse(text) as Record<string, unknown>;
}

describe("MCP protocol surface", () => {
  it("completes the initialize handshake with a protocol version and tool capability", async () => {
    const { server, repository } = await createServer();
    const response = server.handle({ jsonrpc: "2.0", id: 1, method: "initialize" }, SESSION);
    const result = (response as { result: Record<string, unknown> }).result;
    expect(result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(result.capabilities).toMatchObject({ tools: { listChanged: false } });
    repository.close();
  });

  it("advertises one discoverable tool per kernel capability with an input schema", async () => {
    const { server, repository } = await createServer();
    const response = server.handle({ jsonrpc: "2.0", id: 1, method: "tools/list" }, SESSION);
    const tools = (response as { result: { tools: Array<{ name: string; inputSchema: unknown }> } }).result.tools;
    // Derived rather than hardcoded: a new capability should extend the
    // advertised surface automatically, not fail an unrelated count assertion.
    expect(tools).toHaveLength(STUDIO_TOOLS.length);
    expect(new Set(tools.map((tool) => tool.name)).size).toBe(STUDIO_TOOLS.length);
    for (const tool of tools) {
      expect(tool.inputSchema).toMatchObject({ type: "object" });
    }
    // Names must survive the common MCP client constraint of [a-zA-Z0-9_-].
    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    }
    repository.close();
  });

  it("returns a notification-free response for notifications", async () => {
    const { server, repository } = await createServer();
    expect(server.handle({ jsonrpc: "2.0", method: "notifications/initialized" }, SESSION)).toBeNull();
    repository.close();
  });

  it("rejects unknown methods and malformed messages without touching the kernel", async () => {
    const { server, repository } = await createServer();
    const unknown = server.handle({ jsonrpc: "2.0", id: 1, method: "nope" }, SESSION);
    expect(unknown).toMatchObject({ error: { code: -32601 } });
    const malformed = server.handle({ not: "jsonrpc" }, SESSION);
    expect(malformed).toMatchObject({ error: { code: -32600 } });
    repository.close();
  });
});

describe("MCP capability dispatch", () => {
  it("inspects a project and reports its current revision", async () => {
    const { server, projectId, repository } = await createServer();
    const payload = payloadOf(call(server, "studio_project_inspect", { project_id: projectId }));
    expect(payload.status).toBe("completed");
    expect((payload.state as { revision_after: number }).revision_after).toBe(0);
    repository.close();
  });

  it("returns the canonical project so a caller can read what it is about to edit", async () => {
    // Regression guard: the public contract projection previously dropped
    // state.project, so inspect returned a revision and nothing else. An agent
    // could not read the project, and the editor could not render it.
    const { server, projectId, repository } = await createServer();
    const payload = payloadOf(call(server, "studio_project_inspect", { project_id: projectId }));
    const project = (payload.state as { project?: { id: string; timeline?: unknown; assets?: unknown[] } }).project;
    expect(project).toBeDefined();
    expect(project!.id).toBe(projectId);
    expect(project!.timeline).toBeDefined();
    expect(Array.isArray(project!.assets)).toBe(true);
    repository.close();
  });

  it("previews a split as a semantic diff without advancing the revision", async () => {
    const { server, projectId, repository } = await createServer();
    const operations = [
      {
        operationId: "11111111-1111-4111-8111-111111111111",
        type: "timeline.clip.split",
        actor: "agent",
        expectedRevision: 0,
        payload: {
          trackId: "track-video",
          clipId: "clip-main",
          splitAt: { numerator: 2, denominator: 1 },
          rightClipId: "clip-preview-right",
        },
      },
    ];
    const payload = payloadOf(
      call(server, "studio_project_plan", { project_id: projectId, expected_revision: 0, operations }),
    );
    expect(payload.status).toBe("previewed");
    expect((payload.state as { semantic_diff: unknown[] }).semantic_diff.length).toBeGreaterThan(0);

    // The preview must not have committed anything.
    const after = payloadOf(call(server, "studio_project_inspect", { project_id: projectId }, 2));
    expect((after.state as { revision_after: number }).revision_after).toBe(0);
    repository.close();
  });

  it("applies a split and advances the revision", async () => {
    const { server, projectId, repository } = await createServer();
    const operations = [
      {
        operationId: "22222222-2222-4222-8222-222222222222",
        type: "timeline.clip.split",
        actor: "agent",
        expectedRevision: 0,
        payload: {
          trackId: "track-video",
          clipId: "clip-main",
          splitAt: { numerator: 2, denominator: 1 },
          rightClipId: "clip-applied-right",
        },
      },
    ];
    const payload = payloadOf(
      call(server, "studio_project_apply_operations", {
        project_id: projectId,
        expected_revision: 0,
        operations,
      }),
    );
    expect(payload.status).toBe("completed");
    expect((payload.state as { revision_after: number }).revision_after).toBe(1);
    repository.close();
  });

  it("rejects a stale revision as a tool error rather than overwriting concurrent work", async () => {
    const { server, projectId, repository } = await createServer();
    const operations = [
      {
        operationId: "33333333-3333-4333-8333-333333333333",
        type: "timeline.clip.split",
        actor: "agent",
        expectedRevision: 9,
        payload: {
          trackId: "track-video",
          clipId: "clip-main",
          splitAt: { numerator: 2, denominator: 1 },
          rightClipId: "clip-stale-right",
        },
      },
    ];
    const response = call(server, "studio_project_apply_operations", {
      project_id: projectId,
      expected_revision: 9,
      operations,
    });
    const result = (response as { result: { isError?: boolean } }).result;
    expect(result.isError).toBe(true);

    // The project must be untouched.
    const after = payloadOf(call(server, "studio_project_inspect", { project_id: projectId }, 2));
    expect((after.state as { revision_after: number }).revision_after).toBe(0);
    repository.close();
  });

  it("reports kernel rejections without leaking filesystem paths", async () => {
    const { server, projectId, repository } = await createServer();
    const response = call(server, "studio_project_apply_operations", {
      project_id: projectId,
      expected_revision: 0,
      operations: [
        {
          operationId: "44444444-4444-4444-8444-444444444444",
          type: "timeline.clip.trim",
          actor: "agent",
          expectedRevision: 0,
          payload: {
            trackId: "track-video",
            clipId: "clip-main",
            newStart: { numerator: 0, denominator: 1 },
            newDuration: { numerator: 9, denominator: 1 },
            ripple: false,
          },
        },
      ],
    });
    const text = JSON.stringify((response as { result: { content: Array<{ text: string }> } }).result);
    expect(text).not.toMatch(/[A-Za-z]:\\\\|\/(?:home|tmp|Users)\//);
    repository.close();
  });

  it("refuses a mutation the session's grants do not cover", async () => {
    const { server, projectId, repository } = await createServer();
    // A read-only harness: it may inspect, and nothing else.
    const readOnly: StudioSession = {
      principalId: "operator-1",
      agentId: "reader",
      harnessId: "openclaw",
      grantIds: ["studio.project.inspect"],
    };

    const allowed = server.handle(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "studio_project_inspect", arguments: { project_id: projectId } } },
      readOnly,
    );
    expect(payloadOf(allowed).status).toBe("completed");

    const denied = server.handle(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "studio_project_apply_operations",
          arguments: {
            project_id: projectId,
            expected_revision: 0,
            operations: [
              {
                operationId: "77777777-7777-4777-8777-777777777777",
                type: "timeline.clip.split",
                actor: "agent",
                expectedRevision: 0,
                payload: {
                  trackId: "track-video",
                  clipId: "clip-main",
                  splitAt: { numerator: 2, denominator: 1 },
                  rightClipId: "clip-denied-right",
                },
              },
            ],
          },
        },
      },
      readOnly,
    );
    expect((denied as { result: { isError?: boolean } }).result.isError).toBe(true);
    expect(JSON.stringify(payloadOf(denied))).toMatch(/grant/i);

    // And the project is untouched.
    const after = payloadOf(call(server, "studio_project_inspect", { project_id: projectId }, 3));
    expect((after.state as { revision_after: number }).revision_after).toBe(0);
    repository.close();
  });

  it("requires a project_id and refuses unknown tools", async () => {
    const { server, repository } = await createServer();
    expect(call(server, "studio_project_inspect", {})).toMatchObject({ error: { code: -32602 } });
    expect(call(server, "studio_not_a_tool", { project_id: "p" })).toMatchObject({ error: { code: -32602 } });
    repository.close();
  });
});

describe("MCP session authentication", () => {
  const token = "a".repeat(64);
  const credential = { ...SESSION, token };

  it("refuses to construct without any credential", () => {
    expect(() => new SessionRegistry([])).toThrow(/refuses to start unauthenticated/i);
  });

  it("refuses short tokens", () => {
    expect(() => new SessionRegistry([{ ...SESSION, token: "short" }])).toThrow(/at least 32/i);
  });

  it("accepts a correct bearer token and resolves the session identity", () => {
    const registry = new SessionRegistry([credential]);
    const session = registry.authenticate(`Bearer ${token}`);
    expect(session.principalId).toBe("operator-1");
    expect(session.harnessId).toBe("hermes");
  });

  it("rejects a missing, malformed, or wrong token", () => {
    const registry = new SessionRegistry([credential]);
    expect(() => registry.authenticate(undefined)).toThrow(UnauthorizedError);
    expect(() => registry.authenticate(token)).toThrow(/Bearer scheme/i);
    expect(() => registry.authenticate(`Bearer ${"b".repeat(64)}`)).toThrow(/not recognised/i);
  });
});

describe("MCP browser origin policy", () => {
  const TOKEN = "z".repeat(48);
  const ALLOWED = "http://127.0.0.1:5173";

  async function withServer<T>(
    allowedOrigins: string[],
    body: (base: string) => Promise<T>,
  ): Promise<T> {
    const root = await temporaryRoot();
    const repository = track(new SqliteStudioRepository(path.join(root, "studio.sqlite")));
    repository.createProject(createGoldenStudioProject());
    const mcp = new StudioMcpServer({
      invoker: new StudioSdk(new StudioKernel(repository, new MemoryStudioJobGateway())),
      schemaVersion: STUDIO_SCHEMA_VERSION,
    });
    const sessions = new SessionRegistry([{ ...SESSION, token: TOKEN }]);
    const listener = await serveHttp({ server: mcp, sessions, port: 0, host: "127.0.0.1", allowedOrigins });
    const address = listener.address();
    const port = typeof address === "object" && address ? address.port : 0;
    try {
      return await body(`http://127.0.0.1:${port}/`);
    } finally {
      await new Promise<void>((resolve) => listener.close(() => resolve()));
    }
  }

  it("refuses a browser origin that was not explicitly allowed", async () => {
    await withServer([], async (base) => {
      const response = await fetch(base, {
        method: "OPTIONS",
        headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
      });
      expect(response.status).toBe(403);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  it("never answers with a wildcard origin", async () => {
    await withServer([ALLOWED], async (base) => {
      const response = await fetch(base, {
        method: "OPTIONS",
        headers: { origin: ALLOWED, "access-control-request-method": "POST" },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED);
      expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
      // A shared cache must not serve one origin's permission to another.
      expect(response.headers.get("vary")).toBe("origin");
    });
  });

  it("allows a permitted origin to complete a real call", async () => {
    await withServer([ALLOWED], async (base) => {
      const response = await fetch(base, {
        method: "POST",
        headers: {
          origin: ALLOWED,
          authorization: `Bearer ${TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe(ALLOWED);
    });
  });

  it("still requires a token from an allowed origin", async () => {
    await withServer([ALLOWED], async (base) => {
      const response = await fetch(base, {
        method: "POST",
        headers: { origin: ALLOWED, "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      // Origin permission is not authentication.
      expect(response.status).toBe(401);
    });
  });

  it("leaves non-browser callers unaffected", async () => {
    await withServer([], async (base) => {
      const response = await fetch(base, {
        method: "POST",
        headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      expect(response.status).toBe(200);
    });
  });
});

describe("MCP envelope construction", () => {
  it("takes actor identity from the session, never from caller arguments", () => {
    const tool = findTool("studio_project_apply_operations")!;
    const envelope = buildEnvelope({
      tool,
      // A hostile caller trying to assert a different principal.
      args: {
        project_id: "p1",
        expected_revision: 0,
        operations: [],
        ...({ actor: { principal_id: "root" } } as Record<string, unknown>),
      },
      session: SESSION,
      schemaVersion: STUDIO_SCHEMA_VERSION,
    });
    expect(envelope.actor.principal_id).toBe("operator-1");
    expect(envelope.actor.agent_id).toBe("agent-1");
    expect(envelope.authorization.grant_ids).toEqual(["studio.*"]);
  });

  it("attributes an edit to the actor type the credential declares", () => {
    // Regression guard. The contract had no actor type, so the kernel inferred
    // one by comparing agent_id to principal_id — which classified every call
    // through MCP as an agent, including the editor's own. The activity
    // history then reported a person's edits as an agent's.
    const human = buildEnvelope({
      tool: findTool("studio_project_apply_operations")!,
      args: { project_id: "p1", expected_revision: 0, operations: [] },
      session: { ...SESSION, agentId: "studio-editor", actorType: "human" },
      schemaVersion: STUDIO_SCHEMA_VERSION,
    });
    expect(human.actor.actor_type).toBe("human");
    expect(contractEnvelopeToKernel(human).actor.type).toBe("human");

    const agent = buildEnvelope({
      tool: findTool("studio_project_apply_operations")!,
      args: { project_id: "p1", expected_revision: 0, operations: [] },
      session: { ...SESSION, actorType: "agent" },
      schemaVersion: STUDIO_SCHEMA_VERSION,
    });
    expect(contractEnvelopeToKernel(agent).actor.type).toBe("agent");
  });

  it("defaults an unlabelled session to agent", () => {
    // An MCP session is an agent unless the credential says otherwise, so the
    // safer classification is the default.
    const envelope = buildEnvelope({
      tool: findTool("studio_project_inspect")!,
      args: { project_id: "p1" },
      session: { ...SESSION, actorType: undefined },
      schemaVersion: STUDIO_SCHEMA_VERSION,
    });
    expect(envelope.actor.actor_type).toBe("agent");
  });

  it("forces dry_run for the simulation capability", () => {
    const envelope = buildEnvelope({
      tool: findTool("studio_project_plan")!,
      args: { project_id: "p1", expected_revision: 0, operations: [], dry_run: false },
      session: SESSION,
      schemaVersion: STUDIO_SCHEMA_VERSION,
    });
    expect(envelope.execution.dry_run).toBe(true);
  });

  it("honours a caller-supplied idempotency key so retries are safe", () => {
    const envelope = buildEnvelope({
      tool: findTool("studio_project_apply_operations")!,
      args: { project_id: "p1", expected_revision: 0, operations: [], idempotency_key: "stable-key-123" },
      session: SESSION,
      schemaVersion: STUDIO_SCHEMA_VERSION,
    });
    expect(envelope.idempotency_key).toBe("stable-key-123");
  });

  it("targets a project by identity rather than a filesystem path", () => {
    const envelope = buildEnvelope({
      tool: findTool("studio_project_inspect")!,
      args: { project_id: "project-golden" },
      session: SESSION,
      schemaVersion: STUDIO_SCHEMA_VERSION,
    });
    expect(envelope.target.resource).toEqual({ type: "studio_project", id: "project-golden" });
  });

  it("covers every declared capability", () => {
    for (const tool of STUDIO_TOOLS) {
      const envelope = buildEnvelope({
        tool,
        args: {
          project_id: "p1",
          expected_revision: 0,
          operations: [],
          job_id: "j1",
          undo_token: "t1",
          cover_asset_id: "a1",
          preset_id: "preset-1",
          output_name: "out.mp4",
        },
        session: SESSION,
        schemaVersion: STUDIO_SCHEMA_VERSION,
      });
      expect(envelope.capability.id).toBe(tool.capability);
    }
  });
});

describe("adapter parity", () => {
  it("produces the same state change through MCP as through the SDK directly", async () => {
    const buildSplit = (rightClipId: string, operationId: string) => ({
      operationId,
      type: "timeline.clip.split",
      actor: "agent",
      expectedRevision: 0,
      payload: {
        trackId: "track-video",
        clipId: "clip-main",
        splitAt: { numerator: 2, denominator: 1 },
        rightClipId,
      },
    });

    // Path A — through the MCP adapter.
    const viaMcp = await createServer();
    const mcpPayload = payloadOf(
      call(viaMcp.server, "studio_project_apply_operations", {
        project_id: viaMcp.projectId,
        expected_revision: 0,
        operations: [buildSplit("clip-right", "55555555-5555-4555-8555-555555555555")],
      }),
    ) as unknown as ContractOperationResult;

    // Path B — straight through the SDK with an equivalent envelope.
    const root = await temporaryRoot();
    const repository = track(new SqliteStudioRepository(path.join(root, "studio.sqlite")));
    const project = createGoldenStudioProject();
    repository.createProject(project);
    const sdk = new StudioSdk(new StudioKernel(repository, new MemoryStudioJobGateway()));
    const envelope: ContractOperationEnvelope = buildEnvelope({
      tool: findTool("studio_project_apply_operations")!,
      args: {
        project_id: project.id,
        expected_revision: 0,
        operations: [buildSplit("clip-right", "66666666-6666-4666-8666-666666666666")],
      },
      session: SESSION,
      schemaVersion: STUDIO_SCHEMA_VERSION,
    });
    const sdkResult = sdk.invoke(envelope);

    expect(mcpPayload.status).toBe(sdkResult.status);
    expect(mcpPayload.state.revision_after).toBe(sdkResult.state.revision_after);
    expect(mcpPayload.state.semantic_diff?.length).toBe(sdkResult.state.semantic_diff?.length);

    viaMcp.repository.close();
    repository.close();
  });
});
