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
