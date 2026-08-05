import type {
  ArtifactRecord,
  DurableJob,
  OperationEnvelope,
  OperationResult,
  StudioCapabilityId,
} from "@toolshape/studio-kernel";
import type {
  ContractArtifactDocument,
  ContractJobDocument,
  ContractOperationEnvelope,
  ContractOperationResult,
  ContractResourceRef,
} from "./contract-types";

export function contractEnvelopeToKernel(envelope: ContractOperationEnvelope): OperationEnvelope {
  if (envelope.target.resource.type !== "studio_project") {
    throw new TypeError("Studio capabilities require a studio_project target resource.");
  }
  if (
    envelope.target.resource.revision != null &&
    envelope.target.expected_revision != null &&
    envelope.target.resource.revision !== envelope.target.expected_revision
  ) {
    throw new TypeError("Target resource revision and expected_revision must agree.");
  }
  const risk: OperationEnvelope["risk"]["level"] = envelope.risk === "high_impact"
    ? "critical"
    : envelope.risk === "external_reversible"
      ? "high"
      : "low";
  const retention: OperationEnvelope["retention"]["class"] = envelope.retention.class === "R0_ephemeral"
    ? "ephemeral"
    : envelope.retention.class === "R1_operational"
      ? "session"
      : envelope.retention.class === "R2_user_history"
        ? "project"
        : envelope.retention.class === "R4_audit"
          ? "legal_hold"
          : "account";
  return {
    schema_version: envelope.schema_version,
    operation_id: envelope.operation_id,
    idempotency_key: envelope.idempotency_key,
    trace_id: envelope.trace_id,
    actor: {
      id: envelope.actor.principal_id,
      type: envelope.actor.agent_id === envelope.actor.principal_id ? "human" : "agent",
      delegated_by: envelope.actor.delegation_chain?.at(-2) ?? null,
    },
    intent: envelope.intent,
    capability: envelope.capability,
    target: {
      resource: `toolshape-studio://projects/${encodeURIComponent(envelope.target.resource.id)}`,
      expected_revision: envelope.target.expected_revision,
      selection_refs: envelope.target.selection_refs?.map((reference) => `${reference.type}:${reference.id}`),
    },
    input: envelope.input,
    context_refs: envelope.context_refs?.map((reference) => `${reference.type}:${reference.id}`),
    secret_refs: envelope.secret_refs,
    risk: { level: risk },
    authorization: {
      grant_ids: envelope.authorization.grant_ids,
      approval_id: envelope.authorization.approval_id,
    },
    execution: envelope.execution,
    retention: {
      class: retention,
      content_storage: envelope.retention.content_storage,
      expires_at: envelope.retention.expires_at,
    },
    created_at: envelope.created_at,
  };
}

export function resourceRefFromInternal(value: string): ContractResourceRef {
  const project = /^toolshape-studio:\/\/projects\/([^/]+)(?:\/revisions\/(\d+))?/.exec(value);
  if (project && value.includes("/revisions/")) {
    return { type: "studio_project", id: decodeURIComponent(project[1]), revision: Number(project[2]) };
  }
  const asset = /^toolshape-studio:\/\/projects\/[^/]+\/assets\/([^/]+)$/.exec(value);
  if (asset) return { type: "studio_asset", id: decodeURIComponent(asset[1]) };
  const artifact = /^toolshape-studio:\/\/artifacts\/([^/]+)$/.exec(value);
  if (artifact) return { type: "studio_artifact", id: decodeURIComponent(artifact[1]) };
  const job = /^toolshape-studio:\/\/jobs\/([^/]+)$/.exec(value);
  if (job) return { type: "studio_job", id: decodeURIComponent(job[1]) };
  return { type: "toolshape_resource", id: value };
}

export function projectJobDocument(job: DurableJob): ContractJobDocument {
  return {
    schema_version: job.schema_version,
    job_id: job.job_id,
    operation_id: job.operation_id,
    type: job.type,
    status: job.status,
    progress: job.progress,
    inputs: job.inputs.map(resourceRefFromInternal),
    outputs: job.outputs.map(resourceRefFromInternal),
    ...(job.attempt >= 1 ? { attempt: job.attempt } : {}),
    max_attempts: job.max_attempts,
    cancel_supported: job.cancel_supported,
    cost_estimate: null,
    actual_cost: null,
    error_ref: job.error_ref,
    created_at: job.created_at,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
  };
}

/**
 * Capabilities whose caller is asking about project state, and therefore
 * receive it.
 *
 * Deliberately not every capability. A render returns a durable job, a plan
 * returns a diff over an unchanged project, and a job query returns a job —
 * attaching the full project to those inflates every response with something
 * the caller did not ask for. Reads and mutations return it because otherwise
 * the caller must immediately re-inspect to see what happened (ADR 0014).
 */
const CAPABILITIES_RETURNING_PROJECT = new Set<StudioCapabilityId>([
  "studio.project.inspect",
  "studio.project.validate",
  "studio.project.apply_operations",
  "studio.operation.undo",
]);

export function projectOperationResult(
  result: OperationResult,
  capabilityId?: StudioCapabilityId,
): ContractOperationResult {
  const includeProject =
    capabilityId !== undefined && CAPABILITIES_RETURNING_PROJECT.has(capabilityId) && Boolean(result.state.project);
  const evidence = result.verification.evidence.map((item) => {
    const possible = item as { type?: string; job?: DurableJob };
    return possible.type === "durable_job" && possible.job
      ? { type: "durable_job", job: projectJobDocument(possible.job) }
      : structuredClone(item);
  });
  return {
    schema_version: result.schema_version,
    operation_id: result.operation_id,
    trace_id: result.trace_id,
    status: result.status,
    state: {
      revision_before: result.state.revision_before,
      revision_after: result.state.revision_after,
      semantic_diff: result.state.semantic_diff,
      // Omitted rather than null-filled so absence stays meaningful.
      ...(includeProject ? { project: result.state.project } : {}),
    },
    job_ref: result.job_ref ? resourceRefFromInternal(result.job_ref) : null,
    artifact_refs: (result.artifact_refs ?? []).map(resourceRefFromInternal),
    verification: { ...result.verification, evidence },
    warnings: result.warnings,
    usage: { duration_ms: result.usage.duration_ms, model_tokens: result.usage.model_tokens ?? null, cost: null },
    undo: result.undo,
    error_ref: null,
    completed_at: result.completed_at,
  };
}

export function projectArtifactDocument(artifact: ArtifactRecord): ContractArtifactDocument {
  const retentionMap: Record<ArtifactRecord["retention_class"], ContractArtifactDocument["retention_class"]> = {
    ephemeral: "R0_ephemeral",
    session: "R1_operational",
    project: "R2_user_history",
    account: "R3_learned_config",
    legal_hold: "R4_audit",
  };
  return {
    schema_version: artifact.schema_version,
    artifact_id: artifact.artifact_id,
    logical_name: artifact.logical_name,
    media_type: artifact.media_type,
    size_bytes: artifact.size_bytes,
    digest: artifact.digest,
    source: artifact.source.map(resourceRefFromInternal),
    producer: artifact.producer,
    sensitivity: artifact.sensitivity,
    retention_class: retentionMap[artifact.retention_class],
    licence: artifact.licence,
    created_at: artifact.created_at,
    expires_at: artifact.expires_at,
  };
}

export function jobDocumentFromResult(result: ContractOperationResult): ContractJobDocument {
  const evidence = result.verification.evidence.find((item) => item.type === "durable_job") as
    | { job?: ContractJobDocument }
    | undefined;
  if (!evidence?.job) throw new TypeError("Operation result contains no durable job document.");
  return evidence.job;
}

export function stateDigestFromResult(result: ContractOperationResult): string {
  const evidence = result.verification.evidence.find((item) => item.type === "state_digest") as
    | { digest?: string }
    | undefined;
  if (typeof evidence?.digest !== "string") {
    throw new TypeError("Operation result contains no state digest evidence.");
  }
  return evidence.digest;
}
