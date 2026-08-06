import type { SemanticDiff, StudioOperation, StudioProject } from "@toolshape/studio-domain";
import {
  applyStudioOperation,
  detectRevertConflicts,
  planOperationInverse,
  validateStudioProject,
  type InverseOperationDraft,
} from "@toolshape/studio-engine";
import {
  assertOperationEnvelope,
  STUDIO_SCHEMA_VERSION,
  type OperationEnvelope,
  type OperationHistoryEntry,
  type OperationResult,
} from "./contracts";
import { stableDigest } from "./digest";
import {
  assertStudioExportRequest,
  assertStudioRenderRequest,
  type DurableJob,
  type StudioJobGateway,
} from "./jobs";
import type { StudioRepository } from "./repository";

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key was already used for a different operation payload.");
    this.name = "IdempotencyConflictError";
  }
}

export class MissingCapabilityGrantError extends Error {
  constructor(capabilityId: string) {
    super(`No grant authorizes ${capabilityId}.`);
    this.name = "MissingCapabilityGrantError";
  }
}

function projectIdFromResource(resource: string): string {
  const value = resource.slice("toolshape-studio://projects/".length).split(/[/?#]/, 1)[0];
  if (!value) throw new TypeError("Project resource is missing an ID.");
  return decodeURIComponent(value);
}

function idempotencyInput(envelope: OperationEnvelope): unknown {
  return {
    capability: envelope.capability,
    target: envelope.target,
    input: envelope.input,
    execution: envelope.execution,
    authorization: envelope.authorization,
  };
}

function makeResult(
  envelope: OperationEnvelope,
  startedAt: number,
  status: OperationResult["status"],
  before: number,
  after: number,
  project: StudioProject,
  diffs: SemanticDiff[],
  verificationStatus: OperationResult["verification"]["status"] = "passed",
  undoToken: string | null = null,
  job?: DurableJob,
): OperationResult {
  const digest = stableDigest(project);
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: envelope.operation_id,
    trace_id: envelope.trace_id,
    status,
    state: {
      revision_before: before,
      revision_after: after,
      semantic_diff: diffs,
      digest,
      project: structuredClone(project),
    },
    verification: { status: verificationStatus, evidence: [{ type: "state_digest", digest }] },
    warnings: [],
    usage: { duration_ms: Math.max(0, Date.now() - startedAt), model_tokens: null },
    undo: { supported: undoToken !== null, token: undoToken, expires_at: null },
    job_ref: job ? `toolshape-studio://jobs/${job.job_id}` : null,
    artifact_refs: job?.outputs ?? [],
    job,
    completed_at: new Date().toISOString(),
  };
}

export class StudioKernel {
  constructor(
    private readonly repository: StudioRepository,
    private readonly jobs?: StudioJobGateway,
  ) {}

  invoke(value: unknown): OperationResult {
    const startedAt = Date.now();
    assertOperationEnvelope(value);
    const envelope = value;
    if (
      !envelope.authorization.grant_ids.includes(envelope.capability.id) &&
      !envelope.authorization.grant_ids.includes("studio.*")
    ) {
      throw new MissingCapabilityGrantError(envelope.capability.id);
    }

    const inputDigest = stableDigest(idempotencyInput(envelope));
    const prior = this.repository.getIdempotency(envelope.idempotency_key);
    if (prior) {
      if (prior.inputDigest !== inputDigest) throw new IdempotencyConflictError();
      return prior.result;
    }

    const projectId = projectIdFromResource(envelope.target.resource);
    const current = this.repository.getProject(projectId);
    if (!current) throw new RangeError(`Unknown project: ${projectId}`);
    if (
      envelope.target.expected_revision != null &&
      envelope.target.expected_revision !== current.revision
    ) {
      throw new RangeError(
        `Expected project revision ${envelope.target.expected_revision}, but found ${current.revision}.`,
      );
    }

    if (
      envelope.capability.id === "studio.project.render" ||
      envelope.capability.id === "studio.design.export" ||
      envelope.capability.id === "studio.job.get" ||
      envelope.capability.id === "studio.job.cancel"
    ) {
      if (!this.jobs) throw new Error("Studio job gateway is not configured on this host.");
      let job: DurableJob;
      let status: OperationResult["status"] = "completed";
      if (envelope.capability.id === "studio.project.render") {
        assertStudioRenderRequest(envelope.input.render);
        job = this.jobs.queueRender(current, envelope.input.render, {
          operationId: envelope.operation_id,
          traceId: envelope.trace_id,
          createdAt: envelope.created_at,
        });
        status = "accepted_job";
      } else if (envelope.capability.id === "studio.design.export") {
        assertStudioExportRequest(envelope.input.export);
        job = this.jobs.queueExport(current, envelope.input.export, {
          operationId: envelope.operation_id,
          traceId: envelope.trace_id,
          createdAt: envelope.created_at,
        });
        status = "accepted_job";
      } else {
        const jobId = envelope.input.job_id;
        if (typeof jobId !== "string" || !jobId) {
          throw new TypeError("input.job_id is required.");
        }
        const existing = this.jobs.getJob(jobId);
        if (!existing) throw new RangeError(`Unknown job: ${jobId}`);
        if (existing.project_id !== current.id) {
          throw new RangeError("Job does not belong to the target project.");
        }
        job = envelope.capability.id === "studio.job.cancel"
          ? this.jobs.requestCancel(jobId)
          : existing;
      }
      const verificationStatus: OperationResult["verification"]["status"] =
        job.status === "completed"
          ? "passed"
          : job.status === "failed"
            ? "failed"
            : "pending";
      const result = makeResult(
        envelope,
        startedAt,
        status,
        current.revision,
        current.revision,
        current,
        [],
        verificationStatus,
        null,
        job,
      );
      result.verification.evidence.push({ type: "durable_job", job });
      this.repository.recordIdempotency({
        key: envelope.idempotency_key,
        inputDigest,
        result,
      });
      return result;
    }

    if (envelope.capability.id === "studio.project.inspect") {
      return makeResult(
        envelope,
        startedAt,
        "completed",
        current.revision,
        current.revision,
        current,
        [],
        "not_applicable",
      );
    }
    if (envelope.capability.id === "studio.project.validate") {
      const issues = validateStudioProject(current);
      const result = makeResult(
        envelope,
        startedAt,
        "completed",
        current.revision,
        current.revision,
        current,
        [],
        issues.some((issue) => issue.severity === "error") ? "failed" : "passed",
      );
      result.verification.evidence.push({ type: "validation_issues", issues });
      return result;
    }

    if (envelope.capability.id === "studio.project.history") {
      const result = makeResult(
        envelope,
        startedAt,
        "completed",
        current.revision,
        current.revision,
        current,
        [],
        "not_applicable",
      );
      result.history = this.buildHistory(projectId);
      return result;
    }

    let working = structuredClone(current);
    const diffs: SemanticDiff[] = [];
    if (envelope.capability.id === "studio.operation.revert") {
      const plan = this.planRevert(projectId, envelope.input.revert_operation_id);
      for (const draft of plan) {
        const applied = applyStudioOperation(working, {
          ...draft,
          operationId: globalThis.crypto.randomUUID(),
          actor: envelope.actor.type === "agent" ? "agent" : "operator",
          expectedRevision: working.revision,
        } as StudioOperation);
        working = applied.project;
        diffs.push(applied.diff);
      }
    } else if (envelope.capability.id === "studio.operation.undo") {
      const token = envelope.input.undo_token;
      const match = typeof token === "string" ? /^undo:([^:]+):(\d+):(\d+)$/.exec(token) : null;
      if (!match || match[1] !== projectId || Number(match[3]) !== current.revision) {
        throw new TypeError("Undo token is invalid or stale.");
      }
      const snapshot = this.repository.getRevision(projectId, Number(match[2]));
      if (!snapshot) throw new RangeError("Undo snapshot is unavailable.");
      working = snapshot;
      working.revision = current.revision + 1;
      diffs.push({
        operationId: envelope.operation_id,
        summary: `Restored revision ${match[2]}.`,
        changedPaths: ["project"],
        beforeRevision: current.revision,
        afterRevision: working.revision,
      });
    } else {
      const operations = envelope.input.operations;
      if (!Array.isArray(operations) || operations.length === 0) {
        throw new TypeError("input.operations must be a non-empty array.");
      }
      for (const operation of operations as StudioOperation[]) {
        const applied = applyStudioOperation(working, operation);
        working = applied.project;
        diffs.push(applied.diff);
      }
    }

    const preview =
      envelope.execution.dry_run || envelope.capability.id === "studio.project.plan";
    const undoToken = `undo:${projectId}:${current.revision}:${working.revision}`;
    const result = makeResult(
      envelope,
      startedAt,
      preview ? "previewed" : "completed",
      current.revision,
      working.revision,
      working,
      diffs,
      "passed",
      preview ? null : undoToken,
    );
    if (!preview) {
      this.repository.commit({
        projectId,
        expectedRevision: current.revision,
        project: working,
        envelope,
        inputDigest,
        result,
      });
    }
    return result;
  }

  /**
   * Extracts the domain operations a logged envelope carried.
   * Envelopes for reads, renders and undos carry none.
   */
  private operationsOf(entry: { envelope: OperationEnvelope }): StudioOperation[] {
    const operations = entry.envelope.input.operations;
    return Array.isArray(operations) ? (operations as StudioOperation[]) : [];
  }

  /**
   * Builds the visible activity history.
   *
   * Revertibility is evaluated here rather than stored, because it is a
   * function of everything that happened afterwards: an edit that was safely
   * reversible a moment ago stops being so the instant another operation
   * touches the same object.
   */
  private buildHistory(projectId: string): OperationHistoryEntry[] {
    const log = this.repository.listOperations(projectId);
    return log.map((entry, index) => {
      const operations = this.operationsOf(entry);
      const later = log.slice(index + 1).flatMap((candidate) => this.operationsOf(candidate));
      const base: OperationHistoryEntry = {
        operation_id: entry.operationId,
        revision_before: entry.revisionBefore,
        revision_after: entry.revisionAfter,
        actor_type: entry.envelope.actor.type,
        actor_id: entry.envelope.actor.id,
        harness_id: entry.envelope.actor.delegated_by ?? null,
        capability: entry.envelope.capability.id,
        operation_types: operations.map((operation) => operation.type),
        summary: entry.envelope.intent,
        created_at: entry.createdAt,
        revertible: false,
      };

      if (operations.length === 0) {
        return {
          ...base,
          revert_blocked_code: "revert.no-operations",
          revert_blocked_reason: "This entry changed no project objects, so there is nothing to reverse.",
        };
      }

      const before = this.repository.getRevision(projectId, entry.revisionBefore);
      if (!before) {
        return {
          ...base,
          revert_blocked_code: "revert.snapshot-unavailable",
          revert_blocked_reason: "The project state before this operation is no longer available.",
        };
      }

      for (const operation of operations) {
        const plan = planOperationInverse(operation, before);
        if (!plan.revertible) {
          return { ...base, revert_blocked_code: plan.code, revert_blocked_reason: plan.reason };
        }
      }

      const conflicts = operations.flatMap((operation) => detectRevertConflicts(operation, later));
      if (conflicts.length > 0) {
        return {
          ...base,
          revert_blocked_code: "revert.conflict",
          revert_blocked_reason:
            "A later edit touched the same objects. Reverting now would discard that later work.",
          conflicts: conflicts.map((conflict) => ({
            operation_id: conflict.operationId,
            type: conflict.type,
            target: conflict.target,
          })),
        };
      }

      return { ...base, revertible: true };
    });
  }

  /**
   * Resolves the inverse operations for a past operation, refusing rather than
   * guessing when reversal would be unsafe or is not expressible.
   */
  private planRevert(projectId: string, operationId: unknown): InverseOperationDraft[] {
    if (typeof operationId !== "string" || operationId.length === 0) {
      throw new TypeError("input.revert_operation_id is required.");
    }
    const log = this.repository.listOperations(projectId);
    const index = log.findIndex((entry) => entry.operationId === operationId);
    if (index < 0) throw new RangeError(`Unknown operation: ${operationId}`);

    const entry = log[index];
    const operations = this.operationsOf(entry);
    if (operations.length === 0) {
      throw new RangeError("This entry changed no project objects, so there is nothing to reverse.");
    }

    const before = this.repository.getRevision(projectId, entry.revisionBefore);
    if (!before) throw new RangeError("The project state before this operation is no longer available.");

    const later = log.slice(index + 1).flatMap((candidate) => this.operationsOf(candidate));
    const conflicts = operations.flatMap((operation) => detectRevertConflicts(operation, later));
    if (conflicts.length > 0) {
      throw new RangeError(
        `A later edit touched ${conflicts[0].target}. Reverting now would discard that work.`,
      );
    }

    // Reverse order, so a multi-operation batch unwinds the way it was applied.
    const drafts: InverseOperationDraft[] = [];
    for (const operation of [...operations].reverse()) {
      const plan = planOperationInverse(operation, before);
      if (!plan.revertible) throw new RangeError(plan.reason);
      drafts.push(...plan.operations);
    }
    return drafts;
  }
}
