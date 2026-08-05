import type { SemanticDiff, StudioProject } from "@toolshape/studio-domain";
import type { OperationHistoryEntry, StudioCapabilityId } from "@toolshape/studio-kernel";

export interface ContractResourceRef {
  type: string;
  id: string;
  revision?: number | null;
  digest?: string;
}

export interface ContractOperationEnvelope {
  schema_version: string;
  operation_id: string;
  idempotency_key: string;
  trace_id: string;
  actor: {
    principal_id: string;
    agent_id: string;
    harness_id: string;
    /**
     * What kind of actor this is.
     *
     * Optional for compatibility, but callers should set it. Without it the
     * kernel has to infer the type by comparing agent_id to principal_id, and
     * that inference is wrong for any transport that assigns a distinct agent
     * identity to a human session — which is exactly what happens when the
     * editor itself connects over MCP.
     */
    actor_type?: "human" | "agent" | "service";
    chaseos_session_id?: string | null;
    delegation_chain?: string[];
  };
  intent: string;
  capability: { id: StudioCapabilityId; version: string };
  target: {
    resource: ContractResourceRef;
    expected_revision?: number | null;
    selection_refs?: ContractResourceRef[];
  };
  input: Record<string, unknown>;
  context_refs?: ContractResourceRef[];
  secret_refs?: string[];
  risk: "read_only" | "simulation" | "reversible_local_write" | "external_reversible" | "high_impact";
  authorization: {
    grant_ids: string[];
    approval_id?: string | null;
    max_cost?: { amount: string; currency: string; network?: string | null } | null;
  };
  execution: {
    dry_run: boolean;
    atomicity: "atomic" | "staged" | "partial_declared";
    timeout_ms?: number | null;
    priority?: "low" | "normal" | "high";
  };
  retention: {
    class: "R0_ephemeral" | "R1_operational" | "R2_user_history" | "R3_learned_config" | "R4_audit" | "R5_aggregate";
    content_storage: "none" | "local" | "encrypted_sync" | "provider_declared";
    expires_at?: string | null;
  };
  created_at: string;
}

export interface ContractJobDocument {
  schema_version: string;
  job_id: string;
  operation_id: string;
  type: string;
  status: string;
  progress: { fraction: number; stage: string; message?: string | null };
  inputs: ContractResourceRef[];
  outputs: ContractResourceRef[];
  attempt?: number;
  max_attempts?: number;
  cancel_supported?: boolean;
  cost_estimate?: null;
  actual_cost?: null;
  error_ref?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface ContractArtifactDocument {
  schema_version: string;
  artifact_id: string;
  logical_name?: string;
  media_type: string;
  size_bytes: number;
  digest: string;
  source: ContractResourceRef[];
  producer: {
    operation_id: string;
    job_id?: string | null;
    toolchain?: Array<Record<string, unknown>>;
  };
  sensitivity: "public" | "internal" | "private" | "secret";
  retention_class: "R0_ephemeral" | "R1_operational" | "R2_user_history" | "R3_learned_config" | "R4_audit" | "R5_aggregate";
  licence?: string | null;
  created_at: string;
  expires_at?: string | null;
}

export interface ContractOperationResult {
  schema_version: string;
  operation_id: string;
  trace_id: string;
  status: "previewed" | "completed" | "accepted_job" | "approval_required" | "rejected" | "failed" | "partially_completed";
  state: {
    revision_before?: number | null;
    revision_after?: number | null;
    semantic_diff?: SemanticDiff[];
    /**
     * Canonical project state at `revision_after`.
     *
     * Without this, `studio.project.inspect` returns a revision number and no
     * project, which makes the capability useless to any external caller — an
     * agent could not read what it was about to edit, and the editor could not
     * render. StudioProject is the canonical domain object, not a kernel
     * internal, so exposing it does not weaken ADR 0008. See ADR 0014.
     */
    project?: StudioProject;
  };
  /** Populated by studio.project.history. */
  history?: OperationHistoryEntry[];
  job_ref?: ContractResourceRef | null;
  artifact_refs?: ContractResourceRef[];
  verification: {
    status: "passed" | "failed" | "pending" | "not_applicable" | "limited";
    evidence: Array<Record<string, unknown>>;
    limitations?: string[];
  };
  warnings: Array<{ code: string; message: string; details?: Record<string, unknown> }>;
  usage: { duration_ms?: number; model_tokens?: number | null; cost?: null };
  undo?: { supported?: boolean; token?: string | null; expires_at?: string | null };
  error_ref?: string | null;
  completed_at: string;
}
