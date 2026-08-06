import { describe, expect, it } from "vitest";
import type { CaptureDocument } from "@toolshape/studio-domain";
import { rational } from "@toolshape/studio-engine";
import { createCaptureRenderPlan, type CaptureRenderSource } from "../src";

const SOURCE: CaptureRenderSource = { path: "/media/capture.mp4", width: 2560, height: 1440 };

function capture(overrides: Partial<CaptureDocument> = {}): CaptureDocument {
  return {
    id: "capture-1",
    revision: 0,
    source: { id: "display-1", kind: "display", label: "Primary display", width: 2560, height: 1440 },
    mediaAssetId: "asset-capture",
    audioAssetIds: [],
    duration: rational(6),
    frameRate: rational(30),
    cursorTrack: [],
    eventTrack: [],
    windowTrack: [],
    zoomPlan: {
      id: "zoom-1",
      revision: 0,
      derived: true,
      keyframes: [
        { id: "k0", time: rational(0), scale: 1, centerX: 0.5, centerY: 0.5, easing: "ease-in-out" },
        { id: "k1", time: rational(2), scale: 2, centerX: 0.3, centerY: 0.4, easing: "ease-in-out" },
        { id: "k2", time: rational(4), scale: 1, centerX: 0.5, centerY: 0.5, easing: "ease-in-out" },
      ],
    },
    backdrop: { fill: { kind: "solid", colour: "#101014" }, paddingPx: 48, cornerRadiusPx: 12, shadowOpacity: 0.3 },
    cursorStyle: { smoothing: 0.6, sizeScale: 1, clickEmphasis: true, motionBlur: false },
    cameraOverlay: null,
    redactions: [],
    transcriptRef: null,
    ...overrides,
  };
}

function plan(document = capture()) {
  return createCaptureRenderPlan({
    capture: document,
    source: SOURCE,
    outputPath: "/out/capture.mp4",
    width: 1920,
    height: 1080,
    frameRate: 30,
  });
}

describe("capture render plan", () => {
  it("applies a time-varying crop from the zoom plan", () => {
    const graph = plan().args.join(" ");
    expect(graph).toContain("crop=");
    // The crop must vary with time, not be a fixed rectangle.
    expect(graph).toContain("if(lt(t,");
  });

  it("samples the plan rather than handing FFmpeg the raw keyframes", () => {
    // Easing is not linear, so linear interpolation between keyframes would
    // render different motion from the one the editor previewed.
    const result = plan();
    expect(result.zoomSampleCount).toBeGreaterThan(capture().zoomPlan.keyframes.length);
  });

  it("pads the frame with the backdrop colour", () => {
    const graph = plan().args.join(" ");
    expect(graph).toContain("pad=1920:1080");
    expect(graph).toContain("#101014");
  });

  it("leaves room for the recording inside the padding", () => {
    // 1920 - 2*48 = 1824.
    expect(plan().args.join(" ")).toContain("scale=1824:984");
  });

  it("draws redactions before cropping, in source coordinates", () => {
    // After the crop the coordinate space has moved, so a mask applied later
    // would drift away from whatever it was hiding.
    const result = plan(
      capture({
        redactions: [
          {
            id: "r1",
            kind: "region",
            from: rational(1),
            to: rational(3),
            bounds: { x: 100, y: 200, width: 400, height: 300 },
          },
        ],
      }),
    );
    const graph = result.args.join(" ");
    expect(result.redactionCount).toBe(1);
    expect(graph.indexOf("drawbox")).toBeLessThan(graph.indexOf("crop="));
    expect(graph).toContain("x=100:y=200:w=400:h=300");
  });

  it("enables a redaction only over its own time range", () => {
    const graph = plan(
      capture({
        redactions: [
          { id: "r1", kind: "region", from: rational(1), to: rational(3), bounds: { x: 0, y: 0, width: 10, height: 10 } },
        ],
      }),
    ).args.join(" ");
    expect(graph).toContain("between(t,1.000,3.000)");
  });

  it("fills a redaction opaquely rather than blurring it", () => {
    // A blur can sometimes be reversed, and a redaction that only mostly hides
    // something is worse than none because it is trusted.
    const graph = plan(
      capture({
        redactions: [
          { id: "r1", kind: "region", from: rational(0), to: rational(1), bounds: { x: 0, y: 0, width: 10, height: 10 } },
        ],
      }),
    ).args.join(" ");
    expect(graph).toContain("t=fill");
    expect(graph).toContain("black@1.0");
  });

  it("declares an expectation matching the capture", () => {
    const result = plan();
    expect(result.expectation).toMatchObject({ width: 1920, height: 1080, container: "mp4" });
    expect(result.expectation.durationSeconds).toBe(6);
  });

  it("writes to a partial path first", () => {
    const result = plan();
    expect(result.partialOutputPath).not.toBe(result.finalOutputPath);
    expect(result.args.at(-1)).toBe(result.partialOutputPath);
  });
});

describe("capture render plan rejections", () => {
  it("refuses padding that leaves no room for the recording", () => {
    expect(() =>
      createCaptureRenderPlan({
        capture: capture({
          backdrop: { fill: { kind: "solid", colour: "#000000" }, paddingPx: 600, cornerRadiusPx: 0, shadowOpacity: 0 },
        }),
        source: SOURCE,
        outputPath: "/out/capture.mp4",
        width: 1080,
        height: 1080,
        frameRate: 30,
      }),
    ).toThrow(/no room/i);
  });

  it("refuses a colour FFmpeg could not parse", () => {
    expect(() =>
      createCaptureRenderPlan({
        capture: capture({
          backdrop: { fill: { kind: "solid", colour: "red" }, paddingPx: 10, cornerRadiusPx: 0, shadowOpacity: 0 },
        }),
        source: SOURCE,
        outputPath: "/out/capture.mp4",
        width: 1920,
        height: 1080,
        frameRate: 30,
      }),
    ).toThrow(/#rrggbb/i);
  });

  it("refuses odd dimensions", () => {
    expect(() =>
      createCaptureRenderPlan({
        capture: capture(),
        source: SOURCE,
        outputPath: "/out/capture.mp4",
        width: 1921,
        height: 1080,
        frameRate: 30,
      }),
    ).toThrow(/even/i);
  });

  it("refuses a path with a control character", () => {
    expect(() =>
      createCaptureRenderPlan({
        capture: capture(),
        source: { ...SOURCE, path: "/media/bad\nname.mp4" },
        outputPath: "/out/capture.mp4",
        width: 1920,
        height: 1080,
        frameRate: 30,
      }),
    ).toThrow(/control character/i);
  });

  it("refuses a zero-length capture", () => {
    expect(() =>
      createCaptureRenderPlan({
        capture: capture({ duration: rational(0) }),
        source: SOURCE,
        outputPath: "/out/capture.mp4",
        width: 1920,
        height: 1080,
        frameRate: 30,
      }),
    ).toThrow(/positive/i);
  });
});
