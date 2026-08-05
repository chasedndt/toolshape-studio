import { describe, expect, it } from "vitest";
import { rational } from "@toolshape/studio-engine";
import {
  buildTimelineTicks,
  clampTimelineZoom,
  computeTrimCandidate,
  formatTimecode,
  resolveTimelineKeyboardCommand,
  secondsFromTimelinePointer,
  stepPlayhead,
} from "./timeline-interaction";

const frameRate = rational(30);

describe("timeline view geometry", () => {
  it("maps and frame-snaps pointer positions without leaking outside the duration", () => {
    expect(secondsFromTimelinePointer(350, 100, 1_000, 8, frameRate)).toBeCloseTo(2);
    expect(secondsFromTimelinePointer(-500, 100, 1_000, 8, frameRate)).toBe(0);
    expect(secondsFromTimelinePointer(2_000, 100, 1_000, 8, frameRate)).toBe(8);
  });

  it("builds a denser labelled ruler as zoom increases", () => {
    const overview = buildTimelineTicks(8, 1);
    const detailed = buildTimelineTicks(8, 4);
    expect(overview.filter((tick) => tick.major)).toHaveLength(9);
    expect(detailed.filter((tick) => tick.major).length).toBeGreaterThan(
      overview.filter((tick) => tick.major).length,
    );
    expect(detailed.at(-1)).toMatchObject({ seconds: 8, label: "0:08.00", major: true });
  });

  it("formats frame-accurate timecode and clamps playhead steps", () => {
    expect(formatTimecode(2.4, frameRate)).toBe("00:00:02:12");
    expect(stepPlayhead(0, -1, false, 8, frameRate)).toBe(0);
    expect(stepPlayhead(2.4, 1, false, 8, frameRate)).toBeCloseTo(73 / 30);
    expect(stepPlayhead(2.4, 1, true, 8, frameRate)).toBeCloseTo(3.4);
    expect(clampTimelineZoom(99)).toBe(4);
  });
});

describe("timeline trim and keyboard intent", () => {
  it("computes source-safe frame-snapped trim candidates for both handles", () => {
    const left = computeTrimCandidate({
      edge: "start",
      requestedSeconds: 3 / 2,
      clipStart: rational(2),
      clipDuration: rational(4),
      sourceIn: rational(2),
      sourceDuration: rational(8),
      timelineDuration: rational(10),
      frameRate,
    });
    expect(left).toEqual({ newStart: rational(3, 2), newDuration: rational(9, 2) });

    const right = computeTrimCandidate({
      edge: "end",
      requestedSeconds: 20,
      clipStart: rational(2),
      clipDuration: rational(4),
      sourceIn: rational(2),
      sourceDuration: rational(8),
      timelineDuration: rational(20),
      frameRate,
    });
    expect(right).toEqual({ newStart: rational(2), newDuration: rational(6) });
  });

  it("maps professional timeline shortcuts to semantic intent", () => {
    expect(resolveTimelineKeyboardCommand("ArrowLeft", false)).toEqual({ type: "playhead.nudge", direction: -1, coarse: false });
    expect(resolveTimelineKeyboardCommand("ArrowRight", true)).toEqual({ type: "playhead.nudge", direction: 1, coarse: true });
    expect(resolveTimelineKeyboardCommand("s", false)).toEqual({ type: "clip.split" });
    expect(resolveTimelineKeyboardCommand("[", false)).toEqual({ type: "clip.trim-start" });
    expect(resolveTimelineKeyboardCommand("]", false)).toEqual({ type: "clip.trim-end" });
    expect(resolveTimelineKeyboardCommand("+", false)).toEqual({ type: "zoom.change", direction: 1 });
    expect(resolveTimelineKeyboardCommand("-", false)).toEqual({ type: "zoom.change", direction: -1 });
    expect(resolveTimelineKeyboardCommand(" ", false)).toEqual({ type: "transport.toggle" });
  });
});
