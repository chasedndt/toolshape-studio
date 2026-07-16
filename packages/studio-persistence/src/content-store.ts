import { createHash, randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const ALLOWED_MEDIA = new Set([
  "image/png",
  "image/jpeg",
  "video/mp4",
  "audio/wav",
  "audio/mpeg",
  "font/woff2",
]);

export interface StoredAsset {
  assetId: string;
  digest: string;
  mediaType: string;
  sizeBytes: number;
  originalName: string;
  contentPath: string;
  deduplicated: boolean;
}

export interface ContentImport {
  bytes: Uint8Array;
  originalName: string;
  mediaType: string;
}

export function sniffMediaType(bytes: Uint8Array): string | null {
  const starts = (...values: number[]): boolean => values.every((value, index) => bytes[index] === value);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (
    bytes.byteLength >= 12 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  ) return "video/mp4";
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
  ) return "audio/wav";
  if (starts(0x49, 0x44, 0x33) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (starts(0x77, 0x4f, 0x46, 0x32)) return "font/woff2";
  return null;
}

export class ContentAddressedAssetStore {
  constructor(
    private readonly root: string,
    private readonly maxBytes = 250 * 1024 * 1024,
  ) {}

  async import(input: ContentImport): Promise<StoredAsset> {
    if (!ALLOWED_MEDIA.has(input.mediaType)) {
      throw new TypeError(`Unsupported media type: ${input.mediaType}`);
    }
    if (
      !input.originalName ||
      input.originalName !== path.basename(input.originalName) ||
      /[\\/\u0000-\u001f]/.test(input.originalName)
    ) {
      throw new TypeError("Asset name contains a path or control character.");
    }
    if (input.bytes.byteLength === 0 || input.bytes.byteLength > this.maxBytes) {
      throw new RangeError("Asset size is outside the accepted import limit.");
    }
    const sniffed = sniffMediaType(input.bytes);
    if (!sniffed || sniffed !== input.mediaType) {
      throw new TypeError(
        `Declared media type ${input.mediaType} does not match the byte signature${sniffed ? ` (${sniffed})` : ""}.`,
      );
    }

    const hex = createHash("sha256").update(input.bytes).digest("hex");
    const directory = path.resolve(this.root, hex.slice(0, 2));
    const contentPath = path.resolve(directory, hex);
    const resolvedRoot = `${path.resolve(this.root)}${path.sep}`;
    if (!contentPath.startsWith(resolvedRoot)) throw new TypeError("Resolved asset path escaped the content store.");
    await mkdir(directory, { recursive: true });
    let deduplicated = false;
    try {
      await writeFile(contentPath, input.bytes, { flag: "wx" });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      const existing = await stat(contentPath);
      if (existing.size !== input.bytes.byteLength) {
        throw new Error("Content-address collision has an unexpected size.");
      }
      deduplicated = true;
    }
    return {
      assetId: randomUUID(),
      digest: `sha256:${hex}`,
      mediaType: input.mediaType,
      sizeBytes: input.bytes.byteLength,
      originalName: input.originalName,
      contentPath,
      deduplicated,
    };
  }
}
