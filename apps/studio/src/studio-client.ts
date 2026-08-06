import type { SemanticDiff, StudioOperation, StudioProject } from "@toolshape/studio-domain";
import {
  STUDIO_SCHEMA_VERSION,
  type DurableJob,
  type OperationEnvelope,
  type OperationHistoryEntry,
  type OperationResult,
  type StudioKernel,
} from "@toolshape/studio-kernel";

/**
 * The editor's view of the kernel.
 *
 * Until Milestone 8 the UI constructed its own in-process kernel over an
 * in-memory store, so browser edits never reached the SQLite project that the
 * CLI and MCP transport use. Human and agent editing shared an operation path
 * but not a store. This client closes that gap by making the UI a *client* of
 * the kernel rather than an owner of one.
 *
 * The transport is swappable on purpose: HTTP today, a Tauri IPC channel at
 * Milestone 11 (ADR 0013), and an in-memory one for tests. The interface above
 * it does not change when the wire does.
 */

export type OperationDraft = {
  [K in StudioOperation["type"]]: {
    type: K;
    payload: Extract<StudioOperation, { type: K }>["payload"];
  };
}[StudioOperation["type"]];

export interface StudioTransport {
  invoke(envelope: OperationEnvelope): Promise<OperationResult>;
}

export class StudioDisconnectedError extends Error {
  readonly name = "StudioDisconnectedError";
  constructor(cause?: unknown) {
    super("Studio could not reach the project host.", cause === undefined ? undefined : { cause });
  }
}

export class StudioStaleRevisionError extends Error {
  readonly name = "StudioStaleRevisionError";
  constructor(
    readonly expectedRevision: number,
    message = "The project changed since it was last read.",
  ) {
    super(message);
  }
}

export class StudioOperationRejectedError extends Error {
  readonly name = "StudioOperationRejectedError";
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

export interface StudioState {
  project: StudioProject;
  revision: number;
}

export interface ApplyOutcome {
  project: StudioProject;
  revision: number;
  diff: SemanticDiff | null;
  undoToken: string | null;
}

export interface PlanOutcome {
  diff: SemanticDiff[];
}

export interface ExportRequest {
  sceneIds: string[];
  format: "svg" | "png" | "jpeg" | "webp" | "pdf";
  scale?: number;
  quality?: number;
  transparentBackground?: boolean;
  outputName: string;
}

export interface RenderRequest {
  coverAssetId: string;
  presetId: string;
  outputName: string;
}

/** Who is making the edit. Carried into both the envelope and the operation. */
export type StudioActor = "operator" | "agent";

export interface ApplyOptions {
  idempotencyKey?: string;
  /**
   * Defaults to the human operator. Passing "agent" marks the edit as
   * agent-authored, which is what the activity history attributes it to.
   */
  actor?: StudioActor;
}

export interface StudioClientOptions {
  transport: StudioTransport;
  projectId: string;
  actorId?: string;
  newId?: () => string;
  now?: () => string;
}

/**
 * Derives a stable UUID from a string.
 *
 * A retry is only idempotent if the whole operation is byte-identical: the
 * kernel digests the payload, and a freshly generated operationId changes that
 * digest, so the "retry" is correctly treated as a different operation and
 * refused as a conflict. Deriving the operationId from the idempotency key
 * makes a retry genuinely identical, and survives a page reload in a way an
 * in-memory cache would not.
 *
 * Not cryptographic, and does not need to be — these identify operations
 * within one project, they do not authenticate anything.
 */
function deterministicUuid(seed: string): string {
  const hex: string[] = [];
  // Four independently seeded FNV-1a passes give 32 hex characters.
  for (let lane = 0; lane < 4; lane += 1) {
    let hash = 0x811c9dc5 ^ (lane * 0x01000193);
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hex.push(hash.toString(16).padStart(8, "0"));
  }
  const digits = hex.join("");
  const variant = "89ab"[Number.parseInt(digits[16], 16) % 4];
  return [
    digits.slice(0, 8),
    digits.slice(8, 12),
    `4${digits.slice(13, 16)}`,
    `${variant}${digits.slice(17, 20)}`,
    digits.slice(20, 32),
  ].join("-");
}

/** A stale-revision refusal from the kernel reads as a RangeError with this shape. */
function isStaleRevision(error: unknown): boolean {
  return error instanceof Error && /expected project revision/i.test(error.message);
}

/**
 * Anything that is not a domain refusal is treated as a transport failure.
 * The distinction matters to the UI: a refusal means "re-read and re-plan",
 * a disconnection means "the host is not there and nothing you do will work".
 */
function isTransportFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  return /fetch failed|networkerror|failed to fetch|econnrefused|socket hang up|load failed/i.test(
    `${error.name} ${error.message}`,
  );
}

export function createMemoryTransport(kernel: StudioKernel): StudioTransport {
  return {
    invoke(envelope) {
      // Kept async so callers cannot accidentally depend on synchronous
      // resolution that a real transport will never provide.
      return Promise.resolve().then(() => kernel.invoke(envelope));
    },
  };
}

export class StudioClient {
  private readonly newId: () => string;
  private readonly now: () => string;
  private readonly actorId: string;
  /** Last revision the server confirmed. Never inferred locally. */
  private knownRevision: number | null = null;

  constructor(private readonly options: StudioClientOptions) {
    this.newId = options.newId ?? (() => globalThis.crypto.randomUUID());
    this.now = options.now ?? (() => new Date().toISOString());
    this.actorId = options.actorId ?? "studio-operator";
  }

  get revision(): number | null {
    return this.knownRevision;
  }

  private envelope(
    capabilityId: OperationEnvelope["capability"]["id"],
    input: OperationEnvelope["input"],
    options: {
      expectedRevision?: number | null;
      dryRun?: boolean;
      idempotencyKey?: string;
      actor?: StudioActor;
    } = {},
  ): OperationEnvelope {
    return {
      schema_version: STUDIO_SCHEMA_VERSION,
      operation_id: this.newId(),
      idempotency_key: options.idempotencyKey ?? `ui-${this.newId()}`,
      trace_id: `ui-trace-${this.newId()}`,
      actor: {
        id: options.actor === "agent" ? `${this.actorId}:agent` : this.actorId,
        type: options.actor === "agent" ? "agent" : "human",
      },
      intent: `Apply ${capabilityId}`,
      capability: { id: capabilityId, version: STUDIO_SCHEMA_VERSION },
      target: {
        resource: `toolshape-studio://projects/${encodeURIComponent(this.options.projectId)}`,
        expected_revision: options.expectedRevision ?? null,
      },
      input,
      risk: { level: "low" },
      authorization: { grant_ids: ["studio.*"] },
      execution: { dry_run: options.dryRun ?? false, atomicity: "atomic" },
      retention: { class: "project", content_storage: "local" },
      created_at: this.now(),
    };
  }

  private async send(envelope: OperationEnvelope): Promise<OperationResult> {
    let result: OperationResult;
    try {
      result = await this.options.transport.invoke(envelope);
    } catch (error) {
      if (isStaleRevision(error)) {
        throw new StudioStaleRevisionError(envelope.target.expected_revision ?? -1);
      }
      if (isTransportFailure(error)) throw new StudioDisconnectedError(error);
      throw new StudioOperationRejectedError(
        error instanceof Error ? error.message : String(error),
        "studio.operation.rejected",
      );
    }
    if (result.state.revision_after != null) this.knownRevision = result.state.revision_after;
    return result;
  }

  /** Reads canonical state. This is the only source of the expected revision. */
  async inspect(): Promise<StudioState> {
    const result = await this.send(this.envelope("studio.project.inspect", {}));
    const project = result.state.project;
    if (!project) throw new StudioOperationRejectedError("Inspect returned no project.", "studio.inspect.empty");
    this.knownRevision = project.revision;
    return { project, revision: project.revision };
  }

  private requireRevision(): number {
    if (this.knownRevision === null) {
      throw new StudioOperationRejectedError(
        "Inspect the project before mutating it.",
        "studio.client.no-revision",
      );
    }
    return this.knownRevision;
  }

  private operationFrom(
    draft: OperationDraft,
    revision: number,
    idempotencyKey?: string,
    actor: StudioActor = "operator",
  ): StudioOperation {
    return {
      ...draft,
      // Stable when the caller supplied a key, so a retry is byte-identical.
      operationId: idempotencyKey ? deterministicUuid(`${idempotencyKey}:${revision}`) : this.newId(),
      expectedRevision: revision,
      actor,
    } as StudioOperation;
  }

  /** Computes the diff an operation would produce, without mutating. */
  async plan(draft: OperationDraft): Promise<PlanOutcome> {
    const revision = this.requireRevision();
    const result = await this.send(
      this.envelope(
        "studio.project.plan",
        { operations: [this.operationFrom(draft, revision)] },
        { expectedRevision: revision, dryRun: true },
      ),
    );
    return { diff: result.state.semantic_diff };
  }

  async apply(draft: OperationDraft, options: ApplyOptions = {}): Promise<ApplyOutcome> {
    const revision = this.requireRevision();
    const result = await this.send(
      this.envelope(
        "studio.project.apply_operations",
        { operations: [this.operationFrom(draft, revision, options.idempotencyKey, options.actor)] },
        { expectedRevision: revision, idempotencyKey: options.idempotencyKey, actor: options.actor },
      ),
    );
    return this.toApplyOutcome(result);
  }

  /** Every committed operation, with actor attribution and revertibility. */
  async history(): Promise<OperationHistoryEntry[]> {
    const result = await this.send(this.envelope("studio.project.history", {}));
    return result.history ?? [];
  }

  /**
   * Reverses one past operation, keeping everything applied after it.
   *
   * Distinct from `undo`, which restores a whole revision snapshot and
   * therefore discards later work by design.
   */
  async revert(operationId: string): Promise<ApplyOutcome> {
    const revision = this.requireRevision();
    const result = await this.send(
      this.envelope(
        "studio.operation.revert",
        { revert_operation_id: operationId },
        { expectedRevision: revision },
      ),
    );
    return this.toApplyOutcome(result);
  }

  async undo(token: string): Promise<ApplyOutcome> {
    const revision = this.requireRevision();
    const result = await this.send(
      this.envelope("studio.operation.undo", { undo_token: token }, { expectedRevision: revision }),
    );
    return this.toApplyOutcome(result);
  }

  async queueRender(request: RenderRequest): Promise<DurableJob> {
    const revision = this.requireRevision();
    const result = await this.send(
      this.envelope(
        "studio.project.render",
        {
          render: {
            cover_asset_id: request.coverAssetId,
            preset_id: request.presetId,
            output_name: request.outputName,
          },
        },
        { expectedRevision: revision },
      ),
    );
    if (!result.job) {
      throw new StudioOperationRejectedError("Render returned no durable job.", "studio.render.no-job");
    }
    return result.job;
  }

  /**
   * Queues a design export.
   *
   * Goes through the same capability the agent surface uses. A button that
   * called a shortcut of its own would be a second path to the same outcome,
   * with its own revision handling and its own way of being wrong — and the
   * export would stop appearing in the history everyone shares.
   */
  async queueExport(request: ExportRequest): Promise<DurableJob> {
    const revision = this.requireRevision();
    const result = await this.send(
      this.envelope(
        "studio.design.export",
        {
          export: {
            scene_ids: request.sceneIds,
            format: request.format,
            ...(request.scale === undefined ? {} : { scale: request.scale }),
            ...(request.quality === undefined ? {} : { quality: request.quality }),
            ...(request.transparentBackground === undefined
              ? {}
              : { transparent_background: request.transparentBackground }),
            output_name: request.outputName,
          },
        },
        { expectedRevision: revision },
      ),
    );
    if (!result.job) {
      throw new StudioOperationRejectedError("Export returned no durable job.", "studio.export.no-job");
    }
    return result.job;
  }

  async getJob(jobId: string): Promise<DurableJob | null> {
    const result = await this.send(this.envelope("studio.job.get", { job_id: jobId }));
    return result.job ?? null;
  }

  private toApplyOutcome(result: OperationResult): ApplyOutcome {
    const project = result.state.project;
    if (!project) throw new StudioOperationRejectedError("Operation returned no project.", "studio.apply.empty");
    this.knownRevision = project.revision;
    return {
      project,
      revision: project.revision,
      diff: result.state.semantic_diff.at(-1) ?? null,
      undoToken: result.undo?.token ?? null,
    };
  }
}
