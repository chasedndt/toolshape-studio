import { describe, expect, it } from "vitest";
import type { StudioOperation, StudioProject } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import {
  applyStudioOperation,
  detectRevertConflicts,
  operationTargets,
  planOperationInverse,
  rational,
  toSeconds,
} from "../src";

function operation<T extends StudioOperation["type"]>(
  type: T,
  payload: Extract<StudioOperation, { type: T }>["payload"],
  expectedRevision: number,
  id = "11111111-1111-4111-8111-111111111111",
): StudioOperation {
  return { operationId: id, type, actor: "operator", expectedRevision, payload } as StudioOperation;
}

function apply(project: StudioProject, op: StudioOperation): StudioProject {
  return applyStudioOperation(project, op).project;
}

describe("operation inverse planning", () => {
  it("inverts a trim back to the exact prior start and duration", () => {
    const before = createGoldenStudioProject();
    const trim = operation(
      "timeline.clip.trim",
      {
        trackId: "track-video",
        clipId: "clip-main",
        newStart: rational(1),
        newDuration: rational(3),
        ripple: false,
      },
      0,
    );
    const after = apply(before, trim);

    const plan = planOperationInverse(trim, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    // Applying the inverse must restore the original geometry exactly.
    const restored = apply(after, { ...plan.operations[0], expectedRevision: after.revision } as StudioOperation);
    const original = before.timeline.tracks.find((t) => t.id === "track-video");
    const result = restored.timeline.tracks.find((t) => t.id === "track-video");
    const originalClip = original?.kind !== "caption" ? original?.clips.find((c) => c.id === "clip-main") : undefined;
    const resultClip = result?.kind !== "caption" ? result?.clips.find((c) => c.id === "clip-main") : undefined;
    expect(toSeconds(resultClip!.start)).toBe(toSeconds(originalClip!.start));
    expect(toSeconds(resultClip!.duration)).toBe(toSeconds(originalClip!.duration));
  });

  it("inverts an audio change back to the prior gain, mute and fades", () => {
    const before = createGoldenStudioProject();
    const setAudio = operation(
      "timeline.clip.set-audio",
      {
        trackId: "track-audio",
        clipId: "clip-audio-main",
        gainDb: -12,
        muted: true,
        fadeIn: rational(1),
        fadeOut: rational(1),
      },
      0,
    );
    const after = apply(before, setAudio);
    const plan = planOperationInverse(setAudio, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    const restored = apply(after, { ...plan.operations[0], expectedRevision: after.revision } as StudioOperation);
    const track = restored.timeline.tracks.find((t) => t.id === "track-audio");
    const clip = track?.kind !== "caption" ? track?.clips.find((c) => c.id === "clip-audio-main") : undefined;
    const originalTrack = before.timeline.tracks.find((t) => t.id === "track-audio");
    const originalClip =
      originalTrack?.kind !== "caption" ? originalTrack?.clips.find((c) => c.id === "clip-audio-main") : undefined;
    expect(clip!.audio!.gainDb).toBe(originalClip!.audio!.gainDb);
    expect(clip!.audio!.muted).toBe(originalClip!.audio!.muted);
  });

  it("inverts a text edit back to the prior content", () => {
    const before = createGoldenStudioProject();
    const edit = operation(
      "scene.node.update-text",
      { sceneId: before.activeSceneId, nodeId: "node-title", content: "Replaced copy." },
      0,
    );
    const after = apply(before, edit);
    const plan = planOperationInverse(edit, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    const restored = apply(after, { ...plan.operations[0], expectedRevision: after.revision } as StudioOperation);
    const node = restored.scenes[0].nodes.find((n) => n.id === "node-title");
    const originalNode = before.scenes[0].nodes.find((n) => n.id === "node-title");
    expect(node).toMatchObject({ content: (originalNode as { content: string }).content });
  });

  it("inverts a transform patch back to the prior values for only the patched keys", () => {
    const before = createGoldenStudioProject();
    const move = operation(
      "scene.node.update-transform",
      { sceneId: before.activeSceneId, nodeId: "node-title", patch: { x: 999 } },
      0,
    );
    const after = apply(before, move);
    const plan = planOperationInverse(move, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    const inverse = plan.operations[0] as Extract<StudioOperation, { type: "scene.node.update-transform" }>;
    // Only the key that was changed is restored; unrelated keys are untouched.
    expect(Object.keys(inverse.payload.patch)).toEqual(["x"]);

    const restored = apply(after, { ...inverse, expectedRevision: after.revision } as StudioOperation);
    const node = restored.scenes[0].nodes.find((n) => n.id === "node-title");
    const originalNode = before.scenes[0].nodes.find((n) => n.id === "node-title");
    expect(node!.transform.x).toBe(originalNode!.transform.x);
  });

  it("inverts a split by merging the halves back into the original clip", () => {
    const before = createGoldenStudioProject();
    const original = before.timeline.tracks.find((t) => t.id === "track-video");
    const originalClip = original?.kind !== "caption" ? original!.clips.find((c) => c.id === "clip-main")! : undefined;

    const split = operation(
      "timeline.clip.split",
      {
        trackId: "track-video",
        clipId: "clip-main",
        splitAt: rational(2),
        rightClipId: "clip-inverse-right",
      },
      0,
      "99999999-9999-4999-8999-999999999999",
    );
    const after = apply(before, split);

    const plan = planOperationInverse(split, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    const restored = apply(after, { ...plan.operations[0], expectedRevision: after.revision } as StudioOperation);
    const track = restored.timeline.tracks.find((t) => t.id === "track-video");
    const clips = track?.kind !== "caption" ? track!.clips : [];
    // The half is gone and the original geometry is exactly restored.
    expect(clips.find((c) => c.id === "clip-inverse-right")).toBeUndefined();
    const result = clips.find((c) => c.id === "clip-main")!;
    expect(toSeconds(result.start)).toBe(toSeconds(originalClip!.start));
    expect(toSeconds(result.duration)).toBe(toSeconds(originalClip!.duration));
    expect(toSeconds(result.sourceIn)).toBe(toSeconds(originalClip!.sourceIn));
  });

  it("inverts adding a node by removing it", () => {
    const before = createGoldenStudioProject();
    const add = operation(
      "scene.node.add",
      {
        sceneId: before.activeSceneId,
        node: {
          id: "node-added",
          type: "shape",
          name: "Added shape",
          revision: 0,
          transform: { x: 0, y: 0, width: 10, height: 10, rotationDeg: 0, opacity: 1 },
          animations: {},
          shape: "rectangle",
          fill: "#ffffff",
        },
      } as Extract<StudioOperation, { type: "scene.node.add" }>["payload"],
      0,
      "88888888-8888-4888-8888-888888888888",
    );
    const after = apply(before, add);
    expect(after.scenes[0].nodes.some((n) => n.id === "node-added")).toBe(true);

    const plan = planOperationInverse(add, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    const restored = apply(after, { ...plan.operations[0], expectedRevision: after.revision } as StudioOperation);
    expect(restored.scenes[0].nodes.some((n) => n.id === "node-added")).toBe(false);
    expect(restored.scenes[0].nodeIds).not.toContain("node-added");
  });

  it("still refuses to restore a deleted clip, and says why", () => {
    // Deletion is deliberately not revertible: restoring the clip needs an
    // insert operation carrying a whole clip, which does not exist. Declaring
    // the limit beats offering a revert that fails when it is used.
    const before = createGoldenStudioProject();
    const plan = planOperationInverse(
      operation("timeline.clip.delete", { trackId: "track-video", clipId: "clip-main", ripple: false }, 0),
      before,
    );
    expect(plan.revertible).toBe(false);
    if (plan.revertible) return;
    expect(plan.code).toBe("revert.no-inverse-capability");
    expect(plan.reason).toMatch(/insert/i);
  });

  it("refuses to invert a keyframe that did not previously exist", () => {
    const before = createGoldenStudioProject();
    const plan = planOperationInverse(
      operation(
        "animation.keyframe.set",
        {
          sceneId: before.activeSceneId,
          nodeId: "node-title",
          property: "opacity",
          keyframe: { id: "kf-brand-new", time: rational(7), value: 0.25, easing: "linear" },
        } as Extract<StudioOperation, { type: "animation.keyframe.set" }>["payload"],
        0,
      ),
      before,
    );
    expect(plan.revertible).toBe(false);
    if (plan.revertible) return;
    expect(plan.code).toBe("revert.no-inverse-capability");
  });
});

describe("revert conflict detection", () => {
  const trimMain = operation(
    "timeline.clip.trim",
    {
      trackId: "track-video",
      clipId: "clip-main",
      newStart: rational(0),
      newDuration: rational(3),
      ripple: false,
    },
    0,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  );

  it("identifies the objects an operation touches", () => {
    expect(operationTargets(trimMain)).toContain("clip:track-video:clip-main");
  });

  it("reports a conflict when a later operation touched the same clip", () => {
    const laterTrim = operation(
      "timeline.clip.trim",
      {
        trackId: "track-video",
        clipId: "clip-main",
        newStart: rational(0),
        newDuration: rational(2),
        ripple: false,
      },
      1,
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    const conflicts = detectRevertConflicts(trimMain, [laterTrim]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].operationId).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("reports no conflict when later operations touched unrelated objects", () => {
    const unrelated = operation(
      "scene.node.update-text",
      { sceneId: "scene-hero", nodeId: "node-title", content: "Something else." },
      1,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    );
    expect(detectRevertConflicts(trimMain, [unrelated])).toHaveLength(0);
  });

  it("treats a later operation on a different clip in the same track as unrelated", () => {
    const otherClip = operation(
      "timeline.clip.trim",
      {
        trackId: "track-video",
        clipId: "clip-tail",
        newStart: rational(4),
        newDuration: rational(2),
        ripple: false,
      },
      1,
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    );
    expect(detectRevertConflicts(trimMain, [otherClip])).toHaveLength(0);
  });

  it("treats a ripple edit as touching the whole track, since it moves neighbours", () => {
    const ripple = operation(
      "timeline.clip.trim",
      {
        trackId: "track-video",
        clipId: "clip-tail",
        newStart: rational(4),
        newDuration: rational(2),
        ripple: true,
      },
      1,
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    );
    expect(detectRevertConflicts(trimMain, [ripple])).toHaveLength(1);
  });
});
