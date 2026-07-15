import type { StudioProject } from "@toolshape/studio-domain";
import type { OperationEnvelope, OperationResult } from "./contracts";

export interface IdempotencyRecord {
  key: string;
  inputDigest: string;
  result: OperationResult;
}

export interface CommitRecord {
  projectId: string;
  expectedRevision: number;
  project: StudioProject;
  envelope: OperationEnvelope;
  inputDigest: string;
  result: OperationResult;
}

export interface StudioRepository {
  createProject(project: StudioProject): void;
  getProject(projectId: string): StudioProject | null;
  getRevision(projectId: string, revision: number): StudioProject | null;
  getIdempotency(key: string): IdempotencyRecord | null;
  recordIdempotency(record: IdempotencyRecord): void;
  commit(record: CommitRecord): void;
}

export class RepositoryRevisionConflictError extends Error {
  constructor(readonly expected: number, readonly actual: number) {
    super(`Repository expected revision ${expected}, but found ${actual}.`);
    this.name = "RepositoryRevisionConflictError";
  }
}

export class MemoryStudioRepository implements StudioRepository {
  private readonly projects = new Map<string, StudioProject>();
  private readonly revisions = new Map<string, Map<number, StudioProject>>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();

  createProject(project: StudioProject): void {
    if (this.projects.has(project.id)) throw new RangeError(`Project already exists: ${project.id}`);
    const snapshot = structuredClone(project);
    this.projects.set(project.id, snapshot);
    this.revisions.set(project.id, new Map([[snapshot.revision, structuredClone(snapshot)]]));
  }

  getProject(projectId: string): StudioProject | null {
    const project = this.projects.get(projectId);
    return project ? structuredClone(project) : null;
  }

  getRevision(projectId: string, revision: number): StudioProject | null {
    const project = this.revisions.get(projectId)?.get(revision);
    return project ? structuredClone(project) : null;
  }

  getIdempotency(key: string): IdempotencyRecord | null {
    const record = this.idempotency.get(key);
    return record ? structuredClone(record) : null;
  }

  recordIdempotency(record: IdempotencyRecord): void {
    const existing = this.idempotency.get(record.key);
    if (existing && existing.inputDigest !== record.inputDigest) {
      throw new RangeError(`Idempotency key already exists: ${record.key}`);
    }
    this.idempotency.set(record.key, structuredClone(record));
  }

  commit(record: CommitRecord): void {
    const current = this.projects.get(record.projectId);
    if (!current) throw new RangeError(`Unknown project: ${record.projectId}`);
    if (current.revision !== record.expectedRevision) throw new RepositoryRevisionConflictError(record.expectedRevision, current.revision);
    this.projects.set(record.projectId, structuredClone(record.project));
    this.revisions.get(record.projectId)!.set(record.project.revision, structuredClone(record.project));
    this.recordIdempotency({
      key: record.envelope.idempotency_key,
      inputDigest: record.inputDigest,
      result: structuredClone(record.result),
    });
  }
}
