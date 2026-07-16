import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ContentAddressedAssetStore, SqliteStudioRepository } from "@toolshape/studio-persistence";
import {
  MediaIngestionService,
  createFfmpegProxyPlan,
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

class FakeMediaRunner implements MediaProcessRunner {
  private probes = 0;
  constructor(private readonly invalidProxy = false) {}

  async probe(): Promise<NormalizedMediaProbe> {
    this.probes += 1;
    return this.probes === 1
      ? sourceProbe
      : this.invalidProxy
        ? { ...proxyProbe, video: { ...proxyProbe.video!, codec: "vp9" } }
        : proxyProbe;
  }

  async createProxy(plan: { partialOutputPath: string }): Promise<void> {
    await writeFile(plan.partialOutputPath, mp4Bytes());
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
    });

    const result = await service.ingest({
      sourcePath,
      originalName: "source.mp4",
      declaredMediaType: "video/mp4",
    });
    expect(result.asset.probe).toEqual(sourceProbe);
    expect(result.asset.derivatives).toHaveLength(1);
    expect(result.asset.derivatives[0]).toMatchObject({
      kind: "proxy",
      mediaType: "video/mp4",
      width: 640,
      height: 360,
      probe: proxyProbe,
    });
    expect(result.asset.sourceRef).toMatch(/^content:\/\/sha256\/[a-f0-9]{64}$/);
    expect(result.asset.derivatives[0].sourceRef).toMatch(/^content:\/\/sha256\/[a-f0-9]{64}$/);
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
    });

    await expect(service.ingest({
      sourcePath,
      originalName: "source.mp4",
      declaredMediaType: "video/mp4",
    })).rejects.toThrow(/proxy verification/i);
    expect(await readdir(workRoot)).toEqual([]);
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
});
