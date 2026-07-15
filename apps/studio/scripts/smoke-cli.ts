import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp } from "node:fs/promises";
import path from "node:path";
import { STUDIO_SCHEMA_VERSION, type OperationEnvelope } from "@toolshape/studio-kernel";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";

interface ProcessResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runCli(cliPath: string, databasePath: string, document: unknown): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", cliPath, "--db", databasePath], {
      cwd: path.resolve(import.meta.dirname, "../../.."),
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.stdin.end(JSON.stringify(document));
  });
}

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const runtimeRoot = path.join(repoRoot, "runtime");
await mkdir(runtimeRoot, { recursive: true });
const runRoot = await mkdtemp(path.join(runtimeRoot, "cli-"));
const databasePath = path.join(runRoot, "studio.sqlite");
const cliPath = path.join(repoRoot, "packages", "studio-cli", "src", "bin.ts");
const project = createGoldenStudioProject();

const initialized = await runCli(cliPath, databasePath, { command: "init", project });
if (initialized.code !== 0) throw new Error(`CLI init failed: ${initialized.stderr}`);

const envelope: OperationEnvelope = {
  schema_version: STUDIO_SCHEMA_VERSION,
  operation_id: randomUUID(),
  idempotency_key: `cli-smoke-${randomUUID()}`,
  trace_id: `cli-trace-${randomUUID()}`,
  actor: { id: "cli-smoke", type: "service" },
  intent: "Prove the process CLI uses the canonical kernel",
  capability: { id: "studio.project.apply_operations", version: STUDIO_SCHEMA_VERSION },
  target: { resource: `toolshape-studio://projects/${project.id}`, expected_revision: 0 },
  input: {
    operations: [{
      operationId: randomUUID(),
      type: "scene.node.update-transform",
      actor: "operator",
      expectedRevision: 0,
      payload: { sceneId: "scene-hero", nodeId: "node-product", patch: { rotationDeg: -4 } },
    }],
  },
  risk: { level: "low" },
  authorization: { grant_ids: ["studio.project.apply_operations"] },
  execution: { dry_run: false, atomicity: "atomic" },
  retention: { class: "project", content_storage: "local" },
  created_at: new Date().toISOString(),
};

const invoked = await runCli(cliPath, databasePath, { command: "invoke", envelope });
if (invoked.code !== 0) throw new Error(`CLI invoke failed: ${invoked.stderr}`);
const result = JSON.parse(invoked.stdout);
if (result.status !== "completed" || result.state?.revision_after !== 1) {
  throw new Error(`CLI returned an unexpected result: ${invoked.stdout}`);
}

process.stdout.write(`${JSON.stringify({ runRoot, databasePath, init: JSON.parse(initialized.stdout), invoke: { status: result.status, revisionAfter: result.state.revision_after, digest: result.state.digest }, stderrDiagnostics: [initialized.stderr, invoked.stderr].filter(Boolean) }, null, 2)}\n`);
