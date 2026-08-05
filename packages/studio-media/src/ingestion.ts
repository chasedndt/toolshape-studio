import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Asset, AssetDerivative, NormalizedMediaProbe, RationalTime } from "@toolshape/studio-domain";
import { sniffMediaType, type ContentAddressedAssetStore, type StoredAsset } from "@toolshape/studio-persistence";
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
  resourcePolicy?: Partial<MediaResourcePolicy>;
}

export interface MediaResourcePolicy {
  maxSourceBytes: number;
  maxDurationSeconds: number;
  maxVideoWidth: number;
  maxVideoHeight: number;
  maxVideoPixels: number;
  maxFrameRate: number;
  maxAudioChannels: number;
  maxAudioSampleRate: number;
}

export type MediaIngestionStage = "source-validation" | "probe" | "probe-policy";

export class MediaIngestionRejectedError extends Error {
  readonly name = "MediaIngestionRejectedError";

  constructor(
    readonly code: string,
    readonly stage: MediaIngestionStage,
    message: string,
    readonly evidence: Readonly<Record<string, number | string>> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

const DEFAULT_RESOURCE_POLICY: MediaResourcePolicy = {
  maxSourceBytes: 250 * 1024 * 1024,
  maxDurationSeconds: 4 * 60 * 60,
  maxVideoWidth: 8_192,
  maxVideoHeight: 8_192,
  maxVideoPixels: 33_177_600,
  maxFrameRate: 120,
  maxAudioChannels: 8,
  maxAudioSampleRate: 192_000,
};

function validateResourcePolicy(policy: MediaResourcePolicy): void {
  for (const [name, value] of Object.entries(policy)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError(`Media resource policy ${name} must be a positive finite number.`);
    }
  }
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

function rationalSeconds(value: RationalTime): number {
  return value.numerator / value.denominator;
}

function toSeconds(probe: NormalizedMediaProbe): number {
  return rationalSeconds(probe.duration);
}

function reject(
  code: string,
  stage: MediaIngestionStage,
  message: string,
  evidence: Readonly<Record<string, number | string>> = {},
  cause?: unknown,
): never {
  throw new MediaIngestionRejectedError(code, stage, message, evidence, cause === undefined ? undefined : { cause });
}

function verifyOriginal(probe: NormalizedMediaProbe, mediaType: string, policy: MediaResourcePolicy): void {
  if (mediaType !== "video/mp4" || !probe.video) {
    reject("media.source.unsupported", "probe-policy", "This ingestion policy accepts probed MP4 video sources only.");
  }
  const durationSeconds = toSeconds(probe);
  const frameRate = rationalSeconds(probe.video.frameRate);
  if (probe.video.width <= 0 || probe.video.height <= 0 || durationSeconds <= 0) {
    reject("media.probe.invalid", "probe-policy", "Media probe returned invalid source dimensions or duration.");
  }
  if (durationSeconds > policy.maxDurationSeconds) {
    reject("media.resource.duration", "probe-policy", "Media duration exceeds the configured ingestion budget.", {
      observed: durationSeconds,
      limit: policy.maxDurationSeconds,
    });
  }
  if (probe.video.width > policy.maxVideoWidth || probe.video.height > policy.maxVideoHeight) {
    reject("media.resource.video_dimensions", "probe-policy", "Media dimensions exceed the configured ingestion budget.", {
      width: probe.video.width,
      height: probe.video.height,
      maxWidth: policy.maxVideoWidth,
      maxHeight: policy.maxVideoHeight,
    });
  }
  const pixels = probe.video.width * probe.video.height;
  if (pixels > policy.maxVideoPixels) {
    reject("media.resource.video_pixels", "probe-policy", "Media pixel count exceeds the configured ingestion budget.", {
      observed: pixels,
      limit: policy.maxVideoPixels,
    });
  }
  if (frameRate > policy.maxFrameRate) {
    reject("media.resource.frame_rate", "probe-policy", "Media frame rate exceeds the configured ingestion budget.", {
      observed: frameRate,
      limit: policy.maxFrameRate,
    });
  }
  if (probe.audio?.channels && probe.audio.channels > policy.maxAudioChannels) {
    reject("media.resource.audio_channels", "probe-policy", "Media channel count exceeds the configured ingestion budget.", {
      observed: probe.audio.channels,
      limit: policy.maxAudioChannels,
    });
  }
  if (probe.audio?.sampleRate && probe.audio.sampleRate > policy.maxAudioSampleRate) {
    reject("media.resource.audio_sample_rate", "probe-policy", "Media sample rate exceeds the configured ingestion budget.", {
      observed: probe.audio.sampleRate,
      limit: policy.maxAudioSampleRate,
    });
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
  private readonly resourcePolicy: MediaResourcePolicy;

  constructor(private readonly options: MediaIngestionOptions) {
    this.runner = options.runner ?? new FfmpegMediaProcessRunner();
    this.workRoot = path.resolve(options.workRoot);
    this.maxProxyWidth = options.maxProxyWidth ?? 960;
    this.maxProxyHeight = options.maxProxyHeight ?? 960;
    this.maxThumbnailWidth = options.maxThumbnailWidth ?? 480;
    this.maxThumbnailHeight = options.maxThumbnailHeight ?? 270;
    this.waveformWidth = options.waveformWidth ?? 1280;
    this.waveformHeight = options.waveformHeight ?? 160;
    this.resourcePolicy = {
      ...DEFAULT_RESOURCE_POLICY,
      ...options.resourcePolicy,
      ...(options.maxSourceBytes === undefined ? {} : { maxSourceBytes: options.maxSourceBytes }),
    };
    validateResourcePolicy(this.resourcePolicy);
  }

  async ingest(input: MediaIngestionInput): Promise<MediaIngestionResult> {
    let sourceDetails;
    try {
      sourceDetails = await stat(input.sourcePath);
    } catch (cause) {
      reject("media.source.unreadable", "source-validation", "Media source could not be read from the approved caller path.", {}, cause);
    }
    if (!sourceDetails.isFile() || sourceDetails.size <= 0 || sourceDetails.size > this.resourcePolicy.maxSourceBytes) {
      reject("media.source.size", "source-validation", "Media source size is outside the accepted ingestion budget.", {
        observed: sourceDetails.size,
        limit: this.resourcePolicy.maxSourceBytes,
      });
    }
    let bytes: Uint8Array;
    try {
      bytes = await readFile(input.sourcePath);
    } catch (cause) {
      reject("media.source.unreadable", "source-validation", "Media source could not be read from the approved caller path.", {}, cause);
    }
    if (bytes.byteLength === 0 || bytes.byteLength > this.resourcePolicy.maxSourceBytes) {
      reject("media.source.size", "source-validation", "Media source bytes changed outside the accepted ingestion budget.", {
        observed: bytes.byteLength,
        limit: this.resourcePolicy.maxSourceBytes,
      });
    }
    await mkdir(this.workRoot, { recursive: true });
    if (
      !input.originalName ||
      input.originalName !== path.basename(input.originalName) ||
      /[\\/\u0000-\u001f]/.test(input.originalName)
    ) {
      reject("media.source.name", "source-validation", "Media source name contains a path or control character.");
    }
    if (input.declaredMediaType !== "video/mp4") {
      reject("media.source.unsupported", "source-validation", "This ingestion policy accepts declared MP4 video sources only.");
    }
    const sniffedMediaType = sniffMediaType(bytes);
    if (!sniffedMediaType || sniffedMediaType !== input.declaredMediaType) {
      reject("media.source.signature", "source-validation", "Declared media type does not match the source byte signature.", {
        declared: input.declaredMediaType,
        detected: sniffedMediaType ?? "unknown",
      });
    }
    const quarantineRoot = path.resolve(this.workRoot, `.quarantine-${randomUUID()}`);
    const approvedWorkRoot = `${this.workRoot}${path.sep}`;
    if (!quarantineRoot.startsWith(approvedWorkRoot)) {
      reject("media.source.quarantine_path", "source-validation", "Resolved quarantine path escaped the approved media-work root.");
    }
    await mkdir(quarantineRoot, { recursive: false });
    const quarantinePath = path.join(quarantineRoot, "source.mp4");
    try {
      await writeFile(quarantinePath, bytes, { flag: "wx" });
      let sourceProbe: NormalizedMediaProbe;
      try {
        sourceProbe = await this.runner.probe(quarantinePath);
      } catch (cause) {
        reject("media.probe.failed", "probe", "Media source could not be normalized by the bounded probe worker.", {}, cause);
      }
      verifyOriginal(sourceProbe, input.declaredMediaType, this.resourcePolicy);
      const original = await this.options.contentStore.import({
        bytes,
        originalName: input.originalName,
        mediaType: input.declaredMediaType,
      });
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
    } finally {
      await rm(quarantineRoot, { recursive: true, force: true });
    }
  }
}
