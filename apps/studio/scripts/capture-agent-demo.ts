/**
 * Records the agent-and-human demo as an animated GIF.
 *
 * This is the artifact that shows the product's central claim actually
 * happening: an agent edits the project over MCP while a person watches the
 * same editor, and every change lands in one history with the actor that made
 * it. No screen recorder, no manual editing — the app is driven and captured
 * programmatically so the result can be regenerated whenever the UI changes.
 *
 *   npm run docs:demo
 *
 * Requires ffmpeg on PATH for GIF encoding.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium, type Page } from "playwright-core";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { MemoryStudioJobGateway, STUDIO_SCHEMA_VERSION, StudioKernel } from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import { StudioSdk } from "@toolshape/studio-sdk";
import { SessionRegistry, StudioMcpServer, serveHttp } from "@toolshape/studio-mcp";

const EDITOR_TOKEN = "demo-editor-token-0123456789abcdef0123456";
const AGENT_TOKEN = "demo-agent-token-0123456789abcdef01234567";
const MCP_PORT = 7795;
const UI_PORT = 5201;
const ENDPOINT = `http://127.0.0.1:${MCP_PORT}/`;
const VIEWPORT = { width: 1440, height: 900 };
const OUTPUT_DIR = path.resolve(import.meta.dirname, "../../../docs/assets/ui");

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
      // next
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
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/** Applies an operation exactly as an external harness would: over the wire. */
async function agentEdit(projectId: string, revision: number, content: string): Promise<void> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${AGENT_TOKEN}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "studio_project_apply_operations",
        arguments: {
          project_id: projectId,
          expected_revision: revision,
          operations: [
            {
              operationId: globalThis.crypto.randomUUID(),
              type: "scene.node.update-text",
              actor: "agent",
              expectedRevision: revision,
              payload: { sceneId: "scene-hero", nodeId: "node-title", content },
            },
          ],
        },
      },
    }),
  });
  const body = (await response.json()) as { result?: { isError?: boolean; content?: Array<{ text: string }> } };
  if (body.result?.isError) {
    throw new Error(`Agent edit rejected: ${body.result.content?.[0]?.text ?? "unknown"}`);
  }
}

/**
 * Terminates a spawned dev server and its children.
 *
 * With `shell: true` on Windows, `kill()` ends the shell and leaves the real
 * process listening — so the next run connects to a server holding the
 * previous configuration. Killing the tree avoids that.
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
  await mkdir(OUTPUT_DIR, { recursive: true });
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-demo-"));

  const repository = new SqliteStudioRepository(path.join(root, "studio.sqlite"));
  const project = createGoldenStudioProject();
  repository.createProject(project);

  const server = new StudioMcpServer({
    invoker: new StudioSdk(new StudioKernel(repository, new MemoryStudioJobGateway())),
    schemaVersion: STUDIO_SCHEMA_VERSION,
  });
  // The editor authenticates as a person; the simulated harness as an agent.
  // That is what makes the activity history's attribution truthful.
  const sessions = new SessionRegistry([
    {
      principalId: "operator",
      agentId: "operator",
      harnessId: "studio-ui",
      actorType: "human",
      grantIds: ["studio.*"],
      token: EDITOR_TOKEN,
    },
    {
      principalId: "operator",
      agentId: "hermes",
      harnessId: "hermes",
      actorType: "agent",
      grantIds: ["studio.*"],
      token: AGENT_TOKEN,
    },
  ]);
  const listener = await serveHttp({
    server,
    sessions,
    port: MCP_PORT,
    host: "127.0.0.1",
    allowedOrigins: [`http://127.0.0.1:${UI_PORT}`],
  });

  let vite: ChildProcess | undefined;
  const browser = await chromium.launch({ executablePath: await findBrowser(), headless: true });
  const videoDir = path.join(root, "video");

  try {
    vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(UI_PORT), "--strictPort"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      stdio: "ignore",
      shell: process.platform === "win32",
      env: { ...process.env, VITE_STUDIO_ENDPOINT: ENDPOINT, VITE_STUDIO_TOKEN: EDITOR_TOKEN },
    });
    await waitForHttp(`http://127.0.0.1:${UI_PORT}/`);

    // Playwright records continuously at a real framerate. Screenshot polling
    // drops frames whenever a capture takes longer than the interval, which
    // makes the result stutter exactly when the UI is busiest — the moments
    // this demo exists to show.
    const context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: { dir: videoDir, size: VIEWPORT },
    });
    const page: Page = await context.newPage();
    await page.goto(`http://127.0.0.1:${UI_PORT}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(document.documentElement.dataset.studioReadyMs));
    await page.waitForFunction(
      () => document.querySelector("[data-connection]")?.getAttribute("data-connection") === "connected",
      undefined,
      { timeout: 20_000 },
    );

    // Review, so the canvas and the activity history are both on screen: the
    // change and the record of who made it, in one frame.
    await page.locator(".workspace-tabs").getByRole("tab", { name: "Review", exact: true }).click();
    await page.waitForTimeout(400);
    const dismiss = page.getByRole("button", { name: "Dismiss notice" });
    if (await dismiss.isVisible().catch(() => false)) await dismiss.click();

    const beat = (ms: number) => page.waitForTimeout(ms);

    await beat(1200);

    // The agent rewrites the headline twice. Each lands on the canvas and in
    // the history without anyone touching the editor.
    await agentEdit(project.id, 0, "Agents can edit this.");
    await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r1", undefined, {
      timeout: 15_000,
    });
    await beat(1400);

    await agentEdit(project.id, 1, "You are watching it happen.");
    await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r2", undefined, {
      timeout: 15_000,
    });
    await beat(1600);

    // Then a human edit, so both actors appear in one history.
    await page.locator(".right-rail").getByRole("tab", { name: "Inspector", exact: true }).click();
    await beat(500);
    await page.getByRole("button", { name: "Nudge +24", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r3", undefined, {
      timeout: 15_000,
    });
    await beat(600);
    const dismissAgain = page.getByRole("button", { name: "Dismiss notice" });
    if (await dismissAgain.isVisible().catch(() => false)) await dismissAgain.click();

    await page.locator(".right-rail").getByRole("tab", { name: "Activity", exact: true }).click();
    await beat(1800);

    // Finally, revert one agent edit while everything after it survives.
    const revertButtons = page.locator(".activity-entry__revert:not([disabled])");
    const count = await revertButtons.count();
    if (count > 1) {
      await revertButtons.nth(1).click();
      await beat(2000);
      const notice = page.getByRole("button", { name: "Dismiss notice" });
      if (await notice.isVisible().catch(() => false)) await notice.click();
      await beat(1200);
    }

    await beat(800);

    // Closing the context flushes the recording to disk.
    const video = page.video();
    await context.close();
    const source = await video?.path();
    if (!source) throw new Error("Playwright produced no video.");

    // Encode. A generated palette keeps the dark interface from banding, and
    // 12 fps is ample for UI motion while keeping the file README-sized.
    const output = path.join(OUTPUT_DIR, "demo-agent-live.gif");
    const encode = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-i", source,
        "-vf",
        "fps=10,scale=880:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff:max_colors=64[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
        "-loop", "0",
        output,
      ],
      { encoding: "utf8" },
    );
    if (encode.status !== 0) throw new Error(`ffmpeg failed: ${encode.stderr?.slice(-600) ?? "unknown"}`);

    process.stdout.write(`${JSON.stringify({ status: "completed", output })}\n`);
  } finally {
    await browser.close();
    killTree(vite);
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    repository.close();
    // Windows can still hold the recording briefly after the context closes.
    // A failed temp cleanup must not mask the real error from the try block.
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ status: "failed", error: String(error) })}\n`);
  process.exitCode = 1;
});
