/**
 * Runs the editor against the real persistent kernel.
 *
 * `npm run dev` alone starts the editor in local mode: the kernel runs
 * in-process, edits are real but live only in that tab, and no agent can see
 * them. That is deliberate — the editor stays usable with one command.
 *
 * This script starts the MCP host as well and points the editor at it, so the
 * browser and any connected agent share one SQLite project. It is the setup the
 * Tauri shell will make permanent at Milestone 11 (ADR 0013).
 *
 *   npm run dev:connected
 */
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { STUDIO_SCHEMA_VERSION, StudioKernel } from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import { DurableRenderJobService } from "@toolshape/studio-render";
import { StudioSdk } from "@toolshape/studio-sdk";
import { SessionRegistry, StudioMcpServer, serveHttp } from "@toolshape/studio-mcp";

const PORT = Number(process.env.STUDIO_MCP_PORT ?? 7777);
const UI_PORT = Number(process.env.STUDIO_UI_PORT ?? 5173);
const UI_ORIGIN = `http://127.0.0.1:${UI_PORT}`;
const runtimeRoot = path.resolve(import.meta.dirname, "../../../runtime");
const databasePath = path.join(runtimeRoot, "studio.sqlite");

async function main(): Promise<void> {
  await mkdir(runtimeRoot, { recursive: true });

  const repository = new SqliteStudioRepository(databasePath);
  // Seed only when empty, so restarting keeps whatever has been edited.
  const project = createGoldenStudioProject();
  if (!repository.getProject(project.id)) {
    repository.createProject(project);
    process.stdout.write(`Seeded ${project.id} at revision ${project.revision}.\n`);
  } else {
    process.stdout.write(`Reopened ${project.id}.\n`);
  }

  const renderJobs = new DurableRenderJobService(repository, {
    contentRoot: path.join(runtimeRoot, "objects"),
    artifactRoot: path.join(runtimeRoot, "artifacts"),
  });
  const server = new StudioMcpServer({
    invoker: new StudioSdk(new StudioKernel(repository, renderJobs)),
    schemaVersion: STUDIO_SCHEMA_VERSION,
  });

  // A fresh token per run. The editor is handed it through Vite's env, so
  // nothing is written to disk and no default credential exists to leak.
  const token = process.env.STUDIO_MCP_TOKEN ?? randomBytes(32).toString("hex");
  const agentToken = process.env.STUDIO_AGENT_TOKEN ?? randomBytes(32).toString("hex");

  // Two credentials, because the same transport now carries two kinds of
  // caller. The editor is a person and must be recorded as one; a harness is
  // an agent. The credential decides, not the request — a caller still cannot
  // assert its own identity.
  const sessions = new SessionRegistry([
    {
      principalId: "local-operator",
      agentId: "local-operator",
      harnessId: "studio-ui",
      actorType: "human",
      grantIds: ["studio.*"],
      token,
    },
    {
      principalId: "local-operator",
      agentId: "external-harness",
      harnessId: "mcp-client",
      actorType: "agent",
      grantIds: ["studio.*"],
      token: agentToken,
    },
  ]);

  const listener = await serveHttp({
    server,
    sessions,
    port: PORT,
    host: "127.0.0.1",
    allowedOrigins: [UI_ORIGIN],
  });
  process.stdout.write(`MCP host listening on http://127.0.0.1:${PORT}\n`);
  process.stdout.write(`Project database: ${databasePath}\n\n`);

  const vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(UI_PORT), "--strictPort"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      VITE_STUDIO_ENDPOINT: `http://127.0.0.1:${PORT}/`,
      VITE_STUDIO_TOKEN: token,
    },
  });

  const shutdown = (): void => {
    vite.kill();
    listener.close(() => {
      repository.close();
      process.exit(0);
    });
  };
  vite.on("exit", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ status: "failed", error: String(error) })}\n`);
  process.exitCode = 1;
});
