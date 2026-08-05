import { describe, expect, it } from "vitest";
import type { StudioOperation } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { rational, toSeconds } from "@toolshape/studio-engine";
import { MemoryStudioRepository, StudioKernel, type OperationEnvelope } from "../src";

let sequence = 0;
function uuid(): string {
  sequence += 1;
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function createKernel() {
  const project = createGoldenStudioProject();
  const repository = new MemoryStudioRepository();
  repository.createProject(project);
  return { kernel: new StudioKernel(repository), projectId: project.id };
}

function envelope(
  projectId: string,
  capability: OperationEnvelope["capability"]["id"],
  input: OperationEnvelope["input"],
  expectedRevision: number | null,
  actorType: "human" | "agent" = "human",
): OperationEnvelope {
  return {
    schema_version: "0.1.0",
    operation_id: uuid(),
    idempotency_key: `key-${uuid()}`,
    trace_id: `trace-${uuid()}`,
    actor: { id: actorType === "agent" ? "hermes-agent" : "operator-1", type: actorType },
    intent: `Exercise ${capability}`,
    capability: { id: capability, version: "0.1.0" },
    target: { resource: `toolshape-studio://projects/${projectId}`, expected_revision: expectedRevision },
    input,
    risk: { level: "low" },
    authorization: { grant_ids: ["studio.*"] },
    execution: { dry_run: false, atomicity: "atomic" },
    retention: { class: "project", content_storage: "local" },
    created_at: new Date().toISOString(),
  };
}

function trimOperation(revision: number, durationSeconds: number, clipId = "clip-main"): StudioOperation {
  return {
    operationId: uuid(),
    type: "timeline.clip.trim",
    actor: "operator",
    expectedRevision: revision,
    payload: {
      trackId: "track-video",
      clipId,
      newStart: rational(0),
      newDuration: rational(durationSeconds),
      ripple: false,
    },
  } as StudioOperation;
}

function textOperation(revision: number, sceneId: string, content: string): StudioOperation {
  return {
    operationId: uuid(),
    type: "scene.node.update-text",
    actor: "operator",
    expectedRevision: revision,
    payload: { sceneId, nodeId: "node-title", content },
  } as StudioOperation;
}

function history(kernel: StudioKernel, projectId: string) {
  return kernel.invoke(envelope(projectId, "studio.project.history", {}, null)).history ?? [];
}

describe("activity history", () => {
  it("records every operation with the actor that made it", () => {
    const { kernel, projectId } = createKernel();
    kernel.invoke(
      envelope(projectId, "studio.project.apply_operations", { operations: [trimOperation(0, 3)] }, 0, "human"),
    );
    const project = createGoldenStudioProject();
    kernel.invoke(
      envelope(
        projectId,
        "studio.project.apply_operations",
        { operations: [textOperation(1, project.activeSceneId, "Agent copy.")] },
        1,
        "agent",
      ),
    );

    const entries = history(kernel, projectId);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ actor_type: "human", revision_before: 0, revision_after: 1 });
    expect(entries[1]).toMatchObject({ actor_type: "agent", revision_before: 1, revision_after: 2 });
    expect(entries[0].operation_types).toEqual(["timeline.clip.trim"]);
    expect(entries[1].operation_types).toEqual(["scene.node.update-text"]);
  });

  it("marks an operation revertible when nothing later touched it", () => {
    const { kernel, projectId } = createKernel();
    kernel.invoke(envelope(projectId, "studio.project.apply_operations", { operations: [trimOperation(0, 3)] }, 0));
    const entries = history(kernel, projectId);
    expect(entries[0].revertible).toBe(true);
  });

  it("marks an operation non-revertible with a reason when its inverse does not exist", () => {
    const { kernel, projectId } = createKernel();
    // Creating a caption is not reversible: there is no caption-removal
    // operation, so the entry declares the limit rather than offering a revert
    // that would fail. This is a genuine vocabulary gap, unlike deletion, which
    // insert now covers.
    kernel.invoke(
      envelope(projectId, "studio.project.apply_operations", {
          operations: [
            {
              operationId: uuid(),
              type: "timeline.caption.upsert",
              actor: "operator",
              expectedRevision: 0,
              payload: {
                trackId: "track-captions",
                segment: {
                  id: "caption-brand-new",
                  start: rational(0),
                  end: rational(1),
                  text: "A caption that did not exist before.",
                  revision: 0,
                },
              },
            } as StudioOperation,
          ],
        }, 0),
    );
    const entries = history(kernel, projectId);
    expect(entries[0].revertible).toBe(false);
    expect(entries[0].revert_blocked_code).toBe("revert.no-inverse-capability");
    expect(entries[0].revert_blocked_reason).toMatch(/removal/i);
  });

  it("marks a split revertible now that merge exists", () => {
    const { kernel, projectId } = createKernel();
    kernel.invoke(
      envelope(
        projectId,
        "studio.project.apply_operations",
        {
          operations: [
            {
              operationId: uuid(),
              type: "timeline.clip.split",
              actor: "operator",
              expectedRevision: 0,
              payload: {
                trackId: "track-video",
                clipId: "clip-main",
                splitAt: rational(2),
                rightClipId: "clip-now-revertible",
              },
            } as StudioOperation,
          ],
        },
        0,
      ),
    );
    const entries = history(kernel, projectId);
    expect(entries[0].revertible).toBe(true);

    // And reverting it actually rejoins the halves.
    const reverted = kernel.invoke(
      envelope(projectId, "studio.operation.revert", { revert_operation_id: entries[0].operation_id }, 1),
    );
    const track = reverted.state.project!.timeline.tracks.find((candidate) => candidate.id === "track-video");
    const clips = track?.kind !== "caption" ? track!.clips : [];
    expect(clips.find((candidate) => candidate.id === "clip-now-revertible")).toBeUndefined();
    expect(toSeconds(clips.find((candidate) => candidate.id === "clip-main")!.duration)).toBe(8);
  });

  it("marks an earlier operation non-revertible once a later one touches the same clip", () => {
    const { kernel, projectId } = createKernel();
    kernel.invoke(envelope(projectId, "studio.project.apply_operations", { operations: [trimOperation(0, 3)] }, 0));
    let entries = history(kernel, projectId);
    expect(entries[0].revertible).toBe(true);

    kernel.invoke(envelope(projectId, "studio.project.apply_operations", { operations: [trimOperation(1, 2)] }, 1));
    entries = history(kernel, projectId);
    expect(entries[0].revertible).toBe(false);
    expect(entries[0].revert_blocked_code).toBe("revert.conflict");
    expect(entries[0].conflicts?.[0].target).toBe("clip:track-video:clip-main");
    // The most recent one is still revertible.
    expect(entries[1].revertible).toBe(true);
  });

  it("leaves unrelated operations revertible", () => {
    const { kernel, projectId } = createKernel();
    const project = createGoldenStudioProject();
    kernel.invoke(envelope(projectId, "studio.project.apply_operations", { operations: [trimOperation(0, 3)] }, 0));
    kernel.invoke(
      envelope(
        projectId,
        "studio.project.apply_operations",
        { operations: [textOperation(1, project.activeSceneId, "Different object.")] },
        1,
      ),
    );
    const entries = history(kernel, projectId);
    expect(entries[0].revertible).toBe(true);
    expect(entries[1].revertible).toBe(true);
  });
});

describe("selective revert", () => {
  it("reverses one operation while keeping a later unrelated one", () => {
    const { kernel, projectId } = createKernel();
    const project = createGoldenStudioProject();
    const original = project.timeline.tracks.find((track) => track.id === "track-video");
    const originalDuration =
      original?.kind !== "caption" ? toSeconds(original!.clips.find((c) => c.id === "clip-main")!.duration) : 0;

    // 1. Trim the clip.
    kernel.invoke(envelope(projectId, "studio.project.apply_operations", { operations: [trimOperation(0, 3)] }, 0));
    // 2. Edit unrelated text.
    kernel.invoke(
      envelope(
        projectId,
        "studio.project.apply_operations",
        { operations: [textOperation(1, project.activeSceneId, "Keep this copy.")] },
        1,
      ),
    );

    const entries = history(kernel, projectId);
    const trimEntry = entries[0];

    // 3. Revert only the trim.
    const reverted = kernel.invoke(
      envelope(projectId, "studio.operation.revert", { revert_operation_id: trimEntry.operation_id }, 2),
    );

    expect(reverted.status).toBe("completed");
    expect(reverted.state.revision_after).toBe(3);

    const after = reverted.state.project!;
    const track = after.timeline.tracks.find((candidate) => candidate.id === "track-video");
    const clip = track?.kind !== "caption" ? track!.clips.find((c) => c.id === "clip-main") : undefined;
    // The trim is undone...
    expect(toSeconds(clip!.duration)).toBe(originalDuration);
    // ...and the later text edit survives.
    const node = after.scenes.find((scene) => scene.id === project.activeSceneId)!.nodes.find((n) => n.id === "node-title");
    expect(node).toMatchObject({ content: "Keep this copy." });
  });

  it("moves history forward rather than rewriting it", () => {
    const { kernel, projectId } = createKernel();
    kernel.invoke(envelope(projectId, "studio.project.apply_operations", { operations: [trimOperation(0, 3)] }, 0));
    const before = history(kernel, projectId);
    kernel.invoke(
      envelope(projectId, "studio.operation.revert", { revert_operation_id: before[0].operation_id }, 1),
    );
    const after = history(kernel, projectId);

    // The original operation is still there; the revert is a new entry.
    expect(after).toHaveLength(2);
    expect(after[0].operation_id).toBe(before[0].operation_id);
    expect(after[1].capability).toBe("studio.operation.revert");
  });

  it("refuses to revert when a later edit touched the same objects", () => {
    const { kernel, projectId } = createKernel();
    kernel.invoke(envelope(projectId, "studio.project.apply_operations", { operations: [trimOperation(0, 3)] }, 0));
    const entries = history(kernel, projectId);
    kernel.invoke(envelope(projectId, "studio.project.apply_operations", { operations: [trimOperation(1, 2)] }, 1));

    expect(() =>
      kernel.invoke(envelope(projectId, "studio.operation.revert", { revert_operation_id: entries[0].operation_id }, 2)),
    ).toThrow(/would discard that work/i);
  });

  it("refuses to revert an operation whose inverse is not expressible", () => {
    const { kernel, projectId } = createKernel();
    kernel.invoke(
      envelope(projectId, "studio.project.apply_operations", {
          operations: [
            {
              operationId: uuid(),
              type: "timeline.caption.upsert",
              actor: "operator",
              expectedRevision: 0,
              payload: {
                trackId: "track-captions",
                segment: {
                  id: "caption-brand-new",
                  start: rational(0),
                  end: rational(1),
                  text: "A caption that did not exist before.",
                  revision: 0,
                },
              },
            } as StudioOperation,
          ],
        }, 0),
    );
    const entries = history(kernel, projectId);
    expect(() =>
      kernel.invoke(envelope(projectId, "studio.operation.revert", { revert_operation_id: entries[0].operation_id }, 1)),
    ).toThrow(/removal/i);
  });

  it("rejects an unknown operation id", () => {
    const { kernel, projectId } = createKernel();
    expect(() =>
      kernel.invoke(envelope(projectId, "studio.operation.revert", { revert_operation_id: "not-a-real-op" }, 0)),
    ).toThrow(/unknown operation/i);
  });
});
