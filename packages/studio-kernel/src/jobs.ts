import type { StudioProject } from "@toolshape/studio-domain";
import { STUDIO_SCHEMA_VERSION } from "./contracts";

export type JobStatus =
  | "created"
  | "queued"
  | "running"
  | "waiting_for_input"
  | "retry_scheduled"
  | "completed"
  | "failed"
  | "cancel_requested"
  | "cancelled";

export interface JobProgress {
  fraction: number;
  stage: string;
  message: string | null;
}

export interface StudioRenderRequest {
  cover_asset_id: string;
  preset_id: string;
  output_name: string;
}

export interface DurableJob {
  schema_version: string;
  job_id: string;
  operation_id: string;
  trace_id: string;
  project_id: string;
  project_revision: number;
  type: "studio.render";
  status: JobStatus;
  progress: JobProgress;
  inputs: string[];
  outputs: string[];
  attempt: number;
  max_attempts: number;
  cancel_supported: boolean;
  error_ref: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface JobEvent {
  event_id: string;
  job_id: string;
  sequence: number;
  status: JobStatus;
  progress: JobProgress;
  message: string | null;
  created_at: string;
}

export interface ArtifactRecord {
  schema_version: string;
  artifact_id: string;
  logical_name: string;
  media_type: string;
  size_bytes: number;
  digest: string;
  source: string[];
  producer: {
    operation_id: string;
    job_id: string;
    toolchain: Array<Record<string, unknown>>;
  };
  sensitivity: "public" | "internal" | "private" | "secret";
  retention_class: "ephemeral" | "session" | "project" | "account" | "legal_hold";
  licence: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface QueueRenderContext {
  operationId: string;
  traceId: string;
  createdAt: string;
}

export interface StudioJobGateway {
  queueRender(
    project: StudioProject,
    request: StudioRenderRequest,
    context: QueueRenderContext,
  ): DurableJob;
  getJob(jobId: string): DurableJob | null;
  requestCancel(jobId: string): DurableJob;
}

export interface StudioJobRepository {
  insertJob(job: DurableJob, request: StudioRenderRequest): void;
  getJob(jobId: string): DurableJob | null;
  getRenderRequest(jobId: string): StudioRenderRequest;
  claimNextJob(): DurableJob | null;
  updateJob(job: DurableJob, message?: string | null): void;
  requestCancel(jobId: string): DurableJob;
  recoverInterruptedJobs(): number;
  listJobEvents(jobId: string): JobEvent[];
  saveArtifact(artifact: ArtifactRecord): void;
  completeJob(job: DurableJob, artifact: ArtifactRecord): void;
  getArtifact(artifactId: string): ArtifactRecord | null;
}

export function assertStudioRenderRequest(value: unknown): asserts value is StudioRenderRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("input.render must be an object.");
  }
  const request = value as Partial<StudioRenderRequest>;
  if (
    typeof request.cover_asset_id !== "string" ||
    typeof request.preset_id !== "string" ||
    typeof request.output_name !== "string"
  ) {
    throw new TypeError("Render request requires cover_asset_id, preset_id, and output_name.");
  }
  if (
    /[\\/]/.test(request.output_name) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.mp4$/.test(request.output_name)
  ) {
    throw new TypeError("Render output_name must be a safe .mp4 filename.");
  }
}

function assertProjectRenderRefs(project: StudioProject, request: StudioRenderRequest): void {
  if (!project.assets.some((asset) => asset.id === request.cover_asset_id)) {
    throw new RangeError(`Unknown cover asset: ${request.cover_asset_id}`);
  }
  if (!project.renderPresets.some((preset) => preset.id === request.preset_id)) {
    throw new RangeError(`Unknown render preset: ${request.preset_id}`);
  }
}

export class MemoryStudioJobGateway implements StudioJobGateway {
  private readonly jobs = new Map<string, DurableJob>();

  queueRender(
    project: StudioProject,
    request: StudioRenderRequest,
    context: QueueRenderContext,
  ): DurableJob {
    assertStudioRenderRequest(request);
    assertProjectRenderRefs(project, request);
    const now = new Date().toISOString();
    const job: DurableJob = {
      schema_version: STUDIO_SCHEMA_VERSION,
      job_id: globalThis.crypto.randomUUID(),
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
    this.jobs.set(job.job_id, structuredClone(job));
    return structuredClone(job);
  }

  getJob(jobId: string): DurableJob | null {
    const job = this.jobs.get(jobId);
    return job ? structuredClone(job) : null;
  }

  requestCancel(jobId: string): DurableJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new RangeError(`Unknown job: ${jobId}`);
    if (["queued", "retry_scheduled", "created"].includes(job.status)) {
      job.status = "cancelled";
      job.progress = { ...job.progress, stage: "cancelled", message: "Cancelled before execution." };
      job.completed_at = new Date().toISOString();
    } else if (job.status === "running") {
      job.status = "cancel_requested";
      job.progress = { ...job.progress, stage: "cancelling", message: "Cancellation requested." };
    }
    job.updated_at = new Date().toISOString();
    return structuredClone(job);
  }

  list(): DurableJob[] {
    return [...this.jobs.values()].map((job) => structuredClone(job));
  }
}
