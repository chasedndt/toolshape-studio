import { describe, expect, it } from "vitest";
import type { StudioOperation, StudioProject, VideoTrack } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { applyStudioOperation, planOperationInverse, rational } from "../src";

/**
 * A transition belongs to the boundary between two clips rather than to either
 * of them. That is why it lives on the track, and why deleting a clip takes its
 * transitions with it — the alternative is the surviving clip holding half a
 * transition to something that no longer exists.
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

function track(project: StudioProject): VideoTrack {
  return project.timeline.tracks.find((candidate) => candidate.id === "track-video") as VideoTrack;
}

/** A project with two adjacent clips, which a transition needs. */
function split(): StudioProject {
  return apply(
    createGoldenStudioProject(),
    operation(
      "timeline.clip.split",
      { trackId: "track-video", clipId: "clip-main", splitAt: rational(4), rightClipId: "clip-tail" },
      0,
    ),
  );
}

const CROSSFADE = {
  id: "transition-1",
  kind: "crossfade" as const,
  fromClipId: "clip-main",
  toClipId: "clip-tail",
  duration: rational(1),
  revision: 0,
};

describe("timeline.transition.set", () => {
  it("adds a transition between two adjacent clips", () => {
    const after = apply(split(), operation("timeline.transition.set", { trackId: "track-video", transition: CROSSFADE }, 1));
    expect(track(after).transitions).toHaveLength(1);
    expect(track(after).transitions![0].kind).toBe("crossfade");
  });

  it("replaces rather than duplicates a transition on the same boundary", () => {
    let project = apply(split(), operation("timeline.transition.set", { trackId: "track-video", transition: CROSSFADE }, 1));
    project = apply(
      project,
      operation(
        "timeline.transition.set",
        { trackId: "track-video", transition: { ...CROSSFADE, id: "transition-2", kind: "fade-to-black" } },
        2,
      ),
    );
    expect(track(project).transitions).toHaveLength(1);
    expect(track(project).transitions![0].kind).toBe("fade-to-black");
  });

  it("refuses clips that are not adjacent", () => {
    // Two clips with a gap have nothing to cross-fade through.
    const moved = apply(
      split(),
      operation("timeline.clip.move", { trackId: "track-video", clipId: "clip-tail", newStart: rational(6), ripple: false }, 1),
    );
    expect(() =>
      apply(moved, operation("timeline.transition.set", { trackId: "track-video", transition: CROSSFADE }, 2)),
    ).toThrow(/adjacent/i);
  });

  it("refuses a transition longer than either clip it joins", () => {
    // It consumes tail and head, so a longer transition would eat a whole clip.
    expect(() =>
      apply(
        split(),
        operation(
          "timeline.transition.set",
          { trackId: "track-video", transition: { ...CROSSFADE, duration: rational(30) } },
          1,
        ),
      ),
    ).toThrow(/longer than/i);
  });

  it("refuses a zero or negative duration", () => {
    expect(() =>
      apply(
        split(),
        operation(
          "timeline.transition.set",
          { trackId: "track-video", transition: { ...CROSSFADE, duration: rational(0) } },
          1,
        ),
      ),
    ).toThrow(/positive/i);
  });
});

describe("transitions and clip lifetime", () => {
  it("removes a transition when one of its clips is deleted", () => {
    let project = apply(split(), operation("timeline.transition.set", { trackId: "track-video", transition: CROSSFADE }, 1));
    expect(track(project).transitions).toHaveLength(1);

    project = apply(
      project,
      operation("timeline.clip.delete", { trackId: "track-video", clipId: "clip-tail", ripple: false }, 2),
    );
    // The surviving clip must not be left holding half a transition.
    expect(track(project).transitions).toHaveLength(0);
  });
});

describe("transition revert", () => {
  it("reverts a newly added transition by removing it", () => {
    const before = split();
    const set = operation("timeline.transition.set", { trackId: "track-video", transition: CROSSFADE }, 1);
    const after = apply(before, set);
    const plan = planOperationInverse(set, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    sequence += 1;
    const back = apply(after, {
      ...plan.operations[0],
      operationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      actor: "operator",
      expectedRevision: after.revision,
    } as StudioOperation);
    expect(track(back).transitions).toHaveLength(0);
  });

  it("reverts a replaced transition back to the previous one", () => {
    const before = apply(split(), operation("timeline.transition.set", { trackId: "track-video", transition: CROSSFADE }, 1));
    const replace = operation(
      "timeline.transition.set",
      { trackId: "track-video", transition: { ...CROSSFADE, kind: "dip-to-white" } },
      2,
    );
    const after = apply(before, replace);
    expect(track(after).transitions![0].kind).toBe("dip-to-white");

    const plan = planOperationInverse(replace, before);
    expect(plan.revertible).toBe(true);
    if (!plan.revertible) return;

    sequence += 1;
    const back = apply(after, {
      ...plan.operations[0],
      operationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
      actor: "operator",
      expectedRevision: after.revision,
    } as StudioOperation);
    expect(track(back).transitions![0].kind).toBe("crossfade");
  });
});
