import type { StudioCapabilityId } from "@toolshape/studio-kernel";
import type { McpToolDefinition } from "./protocol";

/**
 * Agent-facing tool surface.
 *
 * One tool per kernel capability. The tool schema is deliberately NOT the raw
 * operation envelope: an agent should describe what it wants, not hand-assemble
 * trace identifiers, retention classes, and idempotency keys. The adapter builds
 * the envelope from these inputs plus the authenticated session identity, so the
 * kernel still receives exactly the same envelope the UI and CLI produce.
 *
 * Tool names use underscores because MCP clients commonly constrain names to
 * `[a-zA-Z0-9_-]`. The dotted capability ID each tool maps to is carried in
 * `capability` and stated in the description so discovery stays unambiguous.
 */
export interface StudioToolDefinition extends McpToolDefinition {
  capability: StudioCapabilityId;
  /** Mutating tools are revision-checked and idempotency-keyed. */
  mutating: boolean;
  risk: "read_only" | "simulation" | "reversible_local_write";
}

const PROJECT_ID = {
  type: "string",
  minLength: 1,
  description: "Project identifier. Obtain from the host or from a previous inspect call.",
} as const;

const OPERATIONS = {
  type: "array",
  minItems: 1,
  description:
    "Typed semantic operations to apply atomically. Each operation carries its own operationId, " +
    "type, actor, expectedRevision, and payload. Operation types include timeline.clip.split, " +
    "timeline.clip.trim, timeline.clip.set-audio, and style.profile.apply.",
  items: { type: "object" },
} as const;

export const STUDIO_TOOLS: readonly StudioToolDefinition[] = [
  {
    name: "studio_project_inspect",
    title: "Inspect project",
    capability: "studio.project.inspect",
    mutating: false,
    risk: "read_only",
    description:
      "Read the full canonical project state and its current revision. Always call this before " +
      "planning an edit: the returned revision is what you pass as expected_revision, and it is " +
      "how the kernel detects that a human or another agent changed the project underneath you.",
    inputSchema: {
      type: "object",
      properties: { project_id: PROJECT_ID },
      required: ["project_id"],
      additionalProperties: false,
    },
  },
  {
    name: "studio_project_validate",
    title: "Validate project",
    capability: "studio.project.validate",
    mutating: false,
    risk: "read_only",
    description:
      "Run deterministic domain validation and return structured issues (missing assets, clips " +
      "beyond the timeline or source duration, invalid audio gain, duplicate identifiers). " +
      "Use this to verify your own work rather than assuming an edit was correct.",
    inputSchema: {
      type: "object",
      properties: { project_id: PROJECT_ID },
      required: ["project_id"],
      additionalProperties: false,
    },
  },
  {
    name: "studio_project_plan",
    title: "Preview operations",
    capability: "studio.project.plan",
    mutating: false,
    risk: "simulation",
    description:
      "Simulate operations and return the semantic diff they would produce, without changing any " +
      "state. This is the preview step: check the diff is what you intended before committing. " +
      "A plan that fails validation tells you the edit is wrong before it costs a revision.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: PROJECT_ID,
        expected_revision: { type: "integer", minimum: 0, description: "Revision from inspect." },
        operations: OPERATIONS,
      },
      required: ["project_id", "expected_revision", "operations"],
      additionalProperties: false,
    },
  },
  {
    name: "studio_project_apply_operations",
    title: "Apply operations",
    capability: "studio.project.apply_operations",
    mutating: true,
    risk: "reversible_local_write",
    description:
      "Apply typed operations atomically and advance the project revision. Rejected with " +
      "stale_revision if expected_revision is not current — when that happens, re-inspect and " +
      "re-plan; never retry with a newer revision to force the write through, because that " +
      "silently discards whoever edited in between. Returns an undo token.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: PROJECT_ID,
        expected_revision: { type: "integer", minimum: 0, description: "Revision from inspect." },
        operations: OPERATIONS,
        dry_run: {
          type: "boolean",
          default: false,
          description: "When true, returns the diff without mutating. Equivalent to studio_project_plan.",
        },
        idempotency_key: {
          type: "string",
          minLength: 8,
          description:
            "Optional. Supply a stable key to make retries safe: replaying the same key with the " +
            "same payload returns the original result instead of applying twice. Generated if omitted.",
        },
      },
      required: ["project_id", "expected_revision", "operations"],
      additionalProperties: false,
    },
  },
  {
    name: "studio_project_render",
    title: "Queue render",
    capability: "studio.project.render",
    mutating: true,
    risk: "reversible_local_write",
    description:
      "Queue a durable render job and return immediately with a job reference. Rendering is not " +
      "synchronous: poll studio_job_get for fractional progress, and call studio_job_cancel to " +
      "stop it. The output is probe-verified before an artifact is registered, so a completed " +
      "job means the file was actually checked, not merely written.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: PROJECT_ID,
        expected_revision: { type: "integer", minimum: 0 },
        cover_asset_id: { type: "string", minLength: 1, description: "Asset to render, from inspect." },
        preset_id: { type: "string", minLength: 1, description: "Render preset id, from inspect." },
        output_name: {
          type: "string",
          pattern: "^[a-zA-Z0-9][a-zA-Z0-9._-]*\\.mp4$",
          description: "Safe output filename. No directory separators; the host resolves the location.",
        },
      },
      required: ["project_id", "expected_revision", "cover_asset_id", "preset_id", "output_name"],
      additionalProperties: false,
    },
  },
  {
    name: "studio_job_get",
    title: "Get job",
    capability: "studio.job.get",
    mutating: false,
    risk: "read_only",
    description:
      "Read a durable job's status, fractional progress, stage, attempt count, and outputs. " +
      "Note that cancellation request and actual cancellation are tracked separately, so this " +
      "distinguishes 'cancel was asked for' from 'the work actually stopped'.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: PROJECT_ID,
        job_id: { type: "string", minLength: 1 },
      },
      required: ["project_id", "job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "studio_job_cancel",
    title: "Cancel job",
    capability: "studio.job.cancel",
    mutating: true,
    risk: "reversible_local_write",
    description:
      "Request cooperative cancellation of a durable job. Safe to call repeatedly. A running job " +
      "moves to cancel_requested and stops at its next checkpoint; a queued job cancels immediately.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: PROJECT_ID,
        job_id: { type: "string", minLength: 1 },
      },
      required: ["project_id", "job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "studio_operation_undo",
    title: "Undo operation",
    capability: "studio.operation.undo",
    mutating: true,
    risk: "reversible_local_write",
    description:
      "Reverse a previously applied operation using the undo token returned by " +
      "studio_project_apply_operations. Tokens are bound to a specific capability and revision " +
      "and are single-use — this is not a general 'undo the last thing that happened' command.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: PROJECT_ID,
        undo_token: { type: "string", minLength: 1 },
      },
      required: ["project_id", "undo_token"],
      additionalProperties: false,
    },
  },
] as const;

export function findTool(name: string): StudioToolDefinition | undefined {
  return STUDIO_TOOLS.find((tool) => tool.name === name);
}

export function toolManifest(): McpToolDefinition[] {
  return STUDIO_TOOLS.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: `${tool.description}\n\nCapability: ${tool.capability} · risk: ${tool.risk}`,
    inputSchema: tool.inputSchema,
  }));
}
