import type { CursorSample, Easing, ZoomPlan } from "@toolshape/studio-domain";
import { toSeconds } from "./rational";

/**
 * Turns a zoom plan into concrete framing over time.
 *
 * This is where "crop and reframe to any aspect ratio, with the zoom plan
 * reflowing to match" happens — one recording becoming a 16:9 lesson and a 9:16
 * short without re-deriving anything, because the plan stores points of
 * interest normalised to the frame rather than pixel rectangles.
 *
 * Pure, like the derivation it consumes: the same plan and output always give
 * the same path, so a preview is the render.
 */

export interface ZoomSample {
  scale: number;
  centerX: number;
  centerY: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CameraFrame {
  timeSeconds: number;
  crop: CropRect;
  zoom: ZoomSample;
}

const UNZOOMED: ZoomSample = { scale: 1, centerX: 0.5, centerY: 0.5 };

function ease(progress: number, easing: Easing): number {
  switch (easing) {
    case "linear":
      return progress;
    case "ease-in":
      return progress * progress;
    case "ease-out":
      return progress * (2 - progress);
    case "ease-in-out":
      return progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
    default: {
      const exhaustive: never = easing;
      throw new TypeError(`Unknown easing: ${String(exhaustive)}`);
    }
  }
}

/**
 * Samples the plan at a moment.
 *
 * Outside the plan's range the first and last values hold, rather than
 * extrapolating — a capture should not drift toward a framing nobody asked for
 * before the first region or after the last.
 */
export function sampleZoomAt(plan: ZoomPlan, timeSeconds: number): ZoomSample {
  const ordered = [...plan.keyframes].sort((left, right) => toSeconds(left.time) - toSeconds(right.time));
  if (ordered.length === 0) return { ...UNZOOMED };

  const first = ordered[0];
  if (timeSeconds <= toSeconds(first.time)) {
    return { scale: first.scale, centerX: first.centerX, centerY: first.centerY };
  }
  const last = ordered[ordered.length - 1];
  if (timeSeconds >= toSeconds(last.time)) {
    return { scale: last.scale, centerX: last.centerX, centerY: last.centerY };
  }

  const rightIndex = ordered.findIndex((keyframe) => toSeconds(keyframe.time) >= timeSeconds);
  const right = ordered[rightIndex];
  const left = ordered[rightIndex - 1];
  const span = toSeconds(right.time) - toSeconds(left.time);
  const progress = span === 0 ? 1 : ease((timeSeconds - toSeconds(left.time)) / span, right.easing);

  return {
    scale: left.scale + (right.scale - left.scale) * progress,
    centerX: left.centerX + (right.centerX - left.centerX) * progress,
    centerY: left.centerY + (right.centerY - left.centerY) * progress,
  };
}

export interface PlanCameraPathOptions {
  zoom: ZoomPlan;
  source: { width: number; height: number };
  output: { width: number; height: number };
  fps: number;
  durationSeconds: number;
}

/**
 * The largest crop matching the output aspect that fits inside the source.
 *
 * When the output is a different shape from the source — a 9:16 short from a
 * 16:9 recording — one dimension is the limiting one and the other is cut. At
 * zoom 1 that means the full height and a narrower width, not a squashed frame.
 */
function baseCrop(
  source: { width: number; height: number },
  output: { width: number; height: number },
): { width: number; height: number } {
  const outputAspect = output.width / output.height;
  const sourceAspect = source.width / source.height;
  return sourceAspect > outputAspect
    ? { width: source.height * outputAspect, height: source.height }
    : { width: source.width, height: source.width / outputAspect };
}

export function planCameraPath(options: PlanCameraPathOptions): CameraFrame[] {
  const { source, output, fps, durationSeconds } = options;
  if (!Number.isFinite(fps) || fps <= 0) throw new RangeError("Camera path frame rate must be positive.");
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new RangeError("Camera path duration must be positive.");
  }

  const base = baseCrop(source, output);
  const frames: CameraFrame[] = [];
  const frameCount = Math.round(durationSeconds * fps);

  for (let index = 0; index < frameCount; index += 1) {
    const timeSeconds = index / fps;
    const zoom = sampleZoomAt(options.zoom, timeSeconds);
    const scale = Math.max(1, zoom.scale);

    const width = base.width / scale;
    const height = base.height / scale;

    // Centre on the point of interest, then push the window back inside the
    // source. Clamping rather than letting it hang over the edge avoids
    // sampling pixels that do not exist, which would render as black bars.
    const x = Math.min(Math.max(zoom.centerX * source.width - width / 2, 0), source.width - width);
    const y = Math.min(Math.max(zoom.centerY * source.height - height / 2, 0), source.height - height);

    frames.push({ timeSeconds, crop: { x, y, width, height }, zoom });
  }
  return frames;
}

export interface CursorSmoothingConfig {
  /** 0 leaves the recorded path alone; 1 is maximum smoothing. */
  smoothing: number;
}

/**
 * Smooths the recorded pointer path.
 *
 * A raw cursor track reads as captured — jittery, with the small corrections a
 * hand makes. Smoothing makes it read as animated, which is most of why
 * polished screen recordings look deliberate.
 *
 * An exponential filter run forwards then backwards, so the result has no
 * directional lag: a one-pass filter would make the pointer trail behind where
 * it actually was.
 */
export function smoothCursorPath(
  samples: readonly CursorSample[],
  config: CursorSmoothingConfig,
): CursorSample[] {
  const strength = Math.min(Math.max(config.smoothing, 0), 1);
  if (strength === 0 || samples.length < 2) return samples.map((sample) => ({ ...sample }));

  // Kept below 1 so the filter always tracks the input; at exactly 1 it would
  // freeze on the first sample and invent a path that never happened.
  const alpha = 1 - strength * 0.9;

  const forward: CursorSample[] = [];
  let x = samples[0].x;
  let y = samples[0].y;
  for (const sample of samples) {
    x += (sample.x - x) * alpha;
    y += (sample.y - y) * alpha;
    forward.push({ ...sample, x, y });
  }

  const smoothed = [...forward];
  x = forward[forward.length - 1].x;
  y = forward[forward.length - 1].y;
  for (let index = forward.length - 1; index >= 0; index -= 1) {
    x += (forward[index].x - x) * alpha;
    y += (forward[index].y - y) * alpha;
    smoothed[index] = { ...forward[index], x, y };
  }
  return smoothed;
}
