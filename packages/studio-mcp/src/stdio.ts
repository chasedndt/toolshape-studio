import type { Readable, Writable } from "node:stream";
import type { StudioMcpServer } from "./server";
import type { StudioSession } from "./session";

/**
 * Newline-delimited JSON-RPC over stdio.
 *
 * Used by co-located harnesses that launch Studio as a child process. There is
 * no bearer token here because the trust boundary is the process boundary: a
 * caller that can spawn this process with these arguments already has the
 * host's authority. The session identity is supplied by the launcher.
 */
export interface StdioTransportOptions {
  server: StudioMcpServer;
  session: StudioSession;
  input?: Readable;
  output?: Writable;
}

export function serveStdio(options: StdioTransportOptions): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;

  return new Promise((resolve, reject) => {
    let buffer = "";

    const flushLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        output.write(
          `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } })}\n`,
        );
        return;
      }
      const response = options.server.handle(parsed, options.session);
      if (response) output.write(`${JSON.stringify(response)}\n`);
    };

    input.setEncoding("utf8");
    input.on("data", (chunk: string) => {
      buffer += chunk;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        flushLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    });
    input.on("end", () => {
      if (buffer.trim()) flushLine(buffer);
      resolve();
    });
    input.on("error", reject);
  });
}
