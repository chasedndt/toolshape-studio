import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ContentAddressedAssetStore, SqliteStudioRepository } from "@toolshape/studio-persistence";
import {
  MediaIngestionService,
  createFfmpegProxyPlan,
  createFfmpegThumbnailPlan,
  createFfmpegWaveformPlan,
  type MediaProcessRunner,
  type NormalizedMediaProbe,
} from "../src";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-media-"));
  roots.push(root);
  return root;
}

const sourceProbe: NormalizedMediaProbe = {
  container: "mov,mp4,m4a,3gp,3g2,mj2",
  duration: { numerator: 4, denominator: 1 },
  video: { codec: "h264", width: 1280, height: 720, frameRate: { numerator: 30, denominator: 1 } },
  audio: { codec: "aac", sampleRate: 48000, channels: 2 },
};

const proxyProbe: NormalizedMediaProbe = {
  ...sourceProbe,
  video: { ...sourceProbe.video!, width: 640, height: 360 },
};

function mp4Bytes(): Uint8Array {
  return new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
}

function pngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

class FakeMediaRunner implements MediaProcessRunner {
  private probes = 0;
  constructor(
    private readonly invalidProxy = false,
    private readonly source = sourceProbe,
  ) {}

  async probe(): Promise<NormalizedMediaProbe> {
    this.probes += 1;
    return this.probes === 1
      ? this.source
      : this.invalidProxy
        ? { ...proxyProbe, video: { ...proxyProbe.video!, codec: "vp9" } }
        : { ...proxyProbe, audio: this.source.audio };
  }

  async createProxy(plan: { partialOutputPath: string }): Promise<void> {
    await writeFile(plan.partialOutputPath, mp4Bytes());
  }

  async createThumbnail(plan: { partialOutputPath: string; maxWidth: number; maxHeight: number }): Promise<void> {
    await writeFile(plan.partialOutputPath, pngBytes(plan.maxWidth, plan.maxHeight));
  }

  async createWaveform(plan: { partialOutputPath: string; width: number; height: number }): Promise<void> {
    await writeFile(plan.partialOutputPath, pngBytes(plan.width, plan.height));
  }

  async toolchain(): Promise<Array<Record<string, unknown>>> {
    return [{ name: "ffmpeg", version: "test" }, { name: "ffprobe", version: "test" }];
  }
}

describe("probed media ingestion", () => {
  it("stores a normalized original and verified immutable proxy across reopen", async () => {
    const root = await temporaryRoot();
    const sourcePath = path.join(root, "source.mp4");
    await writeFile(sourcePath, mp4Bytes());
    const databasePath = path.join(root, "studio.sqlite");
    const repository = new SqliteStudioRepository(databasePath);
    const service = new MediaIngestionService({
      contentStore: new ContentAddressedAssetStore(path.join(root, "objects")),
      repository,
      workRoot: path.join(root, "work"),
      runner: new FakeMediaRunner(),
      maxProxyWidth: 640,
      maxProxyHeight: 360,
      maxThumbnailWidth: 320,
      maxThumbnailHeight: 180,
      waveformWidth: 640,
      waveformHeight: 120,
    });

    const result = await service.ingest({
      sourcePath,
      originalName: "source.mp4",
      declaredMediaType: "video/mp4",
    });
    expect(result.asset.probe).toEqual(sourceProbe);
    expect(result.asset.derivatives).toHaveLength(3);
    expect(result.asset.derivatives.find((derivative) => derivative.kind === "proxy")).toMatchObject({
      kind: "proxy",
      mediaType: "video/mp4",
      width: 640,
      height: 360,
      probe: proxyProbe,
    });
    expect(result.asset.derivatives.find((derivative) => derivative.kind === "thumbnail")).toMatchObject({
      kind: "thumbnail",
      mediaType: "image/png",
      width: 320,
      height: 180,
      probe: null,
    });
    expect(result.asset.derivatives.find((derivative) => derivative.kind === "waveform")).toMatchObject({
      kind: "waveform",
      mediaType: "image/png",
      width: 640,
      height: 120,
      duration: sourceProbe.duration,
      probe: null,
    });
    expect(result.asset.sourceRef).toMatch(/^content:\/\/sha256\/[a-f0-9]{64}$/);
    expect(result.asset.derivatives.every((derivative) => /^content:\/\/sha256\/[a-f0-9]{64}$/.test(derivative.sourceRef))).toBe(true);
    expect(new Set(result.asset.derivatives.map((derivative) => derivative.contentHash)).size).toBe(3);
    repository.close();

    const reopened = new SqliteStudioRepository(databasePath);
    expect(reopened.getMediaAsset(result.asset.id)).toEqual(result.asset);
    reopened.close();
  });

  it("does not register a proxy when verification fails and removes worker output", async () => {
    const root = await temporaryRoot();
    const sourcePath = path.join(root, "source.mp4");
    await writeFile(sourcePath, mp4Bytes());
    const repository = new SqliteStudioRepository(path.join(root, "studio.sqlite"));
    const workRoot = path.join(root, "work");
    const service = new MediaIngestionService({
      contentStore: new ContentAddressedAssetStore(path.join(root, "objects")),
      repository,
      workRoot,
      runner: new FakeMediaRunner(true),
      maxProxyWidth: 640,
      maxProxyHeight: 360,
      maxThumbnailWidth: 320,
      maxThumbnailHeight: 180,
      waveformWidth: 640,
      waveformHeight: 120,
    });

    await expect(service.ingest({
      sourcePath,
      originalName: "source.mp4",
      declaredMediaType: "video/mp4",
    })).rejects.toThrow(/proxy verification/i);
    expect(await readdir(workRoot)).toEqual([]);
    repository.close();
  });

  it("omits waveform generation when the source has no audio stream", async () => {
    const root = await temporaryRoot();
    const sourcePath = path.join(root, "silent.mp4");
    await writeFile(sourcePath, mp4Bytes());
    const silentProbe = { ...sourceProbe, audio: undefined };
    const repository = new SqliteStudioRepository(path.join(root, "studio.sqlite"));
    const service = new MediaIngestionService({
      contentStore: new ContentAddressedAssetStore(path.join(root, "objects")),
      repository,
      workRoot: path.join(root, "work"),
      runner: new FakeMediaRunner(false, silentProbe),
      maxThumbnailWidth: 320,
      maxThumbnailHeight: 180,
      waveformWidth: 640,
      waveformHeight: 120,
    });

    const result = await service.ingest({
      sourcePath,
      originalName: "silent.mp4",
      declaredMediaType: "video/mp4",
    });
    expect(result.asset.derivatives.map((derivative) => derivative.kind)).toEqual(["proxy", "thumbnail"]);
    expect(result.waveform).toBeNull();
    repository.close();
  });

  it("builds an approved-root shell-free proxy plan", async () => {
    const root = await temporaryRoot();
    const plan = createFfmpegProxyPlan({
      inputPath: path.join(root, "objects", "aa", "source"),
      workRoot: path.join(root, "work"),
      maxWidth: 640,
      maxHeight: 360,
    });
    expect(plan.binary).toBe("ffmpeg");
    expect(plan.args).toContain("-nostdin");
    expect(plan.args.join(" ")).not.toMatch(/[;&|]/);
    expect(plan.partialOutputPath.startsWith(path.join(root, "work"))).toBe(true);
  });

  it("builds bounded shell-free thumbnail and waveform plans", async () => {
    const root = await temporaryRoot();
    const inputPath = path.join(root, "objects", "aa", "source");
    const workRoot = path.join(root, "work");
    const thumbnail = createFfmpegThumbnailPlan({
      inputPath,
      workRoot,
      maxWidth: 320,
      maxHeight: 180,
      atSeconds: 1,
      workId: "thumb-test",
    });
    const waveform = createFfmpegWaveformPlan({
      inputPath,
      workRoot,
      width: 640,
      height: 120,
      workId: "wave-test",
    });
    expect(thumbnail.args).toContain("-frames:v");
    expect(thumbnail.args.join(" ")).not.toMatch(/[;&|]/);
    expect(thumbnail.partialOutputPath).toMatch(/thumb-test\.thumbnail\.partial\.png$/);
    expect(waveform.args).toContain("-filter_complex");
    expect(waveform.args.join(" ")).toContain("showwavespic=s=640x120");
    expect(waveform.args.join(" ")).not.toMatch(/[;&|]/);
    expect(waveform.partialOutputPath).toMatch(/wave-test\.waveform\.partial\.png$/);
  });
});
