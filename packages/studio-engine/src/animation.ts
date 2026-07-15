import type { Keyframe, RationalTime } from "@toolshape/studio-domain";
import { compareRational, subtractRational, toSeconds } from "./rational";

function applyEasing(progress: number, easing: Keyframe["easing"]): number {
  switch (easing) {
    case "linear":
      return progress;
    case "ease-in":
      return progress * progress * progress;
    case "ease-out":
      return 1 - (1 - progress) ** 3;
    case "ease-in-out":
      return progress < 0.5
        ? 4 * progress ** 3
        : 1 - ((-2 * progress + 2) ** 3) / 2;
  }
  const exhaustive: never = easing;
  return exhaustive;
}

export function interpolateKeyframes(keyframes: Keyframe[], at: RationalTime): number {
  if (keyframes.length === 0) {
    throw new RangeError("At least one keyframe is required.");
  }

  const ordered = [...keyframes].sort((left, right) => compareRational(left.time, right.time));
  if (compareRational(at, ordered[0].time) <= 0) {
    return ordered[0].value;
  }
  if (compareRational(at, ordered.at(-1)!.time) >= 0) {
    return ordered.at(-1)!.value;
  }

  const rightIndex = ordered.findIndex((keyframe) => compareRational(keyframe.time, at) >= 0);
  const left = ordered[rightIndex - 1];
  const right = ordered[rightIndex];
  const elapsed = toSeconds(subtractRational(at, left.time));
  const span = toSeconds(subtractRational(right.time, left.time));
  const eased = applyEasing(elapsed / span, right.easing);
  return left.value + (right.value - left.value) * eased;
}

