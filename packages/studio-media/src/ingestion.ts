import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { Asset, NormalizedMediaProbe } from "@toolshape/studio-domain";
import type { ContentAddressedAssetStore, StoredAsset } from "@toolshape/studio-persistence";
import { createFfmpegProxyPlan } from "./proxy-plan";
import { FfmpegMediaProcessRunner } from "./process-runner";
import type { MediaProcessRunner } from "./types";

export interface MediaAssetRepository {
  saveMediaAsset(asset: Asset, original: StoredAsset): void;
  getMediaAsset(assetId: string): Asset | null;
}

export interface MediaIngestionOptions {
  contentStore: ContentAddressedAssetStore;
  repository: MediaAssetRepository;
  workRoot: string;
  runner?: MediaProcessRunner;
  maxProxyWidth?: number;
  maxProxyHeight?: number;
  maxSourceBytes?: number;
}

export interface MediaIngestionInput {
  sourcePath: string;
  originalName: string;
  declaredMediaType: string;
}

export interface MediaIngestionResult {
  asset: Asset;
  original: StoredAsset;
  proxy: StoredAsset;
  proxyProbe: NormalizedMediaProbe;
}

function toSeconds(probe: NormalizedMediaProbe): number {
  return probe.duration.numerator / probe.duration.denominator;
}

function verifyOriginal(probe: NormalizedMediaProbe, mediaType: string): void {
  if (mediaType !== "video/mp4" || !probe.video) {
    throw new TypeError("This milestone accepts probed MP4 video sources only.");
  }
  if (probe.video.width <= 0 || probe.video.height <= 0 || toSeconds(probe) <= 0) {
    throw new TypeError("Media probe returned invalid source dimensions or duration.");
  }
}

function verifyProxy(
  source: NormalizedMediaProbe,
  proxy: NormalizedMediaProbe,
  maxWidth: number,
  maxHeight: number,
): void {
  const durationDelta = Math.abs(toSeconds(source) - toSeconds(proxy));
  const valid = proxy.video?.codec === "h264" &&
    proxy.video.width <= maxWidth && proxy.video.height <= maxHeight &&
    proxy.video.width > 0 && proxy.video.height > 0 &&
    durationDelta <= 0.2 &&
    (!source.audio || proxy.audio?.codec === "aac");
  if (!valid) throw new Error("Proxy verification failed against the normalized source and proxy policy.");
}

export class MediaIngestionService {
  private readonly runner: MediaProcessRunner;
  private readonly workRoot: string;
  private readonly maxProxyWidth: number;
  private readonly maxProxyHeight: number;
  private readonly maxSourceBytes: number;

  constructor(private readonly options: MediaIngestionOptions) {
    this.runner = options.runner ?? new FfmpegMediaProcessRunner();
    this.workRoot = path.resolve(options.workRoot);
    this.maxProxyWidth = options.maxProxyWidth ?? 960;
    this.maxProxyHeight = options.maxProxyHeight ?? 960;
    this.maxSourceBytes = options.maxSourceBytes ?? 250 * 1024 * 1024;
  }

  async ingest(input: MediaIngestionInput): Promise<MediaIngestionResult> {
    const sourceDetails = await stat(input.sourcePath);
    if (!sourceDetails.isFile() || sourceDetails.size <= 0 || sourceDetails.size > this.maxSourceBytes) {
      throw new RangeError("Media source size is outside the accepted ingestion limit.");
    }
    const bytes = await readFile(input.sourcePath);
    const original = await this.options.contentStore.import({
      bytes,
      originalName: input.originalName,
      mediaType: input.declaredMediaType,
    });
    const sourceProbe = await this.runner.probe(original.contentPath);
    verifyOriginal(sourceProbe, original.mediaType);
    await mkdir(this.workRoot, { recursive: true });
    const plan = createFfmpegProxyPlan({
      inputPath: original.contentPath,
      workRoot: this.workRoot,
      maxWidth: this.maxProxyWidth,
      maxHeight: this.maxProxyHeight,
    });
    try {
      await this.runner.createProxy(plan);
      const proxyProbe = await this.runner.probe(plan.partialOutputPath);
      verifyProxy(sourceProbe, proxyProbe, this.maxProxyWidth, this.maxProxyHeight);
      const proxy = await this.options.contentStore.import({
        bytes: await readFile(plan.partialOutputPath),
        originalName: `${path.parse(input.originalName).name}.proxy.mp4`,
        mediaType: "video/mp4",
      });
      const toolchain = await this.runner.toolchain();
      const asset: Asset = {
        id: original.assetId,
        name: input.originalName,
        kind: "video",
        mediaType: original.mediaType,
        contentHash: original.digest,
        sourceRef: `content://sha256/${original.digest.slice("sha256:".length)}`,
        immutable: true,
        width: sourceProbe.video!.width,
        height: sourceProbe.video!.height,
        duration: sourceProbe.duration,
        probe: sourceProbe,
        derivatives: [{
          id: randomUUID(),
          kind: "proxy",
          mediaType: proxy.mediaType,
          contentHash: proxy.digest,
          sourceRef: `content://sha256/${proxy.digest.slice("sha256:".length)}`,
          immutable: true,
          width: proxyProbe.video!.width,
          height: proxyProbe.video!.height,
          duration: proxyProbe.duration,
          probe: proxyProbe,
          createdAt: new Date().toISOString(),
          provenance: { sourceDigest: original.digest, toolchain },
        }],
      };
      this.options.repository.saveMediaAsset(asset, original);
      return { asset, original, proxy, proxyProbe };
    } finally {
      await rm(plan.partialOutputPath, { force: true });
    }
  }
}
