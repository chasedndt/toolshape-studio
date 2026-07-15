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

  await page.getByRole("button", { name: "Split at 4s" }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r1");
  await page.getByRole("button", { name: "Trim + ripple" }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r2");
  await page.getByRole("button", { name: "Nudge +24" }).click();
  await page.getByRole("button", { name: "Apply candidate" }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r4");
  await page.getByRole("button", { name: /Undo/ }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r5");
  await page.getByRole("button", { name: /Redo/ }).click();
  await page.waitForFunction(() => document.querySelector(".project-crumb i")?.textContent === "r6");

  const videoClipCount = await page.locator(".track-lane--video .timeline-clip").count();
  const qualityText = await page.locator(".quality-card strong").textContent();
  const changedPathText = await page.locator(".diff-strip strong").textContent();
  if (videoClipCount !== 2 || qualityText !== "Canonical state valid") {
    throw new Error(
      `Post-edit state mismatch: clips=${videoClipCount} quality=${String(qualityText)}`,
    );
  }

  await page.screenshot({
    path: path.join(artifactDir, "studio-editor-post-edit.png"),
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
        screenshot: path.join(artifactDir, "studio-editor-post-edit.png"),
        cover,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
