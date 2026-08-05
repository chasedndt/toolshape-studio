import { describe, expect, it } from "vitest";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { applyStudioOperation, rational } from "@toolshape/studio-engine";
import type { StudioOperation, StudioProject } from "@toolshape/studio-domain";
import { createTimelineRenderPlan, type TimelineSource } from "../src";

/**
 * The render path used to loop a single still image and synthesise a sine
 * tone. Everything upstream was real and the export at the end was a
 * placeholder, so nothing a person or an agent edited could actually be
 * produced. These tests pin the shape of a plan that renders the timeline.
 */

const SOURCES: TimelineSource[] = [
  { assetId: "asset-source-video", path: "/media/source-video.mp4", hasAudio: true },
  { assetId: "asset-product-image", path: "/media/product-image.png", hasAudio: false },
];

const PRESET = { width: 1080, height: 1920, frameRate: 30 };

let sequence = 0;
function apply(project: StudioProject, type: StudioOperation["type"], payload: unknown): StudioProject {
  sequence += 1;
  return applyStudioOperation(project, {
    operationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    type,
    actor: "operator",
    expectedRevision: project.revision,
    payload,
  } as StudioOperation).project;
}

function plan(project: StudioProject) {
  return createTimelineRenderPlan({
    project,
    sources: SOURCES,
    outputPath: "/out/render.mp4",
    ...PRESET,
  });
}

describe("timeline render plan", () => {
  it("renders every video clip rather than a single still", () => {
    const project = apply(createGoldenStudioProject(), "timeline.clip.split", {
      trackId: "track-video",
      clipId: "clip-main",
      splitAt: rational(3),
      rightClipId: "clip-tail",
    });
    const result = plan(project);
    const graph = result.args.join(" ");
    // Two segments concatenated, not one image looped.
    expect(result.segments).toHaveLength(2);
    expect(graph).toContain("concat=");
    expect(graph).not.toContain("-loop");
  });

  it("trims each segment to the range its clip reads from the source", () => {
    const project = apply(createGoldenStudioProject(), "timeline.clip.trim", {
      trackId: "track-video",
      clipId: "clip-main",
      newStart: rational(0),
      newDuration: rational(3),
      ripple: false,
    });
    const result = plan(project);
    const segment = result.segments[0];
    expect(segment.sourceInSeconds).toBeCloseTo(0, 3);
    expect(segment.durationSeconds).toBeCloseTo(3, 3);
    expect(result.args.join(" ")).toContain("trim=");
  });

  it("orders segments by timeline position, not by array order", () => {
    let project = apply(createGoldenStudioProject(), "timeline.clip.split", {
      trackId: "track-video",
      clipId: "clip-main",
      splitAt: rational(3),
      rightClipId: "clip-tail",
    });
    project = apply(project, "timeline.clip.reorder", {
      trackId: "track-video",
      clipId: "clip-tail",
      toIndex: 0,
    });
    const result = plan(project);
    expect(result.segments[0].clipId).toBe("clip-tail");
    expect(result.segments[0].startSeconds).toBeLessThan(result.segments[1].startSeconds);
  });

  it("uses the real audio track instead of a synthesised tone", () => {
    const result = plan(createGoldenStudioProject());
    const graph = result.args.join(" ");
    expect(graph).not.toContain("sine=");
    // Trimmed from the project's own audio clip rather than generated.
    expect(graph).toContain("atrim=");
    expect(graph).toContain("aresample=48000");
  });

  it("decodes a source once even when several clips read from it", () => {
    const project = apply(createGoldenStudioProject(), "timeline.clip.split", {
      trackId: "track-video",
      clipId: "clip-main",
      splitAt: rational(3),
      rightClipId: "clip-tail",
    });
    const inputs = plan(project).args.filter((argument) => argument === "-i");
    // Both video segments and the audio clip share one asset.
    expect(inputs).toHaveLength(1);
  });

  it("honours clip gain and silences a muted clip", () => {
    const muted = apply(createGoldenStudioProject(), "timeline.clip.set-audio", {
      trackId: "track-audio",
      clipId: "clip-audio-main",
      gainDb: -6,
      muted: true,
      fadeIn: rational(0),
      fadeOut: rational(0),
    });
    expect(plan(muted).args.join(" ")).toContain("volume=0");

    const quiet = apply(createGoldenStudioProject(), "timeline.clip.set-audio", {
      trackId: "track-audio",
      clipId: "clip-audio-main",
      gainDb: -6,
      muted: false,
      fadeIn: rational(0),
      fadeOut: rational(0),
    });
    expect(plan(quiet).args.join(" ")).toContain("volume=-6dB");
  });

  it("scales and pads to the preset rather than distorting the source", () => {
    const graph = plan(createGoldenStudioProject()).args.join(" ");
    // force_original_aspect_ratio keeps the frame's proportions; pad fills the
    // rest. Without both, a 16:9 source in a 9:16 preset would be squashed.
    expect(graph).toContain("force_original_aspect_ratio=decrease");
    expect(graph).toContain("pad=");
  });

  it("declares an expectation matching the timeline it rendered", () => {
    const result = plan(createGoldenStudioProject());
    expect(result.expectation).toMatchObject({ width: 1080, height: 1920, container: "mp4" });
    expect(result.expectation.durationSeconds).toBeCloseTo(8, 3);
  });

  it("writes to a partial path first so a crash cannot leave a half file in place", () => {
    const result = plan(createGoldenStudioProject());
    expect(result.partialOutputPath).not.toBe(result.finalOutputPath);
    expect(result.args.at(-1)).toBe(result.partialOutputPath);
  });
});

describe("timeline render plan rejections", () => {
  it("refuses a clip whose source asset was not resolved", () => {
    expect(() =>
      createTimelineRenderPlan({
        project: createGoldenStudioProject(),
        sources: [],
        outputPath: "/out/render.mp4",
        ...PRESET,
      }),
    ).toThrow(/unresolved|not resolved|missing/i);
  });

  it("refuses odd dimensions that H.264 cannot encode", () => {
    expect(() =>
      createTimelineRenderPlan({
        project: createGoldenStudioProject(),
        sources: SOURCES,
        outputPath: "/out/render.mp4",
        width: 1081,
        height: 1920,
        frameRate: 30,
      }),
    ).toThrow(/even/i);
  });

  it("refuses a path carrying a control character", () => {
    expect(() =>
      createTimelineRenderPlan({
        project: createGoldenStudioProject(),
        sources: [{ assetId: "asset-source-video", path: "/media/bad\nname.mp4", hasAudio: true }],
        outputPath: "/out/render.mp4",
        ...PRESET,
      }),
    ).toThrow(/control character/i);
  });

  it("refuses a timeline with no video clips", () => {
    const empty = createGoldenStudioProject();
    empty.timeline.tracks = empty.timeline.tracks.filter((track) => track.kind !== "video");
    expect(() =>
      createTimelineRenderPlan({ project: empty, sources: SOURCES, outputPath: "/out/render.mp4", ...PRESET }),
    ).toThrow(/no video/i);
  });
});
