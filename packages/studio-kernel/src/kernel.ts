import type { SemanticDiff, StudioOperation, StudioProject } from "@toolshape/studio-domain";
import { applyStudioOperation, validateStudioProject } from "@toolshape/studio-engine";
import { assertOperationEnvelope, STUDIO_SCHEMA_VERSION, type OperationEnvelope, type OperationResult } from "./contracts";
import { stableDigest } from "./digest";
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
    completed_at: new Date().toISOString(),
  };
}

export class StudioKernel {
  constructor(private readonly repository: StudioRepository) {}

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

    let working = structuredClone(current);
    const diffs: SemanticDiff[] = [];
    if (envelope.capability.id === "studio.operation.undo") {
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
}
