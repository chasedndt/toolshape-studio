import { DatabaseSync } from "node:sqlite";
import type { StudioProject } from "@toolshape/studio-domain";
import {
  RepositoryRevisionConflictError,
  type CommitRecord,
  type IdempotencyRecord,
  type OperationResult,
  type StudioRepository,
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

export class SqliteStudioRepository implements StudioRepository {
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
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      INSERT OR IGNORE INTO schema_migrations(version, applied_at)
      VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
    `);
  }

  createProject(project: StudioProject): void {
    const now = new Date().toISOString();
    const state = JSON.stringify(project);
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database
        .prepare("INSERT INTO projects(id, revision, state_json, updated_at) VALUES (?, ?, ?, ?)")
        .run(project.id, project.revision, state, now);
      this.database
        .prepare("INSERT INTO project_revisions(project_id, revision, state_json, created_at) VALUES (?, ?, ?, ?)")
        .run(project.id, project.revision, state, now);
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
    return row ? (JSON.parse(row.state_json) as StudioProject) : null;
  }

  getRevision(projectId: string, revision: number): StudioProject | null {
    const row = this.database
      .prepare("SELECT state_json FROM project_revisions WHERE project_id = ? AND revision = ?")
      .get(projectId, revision) as unknown as RevisionRow | undefined;
    return row ? (JSON.parse(row.state_json) as StudioProject) : null;
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

  close(): void {
    this.database.close();
  }
}
