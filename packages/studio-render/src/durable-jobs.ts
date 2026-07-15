import { createHash, randomUUID } from "node:crypto";
import { accessSync } from "node:fs";
import { readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { StudioProject } from "@toolshape/studio-domain";
import { toSeconds } from "@toolshape/studio-engine";
import {
  STUDIO_SCHEMA_VERSION,
  assertStudioRenderRequest,
  type ArtifactRecord,
  type DurableJob,
  type QueueRenderContext,
  type StudioJobGateway,
  type StudioJobRepository,
  type StudioRenderRequest,
} from "@toolshape/studio-kernel";
import {
  createFfmpegRenderPlan,
  type RenderPlan,
} from "./render-plan";
import {
  executeVerifiedRender,
  probeMediaToolchain,
  type RenderVerificationReport,
  type RunRenderOptions,
} from "./runner";

type RenderExecutor = (
  plan: RenderPlan,
  options?: RunRenderOptions,
) => Promise<RenderVerificationReport>;

export interface DurableRenderJobOptions {
  contentRoot: string;
  artifactRoot: string;
  executeRender?: RenderExecutor;
  toolchainProvider?: () => Promise<Array<Record<string, unknown>>>;
  cancellationPollMs?: number;
}

function isWithin(root: string, target: string): boolean {
  const normalizedRoot = `${path.resolve(root)}${path.sep}`.toLowerCase();
  return path.resolve(target).toLowerCase().startsWith(normalizedRoot);
}

function contentPath(root: string, sourceRef: string): string {
  const match = /^content:\/\/sha256\/([a-f0-9]{64})$/i.exec(sourceRef);
  if (!match) throw new TypeError("Render source must be an immutable content://sha256 asset.");
  const target = path.resolve(root, match[1].slice(0, 2), match[1]);
  if (!isWithin(root, target)) throw new TypeError("Resolved render source escaped the content root.");
  accessSync(target);
  return target;
}

function createJob(
  project: StudioProject,
  request: StudioRenderRequest,
  context: QueueRenderContext,
): DurableJob {
  const now = new Date().toISOString();
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    job_id: randomUUID(),
    operation_id: context.operationId,
    trace_id: context.traceId,
    project_id: project.id,
    project_revision: project.revision,
    type: "studio.render",
    status: "queued",
    progress: { fraction: 0, stage: "queued", message: "Render is queued." },
    inputs: [
      `toolshape-studio://projects/${encodeURIComponent(project.id)}/assets/${encodeURIComponent(request.cover_asset_id)}`,
      `toolshape-studio://projects/${encodeURIComponent(project.id)}/revisions/${project.revision}`,
    ],
    outputs: [],
    attempt: 0,
    max_attempts: 2,
    cancel_supported: true,
    error_ref: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
}

export class DurableRenderJobService implements StudioJobGateway {
  private readonly contentRoot: string;
  private readonly artifactRoot: string;
  private readonly executeRender: RenderExecutor;
  private readonly toolchainProvider: () => Promise<Array<Record<string, unknown>>>;
  private readonly cancellationPollMs: number;

  constructor(
    private readonly repository: StudioJobRepository & {
      getRevision(projectId: string, revision: number): StudioProject | null;
    },
    options: DurableRenderJobOptions,
  ) {
    this.contentRoot = path.resolve(options.contentRoot);
    this.artifactRoot = path.resolve(options.artifactRoot);
    this.executeRender = options.executeRender ?? executeVerifiedRender;
    this.toolchainProvider = options.toolchainProvider ?? probeMediaToolchain;
    this.cancellationPollMs = options.cancellationPollMs ?? 100;
  }

  queueRender(
    project: StudioProject,
    request: StudioRenderRequest,
    context: QueueRenderContext,
  ): DurableJob {
    assertStudioRenderRequest(request);
    const asset = project.assets.find((candidate) => candidate.id === request.cover_asset_id);
    if (!asset) throw new RangeError(`Unknown cover asset: ${request.cover_asset_id}`);
    if (!project.renderPresets.some((preset) => preset.id === request.preset_id)) {
      throw new RangeError(`Unknown render preset: ${request.preset_id}`);
    }
    contentPath(this.contentRoot, asset.sourceRef);
    const outputPath = path.resolve(this.artifactRoot, request.output_name);
    if (!isWithin(this.artifactRoot, outputPath)) {
      throw new TypeError("Resolved render output escaped the artifact root.");
    }
    const job = createJob(project, request, context);
    this.repository.insertJob(job, request);
    return job;
  }

  getJob(jobId: string): DurableJob | null {
    return this.repository.getJob(jobId);
  }

  requestCancel(jobId: string): DurableJob {
    return this.repository.requestCancel(jobId);
  }

  recoverInterruptedJobs(): number {
    return this.repository.recoverInterruptedJobs();
  }

  async runNext(): Promise<DurableJob | null> {
    const job = this.repository.claimNextJob();
    if (!job) return null;
    const request = this.repository.getRenderRequest(job.job_id);
    const project = this.repository.getRevision(job.project_id, job.project_revision);
    if (!project) {
      job.status = "failed";
      job.error_ref = "studio.render.project_revision_missing";
      job.progress = { fraction: 0, stage: "failed", message: "Project revision is unavailable." };
      job.updated_at = new Date().toISOString();
      job.completed_at = job.updated_at;
      this.repository.updateJob(job, "Project revision unavailable.");
      return job;
    }
    const asset = project.assets.find((candidate) => candidate.id === request.cover_asset_id);
    const preset = project.renderPresets.find((candidate) => candidate.id === request.preset_id);
    if (!asset || !preset) throw new Error("Queued render references are no longer resolvable.");
    const coverPath = contentPath(this.contentRoot, asset.sourceRef);
    const outputPath = path.resolve(
      this.artifactRoot,
      `${job.job_id}-${request.output_name}`,
    );
    if (!isWithin(this.artifactRoot, outputPath)) throw new TypeError("Render output escaped root.");
    const durationSeconds = toSeconds(project.timeline.duration);
    const plan = createFfmpegRenderPlan({
      coverPath,
      outputPath,
      width: preset.width,
      height: preset.height,
      durationSeconds,
      frameRate: preset.frameRate.numerator / preset.frameRate.denominator,
    });
    const controller = new AbortController();
    const poll = setInterval(() => {
      const current = this.repository.getJob(job.job_id);
      if (current?.status === "cancel_requested") controller.abort();
    }, this.cancellationPollMs);

    try {
      const report = await this.executeRender(plan, {
        signal: controller.signal,
        onProgress: (seconds) => {
          job.progress = {
            fraction: Math.max(0, Math.min(0.99, seconds / durationSeconds)),
            stage: "rendering",
            message: `Rendered ${seconds.toFixed(2)} seconds.`,
          };
          job.updated_at = new Date().toISOString();
          this.repository.updateJob(job, "Render progress.");
        },
      });
      const bytes = await readFile(plan.finalOutputPath);
      const details = await stat(plan.finalOutputPath);
      const artifact: ArtifactRecord = {
        schema_version: STUDIO_SCHEMA_VERSION,
        artifact_id: randomUUID(),
        logical_name: request.output_name,
        media_type: "video/mp4",
        size_bytes: details.size,
        digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
        source: [
          `toolshape-studio://projects/${encodeURIComponent(job.project_id)}/revisions/${job.project_revision}`,
          ...job.inputs,
        ],
        producer: {
          operation_id: job.operation_id,
          job_id: job.job_id,
          toolchain: [
            ...(await this.toolchainProvider()),
            { name: "verification", checks: report.checks },
          ],
        },
        sensitivity: "private",
        retention_class: "project",
        licence: null,
        created_at: new Date().toISOString(),
        expires_at: null,
      };
      job.status = "completed";
      job.progress = { fraction: 1, stage: "completed", message: "Verified render completed." };
      job.outputs = [`toolshape-studio://artifacts/${artifact.artifact_id}`];
      job.updated_at = new Date().toISOString();
      job.completed_at = job.updated_at;
      this.repository.completeJob(job, artifact);
      return job;
    } catch (error) {
      await rm(plan.finalOutputPath, { force: true });
      await rm(plan.partialOutputPath, { force: true });
      const cancelled = controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError");
      if (cancelled) {
        job.status = "cancelled";
        job.progress = { ...job.progress, stage: "cancelled", message: "Render cancelled." };
        job.error_ref = null;
        job.completed_at = new Date().toISOString();
      } else if (job.attempt < job.max_attempts) {
        job.status = "retry_scheduled";
        job.progress = { fraction: 0, stage: "retry_scheduled", message: "Render failed; retry scheduled." };
        job.error_ref = "studio.render.worker_failure";
      } else {
        job.status = "failed";
        job.progress = { ...job.progress, stage: "failed", message: "Render failed." };
        job.error_ref = "studio.render.worker_failure";
        job.completed_at = new Date().toISOString();
      }
      job.updated_at = new Date().toISOString();
      this.repository.updateJob(job, cancelled ? "Render cancelled." : "Render worker failed.");
      return job;
    } finally {
      clearInterval(poll);
    }
  }
}
