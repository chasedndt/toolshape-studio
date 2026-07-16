import { createHash } from "node:crypto";
import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
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
if (!executablePath) {
  throw new Error("No supported local Chromium executable was found.");
}

const baseUrl = process.env.STUDIO_URL ?? "http://127.0.0.1:4173/";
const artifactDir = path.resolve(import.meta.dirname, "../artifacts");
await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
  if (!response?.ok()) {
    throw new Error(`Studio returned HTTP ${String(response?.status())}.`);
  }
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.studioReadyMs));

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return {
      studioReadyMs: Number(document.documentElement.dataset.studioReadyMs),
      domContentLoadedMs: Number(navigation.domContentLoadedEventEnd.toFixed(1)),
      loadEventMs: Number(navigation.loadEventEnd.toFixed(1)),
      domNodes: document.querySelectorAll("*").length,
    };
  });

  const initialRevision = await page.locator(".project-crumb i").textContent();
  const initialWorkspace = await page.locator(".studio-shell").getAttribute("data-workspace");
  if (initialRevision !== "r0" || initialWorkspace !== "edit") {
    throw new Error(`Unexpected initial shell: revision=${String(initialRevision)} workspace=${String(initialWorkspace)}`);
  }

  await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('[data-preview-kind]')).every((image) => image.complete && image.naturalWidth > 0));
  const previewEvidence = await page.evaluate(() => ({
    mediaThumbnailCount: document.querySelectorAll('#active-source-panel [data-preview-kind="thumbnail"]').length,
    timelineThumbnailCount: document.querySelectorAll('.timeline-panel [data-preview-kind="thumbnail"]').length,
    timelineWaveformCount: document.querySelectorAll('.timeline-panel [data-preview-kind="waveform"]').length,
    unresolvedMediaCards: document.querySelectorAll('.asset-card[data-preview-ready="true"] img:not([src])').length,
  }));
  if (
    previewEvidence.mediaThumbnailCount !== 1 ||
    previewEvidence.timelineThumbnailCount !== 1 ||
    previewEvidence.timelineWaveformCount !== 1 ||
    previewEvidence.unresolvedMediaCards !== 0
  ) {
    throw new Error(`Initial preview evidence mismatch: ${JSON.stringify(previewEvidence)}`);
  }
  const mediaPreviewScreenshot = path.join(artifactDir, "studio-preview-derivatives-media.png");
  await page.screenshot({ path: mediaPreviewScreenshot, fullPage: false });

  await page.getByRole("tab", { name: "Audio", exact: true }).click();
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>('#active-source-panel [data-preview-kind="waveform"]');
    return Boolean(image?.complete && image.naturalWidth > 0);
  });
  const audioPreviewEvidence = await page.evaluate(() => ({
    panel: document.querySelector("#active-source-panel")?.getAttribute("data-panel-id"),
    waveformReady: document.querySelector(".audio-source-card")?.getAttribute("data-waveform-ready"),
    waveformNaturalWidth: document.querySelector<HTMLImageElement>('#active-source-panel [data-preview-kind="waveform"]')?.naturalWidth ?? 0,
  }));
  if (audioPreviewEvidence.panel !== "audio" || audioPreviewEvidence.waveformReady !== "true" || audioPreviewEvidence.waveformNaturalWidth !== 1280) {
    throw new Error(`Audio preview evidence mismatch: ${JSON.stringify(audioPreviewEvidence)}`);
  }
  const audioPreviewScreenshot = path.join(artifactDir, "studio-preview-derivatives-audio.png");
  await page.screenshot({ path: audioPreviewScreenshot, fullPage: false });

  await page.getByRole("tab", { name: "Review", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".studio-shell")?.getAttribute("data-workspace") === "review");
  if (await page.locator(".project-crumb i").textContent() !== "r0") {
    throw new Error("Workspace switching advanced the canonical project revision.");
  }
  if (await page.locator("#active-context-panel").getAttribute("data-panel-id") !== "agent") {
    throw new Error("Review workspace did not open the agent context.");
  }

  await page.getByRole("menuitem", { name: "View" }).click();
  if (!(await page.getByRole("menu", { name: "View menu" }).isVisible())) {
    throw new Error("View menu did not open.");
  }
  await page.keyboard.press("Escape");
  if (await page.getByRole("menu", { name: "View menu" }).isVisible().catch(() => false)) {
    throw new Error("Escape did not close the View menu.");
  }

  await page.getByRole("menuitem", { name: "View" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Timeline" }).click();
  if (await page.locator(".timeline-panel").count() !== 0) {
    throw new Error("View menu did not hide the timeline.");
  }
  await page.getByRole("button", { name: "Show timeline" }).click();
  if (await page.locator(".timeline-panel").count() !== 1) {
    throw new Error("Quick panel control did not restore the timeline.");
  }

  await page.getByRole("tab", { name: "Edit", exact: true }).click();
  await page.getByRole("tab", { name: "Text", exact: true }).click();
  if (await page.locator("#active-source-panel").getAttribute("data-panel-id") !== "text") {
    throw new Error("Text source panel did not activate.");
  }
  await page.locator("#active-source-panel .source-row", { hasText: "Hero title" }).click();
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();

  await page.getByRole("button", { name: "Split at 4s" }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r1");
  await page.getByRole("button", { name: "Trim + ripple" }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r2");
  await page.getByRole("button", { name: "Nudge +24" }).click();
  await page.getByRole("tab", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Apply candidate" }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r4");
  await page.getByRole("button", { name: /Undo/ }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r5");
  await page.getByRole("button", { name: /Redo/ }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r6");
  await page.getByRole("button", { name: "Render proof" }).click();
  const renderNotice = await page.locator(".notice").textContent();
  if (!renderNotice?.includes("Render queued") || !renderNotice.includes("queued")) {
    throw new Error(`Render capability did not produce an accepted job notice: ${String(renderNotice)}`);
  }

  const videoClipCount = await page.locator(".track-lane--video .timeline-clip").count();
  await page.getByRole("tab", { name: "Quality", exact: true }).click();
  const qualityText = await page.locator(".quality-card strong").textContent();
  await page.getByRole("tab", { name: "Agent", exact: true }).click();
  const changedPathText = await page.locator(".diff-strip strong").textContent();
  if (videoClipCount !== 2 || qualityText !== "Canonical state valid") {
    throw new Error(
      `Post-edit state mismatch: clips=${videoClipCount} quality=${String(qualityText)}`,
    );
  }

  const shellEvidence = await page.evaluate(() => ({
    workspace: document.querySelector(".studio-shell")?.getAttribute("data-workspace"),
    sourcePanel: document.querySelector("#active-source-panel")?.getAttribute("data-panel-id"),
    contextPanel: document.querySelector("#active-context-panel")?.getAttribute("data-panel-id"),
    timelineVisible: Boolean(document.querySelector(".timeline-panel")),
    tabCount: document.querySelectorAll('[role="tab"]').length,
    viewportOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  if (shellEvidence.workspace !== "review" || shellEvidence.contextPanel !== "agent" || !shellEvidence.timelineVisible || shellEvidence.viewportOverflow) {
    throw new Error(`Editor shell evidence mismatch: ${JSON.stringify(shellEvidence)}`);
  }

  await page.waitForTimeout(250);
  await page.getByRole("menuitem", { name: "View" }).click();
  const menuScreenshot = path.join(artifactDir, "studio-editor-shell-view-menu.png");
  await page.waitForTimeout(100);
  await page.screenshot({ path: menuScreenshot, fullPage: false });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(artifactDir, "studio-editor-shell-post-edit.png"),
    fullPage: false,
  });

  const coverPage = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const coverResponse = await coverPage.goto(`${baseUrl}?export=cover`, { waitUntil: "networkidle" });
  if (!coverResponse?.ok()) throw new Error(`Cover view returned HTTP ${String(coverResponse?.status())}.`);
  const coverPath = path.join(artifactDir, "golden-cover.png");
  await coverPage.screenshot({ path: coverPath, fullPage: false });
  const coverBytes = await readFile(coverPath);
  if (coverBytes.subarray(1, 4).toString("ascii") !== "PNG") throw new Error("Cover capture is not a PNG.");
  const cover = {
    path: coverPath,
    width: coverBytes.readUInt32BE(16),
    height: coverBytes.readUInt32BE(20),
    bytes: coverBytes.byteLength,
    sha256: createHash("sha256").update(coverBytes).digest("hex"),
  };
  if (cover.width !== 540 || cover.height !== 960) {
    throw new Error(`Cover dimensions were ${cover.width}x${cover.height}, expected 540x960.`);
  }

  console.log(
    JSON.stringify(
      {
        browser: path.basename(executablePath),
        responseStatus: response.status(),
        metrics,
        postEditRevision: 6,
        videoClipCount,
        qualityText,
        changedPathText,
        previewEvidence,
        audioPreviewEvidence,
        shellEvidence,
        renderNotice,
        mediaPreviewScreenshot,
        audioPreviewScreenshot,
        screenshot: path.join(artifactDir, "studio-editor-shell-post-edit.png"),
        menuScreenshot,
        cover,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
