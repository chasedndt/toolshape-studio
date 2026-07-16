import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { STUDIO_SCHEMA_VERSION, StudioKernel, type OperationEnvelope } from "@toolshape/studio-kernel";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { ContentAddressedAssetStore, SqliteStudioRepository } from "../src";

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-studio-"));
  temporaryRoots.push(root);
  return root;
}

function editEnvelope(): OperationEnvelope {
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: randomUUID(),
    idempotency_key: `sqlite-${randomUUID()}`,
    trace_id: `trace-${randomUUID()}`,
    actor: { id: "test", type: "service" },
    intent: "Prove durable editing",
    capability: { id: "studio.project.apply_operations", version: STUDIO_SCHEMA_VERSION },
    target: { resource: "toolshape-studio://projects/project-launch-film", expected_revision: 0 },
    input: {
      operations: [
        {
          operationId: randomUUID(),
          type: "scene.node.update-text",
          actor: "operator",
          expectedRevision: 0,
          payload: { sceneId: "scene-hero", nodeId: "node-title", content: "Persisted title" },
        },
      ],
    },
    risk: { level: "low" },
    authorization: { grant_ids: ["studio.project.apply_operations"] },
    execution: { dry_run: false, atomicity: "atomic" },
    retention: { class: "project", content_storage: "local" },
    created_at: new Date(0).toISOString(),
  };
}

describe("SQLite project repository", () => {
  it("recovers project and idempotent results after a process-style reopen", async () => {
    const root = await temporaryRoot();
    const databasePath = path.join(root, "studio.sqlite");
    const request = editEnvelope();
    const firstRepository = new SqliteStudioRepository(databasePath);
    firstRepository.createProject(createGoldenStudioProject());
    const first = new StudioKernel(firstRepository).invoke(request);
    firstRepository.close();

    const reopened = new SqliteStudioRepository(databasePath);
    const replay = new StudioKernel(reopened).invoke(request);
    expect(replay).toEqual(first);
    expect(reopened.getProject("project-launch-film")?.revision).toBe(1);
    expect(reopened.getRevision("project-launch-film", 0)?.revision).toBe(0);
    reopened.close();
  });

  it("migrates a v1 project before durable storage and reopen", async () => {
    const root = await temporaryRoot();
    const databasePath = path.join(root, "studio.sqlite");
    const legacy = createGoldenStudioProject() as unknown as Record<string, unknown>;
    legacy.schemaVersion = 1;
    legacy.assets = (legacy.assets as Array<Record<string, unknown>>).map((asset) => {
      const value = { ...asset };
      delete value.probe;
      delete value.derivatives;
      return value;
    });
    const repository = new SqliteStudioRepository(databasePath);
    repository.createProject(legacy as unknown as ReturnType<typeof createGoldenStudioProject>);
    repository.close();
    const reopened = new SqliteStudioRepository(databasePath);
    const project = reopened.getProject("project-launch-film");
    expect(project?.schemaVersion).toBe(3);
    expect(project?.assets.every((asset) => asset.derivatives.length === 0)).toBe(true);
    reopened.close();
  });
});

describe("content-addressed asset imports", () => {
  it("stores immutable bytes once and reports deduplication", async () => {
    const root = await temporaryRoot();
    const store = new ContentAddressedAssetStore(path.join(root, "objects"));
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const first = await store.import({ bytes, originalName: "fixture.png", mediaType: "image/png" });
    const second = await store.import({ bytes, originalName: "fixture-copy.png", mediaType: "image/png" });
    expect(first.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(second.contentPath).toBe(first.contentPath);
    expect(second.deduplicated).toBe(true);
    expect(await readFile(first.contentPath)).toEqual(Buffer.from(bytes));
  });

  it("rejects traversal, executable media, and empty payloads", async () => {
    const root = await temporaryRoot();
    const store = new ContentAddressedAssetStore(path.join(root, "objects"));
    const bytes = new Uint8Array([1]);
    await expect(store.import({ bytes, originalName: "../escape.png", mediaType: "image/png" })).rejects.toThrow(/path/i);
    await expect(store.import({ bytes, originalName: "payload.exe", mediaType: "application/x-msdownload" })).rejects.toThrow(/media type/i);
    await expect(store.import({ bytes: new Uint8Array(), originalName: "empty.png", mediaType: "image/png" })).rejects.toThrow(/size/i);
  });

  it("rejects a declared media type that disagrees with the byte signature", async () => {
    const root = await temporaryRoot();
    const store = new ContentAddressedAssetStore(path.join(root, "objects"));
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45,
      0x66, 0x6d, 0x74, 0x20,
    ]);
    await expect(
      store.import({ bytes: wav, originalName: "disguised.mp4", mediaType: "video/mp4" }),
    ).rejects.toThrow(/signature|declared media/i);
  });
});
