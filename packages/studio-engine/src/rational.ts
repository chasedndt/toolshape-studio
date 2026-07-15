import type { RationalTime } from "@toolshape/studio-domain";

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer.`);
  }
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

export function rational(numerator: number, denominator = 1): RationalTime {
  assertSafeInteger(numerator, "Rational numerator");
  assertSafeInteger(denominator, "Rational denominator");
  if (denominator === 0) {
    throw new RangeError("Rational denominator cannot be zero.");
  }

  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  return {
    numerator: (numerator / divisor) * sign,
    denominator: Math.abs(denominator / divisor),
  };
}

export function addRational(left: RationalTime, right: RationalTime): RationalTime {
  const numerator = left.numerator * right.denominator + right.numerator * left.denominator;
  const denominator = left.denominator * right.denominator;
  assertSafeInteger(numerator, "Rational addition result");
  assertSafeInteger(denominator, "Rational addition denominator");
  return rational(numerator, denominator);
}

export function subtractRational(left: RationalTime, right: RationalTime): RationalTime {
  return addRational(left, rational(-right.numerator, right.denominator));
}

export function multiplyRational(value: RationalTime, factor: number): RationalTime {
  assertSafeInteger(factor, "Rational multiplier");
  return rational(value.numerator * factor, value.denominator);
}

export function compareRational(left: RationalTime, right: RationalTime): number {
  const delta = left.numerator * right.denominator - right.numerator * left.denominator;
  assertSafeInteger(delta, "Rational comparison result");
  return Math.sign(delta);
}

export function maxRational(left: RationalTime, right: RationalTime): RationalTime {
  return compareRational(left, right) >= 0 ? left : right;
}

export function toSeconds(value: RationalTime): number {
  return value.numerator / value.denominator;
}

export function isNonNegative(value: RationalTime): boolean {
  return compareRational(value, rational(0)) >= 0;
}

