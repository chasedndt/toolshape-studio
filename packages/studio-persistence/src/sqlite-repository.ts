import { DatabaseSync } from "node:sqlite";
import { migrateStudioProject, type Asset, type StudioProject } from "@toolshape/studio-domain";
import type { StoredAsset } from "./content-store";
import {
  RepositoryRevisionConflictError,
  STUDIO_SCHEMA_VERSION,
  type ArtifactRecord,
  type CommitRecord,
  type DurableJob,
  type IdempotencyRecord,
  type JobEvent,
  type JobStatus,
  type OperationResult,
  type StudioJobRepository,
  type StudioRepository,
  type StudioRenderRequest,
  type OperationLogEntry,
} from "@toolshape/studio-kernel";

interface ProjectRow {
  revision: number;
  state_json: string;
}

interface RevisionRow {
  state_json: string;
}

interface IdempotencyRow {
  idempotency_key: string;
  input_digest: string;
  result_json: string;
}

interface JobRow {
  job_id: string;
  operation_id: string;
  trace_id: string;
  project_id: string;
  project_revision: number;
  type: "studio.render";
  status: JobStatus;
  progress_fraction: number;
  progress_stage: string;
  progress_message: string | null;
  inputs_json: string;
  outputs_json: string;
  attempt: number;
  max_attempts: number;
  cancel_supported: number;
  error_ref: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  render_request_json: string;
}

interface EventRow {
  event_id: string;
  job_id: string;
  sequence: number;
  status: JobStatus;
  progress_fraction: number;
  progress_stage: string;
  progress_message: string | null;
  message: string | null;
  created_at: string;
}

interface ArtifactRow {
  metadata_json: string;
}

interface MediaAssetRow {
  metadata_json: string;
}

export class SqliteStudioRepository implements StudioRepository, StudioJobRepository {
  readonly database: DatabaseSync;

  constructor(filename: string) {
    this.database = new DatabaseSync(filename);
    this.migrate();
  }

  private migrate(): void {
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL CHECK (revision >= 0),
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS project_revisions (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL CHECK (revision >= 0),
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (project_id, revision)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS operation_log (
        operation_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        revision_before INTEGER NOT NULL,
        revision_after INTEGER NOT NULL,
        envelope_json TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS idempotency (
        idempotency_key TEXT PRIMARY KEY,
        input_digest TEXT NOT NULL,
        result_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS assets (
        asset_id TEXT PRIMARY KEY,
        digest TEXT NOT NULL UNIQUE,
        media_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
        original_name TEXT NOT NULL,
        content_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS jobs (
        job_id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL,
        trace_id TEXT NOT NULL DEFAULT '',
        project_id TEXT NOT NULL DEFAULT '',
        project_revision INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        progress_fraction REAL NOT NULL DEFAULT 0,
        progress_stage TEXT NOT NULL DEFAULT 'queued',
        progress_message TEXT,
        inputs_json TEXT NOT NULL DEFAULT '[]',
        outputs_json TEXT NOT NULL DEFAULT '[]',
        attempt INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 2,
        cancel_supported INTEGER NOT NULL DEFAULT 1,
        error_ref TEXT,
        created_at TEXT NOT NULL DEFAULT '',
        completed_at TEXT,
        render_request_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS job_events (
        event_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        status TEXT NOT NULL,
        progress_fraction REAL NOT NULL,
        progress_stage TEXT NOT NULL,
        progress_message TEXT,
        message TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(job_id, sequence)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS render_artifacts (
        artifact_id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
      VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
    `);
    this.ensureJobColumns();
    this.ensureAssetColumns();
    this.database.exec(`
      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
      VALUES (2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
      VALUES (3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
    `);
  }

  private ensureAssetColumns(): void {
    const existing = new Set(
      (this.database.prepare("PRAGMA table_info(assets)").all() as unknown as Array<{ name: string }>).map(
        (column) => column.name,
      ),
    );
    if (!existing.has("metadata_json")) {
      this.database.exec("ALTER TABLE assets ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'");
    }
  }

  private ensureJobColumns(): void {
    const existing = new Set(
      (this.database.prepare("PRAGMA table_info(jobs)").all() as unknown as Array<{ name: string }>).map(
        (column) => column.name,
      ),
    );
    const additions: Record<string, string> = {
      trace_id: "TEXT NOT NULL DEFAULT ''",
      project_id: "TEXT NOT NULL DEFAULT ''",
      project_revision: "INTEGER NOT NULL DEFAULT 0",
      progress_fraction: "REAL NOT NULL DEFAULT 0",
      progress_stage: "TEXT NOT NULL DEFAULT 'queued'",
      progress_message: "TEXT",
      inputs_json: "TEXT NOT NULL DEFAULT '[]'",
      outputs_json: "TEXT NOT NULL DEFAULT '[]'",
      attempt: "INTEGER NOT NULL DEFAULT 0",
      max_attempts: "INTEGER NOT NULL DEFAULT 2",
      cancel_supported: "INTEGER NOT NULL DEFAULT 1",
      error_ref: "TEXT",
      created_at: "TEXT NOT NULL DEFAULT ''",
      completed_at: "TEXT",
      render_request_json: "TEXT NOT NULL DEFAULT '{}'",
    };
    for (const [name, definition] of Object.entries(additions)) {
      if (!existing.has(name)) this.database.exec(`ALTER TABLE jobs ADD COLUMN ${name} ${definition}`);
    }
  }

  createProject(project: StudioProject): void {
    const canonical = migrateStudioProject(project);
    const now = new Date().toISOString();
    const state = JSON.stringify(canonical);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare("INSERT INTO projects(id, revision, state_json, updated_at) VALUES (?, ?, ?, ?)")
        .run(canonical.id, canonical.revision, state, now);
      this.database
        .prepare("INSERT INTO project_revisions(project_id, revision, state_json, created_at) VALUES (?, ?, ?, ?)")
        .run(canonical.id, canonical.revision, state, now);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  getProject(projectId: string): StudioProject | null {
    const row = this.database
      .prepare("SELECT revision, state_json FROM projects WHERE id = ?")
      .get(projectId) as unknown as ProjectRow | undefined;
    return row ? migrateStudioProject(JSON.parse(row.state_json)) : null;
  }

  getRevision(projectId: string, revision: number): StudioProject | null {
    const row = this.database
      .prepare("SELECT state_json FROM project_revisions WHERE project_id = ? AND revision = ?")
      .get(projectId, revision) as unknown as RevisionRow | undefined;
    return row ? migrateStudioProject(JSON.parse(row.state_json)) : null;
  }

  listOperations(projectId: string): OperationLogEntry[] {
    const rows = this.database
      .prepare(
        "SELECT operation_id, revision_before, revision_after, envelope_json, created_at FROM operation_log WHERE project_id = ? ORDER BY revision_after ASC",
      )
      .all(projectId) as Array<{
        operation_id: string;
        revision_before: number;
        revision_after: number;
        envelope_json: string;
        created_at: string;
      }>;
    return rows.map((row) => ({
      operationId: row.operation_id,
      revisionBefore: row.revision_before,
      revisionAfter: row.revision_after,
      envelope: JSON.parse(row.envelope_json) as OperationLogEntry["envelope"],
      createdAt: row.created_at,
    }));
  }

  getIdempotency(key: string): IdempotencyRecord | null {
    const row = this.database
      .prepare("SELECT idempotency_key, input_digest, result_json FROM idempotency WHERE idempotency_key = ?")
      .get(key) as unknown as IdempotencyRow | undefined;
    return row
      ? {
          key: row.idempotency_key,
          inputDigest: row.input_digest,
          result: JSON.parse(row.result_json) as OperationResult,
        }
      : null;
  }

  recordIdempotency(record: IdempotencyRecord): void {
    this.database
      .prepare(
        "INSERT INTO idempotency(idempotency_key, input_digest, result_json, created_at) VALUES (?, ?, ?, ?)",
      )
      .run(record.key, record.inputDigest, JSON.stringify(record.result), new Date().toISOString());
  }

  saveMediaAsset(asset: Asset, original: StoredAsset): void {
    if (asset.id !== original.assetId || asset.contentHash !== original.digest) {
      throw new TypeError("Media asset identity does not match its immutable stored original.");
    }
    this.database
      .prepare(
        "INSERT INTO assets(asset_id, digest, media_type, size_bytes, original_name, content_path, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        asset.id,
        original.digest,
        original.mediaType,
        original.sizeBytes,
        original.originalName,
        original.contentPath,
        new Date().toISOString(),
        JSON.stringify(asset),
      );
  }

  getMediaAsset(assetId: string): Asset | null {
    const row = this.database
      .prepare("SELECT metadata_json FROM assets WHERE asset_id = ?")
      .get(assetId) as unknown as MediaAssetRow | undefined;
    return row ? (JSON.parse(row.metadata_json) as Asset) : null;
  }

  commit(record: CommitRecord): void {
    const now = new Date().toISOString();
    const projectJson = JSON.stringify(record.project);
    const resultJson = JSON.stringify(record.result);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const update = this.database
        .prepare("UPDATE projects SET revision = ?, state_json = ?, updated_at = ? WHERE id = ? AND revision = ?")
        .run(record.project.revision, projectJson, now, record.projectId, record.expectedRevision);
      if (Number(update.changes) !== 1) {
        const current = this.getProject(record.projectId);
        throw new RepositoryRevisionConflictError(record.expectedRevision, current?.revision ?? -1);
      }
      this.database
        .prepare("INSERT INTO project_revisions(project_id, revision, state_json, created_at) VALUES (?, ?, ?, ?)")
        .run(record.projectId, record.project.revision, projectJson, now);
      this.database
        .prepare("INSERT INTO operation_log(operation_id, project_id, revision_before, revision_after, envelope_json, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(
          record.envelope.operation_id,
          record.projectId,
          record.expectedRevision,
          record.project.revision,
          JSON.stringify(record.envelope),
          resultJson,
          now,
        );
      this.database
        .prepare("INSERT INTO idempotency(idempotency_key, input_digest, result_json, created_at) VALUES (?, ?, ?, ?)")
        .run(record.envelope.idempotency_key, record.inputDigest, resultJson, now);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private rowToJob(row: JobRow): DurableJob {
    return {
      schema_version: STUDIO_SCHEMA_VERSION,
      job_id: row.job_id,
      operation_id: row.operation_id,
      trace_id: row.trace_id,
      project_id: row.project_id,
      project_revision: row.project_revision,
      type: row.type,
      status: row.status,
      progress: {
        fraction: row.progress_fraction,
        stage: row.progress_stage,
        message: row.progress_message,
      },
      inputs: JSON.parse(row.inputs_json) as string[],
      outputs: JSON.parse(row.outputs_json) as string[],
      attempt: row.attempt,
      max_attempts: row.max_attempts,
      cancel_supported: row.cancel_supported === 1,
      error_ref: row.error_ref,
      created_at: row.created_at,
      updated_at: row.updated_at,
      completed_at: row.completed_at,
    };
  }

  private insertEvent(job: DurableJob, message: string | null = null): void {
    const next = this.database
      .prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM job_events WHERE job_id = ?")
      .get(job.job_id) as unknown as { sequence: number };
    this.database
      .prepare(
        "INSERT INTO job_events(event_id, job_id, sequence, status, progress_fraction, progress_stage, progress_message, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        globalThis.crypto.randomUUID(),
        job.job_id,
        next.sequence,
        job.status,
        job.progress.fraction,
        job.progress.stage,
        job.progress.message,
        message,
        job.updated_at,
      );
  }

  insertJob(job: DurableJob, request: StudioRenderRequest): void {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          "INSERT INTO jobs(job_id, operation_id, trace_id, project_id, project_revision, type, status, payload_json, progress_fraction, progress_stage, progress_message, inputs_json, outputs_json, attempt, max_attempts, cancel_supported, error_ref, created_at, completed_at, render_request_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .run(
          job.job_id,
          job.operation_id,
          job.trace_id,
          job.project_id,
          job.project_revision,
          job.type,
          job.status,
          JSON.stringify({ kind: "studio.render" }),
          job.progress.fraction,
          job.progress.stage,
          job.progress.message,
          JSON.stringify(job.inputs),
          JSON.stringify(job.outputs),
          job.attempt,
          job.max_attempts,
          job.cancel_supported ? 1 : 0,
          job.error_ref,
          job.created_at,
          job.completed_at,
          JSON.stringify(request),
          job.updated_at,
        );
      this.insertEvent(job, "Render queued.");
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  getJob(jobId: string): DurableJob | null {
    const row = this.database.prepare("SELECT * FROM jobs WHERE job_id = ?").get(jobId) as unknown as
      | JobRow
      | undefined;
    return row ? this.rowToJob(row) : null;
  }

  getRenderRequest(jobId: string): StudioRenderRequest {
    const row = this.database
      .prepare("SELECT render_request_json FROM jobs WHERE job_id = ?")
      .get(jobId) as unknown as { render_request_json: string } | undefined;
    if (!row) throw new RangeError(`Unknown job: ${jobId}`);
    return JSON.parse(row.render_request_json) as StudioRenderRequest;
  }

  claimNextJob(): DurableJob | null {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const row = this.database
        .prepare(
          "SELECT * FROM jobs WHERE status IN ('queued', 'retry_scheduled') ORDER BY created_at, job_id LIMIT 1",
        )
        .get() as unknown as JobRow | undefined;
      if (!row) {
        this.database.exec("COMMIT");
        return null;
      }
      const job = this.rowToJob(row);
      job.status = "running";
      job.attempt += 1;
      job.progress = { fraction: 0, stage: "starting", message: "Render worker claimed job." };
      job.updated_at = new Date().toISOString();
      this.writeJob(job);
      this.insertEvent(job, "Worker claimed job.");
      this.database.exec("COMMIT");
      return job;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private writeJob(job: DurableJob): void {
    this.database
      .prepare(
        "UPDATE jobs SET status = ?, progress_fraction = ?, progress_stage = ?, progress_message = ?, outputs_json = ?, attempt = ?, max_attempts = ?, cancel_supported = ?, error_ref = ?, completed_at = ?, updated_at = ? WHERE job_id = ?",
      )
      .run(
        job.status,
        job.progress.fraction,
        job.progress.stage,
        job.progress.message,
        JSON.stringify(job.outputs),
        job.attempt,
        job.max_attempts,
        job.cancel_supported ? 1 : 0,
        job.error_ref,
        job.completed_at,
        job.updated_at,
        job.job_id,
      );
  }

  private assertTransition(before: JobStatus, after: JobStatus): void {
    if (before === after) return;
    const allowed: Record<JobStatus, JobStatus[]> = {
      created: ["queued", "cancelled"],
      queued: ["running", "cancelled"],
      running: ["cancel_requested", "completed", "retry_scheduled", "failed", "cancelled"],
      waiting_for_input: ["queued", "cancel_requested", "failed", "cancelled"],
      retry_scheduled: ["running", "failed", "cancelled"],
      completed: [],
      failed: [],
      cancel_requested: ["cancelled"],
      cancelled: [],
    };
    if (!allowed[before].includes(after)) {
      throw new RangeError(`Invalid job transition: ${before} -> ${after}`);
    }
  }

  updateJob(job: DurableJob, message: string | null = null): void {
    const current = this.getJob(job.job_id);
    if (!current) throw new RangeError(`Unknown job: ${job.job_id}`);
    this.assertTransition(current.status, job.status);
    if (!Number.isFinite(job.progress.fraction) || job.progress.fraction < 0 || job.progress.fraction > 1) {
      throw new RangeError("Job progress fraction must be between 0 and 1.");
    }
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.writeJob(job);
      this.insertEvent(job, message);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  requestCancel(jobId: string): DurableJob {
    const current = this.getJob(jobId);
    if (!current) throw new RangeError(`Unknown job: ${jobId}`);
    if (["completed", "failed", "cancelled"].includes(current.status)) return current;
    if (["created", "queued", "retry_scheduled", "waiting_for_input"].includes(current.status)) {
      current.status = "cancelled";
      current.progress = { ...current.progress, stage: "cancelled", message: "Cancelled before execution." };
      current.completed_at = new Date().toISOString();
    } else if (current.status === "running") {
      current.status = "cancel_requested";
      current.progress = { ...current.progress, stage: "cancelling", message: "Cancellation requested." };
    }
    current.updated_at = new Date().toISOString();
    this.updateJob(current, "Cancellation requested.");
    return current;
  }

  recoverInterruptedJobs(): number {
    const rows = this.database
      .prepare("SELECT * FROM jobs WHERE status IN ('running', 'cancel_requested')")
      .all() as unknown as JobRow[];
    for (const row of rows) {
      const job = this.rowToJob(row);
      if (job.status === "cancel_requested") {
        job.status = "cancelled";
        job.progress = { ...job.progress, stage: "cancelled", message: "Cancellation completed during recovery." };
        job.completed_at = new Date().toISOString();
      } else if (job.attempt < job.max_attempts) {
        job.status = "retry_scheduled";
        job.progress = { fraction: 0, stage: "retry_scheduled", message: "Interrupted worker; retry scheduled." };
      } else {
        job.status = "failed";
        job.progress = { ...job.progress, stage: "failed", message: "Retry limit exhausted after interruption." };
        job.error_ref = "studio.job.worker_interrupted";
        job.completed_at = new Date().toISOString();
      }
      job.updated_at = new Date().toISOString();
      this.updateJob(job, "Recovered interrupted job.");
    }
    return rows.length;
  }

  listJobEvents(jobId: string): JobEvent[] {
    const rows = this.database
      .prepare("SELECT * FROM job_events WHERE job_id = ? ORDER BY sequence")
      .all(jobId) as unknown as EventRow[];
    return rows.map((row) => ({
      event_id: row.event_id,
      job_id: row.job_id,
      sequence: row.sequence,
      status: row.status,
      progress: {
        fraction: row.progress_fraction,
        stage: row.progress_stage,
        message: row.progress_message,
      },
      message: row.message,
      created_at: row.created_at,
    }));
  }

  saveArtifact(artifact: ArtifactRecord): void {
    try {
      this.database
        .prepare(
          "INSERT INTO render_artifacts(artifact_id, job_id, metadata_json, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(
          artifact.artifact_id,
          artifact.producer.job_id,
          JSON.stringify(artifact),
          artifact.created_at,
        );
    } catch (error) {
      throw new Error(`Artifact could not be persisted: ${(error as Error).message}`);
    }
  }

  completeJob(job: DurableJob, artifact: ArtifactRecord): void {
    const current = this.getJob(job.job_id);
    if (!current) throw new RangeError(`Unknown job: ${job.job_id}`);
    this.assertTransition(current.status, job.status);
    if (job.status !== "completed" || job.outputs.length === 0) {
      throw new TypeError("Completed job must contain at least one artifact output.");
    }
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare(
          "INSERT INTO render_artifacts(artifact_id, job_id, metadata_json, created_at) VALUES (?, ?, ?, ?)",
        )
        .run(
          artifact.artifact_id,
          artifact.producer.job_id,
          JSON.stringify(artifact),
          artifact.created_at,
        );
      this.writeJob(job);
      this.insertEvent(job, "Verified artifact registered; render completed.");
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  getArtifact(artifactId: string): ArtifactRecord | null {
    const row = this.database
      .prepare("SELECT metadata_json FROM render_artifacts WHERE artifact_id = ?")
      .get(artifactId) as unknown as ArtifactRow | undefined;
    return row ? (JSON.parse(row.metadata_json) as ArtifactRecord) : null;
  }

  close(): void {
    this.database.close();
  }
}
