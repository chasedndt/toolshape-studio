const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export interface PngDimensions {
  width: number;
  height: number;
}

export function inspectPngDimensions(bytes: Uint8Array): PngDimensions {
  if (
    bytes.byteLength < 24 ||
    !PNG_SIGNATURE.every((value, index) => bytes[index] === value) ||
    bytes[12] !== 0x49 ||
    bytes[13] !== 0x48 ||
    bytes[14] !== 0x44 ||
    bytes[15] !== 0x52
  ) {
    throw new TypeError("Derivative output is not a supported PNG with an IHDR header.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width <= 0 || height <= 0 || width > 8192 || height > 8192) {
    throw new RangeError("Derivative PNG dimensions are outside the supported range.");
  }
  return { width, height };
}
