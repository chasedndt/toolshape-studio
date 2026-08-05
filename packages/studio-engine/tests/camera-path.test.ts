import { describe, expect, it } from "vitest";
import type { ZoomPlan } from "@toolshape/studio-domain";
import { planCameraPath, rational, sampleZoomAt, smoothCursorPath } from "../src";

/**
 * The camera path turns a zoom plan into concrete framing over time.
 *
 * This is where "crop and reframe to any aspect ratio, with the zoom plan
 * reflowing to match" actually happens — one capture becoming a 16:9 lesson
 * and a 9:16 short without re-deriving anything.
 */

const SOURCE = { width: 2560, height: 1440 };

function plan(keyframes: Array<[number, number, number, number]>): ZoomPlan {
  return {
    id: "zoom-test",
    revision: 0,
    derived: true,
    keyframes: keyframes.map(([time, scale, centerX, centerY], index) => ({
      id: `k-${index}`,
      time: rational(Math.round(time * 1000), 1000),
      scale,
      centerX,
      centerY,
      easing: "linear" as const,
    })),
  };
}

describe("sampling the zoom plan", () => {
  const zoom = plan([
    [0, 1, 0.5, 0.5],
    [2, 2, 0.25, 0.25],
    [4, 1, 0.5, 0.5],
  ]);

  it("returns the exact keyframe value at a keyframe time", () => {
    expect(sampleZoomAt(zoom, 2)).toMatchObject({ scale: 2, centerX: 0.25, centerY: 0.25 });
  });

  it("interpolates between keyframes", () => {
    const midpoint = sampleZoomAt(zoom, 1);
    expect(midpoint.scale).toBeCloseTo(1.5, 5);
    expect(midpoint.centerX).toBeCloseTo(0.375, 5);
  });

  it("holds the first and last values outside the plan's range", () => {
    expect(sampleZoomAt(zoom, -5).scale).toBe(1);
    expect(sampleZoomAt(zoom, 99).scale).toBe(1);
  });

  it("returns an unzoomed frame for an empty plan", () => {
    expect(sampleZoomAt(plan([]), 3)).toMatchObject({ scale: 1, centerX: 0.5, centerY: 0.5 });
  });
});

describe("camera path framing", () => {
  const zoom = plan([
    [0, 1, 0.5, 0.5],
    [1, 2, 0.5, 0.5],
  ]);

  it("frames the whole source when unzoomed and the aspect matches", () => {
    const path = planCameraPath({ zoom, source: SOURCE, output: { width: 1280, height: 720 }, fps: 10, durationSeconds: 1 });
    const first = path[0].crop;
    expect(first).toMatchObject({ x: 0, y: 0, width: SOURCE.width, height: SOURCE.height });
  });

  it("scales the crop by exactly the sampled zoom on every frame", () => {
    // Asserts the invariant rather than one hardcoded frame: at fps 10 over one
    // second the frames run 0.0 to 0.9, so the last one has not yet reached the
    // keyframe at t=1.
    const path = planCameraPath({ zoom, source: SOURCE, output: { width: 1280, height: 720 }, fps: 10, durationSeconds: 1 });
    for (const frame of path) {
      expect(frame.crop.width).toBeCloseTo(SOURCE.width / frame.zoom.scale, 5);
      expect(frame.crop.height).toBeCloseTo(SOURCE.height / frame.zoom.scale, 5);
    }
    // And a frame sampled exactly at the keyframe is a clean halving.
    expect(sampleZoomAt(zoom, 1).scale).toBe(2);
  });

  it("never crops outside the source frame", () => {
    // A region centred near an edge must be pushed inward rather than
    // sampling pixels that do not exist.
    const edge = plan([[0, 3, 0.02, 0.98]]);
    const path = planCameraPath({ zoom: edge, source: SOURCE, output: { width: 1280, height: 720 }, fps: 5, durationSeconds: 1 });
    for (const frame of path) {
      expect(frame.crop.x).toBeGreaterThanOrEqual(0);
      expect(frame.crop.y).toBeGreaterThanOrEqual(0);
      expect(frame.crop.x + frame.crop.width).toBeLessThanOrEqual(SOURCE.width);
      expect(frame.crop.y + frame.crop.height).toBeLessThanOrEqual(SOURCE.height);
    }
  });

  it("emits one entry per frame at the requested rate", () => {
    const path = planCameraPath({ zoom, source: SOURCE, output: { width: 1280, height: 720 }, fps: 10, durationSeconds: 2 });
    expect(path).toHaveLength(20);
  });
});

describe("reframing to a different aspect ratio", () => {
  it("produces a portrait crop for a 9:16 output from a 16:9 source", () => {
    // The headline capture feature: one recording, many platform formats,
    // with the zoom plan reflowing rather than being re-derived.
    const zoom = plan([[0, 1, 0.5, 0.5]]);
    const path = planCameraPath({ zoom, source: SOURCE, output: { width: 1080, height: 1920 }, fps: 2, durationSeconds: 1 });
    const crop = path[0].crop;
    expect(crop.width / crop.height).toBeCloseTo(1080 / 1920, 3);
    // Full height is used, because height is the limiting dimension.
    expect(crop.height).toBe(SOURCE.height);
    expect(crop.width).toBeLessThan(SOURCE.width);
  });

  it("keeps the point of interest centred when reframing", () => {
    const zoom = plan([[0, 1, 0.25, 0.5]]);
    const path = planCameraPath({ zoom, source: SOURCE, output: { width: 1080, height: 1920 }, fps: 2, durationSeconds: 1 });
    const crop = path[0].crop;
    const centre = (crop.x + crop.width / 2) / SOURCE.width;
    expect(centre).toBeCloseTo(0.25, 2);
  });

  it("matches the output aspect exactly at every zoom level", () => {
    const zoom = plan([
      [0, 1, 0.5, 0.5],
      [1, 2.5, 0.4, 0.6],
    ]);
    const path = planCameraPath({ zoom, source: SOURCE, output: { width: 1080, height: 1350 }, fps: 8, durationSeconds: 1 });
    for (const frame of path) {
      expect(frame.crop.width / frame.crop.height).toBeCloseTo(1080 / 1350, 2);
    }
  });
});

describe("cursor smoothing", () => {
  const jittery = [
    { time: rational(0), x: 100, y: 100, visible: true },
    { time: rational(1, 10), x: 140, y: 96, visible: true },
    { time: rational(2, 10), x: 118, y: 104, visible: true },
    { time: rational(3, 10), x: 160, y: 98, visible: true },
    { time: rational(4, 10), x: 200, y: 102, visible: true },
  ];

  it("reduces frame-to-frame jitter", () => {
    const jitter = (samples: typeof jittery) =>
      samples.slice(1).reduce((total, sample, index) => total + Math.abs(sample.x - samples[index].x), 0);
    const smoothed = smoothCursorPath(jittery, { smoothing: 0.8 });
    expect(jitter(smoothed)).toBeLessThan(jitter(jittery));
  });

  it("keeps the same number of samples and their times", () => {
    const smoothed = smoothCursorPath(jittery, { smoothing: 0.5 });
    expect(smoothed).toHaveLength(jittery.length);
    expect(smoothed.map((sample) => sample.time)).toEqual(jittery.map((sample) => sample.time));
  });

  it("returns the path unchanged at zero smoothing", () => {
    expect(smoothCursorPath(jittery, { smoothing: 0 })).toEqual(jittery);
  });

  it("never invents a position outside the recorded range", () => {
    const smoothed = smoothCursorPath(jittery, { smoothing: 1 });
    const xs = jittery.map((sample) => sample.x);
    for (const sample of smoothed) {
      expect(sample.x).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(sample.x).toBeLessThanOrEqual(Math.max(...xs));
    }
  });
});
