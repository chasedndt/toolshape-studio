import type { OperationEnvelope, OperationResult } from "@toolshape/studio-kernel";
import type { StudioTransport } from "./studio-client";

/**
 * HTTP transport for the editor.
 *
 * Speaks the same MCP JSON-RPC surface an agent harness uses (ADR 0012), which
 * is the point: the human interface becomes just another adapter over the same
 * kernel, rather than a privileged path with its own store.
 *
 * At Milestone 11 a Tauri IPC transport replaces this behind the same
 * `StudioTransport` interface, and nothing above it changes (ADR 0013).
 */

export interface HttpTransportOptions {
  /** e.g. http://127.0.0.1:7777/ */
  endpoint: string;
  token: string;
  fetchImpl?: typeof fetch;
}

interface JsonRpcEnvelopeResponse {
  result?: { content?: Array<{ text: string }>; isError?: boolean };
  error?: { code: number; message: string };
}

/**
 * The MCP tool surface is agent-facing and takes semantic arguments rather than
 * a raw envelope. The editor already builds envelopes, so it maps them onto the
 * matching tool call here.
 */
function toolCallFor(envelope: OperationEnvelope): { name: string; arguments: Record<string, unknown> } {
  const projectId = decodeURIComponent(
    envelope.target.resource.slice("toolshape-studio://projects/".length).split(/[/?#]/, 1)[0],
  );
  const base = {
    project_id: projectId,
    expected_revision: envelope.target.expected_revision ?? undefined,
    idempotency_key: envelope.idempotency_key,
  };
  switch (envelope.capability.id) {
    case "studio.project.inspect":
      return { name: "studio_project_inspect", arguments: { project_id: projectId } };
    case "studio.project.validate":
      return { name: "studio_project_validate", arguments: { project_id: projectId } };
    case "studio.project.plan":
      return { name: "studio_project_plan", arguments: { ...base, operations: envelope.input.operations } };
    case "studio.project.apply_operations":
      return {
        name: "studio_project_apply_operations",
        arguments: { ...base, operations: envelope.input.operations, dry_run: envelope.execution.dry_run },
      };
    case "studio.project.render": {
      const render = envelope.input.render;
      return {
        name: "studio_project_render",
        arguments: {
          ...base,
          cover_asset_id: render?.cover_asset_id,
          preset_id: render?.preset_id,
          output_name: render?.output_name,
        },
      };
    }
    case "studio.job.get":
      return { name: "studio_job_get", arguments: { project_id: projectId, job_id: envelope.input.job_id } };
    case "studio.job.cancel":
      return { name: "studio_job_cancel", arguments: { project_id: projectId, job_id: envelope.input.job_id } };
    case "studio.operation.undo":
      return {
        name: "studio_operation_undo",
        arguments: { project_id: projectId, undo_token: envelope.input.undo_token },
      };
    case "studio.design.export":
      return {
        name: "studio_design_export",
        arguments: {
          project_id: projectId,
          expected_revision: envelope.target.expected_revision ?? undefined,
          scene_ids: envelope.input.export?.scene_ids,
          format: envelope.input.export?.format,
          scale: envelope.input.export?.scale,
          quality: envelope.input.export?.quality,
          transparent_background: envelope.input.export?.transparent_background,
          output_name: envelope.input.export?.output_name,
        },
      };
    case "studio.project.history":
      return { name: "studio_project_history", arguments: { project_id: projectId } };
    case "studio.operation.revert":
      return {
        name: "studio_operation_revert",
        arguments: {
          project_id: projectId,
          expected_revision: envelope.target.expected_revision ?? undefined,
          revert_operation_id: envelope.input.revert_operation_id,
        },
      };
    default: {
      const exhaustive: never = envelope.capability.id;
      throw new TypeError(`Unhandled capability: ${String(exhaustive)}`);
    }
  }
}

let nextRequestId = 1;

export function createHttpTransport(options: HttpTransportOptions): StudioTransport {
  const call = options.fetchImpl ?? fetch;
  return {
    async invoke(envelope: OperationEnvelope): Promise<OperationResult> {
      const response = await call(options.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: nextRequestId++,
          method: "tools/call",
          params: toolCallFor(envelope),
        }),
      });

      if (!response.ok) {
        // 401 and friends are not domain refusals; the client treats a thrown
        // network-shaped error as a disconnection, which is the honest reading
        // when the host will not talk to us at all.
        throw new TypeError(`fetch failed with HTTP ${response.status}`);
      }

      const body = (await response.json()) as JsonRpcEnvelopeResponse;
      if (body.error) throw new Error(body.error.message);

      const text = body.result?.content?.[0]?.text;
      if (!text) throw new Error("Transport returned no result content.");
      const payload = JSON.parse(text) as Record<string, unknown>;

      // A tool error carries the kernel's refusal. Rethrowing with the original
      // message preserves the stale-revision detection the client relies on.
      if (body.result?.isError) {
        const error = payload.error as { message?: string; code?: string } | undefined;
        throw new Error(error?.message ?? "The operation was rejected.");
      }

      // The public contract carries a durable job inside verification
      // evidence, while the internal result shape expects it on `job`. Without
      // lifting it back out, every job-queuing capability over HTTP reports
      // "returned no durable job" after having queued one perfectly well —
      // work happens, the editor says it failed, and the operator presses the
      // button again.
      const evidence = (payload.verification as { evidence?: Array<Record<string, unknown>> } | undefined)
        ?.evidence?.find((item) => item.type === "durable_job");
      if (evidence?.job && !payload.job) {
        return { ...payload, job: evidence.job } as unknown as OperationResult;
      }

      return payload as unknown as OperationResult;
    },
  };
}
