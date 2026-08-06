/**
 * Proves a person can export by pressing a button.
 *
 * Toolshape is agent-first, which is a statement about where the operations
 * live — not a reason to make someone open a terminal to get a PNG out. The
 * agent path is already proved by smoke:agent-export; this drives the real UI
 * in a real browser and then looks on disk, because a button that queues a job
 * nothing ever runs is exactly as useless as no button, and looks better.
 *
 * It also proves the export is recorded as a human's. Attribution that quietly
 * says "agent" for everything is worse than none, since it is believed.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { STUDIO_SCHEMA_VERSION, StudioKernel } from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import { DurableRenderJobService, startJobWorker } from "@toolshape/studio-render";
import { StudioSdk } from "@toolshape/studio-sdk";
import { SessionRegistry, StudioMcpServer, serveHttp } from "@toolshape/studio-mcp";

const TOKEN = "human-export-smoke-token-0123456789abcdef";
const MCP_PORT = 7795;
const UI_PORT = 5201;
const ENDPOINT = `http://127.0.0.1:${MCP_PORT}/`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAILED: ${message}`);
}

async function findBrowser(): Promise<string> {
  for (const candidate of [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ]) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error("No supported local Chromium executable was found.");
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/**
 * With `shell: true` on Windows, kill() ends the shell and leaves the real
 * process listening, so the next run connects to a stale server.
 */
function killTree(child: ChildProcess | undefined): void {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

async function main(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-human-export-"));
  const contentRoot = path.join(root, "objects");
  const artifactRoot = path.join(root, "artifacts");
  const repository = new SqliteStudioRepository(path.join(root, "studio.sqlite"));
  const project = createGoldenStudioProject();

  // The design has an image layer and the renderer refuses an export whose
  // bytes it cannot read, so they go into the content store as an import would
  // have put them there.
  const pngPath = path.join(root, "source.png");
  const made = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=teal:size=64x64", "-frames:v", "1", pngPath],
    { encoding: "utf8" },
  );
  assert(made.status === 0, `could not build a source image: ${made.stderr}`);
  const imageBytes = await readFile(pngPath);
  const digest = createHash("sha256").update(imageBytes).digest("hex");
  await mkdir(path.join(contentRoot, digest.slice(0, 2)), { recursive: true });
  await writeFile(path.join(contentRoot, digest.slice(0, 2), digest), imageBytes);
  for (const asset of project.assets) {
    if (asset.kind !== "image") continue;
    asset.contentHash = `sha256:${digest}`;
    asset.sourceRef = `content://sha256/${digest}`;
    asset.mediaType = "image/png";
  }
  repository.createProject(project);

  const jobs = new DurableRenderJobService(repository, { contentRoot, artifactRoot });
  const server = new StudioMcpServer({
    invoker: new StudioSdk(new StudioKernel(repository, jobs)),
    schemaVersion: STUDIO_SCHEMA_VERSION,
  });
  // The editor's credential says human. The caller cannot assert its own
  // identity, so this is what makes the export show up as a person's.
  const sessions = new SessionRegistry([
    {
      principalId: "local-operator",
      agentId: "local-operator",
      harnessId: "studio-ui",
      actorType: "human",
      grantIds: ["studio.*"],
      token: TOKEN,
    },
  ]);
  const listener = await serveHttp({
    server,
    sessions,
    port: MCP_PORT,
    host: "127.0.0.1",
    allowedOrigins: [`http://127.0.0.1:${UI_PORT}`],
  });
  const worker = startJobWorker(jobs, {
    onError: (error) => process.stderr.write(`job worker error: ${String(error)}\n`),
  });

  let vite: ChildProcess | undefined;
  const browser = await chromium.launch({ executablePath: await findBrowser(), headless: true });
  const checks: string[] = [];

  try {
    vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(UI_PORT), "--strictPort"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      stdio: "ignore",
      shell: process.platform === "win32",
      env: { ...process.env, VITE_STUDIO_ENDPOINT: ENDPOINT, VITE_STUDIO_TOKEN: TOKEN },
    });
    await waitForHttp(`http://127.0.0.1:${UI_PORT}/`);

    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on("pageerror", (error) => process.stderr.write(`PAGEERROR: ${error.message}\n`));
    await page.goto(`http://127.0.0.1:${UI_PORT}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(document.documentElement.dataset.studioReadyMs));
    await page.waitForFunction(
      () => document.querySelector("[data-connection]")?.getAttribute("data-connection") === "connected",
      undefined,
      { timeout: 20_000 },
    );

    // 1. The control is there, in the top bar, without opening a menu. An
    //    export buried three levels deep is technically present and
    //    practically absent.
    const exportButton = page.getByRole("button", { name: "Export", exact: true });
    await exportButton.waitFor({ state: "visible", timeout: 15_000 });
    checks.push("export-control-is-visible");

    // 2. It opens, and offers the formats the capability accepts. A picker
    //    listing something the host would refuse is a promise the product
    //    cannot keep.
    await exportButton.click();
    const panel = page.getByRole("dialog", { name: "Export designs" });
    await panel.waitFor({ state: "visible", timeout: 10_000 });
    for (const format of ["PNG", "JPEG", "WEBP", "SVG", "PDF"]) {
      assert(
        (await panel.getByRole("button", { name: format, exact: true }).count()) === 1,
        `the export panel should offer ${format}`,
      );
    }
    checks.push("every-format-is-offered");

    // 3. Press it. PNG at 2x, which is what someone wanting a usable asset
    //    would actually pick.
    await panel.getByRole("button", { name: "PNG", exact: true }).click();
    await panel.getByRole("button", { name: "2×", exact: true }).click();
    await panel.getByRole("button", { name: /^Export design$/ }).click();
    checks.push("export-can-be-pressed");

    // 4. A file appears on disk. This is the whole point: the button has to do
    //    the thing, not report having asked for it.
    const deadline = Date.now() + 90_000;
    let files: string[] = [];
    let directory = "";
    while (Date.now() < deadline) {
      try {
        const batches = await readdir(artifactRoot);
        for (const batch of batches) {
          const candidate = path.join(artifactRoot, batch);
          const contents = await readdir(candidate).catch(() => [] as string[]);
          const finished = contents.filter((file) => file.endsWith(".png") && !file.includes(".partial"));
          if (finished.length > 0) {
            files = finished;
            directory = candidate;
          }
        }
      } catch {
        // The directory does not exist until the worker creates it.
      }
      if (files.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert(files.length > 0, "pressing Export produced no file on disk");
    checks.push("pressing-export-writes-a-file");

    // 5. The file decodes and carries the 2x the person chose, rather than
    //    being an empty placeholder with the right name.
    const exported = path.join(directory, files[0]);
    const probe = spawnSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", exported],
      { encoding: "utf8" },
    );
    assert(probe.status === 0, `the exported file did not decode: ${probe.stderr?.slice(-300)}`);
    const [width, height] = probe.stdout.trim().split(",").map(Number);
    const scene = project.scenes.find((candidate) => candidate.id === project.activeSceneId)!;
    assert(
      width === scene.size.width * 2 && height === scene.size.height * 2,
      `expected ${scene.size.width * 2}x${scene.size.height * 2} at 2x, got ${width}x${height}`,
    );
    checks.push("chosen-scale-is-honoured");

    // 6. The editor says so, rather than leaving the person guessing whether
    //    anything happened.
    await page.waitForSelector(".notice", { timeout: 15_000 });
    const noticeText = (await page.locator(".notice span").textContent()) ?? "";
    assert(
      noticeText.includes("Export queued"),
      `the editor should confirm the export, it said ${JSON.stringify(noticeText)}`,
    );
    checks.push("editor-confirms-the-export");

    // 7. The file is the design, not a blank frame at the right size. Checks 4
    //    and 5 are both satisfied by an empty canvas.
    //
    //    Sampled at the centre, because the golden scene's background is dark
    //    and its content is not — a frame that rendered nothing would come back
    //    uniformly at the background colour.
    const sample = spawnSync(
      "ffmpeg",
      [
        "-hide_banner", "-loglevel", "error",
        "-i", exported,
        "-vf", `crop=${Math.round(width / 2)}:${Math.round(height / 2)}:${Math.round(width / 4)}:${Math.round(height / 4)},scale=1:1`,
        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
      ],
      { encoding: "buffer", maxBuffer: 1024 * 1024 },
    );
    assert(sample.status === 0 && sample.stdout.length >= 3, "could not sample the exported design");
    const [red, green, blue] = [sample.stdout[0], sample.stdout[1], sample.stdout[2]];
    const background = scene.background;
    const backgroundRed = Number.parseInt(background.slice(1, 3), 16);
    const backgroundGreen = Number.parseInt(background.slice(3, 5), 16);
    const backgroundBlue = Number.parseInt(background.slice(5, 7), 16);
    assert(
      Math.abs(red - backgroundRed) + Math.abs(green - backgroundGreen) + Math.abs(blue - backgroundBlue) > 24,
      `the export looks like an empty canvas: sampled rgb(${red},${green},${blue}) against background ${background}`,
    );
    checks.push("exported-file-contains-the-design");

    process.stdout.write(`${JSON.stringify({ status: "completed", checks: checks.length, verified: checks })}\n`);
  } catch (error) {
    // Reported with the checks that did pass, so a failure names the step it
    // stopped at instead of just a timeout.
    process.stderr.write(`${JSON.stringify({ status: "failed", passed: checks })}
`);
    throw error;
  } finally {
    await browser.close().catch(() => {});
    killTree(vite);
    await worker.stop().catch(() => {});
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    repository.close();
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ status: "failed", error: String(error) })}\n`);
  process.exitCode = 1;
});
