import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { Asset, AssetDerivative, NormalizedMediaProbe } from "@toolshape/studio-domain";
import type { ContentAddressedAssetStore, StoredAsset } from "@toolshape/studio-persistence";
import { createFfmpegThumbnailPlan, createFfmpegWaveformPlan } from "./derivative-plan";
import { inspectPngDimensions, type PngDimensions } from "./png";
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
  maxThumbnailWidth?: number;
  maxThumbnailHeight?: number;
  waveformWidth?: number;
  waveformHeight?: number;
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
  thumbnail: StoredAsset;
  waveform: StoredAsset | null;
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

function verifyThumbnail(dimensions: PngDimensions, maxWidth: number, maxHeight: number): void {
  if (dimensions.width > maxWidth || dimensions.height > maxHeight) {
    throw new Error("Thumbnail verification failed against the configured dimension bounds.");
  }
}

function verifyWaveform(dimensions: PngDimensions, width: number, height: number): void {
  if (dimensions.width !== width || dimensions.height !== height) {
    throw new Error("Waveform verification failed against the configured dimensions.");
  }
}

export class MediaIngestionService {
  private readonly runner: MediaProcessRunner;
  private readonly workRoot: string;
  private readonly maxProxyWidth: number;
  private readonly maxProxyHeight: number;
  private readonly maxThumbnailWidth: number;
  private readonly maxThumbnailHeight: number;
  private readonly waveformWidth: number;
  private readonly waveformHeight: number;
  private readonly maxSourceBytes: number;

  constructor(private readonly options: MediaIngestionOptions) {
    this.runner = options.runner ?? new FfmpegMediaProcessRunner();
    this.workRoot = path.resolve(options.workRoot);
    this.maxProxyWidth = options.maxProxyWidth ?? 960;
    this.maxProxyHeight = options.maxProxyHeight ?? 960;
    this.maxThumbnailWidth = options.maxThumbnailWidth ?? 480;
    this.maxThumbnailHeight = options.maxThumbnailHeight ?? 270;
    this.waveformWidth = options.waveformWidth ?? 1280;
    this.waveformHeight = options.waveformHeight ?? 160;
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
    const proxyPlan = createFfmpegProxyPlan({
      inputPath: original.contentPath,
      workRoot: this.workRoot,
      maxWidth: this.maxProxyWidth,
      maxHeight: this.maxProxyHeight,
    });
    const thumbnailPlan = createFfmpegThumbnailPlan({
      inputPath: original.contentPath,
      workRoot: this.workRoot,
      maxWidth: this.maxThumbnailWidth,
      maxHeight: this.maxThumbnailHeight,
      atSeconds: Math.min(1, toSeconds(sourceProbe) / 2),
    });
    const waveformPlan = sourceProbe.audio
      ? createFfmpegWaveformPlan({
          inputPath: original.contentPath,
          workRoot: this.workRoot,
          width: this.waveformWidth,
          height: this.waveformHeight,
        })
      : null;
    const workerOutputs = [
      proxyPlan.partialOutputPath,
      thumbnailPlan.partialOutputPath,
      ...(waveformPlan ? [waveformPlan.partialOutputPath] : []),
    ];
    try {
      await this.runner.createProxy(proxyPlan);
      const proxyProbe = await this.runner.probe(proxyPlan.partialOutputPath);
      verifyProxy(sourceProbe, proxyProbe, this.maxProxyWidth, this.maxProxyHeight);

      await this.runner.createThumbnail(thumbnailPlan);
      const thumbnailBytes = await readFile(thumbnailPlan.partialOutputPath);
      const thumbnailDimensions = inspectPngDimensions(thumbnailBytes);
      verifyThumbnail(thumbnailDimensions, this.maxThumbnailWidth, this.maxThumbnailHeight);

      let waveformBytes: Uint8Array | null = null;
      let waveformDimensions: PngDimensions | null = null;
      if (waveformPlan) {
        await this.runner.createWaveform(waveformPlan);
        waveformBytes = await readFile(waveformPlan.partialOutputPath);
        waveformDimensions = inspectPngDimensions(waveformBytes);
        verifyWaveform(waveformDimensions, this.waveformWidth, this.waveformHeight);
      }

      const proxy = await this.options.contentStore.import({
        bytes: await readFile(proxyPlan.partialOutputPath),
        originalName: `${path.parse(input.originalName).name}.proxy.mp4`,
        mediaType: "video/mp4",
      });
      const thumbnail = await this.options.contentStore.import({
        bytes: thumbnailBytes,
        originalName: `${path.parse(input.originalName).name}.thumbnail.png`,
        mediaType: "image/png",
      });
      const waveform = waveformBytes
        ? await this.options.contentStore.import({
            bytes: waveformBytes,
            originalName: `${path.parse(input.originalName).name}.waveform.png`,
            mediaType: "image/png",
          })
        : null;
      const toolchain = await this.runner.toolchain();
      const createdAt = new Date().toISOString();
      const derivatives: AssetDerivative[] = [
        {
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
          createdAt,
          provenance: { sourceDigest: original.digest, toolchain },
        },
        {
          id: randomUUID(),
          kind: "thumbnail",
          mediaType: thumbnail.mediaType,
          contentHash: thumbnail.digest,
          sourceRef: `content://sha256/${thumbnail.digest.slice("sha256:".length)}`,
          immutable: true,
          width: thumbnailDimensions.width,
          height: thumbnailDimensions.height,
          probe: null,
          createdAt,
          provenance: { sourceDigest: original.digest, toolchain },
        },
      ];
      if (waveform && waveformDimensions) {
        derivatives.push({
          id: randomUUID(),
          kind: "waveform",
          mediaType: waveform.mediaType,
          contentHash: waveform.digest,
          sourceRef: `content://sha256/${waveform.digest.slice("sha256:".length)}`,
          immutable: true,
          width: waveformDimensions.width,
          height: waveformDimensions.height,
          duration: sourceProbe.duration,
          probe: null,
          createdAt,
          provenance: { sourceDigest: original.digest, toolchain },
        });
      }
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
        derivatives,
      };
      this.options.repository.saveMediaAsset(asset, original);
      return { asset, original, proxy, thumbnail, waveform, proxyProbe };
    } finally {
      await Promise.all(workerOutputs.map((outputPath) => rm(outputPath, { force: true })));
    }
  }
}
