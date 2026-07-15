import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import {
  STUDIO_SCHEMA_VERSION,
  type OperationEnvelope,
  type StudioCapabilityId,
} from "@toolshape/studio-kernel";
import {
  ContentAddressedAssetStore,
  SqliteStudioRepository,
} from "@toolshape/studio-persistence";
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

function envelope(
  capability: StudioCapabilityId,
  input: OperationEnvelope["input"],
): OperationEnvelope {
  return {
    schema_version: STUDIO_SCHEMA_VERSION,
    operation_id: randomUUID(),
    idempotency_key: `render-smoke-${randomUUID()}`,
    trace_id: `render-smoke-trace-${randomUUID()}`,
    actor: { id: "render-job-smoke", type: "service" },
    intent: `Exercise ${capability} through the process CLI`,
    capability: { id: capability, version: STUDIO_SCHEMA_VERSION },
    target: {
      resource: "toolshape-studio://projects/project-launch-film",
      expected_revision: 0,
    },
    input,
    risk: { level: "low" },
    authorization: { grant_ids: [capability] },
    execution: { dry_run: false, atomicity: "atomic" },
    retention: { class: "project", content_storage: "local" },
    created_at: new Date().toISOString(),
  };
}

function parsed(result: ProcessResult, label: string): any {
  if (result.code !== 0) throw new Error(`${label} failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

const appRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(appRoot, "../..");
const coverPath = path.join(appRoot, "artifacts", "golden-cover.png");
try {
  await access(coverPath);
} catch {
  throw new Error("golden-cover.png is missing; run browser QA before the durable render smoke.");
}

const runtimeRoot = path.join(repoRoot, "runtime");
await mkdir(runtimeRoot, { recursive: true });
const runRoot = await mkdtemp(path.join(runtimeRoot, "render-job-"));
const databasePath = path.join(runRoot, "studio.sqlite");
const cliPath = path.join(repoRoot, "packages", "studio-cli", "src", "bin.ts");
const contentStore = new ContentAddressedAssetStore(path.join(runRoot, "objects"));
const storedCover = await contentStore.import({
  bytes: await readFile(coverPath),
  originalName: "golden-cover.png",
  mediaType: "image/png",
});
const project = createGoldenStudioProject();
const coverAsset = project.assets.find((asset) => asset.id === "asset-product-image")!;
coverAsset.contentHash = storedCover.digest;
coverAsset.sourceRef = `content://sha256/${storedCover.digest.slice("sha256:".length)}`;

parsed(await runCli(cliPath, databasePath, { command: "init", project }), "init");
const accepted = parsed(
  await runCli(cliPath, databasePath, {
    command: "invoke",
    envelope: envelope("studio.project.render", {
      render: {
        cover_asset_id: coverAsset.id,
        preset_id: "render-social-portrait",
        output_name: "durable-real-proof.mp4",
      },
    }),
  }),
  "queue render",
);
if (accepted.status !== "accepted_job" || accepted.job?.status !== "queued") {
  throw new Error(`Render was not durably accepted: ${JSON.stringify(accepted)}`);
}

const worked = parsed(
  await runCli(cliPath, databasePath, { command: "work" }),
  "render worker",
);
if (worked.status !== "worked" || worked.job?.status !== "completed") {
  throw new Error(`Render worker did not complete: ${JSON.stringify(worked)}`);
}
const jobId = accepted.job.job_id as string;
const read = parsed(
  await runCli(cliPath, databasePath, {
    command: "invoke",
    envelope: envelope("studio.job.get", { job_id: jobId }),
  }),
  "job get",
);
if (read.job?.status !== "completed") throw new Error("Completed job was not readable.");

const artifactId = read.job.outputs[0].split("/").at(-1);
if (!artifactId) throw new Error("Completed job returned no artifact reference.");
const repository = new SqliteStudioRepository(databasePath);
const artifact = repository.getArtifact(artifactId);
const events = repository.listJobEvents(jobId);
repository.close();
if (!artifact || !artifact.digest.startsWith("sha256:")) {
  throw new Error("Verified artifact metadata is missing.");
}

const cancelAccepted = parsed(
  await runCli(cliPath, databasePath, {
    command: "invoke",
    envelope: envelope("studio.project.render", {
      render: {
        cover_asset_id: coverAsset.id,
        preset_id: "render-social-portrait",
        output_name: "cancel-before-work.mp4",
      },
    }),
  }),
  "queue cancellation fixture",
);
const cancelled = parsed(
  await runCli(cliPath, databasePath, {
    command: "invoke",
    envelope: envelope("studio.job.cancel", { job_id: cancelAccepted.job.job_id }),
  }),
  "cancel job",
);
if (cancelled.job?.status !== "cancelled") throw new Error("Queued job did not cancel.");

process.stdout.write(
  `${JSON.stringify(
    {
      runRoot,
      queue: { status: accepted.status, jobId },
      worker: { status: worked.job.status, attempt: worked.job.attempt },
      jobRead: { status: read.job.status, progress: read.job.progress },
      artifact,
      eventStatuses: events.map((event: { status: string }) => event.status),
      cancellation: { jobId: cancelAccepted.job.job_id, status: cancelled.job.status },
    },
    null,
    2,
  )}\n`,
);
