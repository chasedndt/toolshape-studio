/**
 * End-to-end smoke over the real HTTP transport.
 *
 * Proves what the unit tests cannot: that a networked harness with nothing but
 * a URL and a bearer token can discover the capability surface and drive a full
 * inspect -> preview -> apply -> verify loop with no computer-use and no
 * in-process access. This is the claim ADR 0012 exists to make true.
 */
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { MemoryStudioJobGateway, STUDIO_SCHEMA_VERSION, StudioKernel } from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import { StudioSdk } from "@toolshape/studio-sdk";
import { SessionRegistry, StudioMcpServer, serveHttp } from "@toolshape/studio-mcp";

const TOKEN = "smoke-token-that-is-long-enough-to-pass-1234567890";
const PORT = 7791;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAILED: ${message}`);
}

let nextId = 1;

async function rpc(method: string, params?: Record<string, unknown>, token = TOKEN): Promise<Response> {
  return fetch(`http://127.0.0.1:${PORT}/`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await rpc("tools/call", { name, arguments: args });
  const body = (await response.json()) as { result?: { content?: Array<{ text: string }>; isError?: boolean } };
  const text = body.result?.content?.[0]?.text;
  assert(text, `${name} returned no content`);
  return JSON.parse(text) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-mcp-smoke-"));
  const repository = new SqliteStudioRepository(path.join(root, "studio.sqlite"));
  const project = createGoldenStudioProject();
  repository.createProject(project);

  const server = new StudioMcpServer({
    invoker: new StudioSdk(new StudioKernel(repository, new MemoryStudioJobGateway())),
    schemaVersion: STUDIO_SCHEMA_VERSION,
  });
  const sessions = new SessionRegistry([
    { principalId: "smoke-operator", agentId: "smoke-agent", harnessId: "smoke", grantIds: ["studio.*"], token: TOKEN },
  ]);
  const listener = await serveHttp({ server, sessions, port: PORT });

  try {
    // 1. Liveness needs no credential and leaks nothing.
    const health = await fetch(`http://127.0.0.1:${PORT}/health`);
    assert(health.status === 200, "health check should be reachable");

    // 2. An unauthenticated call is refused before reaching the kernel.
    const anonymous = await fetch(`http://127.0.0.1:${PORT}/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" }),
    });
    assert(anonymous.status === 401, `unauthenticated call must be 401, got ${anonymous.status}`);

    // 3. A wrong token is refused.
    const wrong = await rpc("tools/list", undefined, "x".repeat(50));
    assert(wrong.status === 401, `wrong token must be 401, got ${wrong.status}`);

    // 4. Handshake.
    const initialize = await (await rpc("initialize")).json() as { result: { protocolVersion: string } };
    assert(initialize.result.protocolVersion.length > 0, "initialize must return a protocol version");

    // 5. Discovery — the harness learns the surface with no hardcoded knowledge.
    const listed = await (await rpc("tools/list")).json() as { result: { tools: Array<{ name: string }> } };
    const names = listed.result.tools.map((tool) => tool.name);
    for (const required of [
      "studio_project_inspect",
      "studio_project_plan",
      "studio_project_apply_operations",
      "studio_project_render",
      "studio_project_history",
      "studio_operation_revert",
    ]) {
      assert(names.includes(required), `${required} must be discoverable`);
    }

    // 6. Inspect for the current revision.
    const inspected = await callTool("studio_project_inspect", { project_id: project.id });
    const revision = (inspected.state as { revision_after: number }).revision_after;
    assert(revision === 0, `expected revision 0, got ${revision}`);

    const split = [
      {
        operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "timeline.clip.split",
        actor: "agent",
        expectedRevision: revision,
        payload: {
          trackId: "track-video",
          clipId: "clip-main",
          splitAt: { numerator: 2, denominator: 1 },
          rightClipId: "clip-smoke-right",
        },
      },
    ];

    // 7. Preview changes nothing.
    const preview = await callTool("studio_project_plan", {
      project_id: project.id,
      expected_revision: revision,
      operations: split,
    });
    assert(preview.status === "previewed", `expected previewed, got ${String(preview.status)}`);
    const afterPreview = await callTool("studio_project_inspect", { project_id: project.id });
    assert((afterPreview.state as { revision_after: number }).revision_after === 0, "preview must not commit");

    // 8. Apply advances the revision.
    const applied = await callTool("studio_project_apply_operations", {
      project_id: project.id,
      expected_revision: revision,
      operations: split,
      idempotency_key: "smoke-idempotency-key-0001",
    });
    assert(applied.status === "completed", `expected completed, got ${String(applied.status)}`);
    assert((applied.state as { revision_after: number }).revision_after === 1, "apply must advance to revision 1");

    // 9. Replaying the same key must not apply twice.
    const replayed = await callTool("studio_project_apply_operations", {
      project_id: project.id,
      expected_revision: revision,
      operations: split,
      idempotency_key: "smoke-idempotency-key-0001",
    });
    assert((replayed.state as { revision_after: number }).revision_after === 1, "replay must not double-apply");

    // 10. A stale revision is refused rather than overwriting.
    const stale = await rpc("tools/call", {
      name: "studio_project_apply_operations",
      arguments: { project_id: project.id, expected_revision: 0, operations: split },
    });
    const staleBody = (await stale.json()) as { result: { isError?: boolean } };
    assert(staleBody.result.isError === true, "stale revision must be refused");

    // 11. Validation confirms the project is still coherent.
    const validated = await callTool("studio_project_validate", { project_id: project.id });
    assert(validated.status === "completed", "validate must succeed");

    process.stdout.write(
      `${JSON.stringify({ status: "completed", checks: 11, tools: names.length, final_revision: 1 })}\n`,
    );
  } finally {
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    repository.close();
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ status: "failed", error: String(error) })}\n`);
  process.exitCode = 1;
});
