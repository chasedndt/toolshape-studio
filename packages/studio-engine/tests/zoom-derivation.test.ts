import { describe, expect, it } from "vitest";
import type { CaptureEvent, CaptureWindowFocus } from "@toolshape/studio-domain";
import { deriveZoomPlan, rational, toSeconds, type ZoomDerivationConfig } from "../src";

/**
 * The capture pillar's central claim is that "zoom on every click in the
 * settings panel" is a *query over recorded events*, not a vision problem.
 * That is only true if this derivation is a real, deterministic function — so
 * these tests drive it entirely from synthetic event tracks, which is all it
 * needs and all a caller has to supply.
 */

const SOURCE = { width: 2560, height: 1440 };

function click(seconds: number, x: number, y: number, windowId?: string): CaptureEvent {
  return {
    id: `event-${seconds}-${x}-${y}`,
    kind: "click",
    time: rational(Math.round(seconds * 1000), 1000),
    x,
    y,
    ...(windowId ? { windowId } : {}),
  };
}

function focus(windowId: string, bounds: { x: number; y: number; width: number; height: number }): CaptureWindowFocus {
  return {
    id: `focus-${windowId}`,
    time: rational(0),
    windowId,
    application: "Test App",
    bounds,
  };
}

const CONFIG: Partial<ZoomDerivationConfig> = {
  clusterGapSeconds: 1.5,
  clusterRadiusPx: 400,
  minimumHoldSeconds: 0.5,
  settleSeconds: 1,
  targetScale: 2,
  leadInSeconds: 0.4,
  leadOutSeconds: 0.4,
};

describe("zoom derivation is deterministic", () => {
  it("produces byte-identical plans for the same events", () => {
    const events = [click(2, 800, 600), click(2.4, 850, 640), click(2.9, 820, 610)];
    const first = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    const second = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("marks the plan as derived rather than authored", () => {
    const plan = deriveZoomPlan({ events: [click(2, 800, 600)], windows: [], source: SOURCE, config: CONFIG });
    expect(plan.derived).toBe(true);
  });
});

describe("clustering", () => {
  it("treats clicks close in time and space as one region", () => {
    const events = [click(2, 800, 600), click(2.4, 850, 640), click(2.9, 820, 610)];
    const plan = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    // One region: lead-in, hold-in, hold-out, lead-out.
    const zoomed = plan.keyframes.filter((keyframe) => keyframe.scale > 1);
    expect(zoomed.length).toBeGreaterThan(0);
    expect(plan.regions).toHaveLength(1);
  });

  it("separates clicks far apart in space even when close in time", () => {
    // Merging these would frame a region spanning most of the screen, which
    // zooms to almost nothing and defeats the point.
    const events = [
      click(2, 200, 200),
      click(2.3, 230, 220),
      click(3.1, 2300, 1200),
      click(3.4, 2330, 1220),
    ];
    const plan = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    expect(plan.regions).toHaveLength(2);
  });

  it("separates clicks far apart in time even when in the same place", () => {
    const events = [click(2, 800, 600), click(2.3, 820, 610), click(30, 800, 600), click(30.3, 820, 610)];
    const plan = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    expect(plan.regions).toHaveLength(2);
  });

  it("merges two regions closer together than the settle time", () => {
    // Zooming out and straight back in reads as a jitter, so they become one.
    const events = [click(2, 700, 600), click(2.3, 740, 620), click(3.2, 900, 700), click(3.5, 940, 720)];
    const plan = deriveZoomPlan({ events, windows: [], source: SOURCE, config: { ...CONFIG, settleSeconds: 3 } });
    expect(plan.regions).toHaveLength(1);
  });
});

describe("overlapping activity", () => {
  it("keeps the denser region when two are active over the same moments", () => {
    // A frame cannot be zoomed to two places at once, so simultaneous activity
    // in distant places is ambiguous. The denser region wins rather than the
    // derivation inventing a framing that covers both.
    const events = [
      click(2, 200, 200),
      click(2.2, 230, 220),
      click(2.4, 210, 210),
      click(2.1, 2300, 1200),
      click(2.3, 2330, 1220),
    ];
    const plan = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    expect(plan.regions).toHaveLength(1);
    expect(plan.regions[0].eventCount).toBe(3);
  });
});

describe("window bounding", () => {
  it("never extends a zoom region beyond the window the events occurred in", () => {
    // A click near a window edge must not produce a frame that is half
    // application and half desktop.
    const windowBounds = { x: 1000, y: 500, width: 600, height: 400 };
    const events = [click(2, 1020, 520, "win-1"), click(2.4, 1040, 540, "win-1")];
    const plan = deriveZoomPlan({
      events,
      windows: [focus("win-1", windowBounds)],
      source: SOURCE,
      config: CONFIG,
    });

    const region = plan.regions[0];
    expect(region.bounds.x).toBeGreaterThanOrEqual(windowBounds.x);
    expect(region.bounds.y).toBeGreaterThanOrEqual(windowBounds.y);
    expect(region.bounds.x + region.bounds.width).toBeLessThanOrEqual(windowBounds.x + windowBounds.width);
    expect(region.bounds.y + region.bounds.height).toBeLessThanOrEqual(windowBounds.y + windowBounds.height);
  });

  it("falls back to the source frame when no window is known", () => {
    const events = [click(2, 800, 600), click(2.4, 840, 640)];
    const plan = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    const region = plan.regions[0];
    expect(region.bounds.x).toBeGreaterThanOrEqual(0);
    expect(region.bounds.x + region.bounds.width).toBeLessThanOrEqual(SOURCE.width);
  });
});

describe("idle and noise suppression", () => {
  it("produces no keyframes at all for an empty event track", () => {
    const plan = deriveZoomPlan({ events: [], windows: [], source: SOURCE, config: CONFIG });
    expect(plan.keyframes).toHaveLength(0);
    expect(plan.regions).toHaveLength(0);
  });

  it("ignores a single isolated click too brief to be worth a zoom", () => {
    // One stray click should not cause a zoom that arrives and leaves before a
    // viewer registers it.
    const plan = deriveZoomPlan({
      events: [click(5, 800, 600)],
      windows: [],
      source: SOURCE,
      config: { ...CONFIG, minimumHoldSeconds: 1, minimumEventsPerRegion: 2 },
    });
    expect(plan.regions).toHaveLength(0);
    expect(plan.keyframes).toHaveLength(0);
  });

  it("emits nothing during a long idle stretch between regions", () => {
    const events = [click(2, 700, 600), click(2.4, 740, 620), click(60, 700, 600), click(60.4, 740, 620)];
    const plan = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    expect(plan.regions).toHaveLength(2);
    // Nothing is emitted in the gap; the frame simply sits unzoomed.
    const between = plan.keyframes.filter((keyframe) => {
      const at = toSeconds(keyframe.time);
      return at > 5 && at < 55;
    });
    expect(between).toHaveLength(0);
  });
});

describe("keyframe shape", () => {
  it("returns to scale 1 after a region so the frame does not stay zoomed", () => {
    const events = [click(2, 800, 600), click(2.5, 840, 640)];
    const plan = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    expect(plan.keyframes[0].scale).toBe(1);
    expect(plan.keyframes.at(-1)!.scale).toBe(1);
  });

  it("orders keyframes strictly by time", () => {
    const events = [click(2, 700, 600), click(2.4, 740, 620), click(20, 1800, 900), click(20.4, 1840, 920)];
    const plan = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    const times = plan.keyframes.map((keyframe) => toSeconds(keyframe.time));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("centres on the events, normalised to the source frame", () => {
    const events = [click(4, 1280, 720), click(4.4, 1280, 720)];
    const plan = deriveZoomPlan({ events, windows: [], source: SOURCE, config: CONFIG });
    const held = plan.keyframes.find((keyframe) => keyframe.scale > 1)!;
    // Dead centre of a 2560x1440 frame.
    expect(held.centerX).toBeCloseTo(0.5, 2);
    expect(held.centerY).toBeCloseTo(0.5, 2);
  });
});

describe("rate limiting", () => {
  it("rejects a plan that would zoom faster than the configured limit", () => {
    // Rejected rather than silently smoothed: smoothing would make the render
    // differ from the plan the agent previewed and approved.
    const events = [click(2, 700, 600), click(2.2, 720, 610)];
    expect(() =>
      deriveZoomPlan({
        events,
        windows: [],
        source: SOURCE,
        config: { ...CONFIG, leadInSeconds: 0.05, targetScale: 4, maximumScaleChangePerSecond: 1 },
      }),
    ).toThrow(/rate|faster/i);
  });

  it("accepts a plan within the limit", () => {
    const events = [click(2, 700, 600), click(2.5, 720, 610)];
    expect(() =>
      deriveZoomPlan({
        events,
        windows: [],
        source: SOURCE,
        config: { ...CONFIG, leadInSeconds: 1, leadOutSeconds: 1, targetScale: 2, maximumScaleChangePerSecond: 2 },
      }),
    ).not.toThrow();
  });
});
