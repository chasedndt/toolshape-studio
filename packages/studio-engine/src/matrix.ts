import type { Transform } from "@toolshape/studio-domain";

export type Matrix2D = readonly [number, number, number, number, number, number];

export function composeTransformMatrix(transform: Transform): Matrix2D {
  const radians = (transform.rotationDeg * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    cosine * transform.scaleX,
    sine * transform.scaleX,
    -sine * transform.scaleY,
    cosine * transform.scaleY,
    transform.x,
    transform.y,
  ];
}

export function decomposeTransformMatrix(matrix: Matrix2D, opacity = 1): Transform {
  const [a, b, c, d, x, y] = matrix;
  const scaleX = Math.hypot(a, b);
  if (scaleX === 0) {
    throw new RangeError("Cannot decompose a transform with a zero X scale.");
  }
  const determinant = a * d - b * c;
  const scaleY = determinant / scaleX;
  const rotationDeg = (Math.atan2(b, a) * 180) / Math.PI;
  return { x, y, scaleX, scaleY, rotationDeg, opacity };
}

