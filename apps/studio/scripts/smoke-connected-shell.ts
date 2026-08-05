/**
 * End-to-end proof for the connected shell (Milestone 8).
 *
 * Asserts the thing the product claims and could not previously demonstrate:
 * a human editing in the browser and an agent calling over MCP are working on
 * one project, one store, one revision sequence.
 *
 * Specifically:
 *   1. the editor reports itself connected, not local;
 *   2. an edit made in the UI survives a full page reload;
 *   3. an edit applied by an agent over MCP appears in the UI without a manual
 *      refresh, attributed to the agent;
 *   4. a UI write against a revision the agent has moved past is refused and
 *      surfaced rather than silently overwriting the agent's work.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { chromium, type Page } from "playwright-core";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { MemoryStudioJobGateway, STUDIO_SCHEMA_VERSION, StudioKernel } from "@toolshape/studio-kernel";
import { SqliteStudioRepository } from "@toolshape/studio-persistence";
import { StudioSdk } from "@toolshape/studio-sdk";
import { SessionRegistry, StudioMcpServer, serveHttp } from "@toolshape/studio-mcp";

const TOKEN = "connected-shell-smoke-token-0123456789abcdef";
const MCP_PORT = 7793;
const UI_PORT = 5199;
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
      // next
    }
  }
  throw new Error("No supported local Chromium executable was found.");
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

/** Applies an operation the way an external agent would: over the wire. */
async function agentApply(projectId: string, revision: number, content: string): Promise<void> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 900,
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
  assert(!body.result?.isError, `agent edit was rejected: ${body.result?.content?.[0]?.text ?? "unknown"}`);
}

async function revisionInUi(page: Page): Promise<number> {
  const text = await page.locator(".project-crumb i").textContent();
  return Number((text ?? "r-1").replace("r", ""));
}

async function main(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-connected-"));
  const repository = new SqliteStudioRepository(path.join(root, "studio.sqlite"));
  const project = createGoldenStudioProject();
  repository.createProject(project);

  const server = new StudioMcpServer({
    invoker: new StudioSdk(new StudioKernel(repository, new MemoryStudioJobGateway())),
    schemaVersion: STUDIO_SCHEMA_VERSION,
  });
  const sessions = new SessionRegistry([
    { principalId: "smoke", agentId: "smoke-agent", harnessId: "smoke", grantIds: ["studio.*"], token: TOKEN },
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

  try {
    vite = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(UI_PORT), "--strictPort"], {
      cwd: path.resolve(import.meta.dirname, ".."),
      stdio: "ignore",
      shell: process.platform === "win32",
      env: { ...process.env, VITE_STUDIO_ENDPOINT: ENDPOINT, VITE_STUDIO_TOKEN: TOKEN },
    });
    await waitForHttp(`http://127.0.0.1:${UI_PORT}/`);

    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on("pageerror", (e) => process.stderr.write(`PAGEERROR: ${e.message}
`));
    await page.goto(`http://127.0.0.1:${UI_PORT}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(document.documentElement.dataset.studioReadyMs));

    // 1. The editor is talking to the host, not running its own kernel.
    await page.waitForFunction(
      () => document.querySelector("[data-connection]")?.getAttribute("data-connection") === "connected",
      undefined,
      { timeout: 15_000 },
    );

    assert((await revisionInUi(page)) === 0, "editor should open at revision 0");

    // 2. A UI edit persists across a reload, because it went to the host.
    await page.locator(".workspace-tabs").getByRole("tab", { name: "Create", exact: true }).click();
    await page.getByRole("button", { name: "Nudge +24", exact: true }).click();
    await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r1", undefined, {
      timeout: 15_000,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(document.documentElement.dataset.studioReadyMs));
    await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r1", undefined, {
      timeout: 15_000,
    });
    assert((await revisionInUi(page)) === 1, "UI edit must survive a reload");

    // 3. An agent edit appears without a manual refresh.
    await agentApply(project.id, 1, "Written by an agent.");
    await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r2", undefined, {
      timeout: 20_000,
    });

    await page.locator(".workspace-tabs").getByRole("tab", { name: "Review", exact: true }).click();
    await page.waitForSelector(".activity-entry--agent", { timeout: 15_000 });
    const agentEntries = await page.locator(".activity-entry--agent").count();
    assert(agentEntries >= 1, "the agent edit must be attributed to an agent in the activity history");

    // 4. A stale UI write is refused, not applied over the agent's work.
    //    The editor is at r2; the agent moves to r3 behind its back, and the
    //    editor's next write must be refused rather than clobbering it.
    await page.evaluate(() => {
      // Freeze polling so the editor genuinely holds a stale revision.
      for (let id = 1; id < 10_000; id += 1) window.clearInterval(id);
    });
    await agentApply(project.id, 2, "Agent moved ahead again.");

    await page.locator(".workspace-tabs").getByRole("tab", { name: "Create", exact: true }).click();
    await page.getByRole("button", { name: "Nudge +24", exact: true }).click();
    await page.waitForSelector(".stale-banner", { timeout: 15_000 });

    const finalRevision = repository.getProject(project.id)?.revision ?? -1;
    assert(finalRevision === 3, `agent work must survive; expected revision 3, found ${finalRevision}`);

    process.stdout.write(
      `${JSON.stringify({
        status: "completed",
        checks: 4,
        connection: "connected",
        final_revision: finalRevision,
        agent_entries: agentEntries,
      })}\n`,
    );
  } finally {
    await browser.close();
    vite?.kill();
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    repository.close();
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ status: "failed", error: String(error) })}\n`);
  process.exitCode = 1;
});
