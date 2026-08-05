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

  await page.locator(".workspace-tabs").getByRole("tab", { name: "Review", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".studio-shell")?.getAttribute("data-workspace") === "review");
  if (await page.locator(".project-crumb i").textContent() !== "r0") {
    throw new Error("Workspace switching advanced the canonical project revision.");
  }
  // Review opens on Activity: the workspace exists to show what changed and
  // who changed it, so the history is its default context panel.
  if (await page.locator("#active-context-panel").getAttribute("data-panel-id") !== "activity") {
    throw new Error("Review workspace did not open the activity context.");
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

  const initialTimelineRevision = await page.locator(".project-crumb i").textContent();
  const defaultSelectedClip = page.locator('.timeline-clip[data-selected="true"]');
  if (await defaultSelectedClip.getAttribute("data-clip-id") !== "clip-main") {
    throw new Error("The primary video clip was not selected in the initial direct-edit state.");
  }
  const overviewMajorTicks = await page.locator(".timeline-tick.is-major").count();
  const zoomControl = page.getByRole("slider", { name: "Timeline zoom", exact: true });
  await zoomControl.fill("2");
  await page.waitForFunction(() => document.querySelector(".timeline-panel")?.getAttribute("data-timeline-zoom") === "2.0");
  const detailedMajorTicks = await page.locator(".timeline-tick.is-major").count();
  if (detailedMajorTicks <= overviewMajorTicks || await page.locator(".project-crumb i").textContent() !== initialTimelineRevision) {
    throw new Error(`Timeline zoom mutated project truth or did not increase ruler density: overview=${overviewMajorTicks} detailed=${detailedMajorTicks}`);
  }

  const playheadSlider = page.getByRole("slider", { name: "Timeline playhead", exact: true });
  const rulerBox = await playheadSlider.boundingBox();
  if (!rulerBox) throw new Error("Timeline ruler had no browser geometry.");
  await page.mouse.click(rulerBox.x + rulerBox.width / 2, rulerBox.y + rulerBox.height / 2);
  const scrubbedPlayhead = Number(await playheadSlider.getAttribute("aria-valuenow"));
  if (Math.abs(scrubbedPlayhead - 4) > 1 / 30 || await page.locator(".project-crumb i").textContent() !== "r0") {
    throw new Error(`Playhead scrub was not frame-accurate view state: ${scrubbedPlayhead}`);
  }

  await page.keyboard.press("s");
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r1");
  const rightClip = page.getByRole("button", { name: "Product film B, video clip", exact: true });
  if (await rightClip.getAttribute("aria-pressed") !== "true") {
    throw new Error("Keyboard split did not move selection to the new editable clip.");
  }

  await page.getByRole("button", { name: "Product film, video clip", exact: true }).click();
  const trimEndHandle = page.getByRole("button", { name: "Trim end of Product film", exact: true });
  const handleBox = await trimEndHandle.boundingBox();
  if (!handleBox) throw new Error("Selected clip did not expose a measurable end trim handle.");
  const videoLaneBox = await trimEndHandle.evaluate((element) => {
    const lane = element.closest<HTMLElement>("[data-timeline-lane]");
    if (!lane) return null;
    const rect = lane.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (!videoLaneBox) throw new Error("Selected clip trim handle was not attached to a timeline lane.");
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(videoLaneBox.x + videoLaneBox.width * (3.5 / 8), handleBox.y + handleBox.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r2");
  const trimmedDuration = await page.getByRole("button", { name: "Product film, video clip", exact: true }).locator("small").textContent();
  if (!trimmedDuration?.includes("3.50s")) {
    throw new Error(`Direct handle trim did not commit the expected frame-snapped duration: ${String(trimmedDuration)}`);
  }

  await rightClip.click();
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("]");
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r3");
  const rightDuration = await rightClip.locator("small").textContent();
  if (!rightDuration?.includes("2.00s")) {
    throw new Error(`Keyboard set-out did not commit through the selected clip: ${String(rightDuration)}`);
  }
  const revisionBeforeNudge = await page.locator(".project-crumb i").textContent();
  const playheadBeforeNudge = Number(await playheadSlider.getAttribute("aria-valuenow"));
  await page.keyboard.press("ArrowLeft");
  const playheadAfterNudge = Number(await playheadSlider.getAttribute("aria-valuenow"));
  if (revisionBeforeNudge !== await page.locator(".project-crumb i").textContent() || Math.abs((playheadBeforeNudge - playheadAfterNudge) - 1 / 30) > 0.002) {
    throw new Error("One-frame keyboard playhead nudge changed canonical state or used the wrong step.");
  }
  await page.getByRole("button", { name: "Ripple", exact: true }).click();
  if (await page.locator(".project-crumb i").textContent() !== "r3") {
    throw new Error("Ripple preference changed the canonical project before an edit committed.");
  }
  const timelineScreenshot = path.join(artifactDir, "studio-direct-timeline-selected.png");
  await page.screenshot({ path: timelineScreenshot, fullPage: false });

  await page.getByRole("button", { name: "Nudge +24" }).click();
  await page.locator(".workspace-tabs").getByRole("tab", { name: "Review", exact: true }).click();
  // Review now opens on Activity, so the agent panel is selected explicitly.
  await page.locator(".right-rail").getByRole("tab", { name: "Agent", exact: true }).click();
  await page.getByRole("button", { name: "Apply candidate" }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r5");
  await page.getByRole("button", { name: /Undo/ }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r6");
  await page.getByRole("button", { name: /Redo/ }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r7");
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
    timelineZoom: document.querySelector(".timeline-panel")?.getAttribute("data-timeline-zoom"),
    selectedClip: document.querySelector('.timeline-clip[data-selected="true"]')?.getAttribute("data-clip-id"),
    trimHandleCount: document.querySelectorAll(".trim-handle").length,
    tabCount: document.querySelectorAll('[role="tab"]').length,
    viewportOverflow: document.documentElement.scrollWidth > window.innerWidth,
  }));
  if (shellEvidence.workspace !== "review" || shellEvidence.contextPanel !== "agent" || !shellEvidence.timelineVisible || shellEvidence.timelineZoom !== "2.0" || shellEvidence.trimHandleCount !== 2 || shellEvidence.viewportOverflow) {
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

  const compactPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const compactResponse = await compactPage.goto(baseUrl, { waitUntil: "networkidle" });
  if (!compactResponse?.ok()) throw new Error(`Compact Studio view returned HTTP ${String(compactResponse?.status())}.`);
  await compactPage.waitForFunction(() => Boolean(document.documentElement.dataset.studioReadyMs));
  const compactEvidence = await compactPage.evaluate(() => {
    const toolbar = document.querySelector(".timeline-toolbar")?.getBoundingClientRect();
    const actions = document.querySelector(".timeline-actions")?.getBoundingClientRect();
    const zoom = document.querySelector(".timeline-zoom")?.getBoundingClientRect();
    return {
      viewportOverflow: document.documentElement.scrollWidth > window.innerWidth,
      toolbarContained: Boolean(toolbar && actions && actions.right <= toolbar.right + 1 && actions.left >= toolbar.left - 1),
      zoomVisible: Boolean(zoom && zoom.width > 100 && zoom.right <= window.innerWidth),
      actionCount: document.querySelectorAll(".timeline-actions button").length,
    };
  });
  if (compactEvidence.viewportOverflow || !compactEvidence.toolbarContained || !compactEvidence.zoomVisible || compactEvidence.actionCount < 8) {
    throw new Error(`Compact direct timeline layout failed containment: ${JSON.stringify(compactEvidence)}`);
  }
  const compactScreenshot = path.join(artifactDir, "studio-direct-timeline-1280.png");
  await compactPage.screenshot({ path: compactScreenshot, fullPage: false });

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
        postEditRevision: 7,
        videoClipCount,
        qualityText,
        changedPathText,
        previewEvidence,
        audioPreviewEvidence,
        directTimelineEvidence: {
          overviewMajorTicks,
          detailedMajorTicks,
          scrubbedPlayhead,
          trimmedDuration,
          rightDuration,
          oneFrameNudge: playheadBeforeNudge - playheadAfterNudge,
          timelineScreenshot,
        },
        compactEvidence: { ...compactEvidence, screenshot: compactScreenshot },
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
