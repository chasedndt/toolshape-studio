/**
 * Captures real screenshots of every workspace and panel for the documentation.
 *
 * Regenerable on purpose: docs images drift from the product faster than any
 * other artifact, so they are produced by driving the actual app rather than
 * pasted in by hand. Re-run after any shell change.
 *
 *   npm run dev                      (in one terminal)
 *   STUDIO_URL=http://127.0.0.1:5173/ npm run docs:screenshots
 */
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium, type Page } from "playwright-core";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

let executablePath: string | undefined;
for (const candidate of chromeCandidates) {
  try {
    await access(candidate);
    executablePath = candidate;
    break;
  } catch {
    // Try the next installed browser.
  }
}
if (!executablePath) throw new Error("No supported local Chromium executable was found.");

const baseUrl = process.env.STUDIO_URL ?? "http://127.0.0.1:4173/";
const outputDir = path.resolve(import.meta.dirname, "../../../docs/assets/ui");
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const captured: string[] = [];

async function settle(page: Page): Promise<void> {
  // Wait for every preview derivative to actually decode, so no screenshot
  // records a half-loaded image.
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>("[data-preview-kind]")).every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
  await page.waitForTimeout(220);
}

async function dismissNotice(page: Page): Promise<void> {
  // Workspace and panel switches raise a transient status toast. It is real UI,
  // but it would sit over the bottom of every documentation frame.
  const dismiss = page.getByRole("button", { name: "Dismiss notice" });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await page.waitForTimeout(120);
  }
}

async function shoot(page: Page, name: string): Promise<void> {
  await dismissNotice(page);
  await settle(page);
  await page.screenshot({ path: path.join(outputDir, `${name}.png`) });
  captured.push(name);
}

async function openWorkspace(page: Page, label: string): Promise<void> {
  // Scoped to the workspace tablist: "Capture" also names a right-rail panel.
  await page.locator(".workspace-tabs").getByRole("tab", { name: label, exact: true }).click();
  await page.waitForTimeout(180);
}

async function selectLeftPanel(page: Page, label: string): Promise<void> {
  await page.locator(".left-rail").getByRole("tab", { name: label, exact: true }).click();
  await page.waitForTimeout(160);
}

async function selectRightPanel(page: Page, label: string): Promise<void> {
  await page.locator(".right-rail").getByRole("tab", { name: label, exact: true }).click();
  await page.waitForTimeout(160);
}

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`Studio returned HTTP ${String(response?.status())}.`);
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.studioReadyMs));

  // Dismiss any transient notice so it does not sit over the first frame.
  const dismiss = page.getByRole("button", { name: "Dismiss notice" });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();

  // --- Workspaces -----------------------------------------------------------
  await openWorkspace(page, "Home");
  await shoot(page, "workspace-home");

  await openWorkspace(page, "Capture");
  await shoot(page, "workspace-capture");

  await openWorkspace(page, "Create");
  await shoot(page, "workspace-create");

  await openWorkspace(page, "Edit");
  await shoot(page, "workspace-edit");

  await openWorkspace(page, "Review");
  await shoot(page, "workspace-review");

  await openWorkspace(page, "Automate");
  await shoot(page, "workspace-automate");

  // --- Left rail panels, captured inside Edit -------------------------------
  await openWorkspace(page, "Edit");
  for (const [label, slug] of [
    ["Media", "panel-media"],
    ["Layers", "panel-layers"],
    ["Text", "panel-text"],
    ["Audio", "panel-audio"],
    ["Captions", "panel-captions"],
  ] as const) {
    await selectLeftPanel(page, label);
    await shoot(page, slug);
  }

  // --- Right rail panels ----------------------------------------------------
  await selectLeftPanel(page, "Media");
  for (const [label, slug] of [
    ["Inspector", "panel-inspector"],
    ["Agent", "panel-agent"],
    ["Quality", "panel-quality"],
  ] as const) {
    await selectRightPanel(page, label);
    await shoot(page, slug);
  }

  // --- Capture-specific panels ---------------------------------------------
  await openWorkspace(page, "Capture");
  await selectLeftPanel(page, "Sources");
  await shoot(page, "panel-sources");
  await selectRightPanel(page, "Capture");
  await shoot(page, "panel-capture-settings");

  // --- Activity panel -------------------------------------------------------
  // Exercised with real edits rather than screenshotted empty, so the captured
  // proof shows genuine history entries and genuine revert affordances.
  await openWorkspace(page, "Edit");

  // Scrubs the playhead to a fraction of the timeline so a trim-at-playhead
  // stays valid between edits.
  async function scrubTo(fraction: number): Promise<void> {
    const lane = page.locator("[data-timeline-lane]").first();
    const box = await lane.boundingBox();
    if (!box) return;
    await page.mouse.click(box.x + box.width * fraction, box.y + box.height / 2);
    await page.waitForTimeout(150);
  }

  const clipToEdit = page.locator(".timeline-clip__select").first();
  if (await clipToEdit.isVisible().catch(() => false)) {
    await clipToEdit.click();
    await page.waitForTimeout(150);

    // Two trims on the same clip. The second makes the first non-revertible,
    // which is the state worth documenting: a blocked entry with its reason
    // beside a revertible one.
    for (const fraction of [0.62, 0.45]) {
      await scrubTo(fraction);
      const setOut = page.getByRole("button", { name: "Set out", exact: true });
      if (await setOut.isEnabled().catch(() => false)) {
        await setOut.click();
        await page.waitForTimeout(220);
      }
    }
  }

  // Two transform edits on the same node. The second makes the first
  // non-revertible, so the captured panel shows a blocked entry with its
  // reason beside entries that are still revertible — the state that actually
  // explains how selective revert behaves.
  await openWorkspace(page, "Create");
  const nudge = page.getByRole("button", { name: "Nudge +24", exact: true });
  for (let press = 0; press < 2; press += 1) {
    if (await nudge.isEnabled().catch(() => false)) {
      await nudge.click();
      await page.waitForTimeout(220);
      await dismissNotice(page);
    }
  }

  await openWorkspace(page, "Review");
  await selectRightPanel(page, "Activity");
  await shoot(page, "panel-activity");
  const activity = page.locator(".activity-section");
  if (await activity.isVisible().catch(() => false)) {
    await dismissNotice(page);
    await activity.screenshot({ path: path.join(outputDir, "detail-activity.png") });
    captured.push("detail-activity");
  }

  // --- Timeline detail ------------------------------------------------------
  await openWorkspace(page, "Edit");
  const timeline = page.locator(".timeline-panel");
  await timeline.screenshot({ path: path.join(outputDir, "detail-timeline.png") });
  captured.push("detail-timeline");

  // Selected clip with trim handles exposed.
  const clip = page.locator(".timeline-clip__select").first();
  if (await clip.isVisible().catch(() => false)) {
    await clip.click();
    await page.waitForTimeout(200);
    await timeline.screenshot({ path: path.join(outputDir, "detail-timeline-selected.png") });
    captured.push("detail-timeline-selected");
  }

  process.stdout.write(`${JSON.stringify({ status: "completed", count: captured.length, captured, outputDir })}\n`);
} finally {
  await browser.close();
}
