/**
 * Proves a networked agent can export a design and get real files.
 *
 * The export renderer only mattered if an agent could reach it, and the unit
 * tests stop at the adapter boundary. This drives the whole path the way a
 * server-resident harness would — HTTP, a bearer token, no in-process access —
 * and then decodes what landed on disk. A job that reports "completed" while
 * having produced an unreadable file is exactly the failure this is here to
 * catch.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { STUDIO_SCHEMA_VERSION, StudioKernel } from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import { DurableRenderJobService } from "@toolshape/studio-render";
import { StudioSdk } from "@toolshape/studio-sdk";
import { SessionRegistry, StudioMcpServer, serveHttp } from "@toolshape/studio-mcp";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";

const TOKEN = "agent-export-smoke-token-long-enough-1234567890";
const PORT = 7793;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAILED: ${message}`);
}

let nextId = 1;
async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`http://127.0.0.1:${PORT}/`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method: "tools/call", params: { name, arguments: args } }),
  });
  const body = (await response.json()) as { result?: { content?: Array<{ text: string }> } };
  const text = body.result?.content?.[0]?.text;
  assert(text, `${name} returned no content`);
  return JSON.parse(text) as Record<string, unknown>;
}

function jobFrom(payload: Record<string, unknown>): { job_id: string; status: string; outputs: unknown[] } {
  const verification = payload.verification as { evidence?: Array<{ type?: string; job?: Record<string, unknown> }> };
  const evidence = verification?.evidence?.find((item) => item.type === "durable_job");
  assert(evidence?.job, "result carried no durable job document");
  return evidence.job as unknown as { job_id: string; status: string; outputs: unknown[] };
}

async function main(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-agent-export-"));
  const repository = new SqliteStudioRepository(path.join(root, "studio.sqlite"));
  const project = createGoldenStudioProject();

  // The design has an image layer, and the renderer refuses an export whose
  // asset bytes it cannot read — an export with a hole in it looks finished and
  // gets sent. So the bytes go into the content store first, exactly as an
  // import would have put them there.
  const contentRoot = path.join(root, "objects");
  const pngPath = path.join(root, "source.png");
  const make = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=teal:size=64x64", "-frames:v", "1", pngPath],
    { encoding: "utf8" },
  );
  assert(make.status === 0, `could not build a source image: ${make.stderr}`);
  const bytes = await readFile(pngPath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  await mkdir(path.join(contentRoot, digest.slice(0, 2)), { recursive: true });
  await writeFile(path.join(contentRoot, digest.slice(0, 2), digest), bytes);
  for (const asset of project.assets) {
    if (asset.kind !== "image") continue;
    asset.contentHash = `sha256:${digest}`;
    asset.sourceRef = `content://sha256/${digest}`;
    asset.mediaType = "image/png";
  }

  repository.createProject(project);

  const jobs = new DurableRenderJobService(repository, {
    contentRoot,
    artifactRoot: path.join(root, "artifacts"),
  });
  const server = new StudioMcpServer({
    invoker: new StudioSdk(new StudioKernel(repository, jobs)),
    schemaVersion: STUDIO_SCHEMA_VERSION,
  });
  const sessions = new SessionRegistry([
    { principalId: "smoke-operator", agentId: "export-agent", harnessId: "smoke", grantIds: ["studio.*"], token: TOKEN },
  ]);
  const listener = await serveHttp({ server, sessions, port: PORT });
  const checks: string[] = [];

  try {
    // 1. The agent discovers the scene it is about to export, rather than being
    //    told its id out of band.
    const inspect = await callTool("studio_project_inspect", { project_id: project.id });
    const scenes = ((inspect.state as { project?: { scenes?: Array<{ id: string }> } }).project?.scenes ?? []);
    assert(scenes.length > 0, "inspect returned no scenes for the agent to export");
    const sceneId = scenes[0].id;
    checks.push("scene-discovered-over-mcp");

    // 2. Reframe the scene into a second platform size, so the export has a
    //    genuine batch to produce rather than one file called a batch.
    const square = await callTool("studio_project_apply_operations", {
      project_id: project.id,
      expected_revision: (inspect.state as { revision_after: number }).revision_after,
      operations: [
        {
          operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          type: "design.variant.create",
          actor: "agent",
          expectedRevision: (inspect.state as { revision_after: number }).revision_after,
          payload: { sceneId, formatId: "square", formatName: "Square", width: 1080, height: 1080 },
        },
      ],
    });
    const revision = (square.state as { revision_after: number }).revision_after;
    checks.push("variant-created-over-mcp");

    // 3. Queue the export. It comes back as a job reference, not bytes: nine
    //    files inlined into a tool result would be megabytes of an agent's
    //    context spent on something it can fetch when it needs it.
    const queued = await callTool("studio_design_export", {
      project_id: project.id,
      expected_revision: revision,
      scene_ids: [sceneId, `${sceneId}--square`],
      format: "png",
      scale: 1,
      output_name: "launch",
    });
    assert(queued.status === "accepted_job", `export should be accepted as a job, got ${String(queued.status)}`);
    const queuedJob = jobFrom(queued);
    checks.push("export-accepted-as-job");

    // 4. The worker runs it and the job reports completion with one output per
    //    scene.
    const finished = await jobs.runNext();
    assert(finished?.status === "completed", `export job failed: ${finished?.progress.message ?? "unknown"}`);
    assert(finished.outputs.length === 2, `expected two artifacts, got ${finished.outputs.length}`);
    checks.push("worker-completed-batch");

    // 5. The agent learns that from polling, not from being inside the process.
    const polled = jobFrom(await callTool("studio_job_get", { project_id: project.id, job_id: queuedJob.job_id }));
    assert(polled.status === "completed", `polled status should be completed, got ${polled.status}`);
    checks.push("status-visible-over-mcp");

    // 6. The files exist and are real PNGs — decoded, not merely present. A
    //    zero-byte file with the right name would satisfy a weaker check.
    const directory = path.join(root, "artifacts", "launch");
    const files = (await readdir(directory)).sort();
    assert(files.length === 2, `expected two files, found ${files.join(", ")}`);
    for (const file of files) {
      const full = path.join(directory, file);
      assert((await stat(full)).size > 0, `${file} is empty`);
      const probe = spawnSync(
        "ffprobe",
        ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", full],
        { encoding: "utf8" },
      );
      assert(probe.status === 0, `${file} did not decode: ${probe.stderr?.slice(-300)}`);
      assert(/^\d+,\d+$/.test(probe.stdout.trim()), `${file} reported no dimensions`);
    }
    checks.push("files-decode-as-images");

    // 7. The two variants really are different sizes. Exporting nine identical
    //    files would pass every check above.
    const dimensionsOf = (file: string) =>
      spawnSync(
        "ffprobe",
        [
          "-v", "error", "-select_streams", "v:0",
          "-show_entries", "stream=width,height", "-of", "csv=p=0",
          path.join(directory, file),
        ],
        { encoding: "utf8" },
      ).stdout.trim();
    const sizes = new Set(files.map(dimensionsOf));
    assert(sizes.size === 2, `variants should differ in size, found ${[...sizes].join(" and ")}`);
    checks.push("variants-differ-in-size");

    process.stdout.write(`${JSON.stringify({ status: "completed", checks: checks.length, verified: checks })}\n`);
  } finally {
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    repository.close();
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ status: "failed", error: String(error) })}\n`);
  process.exitCode = 1;
});
