import { access, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";
import type { ImageExportPlan } from "./image-export";

/**
 * Turns an export plan into bytes.
 *
 * The plan decided everything — format, size, quality, the document itself —
 * so all that happens here is rasterisation. Keeping the decisions on the pure
 * side is what lets the whole export be tested without a browser; this file is
 * the only part that needs one.
 *
 * SVG needs no browser at all and is written straight out. It is not a special
 * case bolted on: it is the same document every other format is produced from.
 */

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

export async function findBrowserExecutable(): Promise<string> {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error("No supported local Chromium executable was found for rasterising exports.");
}

/**
 * A page that renders the document and reaches nothing else.
 *
 * The document is written as a data URL and every request it might make is
 * refused. An exported design can carry arbitrary text and image bytes, and
 * rasterising it must not be a way for that content to reach the network from
 * the user's machine.
 */
async function openIsolatedPage(browser: Browser, plan: ImageExportPlan) {
  const context = await browser.newContext({
    viewport: { width: plan.width, height: plan.height },
    deviceScaleFactor: 1,
    javaScriptEnabled: false,
  });
  await context.route("**/*", (route) => {
    route.abort();
  });
  const page = await context.newPage();

  const html =
    `<!doctype html><meta charset="utf-8">` +
    `<style>html,body{margin:0;padding:0;background:transparent}` +
    `svg{display:block;width:${plan.width}px;height:${plan.height}px}</style>` +
    plan.document;

  // A data URL rather than a file, so nothing in the document can reference a
  // sibling path on disk.
  await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, {
    waitUntil: "load",
  });
  return { context, page };
}

export interface RasteriseResult {
  outputPath: string;
  bytes: number;
  format: ImageExportPlan["format"];
}

export async function executeImageExport(
  plan: ImageExportPlan,
  browser?: Browser,
): Promise<RasteriseResult> {
  if (plan.format === "svg") {
    await writeFile(plan.partialOutputPath, plan.document, "utf8");
    return finish(plan);
  }

  const owned = browser === undefined;
  const active = browser ?? (await chromium.launch({ executablePath: await findBrowserExecutable(), headless: true }));

  try {
    const { context, page } = await openIsolatedPage(active, plan);
    try {
      if (plan.format === "pdf") {
        // Sized in CSS pixels so the page matches the design exactly rather
        // than being fitted onto a paper size it was never laid out for.
        await page.pdf({
          path: plan.partialOutputPath,
          width: `${plan.width}px`,
          height: `${plan.height}px`,
          printBackground: true,
          pageRanges: "1",
        });
      } else {
        await page.screenshot({
          path: plan.partialOutputPath,
          type: plan.format === "webp" ? "png" : plan.format,
          ...(plan.quality !== null && plan.format === "jpeg" ? { quality: plan.quality } : {}),
          omitBackground: plan.transparent,
          clip: { x: 0, y: 0, width: plan.width, height: plan.height },
        });
        if (plan.format === "webp") {
          await encodeWebp(plan);
        }
      }
    } finally {
      await context.close();
    }
  } finally {
    if (owned) await active.close();
  }

  return finish(plan);
}

/**
 * Chromium screenshots PNG and JPEG only, so WebP is transcoded from the PNG.
 *
 * Going through a lossless intermediate rather than a second render means the
 * WebP is pixel-identical to the PNG before compression, so the formats cannot
 * drift apart.
 */
async function encodeWebp(plan: ImageExportPlan): Promise<void> {
  const { spawnSync } = await import("node:child_process");
  const intermediate = plan.partialOutputPath;
  const encoded = `${intermediate}.webp`;
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", intermediate,
      "-c:v", "libwebp",
      "-quality", String(plan.quality ?? 90),
      "-lossless", "0",
      encoded,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`WebP encode failed: ${result.stderr?.slice(-400)}`);
  }
  await rename(encoded, intermediate);
}

/**
 * The final name appears only once the file is complete, so a reader that sees
 * it never sees a half-written export.
 */
async function finish(plan: ImageExportPlan): Promise<RasteriseResult> {
  const { stat } = await import("node:fs/promises");
  const info = await stat(plan.partialOutputPath);
  if (info.size === 0) {
    throw new Error(`Export produced an empty file at ${path.basename(plan.partialOutputPath)}.`);
  }
  await rename(plan.partialOutputPath, plan.finalOutputPath);
  return { outputPath: plan.finalOutputPath, bytes: info.size, format: plan.format };
}
