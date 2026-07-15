import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  STUDIO_SCHEMA_VERSION,
  StudioKernel,
  type OperationEnvelope,
} from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import {
  DurableRenderJobService,
  type RenderPlan,
  type RenderVerificationReport,
} from "../src";

const temporaryRoots: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture(): Promise<{
  root: string;
  repository: SqliteStudioRepository;
  projectId: string;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-render-jobs-"));
  temporaryRoots.push(root);
  const bytes = new TextEncoder().encode("generated-cover-fixture");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const contentFile = path.join(root, "objects", digest.slice(0, 2), digest);
  await mkdir(path.dirname(contentFile), { recursive: true });
  await writeFile(contentFile, bytes);
  const project = createGoldenStudioProject();
  const asset = project.assets.find((candidate) => candidate.id === "asset-product-image")!;
  asset.contentHash = `sha256:${digest}`;
  asset.sourceRef = `content://sha256/${digest}`;
  const repository = new SqliteStudioRepository(path.join(root, "studio.sqlite"));
  repository.createProject(project);
  return { root, repository, projectId: project.id };
}

function renderEnvelope(): OperationEnvelope {
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: randomUUID(),
    idempotency_key: `render-job-${randomUUID()}`,
    trace_id: `render-trace-${randomUUID()}`,
    actor: { id: "render-test", type: "service" },
    intent: "Queue a durable verified render",
    capability: { id: "studio.project.render", version: STUDIO_SCHEMA_VERSION },
    target: {
      resource: "toolshape-studio://projects/project-launch-film",
      expected_revision: 0,
    },
    input: {
      render: {
        cover_asset_id: "asset-product-image",
        preset_id: "render-social-portrait",
        output_name: "durable-proof.mp4",
      },
    },
    risk: { level: "low" },
    authorization: { grant_ids: ["studio.project.render"] },
    execution: { dry_run: false, atomicity: "atomic" },
    retention: { class: "project", content_storage: "local" },
    created_at: new Date(0).toISOString(),
  };
}

const verifiedReport: RenderVerificationReport = {
  passed: true,
  checks: [{ name: "test verifier", passed: true, actual: "verified" }],
  probe: { format: { format_name: "mp4", duration: "8.000" }, streams: [] },
};

describe("durable render worker", () => {
  it("moves a queued job to a verified immutable artifact", async () => {
    const { root, repository } = await fixture();
    let capturedPlan: RenderPlan | null = null;
    const service = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeRender: async (plan) => {
        capturedPlan = plan;
        await mkdir(path.dirname(plan.finalOutputPath), { recursive: true });
        await writeFile(plan.finalOutputPath, new TextEncoder().encode("verified-video"));
        return verifiedReport;
      },
      toolchainProvider: async () => [{ name: "ffmpeg", version: "test-8.1.1" }],
    });
    const accepted = new StudioKernel(repository, service).invoke(renderEnvelope());
    expect(accepted.status).toBe("accepted_job");

    const completed = await service.runNext();
    expect(completed?.status).toBe("completed");
    expect(completed?.progress.fraction).toBe(1);
    expect(capturedPlan?.args).toContain("libx264");
    expect(capturedPlan?.finalOutputPath.startsWith(path.join(root, "artifacts"))).toBe(true);
    const artifactId = completed!.outputs[0].split("/").at(-1)!;
    const artifact = repository.getArtifact(artifactId);
    expect(artifact?.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(artifact?.producer.job_id).toBe(completed?.job_id);
    expect(repository.listJobEvents(completed!.job_id).at(-1)?.status).toBe("completed");
    repository.close();
  });

  it("observes a durable cancellation request while work is running", async () => {
    const { root, repository } = await fixture();
    let started!: () => void;
    const startedPromise = new Promise<void>((resolve) => { started = resolve; });
    const service = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      cancellationPollMs: 5,
      executeRender: async (_plan, options) => {
        started();
        return await new Promise<RenderVerificationReport>((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("cancelled", "AbortError")),
            { once: true },
          );
        });
      },
    });
    const accepted = new StudioKernel(repository, service).invoke(renderEnvelope());
    const jobId = accepted.job!.job_id;
    const work = service.runNext();
    await startedPromise;
    expect(service.requestCancel(jobId).status).toBe("cancel_requested");
    const cancelled = await work;
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.outputs).toEqual([]);
    repository.close();
  });

  it("does not register failed output and schedules a bounded retry", async () => {
    const { root, repository } = await fixture();
    const service = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
      executeRender: async (plan) => {
        await mkdir(path.dirname(plan.finalOutputPath), { recursive: true });
        await writeFile(plan.finalOutputPath, new Uint8Array([1, 2, 3]));
        throw new Error("corrupt encoder output");
      },
    });
    new StudioKernel(repository, service).invoke(renderEnvelope());
    const failedAttempt = await service.runNext();
    expect(failedAttempt?.status).toBe("retry_scheduled");
    expect(failedAttempt?.outputs).toEqual([]);
    const events = repository.listJobEvents(failedAttempt!.job_id);
    expect(events.at(-1)?.status).toBe("retry_scheduled");
    repository.close();
  });

  it("rejects non-content-addressed fixture sources before queueing", async () => {
    const { root, repository } = await fixture();
    const project = repository.getProject("project-launch-film")!;
    project.assets.find((asset) => asset.id === "asset-product-image")!.sourceRef = "fixture://unsafe-for-worker";
    project.id = "fixture-source-project";
    repository.createProject(project);
    const service = new DurableRenderJobService(repository, {
      contentRoot: path.join(root, "objects"),
      artifactRoot: path.join(root, "artifacts"),
    });
    const request = renderEnvelope();
    request.target.resource = "toolshape-studio://projects/fixture-source-project";
    expect(() => new StudioKernel(repository, service).invoke(request)).toThrow(/content:\/\/sha256/i);
    repository.close();
  });
});
