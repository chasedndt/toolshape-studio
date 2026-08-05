import { describe, expect, it } from "vitest";
import type { StudioOperation, StudioProject } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { applyStudioOperation, planOperationInverse, rational, toSeconds } from "../src";

/**
 * Every operation should be revertible unless reversing it genuinely needs
 * information that no longer exists.
 *
 * The inverse planner receives the project as it was immediately before the
 * operation ran, so anything visible in that snapshot is recoverable — a
 * merge's split point, a reorder's previous ordering, and a removed node are
 * all still there. Declaring those non-revertible was over-conservative, and
 * the stated reasons were wrong: they claimed the operation "did not record"
 * something the snapshot holds.
 */

let sequence = 0;
function operation<T extends StudioOperation["type"]>(
  type: T,
  payload: Extract<StudioOperation, { type: T }>["payload"],
  expectedRevision: number,
): StudioOperation {
  sequence += 1;
  return {
    operationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    type,
    actor: "operator",
    expectedRevision,
    payload,
  } as StudioOperation;
}

function apply(project: StudioProject, op: StudioOperation): StudioProject {
  return applyStudioOperation(project, op).project;
}

function clips(project: StudioProject) {
  const track = project.timeline.tracks.find((candidate) => candidate.id === "track-video");
  return track?.kind !== "caption" ? track!.clips : [];
}

/** Applies every operation an inverse plan produced, in order. */
function revert(project: StudioProject, plan: ReturnType<typeof planOperationInverse>): StudioProject {
  if (!plan.revertible) throw new Error(`Not revertible: ${plan.reason}`);
  let working = project;
  for (const draft of plan.operations) {
    working = apply(working, { ...draft, operationId: `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`, actor: "operator", expectedRevision: working.revision } as StudioOperation);
  }
  return working;
}

describe("merge is revertible", () => {
  it("splits the clip back at the boundary the snapshot still shows", () => {
    const before = createGoldenStudioProject();
    const split = apply(
      before,
      operation("timeline.clip.split", { trackId: "track-video", clipId: "clip-main", splitAt: rational(3), rightClipId: "clip-b" }, 0),
    );
    const merge = operation("timeline.clip.merge", { trackId: "track-video", leftClipId: "clip-main", rightClipId: "clip-b" }, 1);
    const merged = apply(split, merge);
    expect(clips(merged)).toHaveLength(1);

    const restored = revert(merged, planOperationInverse(merge, split));
    const result = clips(restored);
    expect(result).toHaveLength(2);
    // Both halves are back with their original geometry.
    expect(toSeconds(result.find((c) => c.id === "clip-main")!.duration)).toBe(3);
    expect(toSeconds(result.find((c) => c.id === "clip-b")!.start)).toBe(3);
  });
});

describe("reorder is revertible", () => {
  it("restores the previous ordering from the snapshot", () => {
    const before = createGoldenStudioProject();
    const split = apply(
      before,
      operation("timeline.clip.split", { trackId: "track-video", clipId: "clip-main", splitAt: rational(3), rightClipId: "clip-b" }, 0),
    );
    const originalOrder = clips(split).map((c) => c.id);

    const reorder = operation("timeline.clip.reorder", { trackId: "track-video", clipId: "clip-b", toIndex: 0 }, 1);
    const reordered = apply(split, reorder);
    expect(clips(reordered).map((c) => c.id)).not.toEqual(originalOrder);

    const restored = revert(reordered, planOperationInverse(reorder, split));
    expect(clips(restored).map((c) => c.id)).toEqual(originalOrder);
  });
});

describe("node removal is revertible", () => {
  it("adds the node back exactly as it was", () => {
    const before = createGoldenStudioProject();
    const original = before.scenes[0].nodes.find((n) => n.id === "node-title")!;
    const remove = operation("scene.node.remove", { sceneId: before.activeSceneId, nodeId: "node-title" }, 0);
    const removed = apply(before, remove);
    expect(removed.scenes[0].nodes.some((n) => n.id === "node-title")).toBe(false);

    const restored = revert(removed, planOperationInverse(remove, before));
    const node = restored.scenes[0].nodes.find((n) => n.id === "node-title");
    expect(node).toBeDefined();
    expect(node).toMatchObject({ name: original.name, type: original.type });
    expect(restored.scenes[0].nodeIds).toContain("node-title");
  });
});

describe("deletion is revertible once a clip can be inserted", () => {
  it("puts the deleted clip back with its exact source range", () => {
    const before = createGoldenStudioProject();
    const split = apply(
      before,
      operation("timeline.clip.split", { trackId: "track-video", clipId: "clip-main", splitAt: rational(3), rightClipId: "clip-b" }, 0),
    );
    const original = clips(split).find((c) => c.id === "clip-b")!;

    const del = operation("timeline.clip.delete", { trackId: "track-video", clipId: "clip-b", ripple: false }, 1);
    const deleted = apply(split, del);
    expect(clips(deleted).some((c) => c.id === "clip-b")).toBe(false);

    const restored = revert(deleted, planOperationInverse(del, split));
    const back = clips(restored).find((c) => c.id === "clip-b")!;
    expect(toSeconds(back.start)).toBe(toSeconds(original.start));
    expect(toSeconds(back.duration)).toBe(toSeconds(original.duration));
    expect(toSeconds(back.sourceIn)).toBe(toSeconds(original.sourceIn));
    expect(back.assetId).toBe(original.assetId);
  });

  it("refuses to insert a clip whose id already exists", () => {
    const before = createGoldenStudioProject();
    const existing = clips(before)[0];
    expect(() =>
      apply(
        before,
        operation("timeline.clip.insert", { trackId: "track-video", clip: structuredClone(existing), ripple: false }, 0),
      ),
    ).toThrow(/already/i);
  });
});

describe("every operation now declares a truthful revert status", () => {
  it("leaves no operation blocked for a reason the snapshot disproves", () => {
    // A guard against the mistake this file exists to correct: claiming an
    // operation "did not record" something that is plainly in the snapshot.
    const before = createGoldenStudioProject();
    const split = apply(
      before,
      operation("timeline.clip.split", { trackId: "track-video", clipId: "clip-main", splitAt: rational(3), rightClipId: "clip-b" }, 0),
    );

    const candidates: Array<[StudioProject, StudioOperation]> = [
      [split, operation("timeline.clip.merge", { trackId: "track-video", leftClipId: "clip-main", rightClipId: "clip-b" }, 1)],
      [split, operation("timeline.clip.reorder", { trackId: "track-video", clipId: "clip-b", toIndex: 0 }, 1)],
      [split, operation("timeline.clip.delete", { trackId: "track-video", clipId: "clip-b", ripple: false }, 1)],
      [before, operation("scene.node.remove", { sceneId: before.activeSceneId, nodeId: "node-title" }, 0)],
    ];

    for (const [snapshot, op] of candidates) {
      const plan = planOperationInverse(op, snapshot);
      expect(plan.revertible, `${op.type} should be revertible from its snapshot`).toBe(true);
    }
  });
});
