/**
 * Minimal JSON-RPC 2.0 and Model Context Protocol wire types.
 *
 * Hand-rolled rather than taken from an SDK dependency, for the same reason the
 * persistence layer uses `node:sqlite` instead of a native driver: the protocol
 * surface we need is small, stable, and fully testable, and keeping it in-repo
 * means the adapter has no supply-chain surface of its own. See ADR 0012.
 */

export const JSONRPC_VERSION = "2.0";

/** Protocol revision this adapter implements. */
export const MCP_PROTOCOL_VERSION = "2025-06-18";

export interface JsonRpcRequest {
  jsonrpc: typeof JSONRPC_VERSION;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcSuccess {
  jsonrpc: typeof JSONRPC_VERSION;
  id: string | number | null;
  result: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: typeof JSONRPC_VERSION;
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

export const JsonRpcErrorCode = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
  /** Application-defined: the session is missing or its token did not verify. */
  unauthorized: -32001,
} as const;

export class JsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "JsonRpcError";
  }
}

export function success(id: string | number | null, result: unknown): JsonRpcSuccess {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

export function failure(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcFailure {
  return { jsonrpc: JSONRPC_VERSION, id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<JsonRpcRequest>;
  return candidate.jsonrpc === JSONRPC_VERSION && typeof candidate.method === "string";
}

/** A request with no `id` is a notification: it must not receive a response. */
export function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined;
}

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}
