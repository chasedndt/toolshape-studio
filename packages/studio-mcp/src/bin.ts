import { randomBytes } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { STUDIO_SCHEMA_VERSION, StudioKernel } from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import { DurableRenderJobService } from "@toolshape/studio-render";
import { StudioSdk } from "@toolshape/studio-sdk";
import { serveHttp } from "./http";
import { StudioMcpServer } from "./server";
import { SessionRegistry, type SessionCredential } from "./session";
import { serveStdio } from "./stdio";

function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const transport = flag(args, "--transport") ?? "stdio";
  const databasePath = flag(args, "--db") ?? "runtime/studio.sqlite";
  const host = flag(args, "--host") ?? "127.0.0.1";
  const port = Number(flag(args, "--port") ?? 7777);

  const principalId = flag(args, "--principal") ?? "local-operator";
  const agentId = flag(args, "--agent") ?? "mcp-agent";
  const harnessId = flag(args, "--harness") ?? "unknown-harness";

  const repository = new SqliteStudioRepository(databasePath);
  const runtimeRoot = path.dirname(path.resolve(databasePath));
  const renderJobs = new DurableRenderJobService(repository, {
    contentRoot: path.join(runtimeRoot, "objects"),
    artifactRoot: path.join(runtimeRoot, "artifacts"),
  });
  const invoker = new StudioSdk(new StudioKernel(repository, renderJobs));
  const server = new StudioMcpServer({ invoker, schemaVersion: STUDIO_SCHEMA_VERSION });

  const session = {
    principalId,
    agentId,
    harnessId,
    // Grants are asserted here and authorized by the kernel. A production
    // deployment sources these from the policy engine, which is not yet built
    // (`docs/security/THREAT-MODEL.md`, explicit non-claims).
    // Each grant is a capability ID or the `studio.*` wildcard. Scope a harness
    // down with e.g. --grants studio.project.inspect,studio.job.get.
    // A production deployment sources these from the policy engine, which is
    // not yet built (`docs/security/THREAT-MODEL.md`, explicit non-claims).
    grantIds: (flag(args, "--grants") ?? "studio.*").split(",").map((grant) => grant.trim()).filter(Boolean),
  };

  if (transport === "stdio") {
    await serveStdio({ server, session });
    repository.close();
    return;
  }

  if (transport !== "http") {
    throw new TypeError(`Unknown transport: ${transport}. Use "stdio" or "http".`);
  }

  // Fail closed: never start an unauthenticated listener. If no token is
  // supplied we mint one and print it to stderr rather than defaulting to open.
  const supplied = process.env.STUDIO_MCP_TOKEN;
  const token = supplied ?? randomBytes(32).toString("hex");
  const credential: SessionCredential = { ...session, token };
  const sessions = new SessionRegistry([credential]);

  // Browser clients need an explicit origin; nothing is allowed by default.
  const allowedOrigins = (flag(args, "--allow-origin") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const listener = await serveHttp({ server, sessions, port, host, allowedOrigins });
  if (!supplied) {
    process.stderr.write(
      `Generated a single-run bearer token. Set STUDIO_MCP_TOKEN to use a stable one.\n${token}\n`,
    );
  }
  process.stderr.write(`Toolshape Studio MCP listening on http://${host}:${port}\n`);

  const shutdown = (): void => {
    listener.close(() => {
      repository.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ status: "failed", error: { code: "studio.mcp.failure", message } })}\n`);
  process.exitCode = 1;
});
