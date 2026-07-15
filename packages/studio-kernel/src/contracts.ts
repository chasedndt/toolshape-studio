import type { SemanticDiff, StudioOperation, StudioProject } from "@toolshape/studio-domain";

export const STUDIO_SCHEMA_VERSION = "0.1.0";

export type StudioCapabilityId =
  | "studio.project.inspect"
  | "studio.project.plan"
  | "studio.project.apply_operations"
  | "studio.project.validate"
  | "studio.operation.undo";

export interface OperationEnvelope {
  schema_version: string;
  operation_id: string;
  idempotency_key: string;
  trace_id: string;
  actor: { id: string; type: "human" | "agent" | "service"; delegated_by?: string | null };
  intent: string;
  capability: { id: StudioCapabilityId; version: string };
  target: { resource: string; expected_revision?: number | null; selection_refs?: string[] };
  input: { operations?: StudioOperation[]; undo_token?: string } & Record<string, unknown>;
  context_refs?: string[];
  secret_refs?: string[];
  risk: { level: "low" | "medium" | "high" | "critical"; reasons?: string[] };
  authorization: { grant_ids: string[]; approval_id?: string | null };
  execution: { dry_run: boolean; atomicity: "atomic" | "staged" | "partial_declared"; timeout_ms?: number | null; priority?: "low" | "normal" | "high" };
  retention: { class: "ephemeral" | "session" | "project" | "account" | "legal_hold"; content_storage: "none" | "local" | "encrypted_sync" | "provider_declared"; expires_at?: string | null };
  created_at: string;
}

export interface OperationResult {
  schema_version: string;
  operation_id: string;
  trace_id: string;
  status: "previewed" | "completed" | "rejected" | "failed";
  state: {
    revision_before: number | null;
    revision_after: number | null;
    semantic_diff: SemanticDiff[];
    digest?: string;
    project?: StudioProject;
  };
  verification: { status: "passed" | "failed" | "not_applicable"; evidence: Array<Record<string, unknown>>; limitations?: string[] };
  warnings: Array<{ code: string; message: string; details?: Record<string, unknown> }>;
  usage: { duration_ms: number; model_tokens?: null };
  undo?: { supported: boolean; token: string | null; expires_at?: null };
  completed_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAPABILITIES = new Set<StudioCapabilityId>([
  "studio.project.inspect",
  "studio.project.plan",
  "studio.project.apply_operations",
  "studio.project.validate",
  "studio.operation.undo",
]);

export function assertOperationEnvelope(value: unknown): asserts value is OperationEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Operation envelope must be an object.");
  const envelope = value as Partial<OperationEnvelope>;
  if (envelope.schema_version !== STUDIO_SCHEMA_VERSION) throw new TypeError("Unsupported operation schema_version.");
  if (!UUID.test(envelope.operation_id ?? "")) throw new TypeError("operation_id must be a UUID.");
  if (typeof envelope.idempotency_key !== "string" || envelope.idempotency_key.length < 16) throw new TypeError("idempotency_key must contain at least 16 characters.");
  if (typeof envelope.trace_id !== "string" || envelope.trace_id.length < 8) throw new TypeError("trace_id must contain at least 8 characters.");
  if (!envelope.actor || typeof envelope.actor.id !== "string" || !["human", "agent", "service"].includes(envelope.actor.type ?? "")) throw new TypeError("actor is invalid.");
  if (!envelope.capability || !CAPABILITIES.has(envelope.capability.id as StudioCapabilityId) || envelope.capability.version !== STUDIO_SCHEMA_VERSION) throw new TypeError("capability is unknown or has an unsupported version.");
  if (!envelope.target || typeof envelope.target.resource !== "string" || !envelope.target.resource.startsWith("toolshape-studio://projects/")) throw new TypeError("target.resource must identify a Toolshape Studio project.");
  if (!envelope.input || typeof envelope.input !== "object" || Array.isArray(envelope.input)) throw new TypeError("input must be an object.");
  if (!envelope.authorization || !Array.isArray(envelope.authorization.grant_ids)) throw new TypeError("authorization.grant_ids is required.");
  if (!envelope.execution || typeof envelope.execution.dry_run !== "boolean" || !["atomic", "staged", "partial_declared"].includes(envelope.execution.atomicity ?? "")) throw new TypeError("execution is invalid.");
  if (!envelope.retention || typeof envelope.retention.class !== "string" || typeof envelope.retention.content_storage !== "string") throw new TypeError("retention is invalid.");
  if (typeof envelope.created_at !== "string" || !Number.isFinite(Date.parse(envelope.created_at))) throw new TypeError("created_at must be an ISO timestamp.");
  if (!envelope.risk || !["low", "medium", "high", "critical"].includes(envelope.risk.level ?? "")) throw new TypeError("risk is invalid.");
}
