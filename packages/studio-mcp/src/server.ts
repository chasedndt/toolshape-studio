import type { StudioInvoker } from "@toolshape/studio-sdk";
import { buildEnvelope, type ToolCallArguments } from "./envelope";
import {
  JsonRpcError,
  JsonRpcErrorCode,
  MCP_PROTOCOL_VERSION,
  failure,
  isJsonRpcRequest,
  isNotification,
  success,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpToolResult,
} from "./protocol";
import type { StudioSession } from "./session";
import { findTool, toolManifest } from "./tools";

export interface StudioMcpServerOptions {
  invoker: StudioInvoker;
  schemaVersion: string;
  serverName?: string;
  serverVersion?: string;
  now?: () => string;
  newId?: () => string;
}

/**
 * Transport-agnostic MCP dispatch.
 *
 * Holds no domain logic and no authorization decisions of its own: it validates
 * the JSON-RPC shape, resolves the tool, builds an envelope from the
 * authenticated session, and hands off to the kernel through the SDK. Every
 * substantive check — capability allowlist, grants, expected revision,
 * idempotency — happens in the kernel, so this adapter cannot become a looser
 * path than the UI or CLI (ADR 0006, ADR 0012).
 */
export class StudioMcpServer {
  private readonly serverName: string;
  private readonly serverVersion: string;

  constructor(private readonly options: StudioMcpServerOptions) {
    this.serverName = options.serverName ?? "toolshape-studio";
    this.serverVersion = options.serverVersion ?? options.schemaVersion;
  }

  /**
   * Handle one JSON-RPC message. Returns null for notifications, which must not
   * receive a response.
   */
  handle(message: unknown, session: StudioSession): JsonRpcResponse | null {
    if (!isJsonRpcRequest(message)) {
      return failure(null, JsonRpcErrorCode.invalidRequest, "Message is not a JSON-RPC 2.0 request.");
    }
    const id = message.id ?? null;
    try {
      const result = this.dispatch(message, session);
      if (isNotification(message)) return null;
      return success(id, result);
    } catch (error) {
      if (isNotification(message)) return null;
      if (error instanceof JsonRpcError) {
        return failure(id, error.code, error.message, error.data);
      }
      return failure(
        id,
        JsonRpcErrorCode.internalError,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private dispatch(request: JsonRpcRequest, session: StudioSession): unknown {
    switch (request.method) {
      case "initialize":
        return {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: this.serverName, version: this.serverVersion },
          instructions:
            "Toolshape Studio semantic surface. Always studio_project_inspect first to obtain the " +
            "current revision, preview mutations with studio_project_plan, then apply with the " +
            "revision you inspected. A stale_revision rejection means someone else edited the " +
            "project: re-inspect and re-plan rather than forcing the write.",
        };
      case "notifications/initialized":
        return {};
      case "ping":
        return {};
      case "tools/list":
        return { tools: toolManifest() };
      case "tools/call":
        return this.callTool(request.params, session);
      default:
        throw new JsonRpcError(JsonRpcErrorCode.methodNotFound, `Unknown method: ${request.method}`);
    }
  }

  private callTool(params: Record<string, unknown> | undefined, session: StudioSession): McpToolResult {
    const name = params?.name;
    if (typeof name !== "string") {
      throw new JsonRpcError(JsonRpcErrorCode.invalidParams, "tools/call requires a tool name.");
    }
    const tool = findTool(name);
    if (!tool) {
      throw new JsonRpcError(JsonRpcErrorCode.invalidParams, `Unknown tool: ${name}`);
    }
    const rawArgs = params?.arguments;
    if (rawArgs !== undefined && (typeof rawArgs !== "object" || rawArgs === null || Array.isArray(rawArgs))) {
      throw new JsonRpcError(JsonRpcErrorCode.invalidParams, "tools/call arguments must be an object.");
    }
    const args = (rawArgs ?? {}) as ToolCallArguments;
    if (typeof args.project_id !== "string" || args.project_id.length === 0) {
      throw new JsonRpcError(JsonRpcErrorCode.invalidParams, "project_id is required.");
    }

    const envelope = buildEnvelope({
      tool,
      args,
      session,
      schemaVersion: this.options.schemaVersion,
      now: this.options.now,
      newId: this.options.newId,
    });

    try {
      const result = this.options.invoker.invoke(envelope);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      // Kernel rejections are reported as tool errors, not protocol errors: the
      // call was well-formed, the operation was refused. Agents branch on this.
      // Structured fields are surfaced without filesystem paths (ADR 0008).
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify(describeRejection(error), null, 2) }],
      };
    }
  }
}

function describeRejection(error: unknown): Record<string, unknown> {
  const message = error instanceof Error ? error.message : String(error);
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const code = typeof record.code === "string" ? record.code : "studio.operation.rejected";
  const stage = typeof record.stage === "string" ? record.stage : undefined;
  const evidence =
    typeof record.evidence === "object" && record.evidence !== null ? record.evidence : undefined;
  return {
    status: "rejected",
    error: {
      code,
      message,
      ...(stage ? { stage } : {}),
      ...(evidence ? { evidence } : {}),
    },
  };
}
