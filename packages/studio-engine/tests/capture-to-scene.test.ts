import { describe, expect, it } from "vitest";
import type { CaptureDocument, StudioOperation, StudioProject } from "@toolshape/studio-domain";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { applyStudioOperation, rational, toSeconds } from "../src";

/**
 * Projecting a capture into the timeline is what closes the capture-to-edit
 * half of the pipeline. The invariant that matters is CAP-7: the projection is
 * lossless in the direction that counts — editing the resulting scene must
 * never invalidate the capture's event tracks, because those tracks are what
 * makes re-deriving a zoom plan possible later.
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

function capture(): CaptureDocument {
  return {
    id: "capture-1",
    revision: 0,
    source: { id: "display-1", kind: "display", label: "Primary display", width: 2560, height: 1440 },
    mediaAssetId: "asset-source-video",
    audioAssetIds: ["asset-source-video"],
    duration: rational(6),
    frameRate: rational(30),
    cursorTrack: [{ time: rational(0), x: 100, y: 100, visible: true }],
    eventTrack: [
      { id: "e1", kind: "click", time: rational(2), x: 800, y: 600 },
      { id: "e2", kind: "click", time: rational(2, 1), x: 820, y: 610 },
    ],
    windowTrack: [
      {
        id: "w1",
        time: rational(0),
        windowId: "win-1",
        application: "Test App",
        bounds: { x: 0, y: 0, width: 2560, height: 1440 },
      },
    ],
    zoomPlan: {
      id: "zoom-1",
      revision: 0,
      derived: true,
      keyframes: [{ id: "k0", time: rational(0), scale: 1, centerX: 0.5, centerY: 0.5, easing: "linear" }],
    },
    backdrop: { fill: { kind: "solid", colour: "#000000" }, paddingPx: 32, cornerRadiusPx: 12, shadowOpacity: 0.3 },
    cursorStyle: { smoothing: 0.6, sizeScale: 1, clickEmphasis: true, motionBlur: false },
    cameraOverlay: null,
    redactions: [],
    transcriptRef: null,
  };
}

function withCapture(): StudioProject {
  const project = createGoldenStudioProject();
  project.captures = [capture()];
  return project;
}

function videoTrack(project: StudioProject) {
  const track = project.timeline.tracks.find((candidate) => candidate.id === "track-capture-1");
  return track && track.kind !== "caption" ? track : undefined;
}

describe("capture.to-scene", () => {
  it("adds a track carrying the capture's media for its full duration", () => {
    const before = withCapture();
    const after = apply(
      before,
      operation("capture.to-scene", { captureId: "capture-1", trackId: "track-capture-1" }, 0),
    );

    const track = videoTrack(after);
    expect(track).toBeDefined();
    expect(track!.clips).toHaveLength(1);
    expect(track!.clips[0].assetId).toBe("asset-source-video");
    expect(toSeconds(track!.clips[0].duration)).toBe(6);
    expect(toSeconds(track!.clips[0].sourceIn)).toBe(0);
  });

  it("leaves the capture's tracks intact so a zoom plan can still be re-derived", () => {
    // CAP-7. The projection must not consume the capture.
    const before = withCapture();
    const after = apply(
      before,
      operation("capture.to-scene", { captureId: "capture-1", trackId: "track-capture-1" }, 0),
    );

    const projected = after.captures.find((candidate) => candidate.id === "capture-1")!;
    expect(projected.eventTrack).toHaveLength(2);
    expect(projected.cursorTrack).toHaveLength(1);
    expect(projected.windowTrack).toHaveLength(1);
    expect(projected.zoomPlan.keyframes).toHaveLength(1);
  });

  it("survives editing the projected clip", () => {
    // Trimming the scene must not reach back into the capture.
    let project = apply(
      withCapture(),
      operation("capture.to-scene", { captureId: "capture-1", trackId: "track-capture-1" }, 0),
    );
    project = apply(
      project,
      operation(
        "timeline.clip.trim",
        {
          trackId: "track-capture-1",
          clipId: videoTrack(project)!.clips[0].id,
          newStart: rational(0),
          newDuration: rational(3),
          ripple: false,
        },
        project.revision,
      ),
    );

    expect(toSeconds(videoTrack(project)!.clips[0].duration)).toBe(3);
    expect(project.captures[0].eventTrack).toHaveLength(2);
    expect(toSeconds(project.captures[0].duration)).toBe(6);
  });

  it("extends the timeline when the capture is longer than it", () => {
    const before = withCapture();
    // Shrink to a timeline shorter than the capture. Existing clips and
    // captions go with it, so the starting project is itself coherent.
    before.timeline.duration = rational(2);
    before.timeline.tracks = before.timeline.tracks.filter((track) => track.kind !== "caption");
    for (const track of before.timeline.tracks) {
      if (track.kind !== "caption") track.clips = track.clips.map((clip) => ({ ...clip, duration: rational(2) }));
    }
    const after = apply(
      before,
      operation("capture.to-scene", { captureId: "capture-1", trackId: "track-capture-1" }, 0),
    );
    // A projection that left the timeline shorter than the clip would produce
    // a project that fails its own validation.
    expect(toSeconds(after.timeline.duration)).toBeGreaterThanOrEqual(6);
  });

  it("clamps to the source when a capture claims more than its media holds", () => {
    // Projecting the longer figure would create a clip reading past the end of
    // its own asset. The projection stays usable; validation reports the
    // capture rather than the scene.
    const before = withCapture();
    before.captures[0].duration = rational(999);
    const after = apply(
      before,
      operation("capture.to-scene", { captureId: "capture-1", trackId: "track-capture-1" }, 0),
    );
    const media = after.assets.find((asset) => asset.id === "asset-source-video")!;
    expect(toSeconds(videoTrack(after)!.clips[0].duration)).toBe(toSeconds(media.duration!));
  });

  it("refuses to project onto a track id that already exists", () => {
    const before = withCapture();
    expect(() =>
      apply(before, operation("capture.to-scene", { captureId: "capture-1", trackId: "track-video" }, 0)),
    ).toThrow(/already/i);
  });

  it("refuses an unknown capture", () => {
    const before = withCapture();
    expect(() =>
      apply(before, operation("capture.to-scene", { captureId: "nope", trackId: "track-new" }, 0)),
    ).toThrow(/unknown capture/i);
  });

  it("refuses a capture whose media is not in the project's assets", () => {
    const before = withCapture();
    before.captures[0].mediaAssetId = "asset-not-imported";
    expect(() =>
      apply(before, operation("capture.to-scene", { captureId: "capture-1", trackId: "track-new" }, 0)),
    ).toThrow(/asset/i);
  });
});
