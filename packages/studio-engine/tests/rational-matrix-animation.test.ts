import { describe, expect, it } from "vitest";
import type { Transform } from "@toolshape/studio-domain";
import {
  addRational,
  compareRational,
  composeTransformMatrix,
  decomposeTransformMatrix,
  interpolateKeyframes,
  rational,
  subtractRational,
} from "../src";

describe("rational timeline arithmetic", () => {
  it("normalizes and composes exact frame times", () => {
    expect(rational(60, 30)).toEqual({ numerator: 2, denominator: 1 });
    expect(addRational(rational(1, 24), rational(1, 24))).toEqual({
      numerator: 1,
      denominator: 12,
    });
    expect(subtractRational(rational(5, 2), rational(3, 4))).toEqual({
      numerator: 7,
      denominator: 4,
    });
    expect(compareRational(rational(1001, 30000), rational(1, 30))).toBeGreaterThan(0);
  });

  it("rejects zero denominators", () => {
    expect(() => rational(1, 0)).toThrow(/denominator cannot be zero/i);
  });
});

describe("transform matrix", () => {
  it("round-trips translation, scale and rotation", () => {
    const transform: Transform = {
      x: 128,
      y: 384,
      scaleX: 1.25,
      scaleY: 0.75,
      rotationDeg: 18,
      opacity: 0.82,
    };
    const roundTrip = decomposeTransformMatrix(composeTransformMatrix(transform), transform.opacity);
    expect(roundTrip.x).toBeCloseTo(transform.x, 8);
    expect(roundTrip.y).toBeCloseTo(transform.y, 8);
    expect(roundTrip.scaleX).toBeCloseTo(transform.scaleX, 8);
    expect(roundTrip.scaleY).toBeCloseTo(transform.scaleY, 8);
    expect(roundTrip.rotationDeg).toBeCloseTo(transform.rotationDeg, 8);
    expect(roundTrip.opacity).toBe(transform.opacity);
  });
});

describe("keyframe interpolation", () => {
  it("uses the arriving keyframe easing deterministically", () => {
    const value = interpolateKeyframes(
      [
        { id: "a", time: rational(0), value: 0, easing: "linear" },
        { id: "b", time: rational(2), value: 100, easing: "ease-in-out" },
      ],
      rational(1),
    );
    expect(value).toBeCloseTo(50, 8);
  });
});

