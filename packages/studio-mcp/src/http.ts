import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { StudioMcpServer } from "./server";
import { SessionRegistry, UnauthorizedError } from "./session";

/**
 * JSON-RPC over HTTP POST.
 *
 * This is the transport that exists to serve harnesses running as long-lived
 * server processes (Hermes, OpenClaw, supervised runtimes) which cannot import
 * the SDK in-process or spawn the CLI. See ADR 0012.
 *
 * Every request authenticates. Loopback is not an authorization boundary — any
 * local process can reach a bound port — so there is no "trusted because it's
 * 127.0.0.1" path here.
 */
export interface HttpTransportOptions {
  server: StudioMcpServer;
  sessions: SessionRegistry;
  port: number;
  /** Defaults to loopback. Binding wider is an explicit, deliberate act. */
  host?: string;
  /** Rejects oversized bodies before parsing. */
  maxBodyBytes?: number;
}

const DEFAULT_MAX_BODY_BYTES = 4 * 1024 * 1024;

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(text),
    // This is a machine surface; browsers have no business framing or sniffing it.
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  });
  response.end(text);
}

function readBody(request: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    request.on("data", (chunk: Buffer) => {
      total += chunk.byteLength;
      if (total > maxBytes) {
        reject(new RangeError("Request body exceeded the accepted limit."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

export function createHttpTransport(options: HttpTransportOptions): Server {
  const maxBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return createServer((request, response) => {
    void (async () => {
      // Unauthenticated liveness only. Deliberately reveals nothing about
      // projects, sessions, or the capability surface.
      if (request.method === "GET" && request.url === "/health") {
        writeJson(response, 200, { status: "ok" });
        return;
      }

      if (request.method !== "POST") {
        writeJson(response, 405, { error: { code: -32600, message: "Use POST for JSON-RPC." } });
        return;
      }

      let session;
      try {
        session = options.sessions.authenticate(request.headers.authorization);
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          response.setHeader("www-authenticate", "Bearer");
          writeJson(response, 401, { error: { code: -32001, message: error.message } });
          return;
        }
        throw error;
      }

      let body: string;
      try {
        body = await readBody(request, maxBytes);
      } catch (error) {
        writeJson(response, 413, {
          error: { code: -32600, message: error instanceof Error ? error.message : "Body rejected." },
        });
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        writeJson(response, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } });
        return;
      }

      const result = options.server.handle(parsed, session);
      // A notification produces no response body.
      if (!result) {
        response.writeHead(204);
        response.end();
        return;
      }
      writeJson(response, 200, result);
    })().catch(() => {
      if (!response.headersSent) {
        writeJson(response, 500, { error: { code: -32603, message: "Internal error." } });
      } else {
        response.end();
      }
    });
  });
}

export function serveHttp(options: HttpTransportOptions): Promise<Server> {
  const server = createHttpTransport(options);
  const host = options.host ?? "127.0.0.1";
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, host, () => resolve(server));
  });
}
