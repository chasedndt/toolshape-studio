/**
 * Proves a design exports to a file someone can actually open.
 *
 * The design pillar could produce nine platform variants and export none of
 * them. Asserting on the SVG string would only prove the markup was built; it
 * would not prove the markup renders, that the formats agree, or that a
 * transparent export is genuinely transparent. So this decodes the exported
 * files and reads their pixels.
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import type { Scene, SceneNode } from "@toolshape/studio-domain";
import {
  createImageExportPlan,
  createVariantExportPlans,
  executeImageExport,
  findBrowserExecutable,
} from "@toolshape/studio-render";
import { chromium } from "playwright-core";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAILED: ${message}`);
}

/** Mean RGBA of a region of an image file, read straight from decoded pixels. */
function samplePixel(file: string, region: { x: number; y: number; w: number; h: number }) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error",
      "-i", file,
      "-vf", `crop=${region.w}:${region.h}:${region.x}:${region.y},scale=1:1`,
      "-frames:v", "1",
      "-f", "rawvideo", "-pix_fmt", "rgba",
      "-",
    ],
    { encoding: "buffer", maxBuffer: 1024 * 1024 },
  );
  assert(result.status === 0, `pixel sample of ${path.basename(file)} failed: ${result.stderr?.toString().slice(-400)}`);
  const pixels = result.stdout;
  assert(pixels.length >= 4, `pixel sample of ${path.basename(file)} returned no data`);
  return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
}

function isNear(sample: { r: number; g: number; b: number }, target: [number, number, number], tolerance = 12): boolean {
  return (
    Math.abs(sample.r - target[0]) <= tolerance &&
    Math.abs(sample.g - target[1]) <= tolerance &&
    Math.abs(sample.b - target[2]) <= tolerance
  );
}

const TRANSFORM = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0, opacity: 1 };

function node(id: string, overrides: Record<string, unknown>): SceneNode {
  return {
    id,
    name: id,
    revision: 0,
    visible: true,
    locked: false,
    zIndex: 0,
    transform: { ...TRANSFORM },
    size: { width: 100, height: 100 },
    effectIds: [],
    animations: {},
    ...overrides,
  } as unknown as SceneNode;
}

/**
 * A scene of four flat quadrants on a known background, so every check reads a
 * colour that could only have come from the thing it is checking.
 */
function makeScene(id: string): Scene {
  const quadrant = (name: string, x: number, y: number, fill: string) =>
    node(name, {
      type: "shape",
      shape: "rectangle",
      fill,
      cornerRadius: 0,
      transform: { ...TRANSFORM, x, y },
      size: { width: 200, height: 150 },
      zIndex: 1,
    });

  return {
    id,
    name: "Export smoke",
    revision: 0,
    size: { width: 400, height: 300 },
    safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    background: "#ffffff",
    nodeIds: [],
    nodes: [
      quadrant("tl", 0, 0, "#ff0000"),
      quadrant("tr", 200, 0, "#00ff00"),
      quadrant("bl", 0, 150, "#0000ff"),
      // Deliberately left unpainted so the scene background shows through and a
      // renderer that filled the frame with a solid colour would be caught.
      node("label", {
        type: "text",
        content: "EXPORT",
        fontFamily: "Arial",
        fontSize: 28,
        fontWeight: 700,
        lineHeight: 1.2,
        alignment: "left",
        color: "#000000",
        maxLines: 1,
        transform: { ...TRANSFORM, x: 210, y: 160 },
        size: { width: 180, height: 40 },
        zIndex: 2,
      }),
    ],
  };
}

async function main(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-image-export-"));
  const browser = await chromium.launch({ executablePath: await findBrowserExecutable(), headless: true });
  const checks: string[] = [];

  try {
    const scene = makeScene("scene-export");

    // 1. PNG at 2x renders the design, not a blank frame.
    const png = await executeImageExport(
      createImageExportPlan({ scene, outputPath: path.join(root, "design.png"), scale: 2 }),
      browser,
    );
    const topLeft = samplePixel(png.outputPath, { x: 40, y: 40, w: 60, h: 60 });
    assert(isNear(topLeft, [255, 0, 0]), `PNG top-left should be red, got rgb(${topLeft.r},${topLeft.g},${topLeft.b})`);
    const topRight = samplePixel(png.outputPath, { x: 500, y: 40, w: 60, h: 60 });
    assert(isNear(topRight, [0, 255, 0]), `PNG top-right should be green, got rgb(${topRight.r},${topRight.g},${topRight.b})`);
    checks.push("png-renders-design");

    // 2. The 2x scale produced a 2x file, not a scaled-up 1x one.
    const probe = spawnSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", png.outputPath],
      { encoding: "utf8" },
    );
    assert(probe.stdout.trim() === "800,600", `PNG should be 800x600, ffprobe reported ${probe.stdout.trim()}`);
    checks.push("scale-applied");

    // 3. The unpainted quadrant shows the scene background, so the renderer did
    //    not simply flood the frame.
    const bottomRight = samplePixel(png.outputPath, { x: 700, y: 560, w: 40, h: 30 });
    assert(
      isNear(bottomRight, [255, 255, 255]),
      `PNG bottom-right should be the white background, got rgb(${bottomRight.r},${bottomRight.g},${bottomRight.b})`,
    );
    checks.push("background-shows-through");

    // 4. Text was drawn. Sampling a band across the word rather than one glyph,
    //    because where the letters land depends on the installed font.
    const textBand = samplePixel(png.outputPath, { x: 424, y: 330, w: 200, h: 44 });
    assert(
      textBand.r < 235 && textBand.g < 235 && textBand.b < 235,
      `text should darken its band against white, got rgb(${textBand.r},${textBand.g},${textBand.b})`,
    );
    checks.push("text-rendered");

    // 5. JPEG and WebP carry the same design. A separate renderer per format is
    //    exactly how a PNG and a PDF end up disagreeing.
    for (const [file, format] of [["design.jpg", "jpeg"], ["design.webp", "webp"]] as const) {
      const result = await executeImageExport(
        createImageExportPlan({ scene, outputPath: path.join(root, file), quality: 92 }),
        browser,
      );
      const corner = samplePixel(result.outputPath, { x: 20, y: 20, w: 30, h: 30 });
      assert(isNear(corner, [255, 0, 0], 24), `${format} top-left should be red, got rgb(${corner.r},${corner.g},${corner.b})`);
    }
    checks.push("lossy-formats-agree");

    // 6. A transparent export really has no background, rather than a white one
    //    that merely looks right on a white page.
    const transparent = await executeImageExport(
      createImageExportPlan({
        scene,
        outputPath: path.join(root, "transparent.png"),
        transparentBackground: true,
      }),
      browser,
    );
    const empty = samplePixel(transparent.outputPath, { x: 350, y: 280, w: 20, h: 15 });
    assert(empty.a < 16, `transparent export should have an empty alpha channel, got a=${empty.a}`);
    const painted = samplePixel(transparent.outputPath, { x: 20, y: 20, w: 30, h: 30 });
    assert(painted.a > 240, `painted areas must stay opaque, got a=${painted.a}`);
    checks.push("transparency-honoured");

    // 7. PDF is produced and is a real PDF, not a renamed PNG.
    const pdf = await executeImageExport(
      createImageExportPlan({ scene, outputPath: path.join(root, "design.pdf") }),
      browser,
    );
    const header = (await readFile(pdf.outputPath)).subarray(0, 5).toString("latin1");
    assert(header === "%PDF-", `PDF should start with %PDF-, found ${JSON.stringify(header)}`);
    checks.push("pdf-produced");

    // 8. SVG needs no browser and is written out as the same document every
    //    other format was rasterised from.
    const svg = await executeImageExport(
      createImageExportPlan({ scene, outputPath: path.join(root, "design.svg") }),
    );
    const markup = await readFile(svg.outputPath, "utf8");
    assert(markup.startsWith("<?xml"), "standalone SVG should carry an XML prolog");
    assert(markup.includes("#ff0000") && markup.includes("EXPORT"), "SVG should contain the design");
    checks.push("svg-written-without-browser");

    // 9. A variant batch writes one file per scene, which is the whole reason
    //    the variant work existed.
    const batch = createVariantExportPlans({
      scenes: [makeScene("story"), makeScene("square"), makeScene("landscape")],
      directory: root,
      format: "png",
    });
    for (const plan of batch) await executeImageExport(plan, browser);
    assert(batch.length === 3, "variant batch should plan three files");
    for (const plan of batch) {
      const corner = samplePixel(plan.finalOutputPath, { x: 10, y: 10, w: 20, h: 20 });
      assert(isNear(corner, [255, 0, 0]), `variant ${path.basename(plan.finalOutputPath)} did not render`);
    }
    checks.push("variant-batch-exported");

    // 10. The same scene exports byte-identically twice. Without this, no
    //     exported file can be compared against a previous one.
    const first = await readFile(png.outputPath);
    const again = await executeImageExport(
      createImageExportPlan({ scene, outputPath: path.join(root, "design-again.png"), scale: 2 }),
      browser,
    );
    const second = await readFile(again.outputPath);
    assert(first.equals(second), "two exports of the same scene differed byte for byte");
    checks.push("export-is-reproducible");

    process.stdout.write(`${JSON.stringify({ status: "completed", checks: checks.length, verified: checks })}\n`);
  } finally {
    await browser.close().catch(() => {});
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ status: "failed", error: String(error) })}\n`);
  process.exitCode = 1;
});
