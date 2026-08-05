import { describe, expect, it } from "vitest";
import type { StudioOperation, StudioProject, VideoTrack } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { applyStudioOperation, rational, toSeconds, validateStudioProject } from "../src";

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

function videoTrack(project: StudioProject): VideoTrack {
  return project.timeline.tracks.find((track) => track.id === "track-video") as VideoTrack;
}

function clip(project: StudioProject, clipId: string) {
  return videoTrack(project).clips.find((candidate) => candidate.id === clipId);
}

describe("timeline.clip.move", () => {
  it("repositions a clip without changing what it reads from the source", () => {
    const before = createGoldenStudioProject();
    const original = clip(before, "clip-main")!;
    const after = apply(
      before,
      operation("timeline.clip.move", { trackId: "track-video", clipId: "clip-main", newStart: rational(1), ripple: false }, 0),
    );
    const moved = clip(after, "clip-main")!;
    expect(toSeconds(moved.start)).toBe(1);
    // A move is not a trim: the source range is untouched.
    expect(toSeconds(moved.sourceIn)).toBe(toSeconds(original.sourceIn));
    expect(toSeconds(moved.duration)).toBe(toSeconds(original.duration));
  });

  it("allows a move past the timeline end but reports it as a warning", () => {
    // Consistent with trim, which also permits this. The timeline duration is
    // a project property that can be extended, so overrunning it is a
    // correctable condition rather than an invalid state — and an agent gets
    // the same answer from both operations instead of one throwing.
    const before = createGoldenStudioProject();
    const after = apply(
      before,
      operation("timeline.clip.move", { trackId: "track-video", clipId: "clip-main", newStart: rational(100), ripple: false }, 0),
    );
    const issues = validateStudioProject(after);
    expect(issues.some((issue) => issue.code === "timeline.clip-after-end" && issue.severity === "warning")).toBe(true);
    expect(issues.some((issue) => issue.severity === "error")).toBe(false);
  });

  it("refuses a negative start", () => {
    const before = createGoldenStudioProject();
    expect(() =>
      apply(
        before,
        operation("timeline.clip.move", { trackId: "track-video", clipId: "clip-main", newStart: rational(-1), ripple: false }, 0),
      ),
    ).toThrow(/before the start/i);
  });
});

describe("timeline.clip.set-speed", () => {
  it("halves the duration at double speed using exact arithmetic", () => {
    const before = createGoldenStudioProject();
    const original = toSeconds(clip(before, "clip-main")!.duration);
    const after = apply(
      before,
      operation("timeline.clip.set-speed", { trackId: "track-video", clipId: "clip-main", speed: rational(2), ripple: false }, 0),
    );
    expect(toSeconds(clip(after, "clip-main")!.duration)).toBe(original / 2);
  });

  it("round-trips exactly through 2x then 1/2x", () => {
    // The reason speed is rational rather than a float: repeated changes must
    // not accumulate error.
    const before = createGoldenStudioProject();
    const original = clip(before, "clip-main")!.duration;
    const doubled = apply(
      before,
      operation("timeline.clip.set-speed", { trackId: "track-video", clipId: "clip-main", speed: rational(2), ripple: false }, 0),
    );
    const restored = apply(
      doubled,
      operation("timeline.clip.set-speed", { trackId: "track-video", clipId: "clip-main", speed: rational(1, 2), ripple: false }, 1),
    );
    const result = clip(restored, "clip-main")!.duration;
    expect(result.numerator / result.denominator).toBe(original.numerator / original.denominator);
  });

  it("refuses a zero or negative speed", () => {
    const before = createGoldenStudioProject();
    for (const speed of [rational(0), rational(-2)]) {
      expect(() =>
        apply(before, operation("timeline.clip.set-speed", { trackId: "track-video", clipId: "clip-main", speed, ripple: false }, 0)),
      ).toThrow(/positive/i);
    }
  });
});

describe("timeline.clip.duplicate", () => {
  it("copies the source range rather than the media", () => {
    const before = createGoldenStudioProject();
    const original = clip(before, "clip-main")!;
    const after = apply(
      before,
      operation(
        "timeline.clip.duplicate",
        { trackId: "track-video", clipId: "clip-main", newClipId: "clip-copy", at: rational(4) },
        0,
      ),
    );
    const copy = clip(after, "clip-copy")!;
    expect(copy.assetId).toBe(original.assetId);
    expect(toSeconds(copy.sourceIn)).toBe(toSeconds(original.sourceIn));
    expect(toSeconds(copy.duration)).toBe(toSeconds(original.duration));
    expect(toSeconds(copy.start)).toBe(4);
    // The asset library is untouched: duplication references, it does not copy.
    expect(after.assets).toHaveLength(before.assets.length);
  });

  it("refuses a duplicate id that already exists", () => {
    const before = createGoldenStudioProject();
    expect(() =>
      apply(
        before,
        operation(
          "timeline.clip.duplicate",
          { trackId: "track-video", clipId: "clip-main", newClipId: "clip-main", at: rational(4) },
          0,
        ),
      ),
    ).toThrow(/already/i);
  });
});

describe("timeline.clip.delete", () => {
  it("removes a clip and leaves the gap when not rippling", () => {
    const before = createGoldenStudioProject();
    const split = apply(
      before,
      operation(
        "timeline.clip.split",
        { trackId: "track-video", clipId: "clip-main", splitAt: rational(2), rightClipId: "clip-right" },
        0,
      ),
    );
    const rightStart = toSeconds(clip(split, "clip-right")!.start);
    const after = apply(
      split,
      operation("timeline.clip.delete", { trackId: "track-video", clipId: "clip-main", ripple: false }, 1),
    );
    expect(clip(after, "clip-main")).toBeUndefined();
    expect(toSeconds(clip(after, "clip-right")!.start)).toBe(rightStart);
  });

  it("closes the gap when rippling", () => {
    const before = createGoldenStudioProject();
    const split = apply(
      before,
      operation(
        "timeline.clip.split",
        { trackId: "track-video", clipId: "clip-main", splitAt: rational(2), rightClipId: "clip-right" },
        0,
      ),
    );
    const after = apply(
      split,
      operation("timeline.clip.delete", { trackId: "track-video", clipId: "clip-main", ripple: true }, 1),
    );
    expect(toSeconds(clip(after, "clip-right")!.start)).toBe(0);
  });

  it("refuses to delete the last clip on a track", () => {
    const before = createGoldenStudioProject();
    expect(() =>
      apply(before, operation("timeline.clip.delete", { trackId: "track-video", clipId: "clip-main", ripple: false }, 0)),
    ).toThrow(/last clip/i);
  });
});

describe("timeline.clip.merge", () => {
  it("rejoins the two halves a split produced", () => {
    const before = createGoldenStudioProject();
    const original = clip(before, "clip-main")!;
    const split = apply(
      before,
      operation(
        "timeline.clip.split",
        { trackId: "track-video", clipId: "clip-main", splitAt: rational(2), rightClipId: "clip-right" },
        0,
      ),
    );
    const merged = apply(
      split,
      operation("timeline.clip.merge", { trackId: "track-video", leftClipId: "clip-main", rightClipId: "clip-right" }, 1),
    );
    const result = clip(merged, "clip-main")!;
    expect(clip(merged, "clip-right")).toBeUndefined();
    expect(toSeconds(result.start)).toBe(toSeconds(original.start));
    expect(toSeconds(result.duration)).toBe(toSeconds(original.duration));
    expect(toSeconds(result.sourceIn)).toBe(toSeconds(original.sourceIn));
  });

  it("refuses to merge clips that are not contiguous on the timeline", () => {
    const before = createGoldenStudioProject();
    const split = apply(
      before,
      operation(
        "timeline.clip.split",
        { trackId: "track-video", clipId: "clip-main", splitAt: rational(2), rightClipId: "clip-right" },
        0,
      ),
    );
    const moved = apply(
      split,
      operation("timeline.clip.move", { trackId: "track-video", clipId: "clip-right", newStart: rational(5), ripple: false }, 1),
    );
    expect(() =>
      apply(moved, operation("timeline.clip.merge", { trackId: "track-video", leftClipId: "clip-main", rightClipId: "clip-right" }, 2)),
    ).toThrow(/adjacent|contiguous/i);
  });

  it("refuses to merge clips that read from different assets", () => {
    const before = createGoldenStudioProject();
    const duplicated = apply(
      before,
      operation(
        "timeline.clip.duplicate",
        { trackId: "track-video", clipId: "clip-main", newClipId: "clip-second", at: rational(4) },
        0,
      ),
    );
    // Same asset, but not contiguous in the source — merging would silently
    // invent footage that was never there.
    expect(() =>
      apply(
        duplicated,
        operation("timeline.clip.merge", { trackId: "track-video", leftClipId: "clip-main", rightClipId: "clip-second" }, 1),
      ),
    ).toThrow();
  });
});

describe("timeline.clip.reorder", () => {
  it("re-packs clips end to end in the new order", () => {
    const before = createGoldenStudioProject();
    const split = apply(
      before,
      operation(
        "timeline.clip.split",
        { trackId: "track-video", clipId: "clip-main", splitAt: rational(2), rightClipId: "clip-right" },
        0,
      ),
    );
    const rightDuration = toSeconds(clip(split, "clip-right")!.duration);
    const after = apply(
      split,
      operation("timeline.clip.reorder", { trackId: "track-video", clipId: "clip-right", toIndex: 0 }, 1),
    );
    const track = videoTrack(after);
    expect(track.clips[0].id).toBe("clip-right");
    expect(toSeconds(track.clips[0].start)).toBe(0);
    // Re-packed, so the second clip begins exactly where the first ends.
    expect(toSeconds(track.clips[1].start)).toBe(rightDuration);
  });

  it("refuses an index outside the track", () => {
    const before = createGoldenStudioProject();
    expect(() =>
      apply(before, operation("timeline.clip.reorder", { trackId: "track-video", clipId: "clip-main", toIndex: 9 }, 0)),
    ).toThrow(/range/i);
  });
});

describe("scene.node.remove", () => {
  it("removes a node from the scene", () => {
    const before = createGoldenStudioProject();
    const sceneId = before.activeSceneId;
    const after = apply(before, operation("scene.node.remove", { sceneId, nodeId: "node-title" }, 0));
    expect(after.scenes[0].nodes.find((node) => node.id === "node-title")).toBeUndefined();
  });

  it("refuses to remove a node that does not exist", () => {
    const before = createGoldenStudioProject();
    expect(() =>
      apply(before, operation("scene.node.remove", { sceneId: before.activeSceneId, nodeId: "node-missing" }, 0)),
    ).toThrow(/unknown/i);
  });
});
