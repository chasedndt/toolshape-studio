import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  STUDIO_SCHEMA_VERSION,
  type ArtifactRecord,
  type DurableJob,
  type StudioRenderRequest,
} from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "../src";

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function temporaryDatabase(): Promise<{ root: string; databasePath: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-jobs-"));
  temporaryRoots.push(root);
  return { root, databasePath: path.join(root, "studio.sqlite") };
}

function job(overrides: Partial<DurableJob> = {}): DurableJob {
  const now = new Date(0).toISOString();
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    job_id: randomUUID(),
    operation_id: randomUUID(),
    trace_id: `trace-${randomUUID()}`,
    project_id: "project-launch-film",
    project_revision: 0,
    type: "studio.render",
    status: "queued",
    progress: { fraction: 0, stage: "queued", message: "Queued." },
    inputs: ["toolshape-studio://projects/project-launch-film/revisions/0"],
    outputs: [],
    attempt: 0,
    max_attempts: 2,
    cancel_supported: true,
    error_ref: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    ...overrides,
  };
}

const request: StudioRenderRequest = {
  cover_asset_id: "asset-product-image",
  preset_id: "render-social-portrait",
  output_name: "queued-proof.mp4",
};

describe("SQLite durable jobs", () => {
  it("claims one job atomically and records ordered events", async () => {
    const { databasePath } = await temporaryDatabase();
    const repository = new SqliteStudioRepository(databasePath);
    const queued = job();
    repository.insertJob(queued, request);

    const claimed = repository.claimNextJob();
    expect(claimed?.job_id).toBe(queued.job_id);
    expect(claimed?.status).toBe("running");
    expect(claimed?.attempt).toBe(1);
    expect(repository.claimNextJob()).toBeNull();
    expect(repository.getRenderRequest(queued.job_id)).toEqual(request);
    expect(repository.listJobEvents(queued.job_id).map((event) => event.status)).toEqual([
      "queued",
      "running",
    ]);
    repository.close();
  });

  it("cancels queued work idempotently", async () => {
    const { databasePath } = await temporaryDatabase();
    const repository = new SqliteStudioRepository(databasePath);
    const queued = job();
    repository.insertJob(queued, request);
    expect(repository.requestCancel(queued.job_id).status).toBe("cancelled");
    expect(repository.requestCancel(queued.job_id).status).toBe("cancelled");
    expect(repository.getJob(queued.job_id)?.completed_at).not.toBeNull();
    repository.close();
  });

  it("recovers interrupted running work to a retry after reopen", async () => {
    const { databasePath } = await temporaryDatabase();
    const first = new SqliteStudioRepository(databasePath);
    const queued = job();
    first.insertJob(queued, request);
    expect(first.claimNextJob()?.status).toBe("running");
    first.close();

    const reopened = new SqliteStudioRepository(databasePath);
    expect(reopened.recoverInterruptedJobs()).toBe(1);
    expect(reopened.getJob(queued.job_id)?.status).toBe("retry_scheduled");
    expect(reopened.claimNextJob()?.attempt).toBe(2);
    reopened.close();
  });

  it("persists immutable artifact metadata after a job", async () => {
    const { databasePath } = await temporaryDatabase();
    const repository = new SqliteStudioRepository(databasePath);
    const artifact: ArtifactRecord = {
      schema_version: STUDIO_SCHEMA_VERSION,
      artifact_id: randomUUID(),
      logical_name: "queued-proof.mp4",
      media_type: "video/mp4",
      size_bytes: 1234,
      digest: `sha256:${"a".repeat(64)}`,
      source: ["toolshape-studio://projects/project-launch-film/revisions/0"],
      producer: {
        operation_id: randomUUID(),
        job_id: randomUUID(),
        toolchain: [{ name: "ffmpeg", version: "test" }],
      },
      sensitivity: "private",
      retention_class: "project",
      licence: null,
      created_at: new Date(0).toISOString(),
      expires_at: null,
    };
    repository.saveArtifact(artifact);
    expect(repository.getArtifact(artifact.artifact_id)).toEqual(artifact);
    expect(() => repository.saveArtifact(artifact)).toThrow(/artifact/i);
    repository.close();
  });
});
