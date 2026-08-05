import { describe, expect, it } from "vitest";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { MemoryStudioJobGateway, StudioKernel } from "@toolshape/studio-kernel";
import { MemoryStudioRepository } from "@toolshape/studio-kernel";
import {
  StudioClient,
  StudioDisconnectedError,
  StudioStaleRevisionError,
  createMemoryTransport,
  type StudioTransport,
} from "./studio-client";

function createClient(): { client: StudioClient; projectId: string; kernel: StudioKernel } {
  const project = createGoldenStudioProject();
  const repository = new MemoryStudioRepository();
  repository.createProject(project);
  const kernel = new StudioKernel(repository, new MemoryStudioJobGateway());
  return {
    client: new StudioClient({ transport: createMemoryTransport(kernel), projectId: project.id }),
    projectId: project.id,
    kernel,
  };
}

const splitDraft = (rightClipId: string) =>
  ({
    type: "timeline.clip.split",
    payload: {
      trackId: "track-video",
      clipId: "clip-main",
      splitAt: { numerator: 2, denominator: 1 },
      rightClipId,
    },
  }) as const;

describe("StudioClient", () => {
  it("inspects the project and reports the server's revision", async () => {
    const { client } = createClient();
    const state = await client.inspect();
    expect(state.revision).toBe(0);
    expect(state.project.id).toBe("project-launch-film");
  });

  it("applies an operation and advances the revision", async () => {
    const { client } = createClient();
    await client.inspect();
    const result = await client.apply(splitDraft("clip-right-1"));
    expect(result.revision).toBe(1);
    expect(result.diff).toBeTruthy();
  });

  it("reads its expected revision from the server, not from stale local state", async () => {
    const { client, kernel, projectId } = createClient();
    await client.inspect();

    // Another actor -- an agent -- advances the project behind the client's back.
    kernel.invoke({
      schema_version: "0.1.0",
      operation_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      idempotency_key: "agent-advance-key-0001",
      trace_id: "agent-trace-1",
      actor: { id: "agent", type: "agent" },
      intent: "agent split",
      capability: { id: "studio.project.apply_operations", version: "0.1.0" },
      target: { resource: `toolshape-studio://projects/${projectId}`, expected_revision: 0 },
      input: {
        operations: [
          {
            operationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            type: "timeline.clip.split",
            actor: "agent",
            expectedRevision: 0,
            payload: {
              trackId: "track-video",
              clipId: "clip-main",
              splitAt: { numerator: 3, denominator: 1 },
              rightClipId: "clip-agent-right",
            },
          },
        ],
      },
      risk: { level: "low" },
      authorization: { grant_ids: ["studio.*"] },
      execution: { dry_run: false, atomicity: "atomic" },
      retention: { class: "project", content_storage: "local" },
      created_at: new Date().toISOString(),
    });

    // The client still believes revision 0. Its next write must be refused,
    // not silently retried at revision 1 -- that would discard the agent's edit.
    await expect(client.apply(splitDraft("clip-right-2"))).rejects.toBeInstanceOf(StudioStaleRevisionError);
  });

  it("recovers after a stale rejection by re-inspecting", async () => {
    const { client, kernel, projectId } = createClient();
    await client.inspect();
    kernel.invoke({
      schema_version: "0.1.0",
      operation_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      idempotency_key: "agent-advance-key-0002",
      trace_id: "agent-trace-2",
      actor: { id: "agent", type: "agent" },
      intent: "agent split",
      capability: { id: "studio.project.apply_operations", version: "0.1.0" },
      target: { resource: `toolshape-studio://projects/${projectId}`, expected_revision: 0 },
      input: {
        operations: [
          {
            operationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            type: "timeline.clip.split",
            actor: "agent",
            expectedRevision: 0,
            payload: {
              trackId: "track-video",
              clipId: "clip-main",
              splitAt: { numerator: 3, denominator: 1 },
              rightClipId: "clip-agent-right-2",
            },
          },
        ],
      },
      risk: { level: "low" },
      authorization: { grant_ids: ["studio.*"] },
      execution: { dry_run: false, atomicity: "atomic" },
      retention: { class: "project", content_storage: "local" },
      created_at: new Date().toISOString(),
    });

    await expect(client.apply(splitDraft("clip-x"))).rejects.toBeInstanceOf(StudioStaleRevisionError);
    const refreshed = await client.inspect();
    expect(refreshed.revision).toBe(1);
    const result = await client.apply(splitDraft("clip-after-refresh"));
    expect(result.revision).toBe(2);
  });

  it("does not double-apply when a lost response is retried", async () => {
    // The real retry scenario: the operation reaches the kernel and commits,
    // but the response never gets back, so the client still believes the old
    // revision and the user tries again. Without a stable operation identity
    // this applies the edit twice.
    const project = createGoldenStudioProject();
    const repository = new MemoryStudioRepository();
    repository.createProject(project);
    const kernel = new StudioKernel(repository, new MemoryStudioJobGateway());
    const inner = createMemoryTransport(kernel);

    let dropNextResponse = false;
    const flaky: StudioTransport = {
      async invoke(envelope) {
        const result = await inner.invoke(envelope);
        if (dropNextResponse) {
          dropNextResponse = false;
          throw new TypeError("fetch failed");
        }
        return result;
      },
    };

    const client = new StudioClient({ transport: flaky, projectId: project.id });
    await client.inspect();
    const key = "gesture-stable-key-0001";

    dropNextResponse = true;
    await expect(client.apply(splitDraft("clip-retry"), { idempotencyKey: key })).rejects.toBeInstanceOf(
      StudioDisconnectedError,
    );

    // The kernel committed it even though the client never heard back.
    expect(kernel.invoke).toBeTruthy();

    // Retrying the same gesture must return the original result, not apply again.
    const retried = await client.apply(splitDraft("clip-retry"), { idempotencyKey: key });
    expect(retried.revision).toBe(1);
  });

  it("surfaces transport failure as a disconnection rather than a silent no-op", async () => {
    const failing: StudioTransport = {
      async invoke() {
        throw new TypeError("fetch failed");
      },
    };
    const client = new StudioClient({ transport: failing, projectId: "project-launch-film" });
    await expect(client.inspect()).rejects.toBeInstanceOf(StudioDisconnectedError);
  });

  it("previews an operation without advancing the revision", async () => {
    const { client } = createClient();
    await client.inspect();
    const preview = await client.plan(splitDraft("clip-preview"));
    expect(preview.diff.length).toBeGreaterThan(0);
    const state = await client.inspect();
    expect(state.revision).toBe(0);
  });

  it("undoes an applied operation", async () => {
    const { client } = createClient();
    await client.inspect();
    const applied = await client.apply(splitDraft("clip-undo"));
    expect(applied.undoToken).toBeTruthy();
    const undone = await client.undo(applied.undoToken!);
    expect(undone.revision).toBe(2);
  });

  it("queues a render job", async () => {
    const { client } = createClient();
    await client.inspect();
    const job = await client.queueRender({
      coverAssetId: "asset-product-image",
      presetId: "render-social-portrait",
      outputName: "connected-shell-proof.mp4",
    });
    expect(job.job_id).toBeTruthy();
    expect(job.status).toBe("queued");
  });
});
