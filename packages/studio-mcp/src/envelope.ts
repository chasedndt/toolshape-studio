import { randomUUID } from "node:crypto";
import type { ContractOperationEnvelope } from "@toolshape/studio-sdk";
import type { StudioSession } from "./session";
import type { StudioToolDefinition } from "./tools";

/**
 * Builds the operation envelope from an agent-facing tool call.
 *
 * This is the whole job of the adapter: translate a convenient tool call into
 * the exact same envelope the UI and CLI submit, filling identity from the
 * authenticated session rather than from anything the caller supplied. The
 * adapter makes no authorization decisions — it asserts identity and lets the
 * kernel authorize.
 */

export interface ToolCallArguments {
  project_id: string;
  expected_revision?: number;
  operations?: unknown[];
  dry_run?: boolean;
  idempotency_key?: string;
  undo_token?: string;
  job_id?: string;
  cover_asset_id?: string;
  preset_id?: string;
  output_name?: string;
}

/** Maps a tool's declared risk onto the public contract's risk vocabulary. */
function riskFor(tool: StudioToolDefinition): ContractOperationEnvelope["risk"] {
  return tool.risk;
}

function inputFor(tool: StudioToolDefinition, args: ToolCallArguments): Record<string, unknown> {
  switch (tool.capability) {
    case "studio.project.inspect":
    case "studio.project.validate":
      return {};
    case "studio.project.plan":
    case "studio.project.apply_operations":
      return { operations: args.operations ?? [] };
    case "studio.project.render":
      return {
        render: {
          cover_asset_id: args.cover_asset_id,
          preset_id: args.preset_id,
          output_name: args.output_name,
        },
      };
    case "studio.job.get":
    case "studio.job.cancel":
      return { job_id: args.job_id };
    case "studio.operation.undo":
      return { undo_token: args.undo_token };
    default: {
      const exhaustive: never = tool.capability;
      throw new TypeError(`Unhandled capability: ${String(exhaustive)}`);
    }
  }
}

export interface BuildEnvelopeOptions {
  tool: StudioToolDefinition;
  args: ToolCallArguments;
  session: StudioSession;
  schemaVersion: string;
  /** Injectable for deterministic tests. */
  now?: () => string;
  newId?: () => string;
}

export function buildEnvelope(options: BuildEnvelopeOptions): ContractOperationEnvelope {
  const { tool, args, session, schemaVersion } = options;
  const now = options.now ?? (() => new Date().toISOString());
  const newId = options.newId ?? (() => randomUUID());

  // `studio.project.plan` is a simulation capability, and dry_run on a mutating
  // tool means the same thing: compute the diff, change nothing.
  const dryRun = tool.capability === "studio.project.plan" ? true : Boolean(args.dry_run);

  return {
    schema_version: schemaVersion,
    operation_id: newId(),
    // A caller-supplied key makes retries safe across process restarts. Without
    // one we still generate a key so the envelope is well-formed, but that key
    // is unique per call and therefore provides no replay protection — which is
    // why the tool description tells agents to supply their own.
    idempotency_key: args.idempotency_key ?? `mcp-${newId()}`,
    trace_id: newId(),
    actor: {
      principal_id: session.principalId,
      agent_id: session.agentId,
      harness_id: session.harnessId,
      delegation_chain: [session.principalId, session.agentId],
    },
    intent: `${tool.title} via MCP (${session.harnessId})`,
    capability: { id: tool.capability, version: schemaVersion },
    target: {
      // A bare project ID. The SDK projection is what forms the
      // `toolshape-studio://projects/<id>` URI, so wrapping it here would
      // double-encode and the kernel would fail to resolve the project.
      resource: { type: "studio_project", id: args.project_id },
      expected_revision: args.expected_revision ?? null,
    },
    input: inputFor(tool, args),
    risk: riskFor(tool),
    authorization: { grant_ids: [...session.grantIds], approval_id: null },
    execution: { dry_run: dryRun, atomicity: "atomic", priority: "normal" },
    retention: { class: "R1_operational", content_storage: "local" },
    created_at: now(),
  };
}
