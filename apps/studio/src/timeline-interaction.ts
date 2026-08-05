import type { RationalTime } from "@toolshape/studio-domain";
import { rational, toSeconds } from "@toolshape/studio-engine";

export const MIN_TIMELINE_ZOOM = 1;
export const MAX_TIMELINE_ZOOM = 4;
export const TIMELINE_ZOOM_STEP = 0.5;

export type TrimEdge = "start" | "end";

export interface TimelineTick {
  seconds: number;
  positionPercent: number;
  label: string | null;
  major: boolean;
}

export type TimelineKeyboardCommand =
  | { type: "playhead.nudge"; direction: -1 | 1; coarse: boolean }
  | { type: "playhead.boundary"; boundary: "start" | "end" }
  | { type: "clip.split" }
  | { type: "clip.trim-start" }
  | { type: "clip.trim-end" }
  | { type: "zoom.change"; direction: -1 | 1 }
  | { type: "transport.toggle" };

interface TrimCandidateInput {
  edge: TrimEdge;
  requestedSeconds: number;
  clipStart: RationalTime;
  clipDuration: RationalTime;
  sourceIn: RationalTime;
  sourceDuration: RationalTime;
  timelineDuration: RationalTime;
  frameRate: RationalTime;
}

export interface TrimCandidate {
  newStart: RationalTime;
  newDuration: RationalTime;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function framesPerSecond(frameRate: RationalTime): number {
  const value = toSeconds(frameRate);
  if (!Number.isFinite(value) || value <= 0) throw new TypeError("Timeline frame rate must be positive.");
  return value;
}

function snapToFrame(seconds: number, frameRate: RationalTime): number {
  const fps = framesPerSecond(frameRate);
  return Math.round(seconds * fps) / fps;
}

function timeAtFrame(seconds: number, frameRate: RationalTime): RationalTime {
  const totalFrames = Math.round(seconds * framesPerSecond(frameRate));
  return rational(totalFrames * frameRate.denominator, frameRate.numerator);
}

export function clampTimelineZoom(value: number): number {
  return clamp(Math.round(value / TIMELINE_ZOOM_STEP) * TIMELINE_ZOOM_STEP, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM);
}

export function secondsFromTimelinePointer(
  clientX: number,
  contentLeft: number,
  contentWidth: number,
  durationSeconds: number,
  frameRate: RationalTime,
): number {
  if (!Number.isFinite(contentWidth) || contentWidth <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }
  const raw = ((clientX - contentLeft) / contentWidth) * durationSeconds;
  return clamp(snapToFrame(raw, frameRate), 0, durationSeconds);
}

export function stepPlayhead(
  currentSeconds: number,
  direction: -1 | 1,
  coarse: boolean,
  durationSeconds: number,
  frameRate: RationalTime,
): number {
  const delta = coarse ? 1 : 1 / framesPerSecond(frameRate);
  return clamp(snapToFrame(currentSeconds + direction * delta, frameRate), 0, durationSeconds);
}

export function formatTimecode(seconds: number, frameRate: RationalTime): string {
  const fps = framesPerSecond(frameRate);
  const nominalFps = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(0, Math.round(seconds * fps));
  const frames = totalFrames % nominalFps;
  const totalSeconds = Math.floor(totalFrames / nominalFps);
  const displaySeconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  return [hours, minutes, displaySeconds, frames].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatRulerLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(2).padStart(5, "0")}`;
}

export function buildTimelineTicks(durationSeconds: number, zoom: number): TimelineTick[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const normalizedZoom = clampTimelineZoom(zoom);
  const targetMajorCount = 8 * normalizedZoom;
  const rawMajorStep = durationSeconds / targetMajorCount;
  const niceSteps = [1 / 30, 1 / 15, 0.1, 0.125, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  const majorStep = niceSteps.find((step) => step >= rawMajorStep) ?? niceSteps.at(-1)!;
  const minorStep = majorStep / 4;
  const tickCount = Math.ceil(durationSeconds / minorStep);
  const ticks: TimelineTick[] = [];
  for (let index = 0; index <= tickCount; index += 1) {
    const seconds = Math.min(durationSeconds, index * minorStep);
    if (ticks.length > 0 && Math.abs(seconds - ticks.at(-1)!.seconds) < 1e-7) continue;
    const isMajor = Math.abs(seconds / majorStep - Math.round(seconds / majorStep)) < 1e-7 ||
      Math.abs(seconds - durationSeconds) < 1e-7;
    ticks.push({
      seconds,
      positionPercent: (seconds / durationSeconds) * 100,
      label: isMajor ? formatRulerLabel(seconds) : null,
      major: isMajor,
    });
  }
  return ticks;
}

export function computeTrimCandidate(input: TrimCandidateInput): TrimCandidate {
  const start = toSeconds(input.clipStart);
  const duration = toSeconds(input.clipDuration);
  const sourceIn = toSeconds(input.sourceIn);
  const sourceDuration = toSeconds(input.sourceDuration);
  const timelineDuration = toSeconds(input.timelineDuration);
  const frameDuration = 1 / framesPerSecond(input.frameRate);
  const end = start + duration;

  if (input.edge === "start") {
    const earliestStart = Math.max(0, start - sourceIn);
    const latestStart = end - frameDuration;
    const newStartSeconds = clamp(snapToFrame(input.requestedSeconds, input.frameRate), earliestStart, latestStart);
    return {
      newStart: timeAtFrame(newStartSeconds, input.frameRate),
      newDuration: timeAtFrame(end - newStartSeconds, input.frameRate),
    };
  }

  const earliestEnd = start + frameDuration;
  const latestSourceEnd = start + Math.max(frameDuration, sourceDuration - sourceIn);
  const latestEnd = Math.min(timelineDuration, latestSourceEnd);
  const newEndSeconds = clamp(snapToFrame(input.requestedSeconds, input.frameRate), earliestEnd, latestEnd);
  return {
    newStart: input.clipStart,
    newDuration: timeAtFrame(newEndSeconds - start, input.frameRate),
  };
}

export function resolveTimelineKeyboardCommand(key: string, shiftKey: boolean): TimelineKeyboardCommand | null {
  if (key === "ArrowLeft") return { type: "playhead.nudge", direction: -1, coarse: shiftKey };
  if (key === "ArrowRight") return { type: "playhead.nudge", direction: 1, coarse: shiftKey };
  if (key === "Home") return { type: "playhead.boundary", boundary: "start" };
  if (key === "End") return { type: "playhead.boundary", boundary: "end" };
  if (key.toLocaleLowerCase() === "s") return { type: "clip.split" };
  if (key === "[") return { type: "clip.trim-start" };
  if (key === "]") return { type: "clip.trim-end" };
  if (key === "+" || key === "=") return { type: "zoom.change", direction: 1 };
  if (key === "-") return { type: "zoom.change", direction: -1 };
  if (key === " ") return { type: "transport.toggle" };
  return null;
}
