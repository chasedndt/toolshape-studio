import { createHash, randomUUID } from "node:crypto";
import { accessSync } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { StudioProject } from "@toolshape/studio-domain";
import { toSeconds } from "@toolshape/studio-engine";
import {
  STUDIO_SCHEMA_VERSION,
  assertStudioExportRequest,
  assertStudioRenderRequest,
  type ArtifactRecord,
  type DurableJob,
  type QueueRenderContext,
  type StudioJobGateway,
  type StudioJobRepository,
  type StudioExportRequest,
  type StudioRenderRequest,
} from "@toolshape/studio-kernel";
import {
  createFfmpegRenderPlan,
  type RenderPlan,
} from "./render-plan";
import { createTimelineRenderPlan } from "./timeline-render-plan";
import {
  createVariantExportPlans,
  type ImageExportPlan,
} from "./image-export";
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

/**
 * Turns an export plan into bytes.
 *
 * Injected rather than imported because rasterising needs a browser, and a
 * browser has no business being a dependency of the render package — the SVG
 * path, which is most of the value, needs nothing at all. The host wires in a
 * rasteriser when it has one.
 */
export type ExportExecutor = (plan: ImageExportPlan) => Promise<{ outputPath: string; bytes: number }>;

/**
 * The default executor.
 *
 * SVG is written directly; the rasteriser is imported only when a raster format
 * is actually asked for. A host that only ever exports SVG therefore never
 * loads a browser, and one that has no browser installed still gets a working
 * SVG export rather than an import error at startup.
 */
const defaultExportExecutor: ExportExecutor = async (plan) => {
  const { executeImageExport } = await import("./svg-rasteriser");
  return executeImageExport(plan);
};

export interface DurableRenderJobOptions {
  contentRoot: string;
  artifactRoot: string;
  executeRender?: RenderExecutor;
  executeExport?: ExportExecutor;
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
  private readonly executeExport: ExportExecutor;
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
    this.executeExport = options.executeExport ?? defaultExportExecutor;
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

  queueExport(
    project: StudioProject,
    request: StudioExportRequest,
    context: QueueRenderContext,
  ): DurableJob {
    assertStudioExportRequest(request);
    for (const sceneId of request.scene_ids) {
      if (!project.scenes.some((scene) => scene.id === sceneId)) {
        throw new RangeError(`Unknown scene: ${sceneId}`);
      }
    }
    const directory = path.resolve(this.artifactRoot, request.output_name);
    if (!isWithin(this.artifactRoot, directory)) {
      throw new TypeError("Resolved export directory escaped the artifact root.");
    }
    const now = new Date().toISOString();
    const job: DurableJob = {
      schema_version: STUDIO_SCHEMA_VERSION,
      job_id: randomUUID(),
      operation_id: context.operationId,
      trace_id: context.traceId,
      project_id: project.id,
      project_revision: project.revision,
      type: "studio.design.export",
      status: "queued",
      progress: { fraction: 0, stage: "queued", message: "Export is queued." },
      inputs: [
        ...request.scene_ids.map(
          (sceneId) =>
            `toolshape-studio://projects/${encodeURIComponent(project.id)}/scenes/${encodeURIComponent(sceneId)}`,
        ),
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

  /**
   * Builds a timeline render plan, or returns null when the timeline cannot be
   * rendered from what is on disk.
   *
   * Resolution failures are expected rather than exceptional: a project can
   * reference an asset whose bytes were never imported. Returning null lets the
   * caller fall back instead of failing the job.
   */
  private planTimelineRender(
    project: StudioProject,
    outputPath: string,
    width: number,
    height: number,
    frameRate: number,
  ): RenderPlan | null {
    try {
      const sources = project.assets
        .filter((asset) => asset.kind === "video" || asset.kind === "audio")
        .map((asset) => ({
          assetId: asset.id,
          path: contentPath(this.contentRoot, asset.sourceRef),
          hasAudio: asset.kind === "audio" || Boolean(asset.probe?.audio),
        }));
      return createTimelineRenderPlan({ project, sources, outputPath, width, height, frameRate });
    } catch {
      return null;
    }
  }

  /**
   * Reads the image bytes a scene needs, keyed by asset id.
   *
   * An asset whose bytes are not in the content store is left out rather than
   * substituted, so the renderer refuses the export instead of producing a
   * design with a hole where a picture should be.
   */
  private async imageDataFor(
    project: StudioProject,
    sceneIds: readonly string[],
  ): Promise<Record<string, { mediaType: string; base64: string }>> {
    const needed = new Set<string>();
    for (const scene of project.scenes) {
      if (!sceneIds.includes(scene.id)) continue;
      for (const node of scene.nodes) {
        if (node.type === "image") needed.add(node.assetId);
      }
    }

    const data: Record<string, { mediaType: string; base64: string }> = {};
    for (const assetId of needed) {
      const asset = project.assets.find((candidate) => candidate.id === assetId);
      if (!asset || asset.kind !== "image") continue;
      try {
        const bytes = await readFile(contentPath(this.contentRoot, asset.sourceRef));
        data[assetId] = { mediaType: asset.mediaType, base64: bytes.toString("base64") };
      } catch {
        // Left out deliberately; the renderer decides what a missing asset means.
      }
    }
    return data;
  }

  private async runExport(job: DurableJob): Promise<DurableJob> {
    const request = this.repository.getExportRequest(job.job_id);
    const project = this.repository.getRevision(job.project_id, job.project_revision);
    if (!project) {
      return this.failJob(job, "studio.export.project_revision_missing", "Project revision is unavailable.");
    }

    const directory = path.resolve(this.artifactRoot, request.output_name);
    if (!isWithin(this.artifactRoot, directory)) throw new TypeError("Export output escaped root.");

    try {
      await mkdir(directory, { recursive: true });
      const scenes = request.scene_ids.map((sceneId) => {
        const scene = project.scenes.find((candidate) => candidate.id === sceneId);
        if (!scene) throw new RangeError(`Queued export references a missing scene: ${sceneId}`);
        return scene;
      });

      const plans = createVariantExportPlans({
        scenes,
        directory,
        format: request.format,
        scale: request.scale,
        quality: request.quality,
        transparentBackground: request.transparent_background,
        effects: project.effects,
        imageData: await this.imageDataFor(project, request.scene_ids),
      });

      const artifacts: ArtifactRecord[] = [];
      for (const [index, plan] of plans.entries()) {
        // Checked between files rather than only at the start: a batch of nine
        // exports is long enough that a cancellation arriving partway through
        // should not have to wait for all of them.
        if (this.repository.getJob(job.job_id)?.status === "cancel_requested") {
          await rm(directory, { recursive: true, force: true }).catch(() => {});
          job.status = "cancelled";
          job.progress = { ...job.progress, stage: "cancelled", message: "Export cancelled." };
          job.error_ref = null;
          job.updated_at = new Date().toISOString();
          job.completed_at = job.updated_at;
          this.repository.updateJob(job, "Export cancelled.");
          return job;
        }

        const written = await this.executeExport(plan);
        const bytes = await readFile(written.outputPath);
        artifacts.push({
          schema_version: STUDIO_SCHEMA_VERSION,
          artifact_id: randomUUID(),
          logical_name: path.basename(written.outputPath),
          media_type: plan.mediaType,
          size_bytes: written.bytes,
          digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
          source: [
            `toolshape-studio://projects/${encodeURIComponent(job.project_id)}/revisions/${job.project_revision}`,
            ...job.inputs,
          ],
          producer: {
            operation_id: job.operation_id,
            job_id: job.job_id,
            toolchain: [{ name: "scene-svg", format: plan.format, width: plan.width, height: plan.height }],
          },
          sensitivity: "private",
          retention_class: "project",
          licence: null,
          created_at: new Date().toISOString(),
          expires_at: null,
        });

        job.progress = {
          fraction: Math.min(0.99, (index + 1) / plans.length),
          stage: "exporting",
          message: `Exported ${index + 1} of ${plans.length}.`,
        };
        job.updated_at = new Date().toISOString();
        this.repository.updateJob(job, "Export progress.");
      }

      job.status = "completed";
      job.progress = { fraction: 1, stage: "completed", message: `Exported ${artifacts.length} files.` };
      job.outputs = artifacts.map((artifact) => `toolshape-studio://artifacts/${artifact.artifact_id}`);
      job.updated_at = new Date().toISOString();
      job.completed_at = job.updated_at;
      // Every file is its own artifact, so a caller can fetch one variant
      // without knowing about the rest. The last completes the job, because
      // completeJob is what makes the status transition atomic.
      for (const artifact of artifacts.slice(0, -1)) this.repository.saveArtifact(artifact);
      this.repository.completeJob(job, artifacts[artifacts.length - 1]);
      return job;
    } catch (error) {
      await rm(directory, { recursive: true, force: true }).catch(() => {});
      if (job.attempt < job.max_attempts) {
        job.status = "retry_scheduled";
        job.progress = { fraction: 0, stage: "retry_scheduled", message: "Export failed; retry scheduled." };
        job.error_ref = "studio.export.worker_failure";
        job.updated_at = new Date().toISOString();
        this.repository.updateJob(job, `Export worker failed: ${String(error)}`);
        return job;
      }
      return this.failJob(job, "studio.export.worker_failure", `Export failed: ${String(error)}`);
    }
  }

  private failJob(job: DurableJob, errorRef: string, message: string): DurableJob {
    job.status = "failed";
    job.error_ref = errorRef;
    job.progress = { ...job.progress, stage: "failed", message };
    job.updated_at = new Date().toISOString();
    job.completed_at = job.updated_at;
    this.repository.updateJob(job, message);
    return job;
  }

  async runNext(): Promise<DurableJob | null> {
    const job = this.repository.claimNextJob();
    if (!job) return null;
    if (job.type === "studio.design.export") return this.runExport(job);
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
    const frameRate = preset.frameRate.numerator / preset.frameRate.denominator;

    // Render the timeline when its sources resolve. The cover render remains
    // the fallback for a project whose media is not yet in the content store —
    // a still frame is a poor export, but it is better than failing a job the
    // caller can do nothing about.
    const plan = this.planTimelineRender(project, outputPath, preset.width, preset.height, frameRate)
      ?? createFfmpegRenderPlan({
        coverPath,
        outputPath,
        width: preset.width,
        height: preset.height,
        durationSeconds: toSeconds(project.timeline.duration),
        frameRate,
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
            fraction: Math.max(0, Math.min(0.99, seconds / plan.expectation.durationSeconds)),
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
