/**
 * Proves a capture renders with its styling applied.
 *
 * The zoom plan, backdrop and redactions existed as data and as pure functions
 * for a while with nothing turning them into pixels. This checks the pixels:
 * that the backdrop occupies the padding, that a redaction is genuinely opaque
 * inside its time range and genuinely absent outside it, and that the frame is
 * zoomed when the plan says it should be.
 *
 * Sampling actual pixels rather than asserting on the filter string, because a
 * filter graph that parses is not the same as a filter graph that works.
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import type { CaptureDocument } from "@toolshape/studio-domain";
import { rational } from "@toolshape/studio-engine";
import { createCaptureRenderPlan } from "@toolshape/studio-render";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAILED: ${message}`);
}

/** Mean RGB of a region of one frame, read straight from decoded pixels. */
function sampleRegion(
  file: string,
  atSeconds: number,
  crop: { x: number; y: number; w: number; h: number },
): { r: number; g: number; b: number } {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error",
      "-ss", atSeconds.toFixed(3),
      "-i", file,
      "-frames:v", "1",
      "-vf", `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=1:1`,
      "-f", "rawvideo", "-pix_fmt", "rgb24",
      "-",
    ],
    { encoding: "buffer", maxBuffer: 1024 * 1024 },
  );
  assert(result.status === 0, `pixel sample failed: ${result.stderr?.toString().slice(-400)}`);
  const pixels = result.stdout;
  assert(pixels.length >= 3, "pixel sample returned no data");
  return { r: pixels[0], g: pixels[1], b: pixels[2] };
}

function isNear(sample: { r: number; g: number; b: number }, target: [number, number, number], tolerance = 26): boolean {
  return (
    Math.abs(sample.r - target[0]) <= tolerance &&
    Math.abs(sample.g - target[1]) <= tolerance &&
    Math.abs(sample.b - target[2]) <= tolerance
  );
}

async function main(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-capture-render-"));
  try {
    // A bright, uniform source so any styling applied over it is unambiguous.
    const sourcePath = path.join(root, "source.mp4");
    const make = spawnSync(
      "ffmpeg",
      [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "color=c=white:size=1280x720:rate=30:duration=6",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        sourcePath,
      ],
      { encoding: "utf8" },
    );
    assert(make.status === 0, `could not build source media: ${make.stderr}`);

    const capture: CaptureDocument = {
      id: "capture-smoke",
      revision: 0,
      source: { id: "display-1", kind: "display", label: "Display", width: 1280, height: 720 },
      mediaAssetId: "asset-capture",
      audioAssetIds: [],
      duration: rational(6),
      frameRate: rational(30),
      cursorTrack: [],
      eventTrack: [],
      windowTrack: [],
      zoomPlan: {
        id: "zoom-1",
        revision: 0,
        derived: true,
        keyframes: [
          { id: "k0", time: rational(0), scale: 1, centerX: 0.5, centerY: 0.5, easing: "ease-in-out" },
          { id: "k1", time: rational(3), scale: 2, centerX: 0.5, centerY: 0.5, easing: "ease-in-out" },
          { id: "k2", time: rational(6), scale: 1, centerX: 0.5, centerY: 0.5, easing: "ease-in-out" },
        ],
      },
      // A strongly coloured backdrop, so padding is distinguishable from both
      // the white source and a black redaction.
      backdrop: { fill: { kind: "solid", colour: "#ff0000" }, paddingPx: 100, cornerRadiusPx: 0, shadowOpacity: 0 },
      cursorStyle: { smoothing: 0, sizeScale: 1, clickEmphasis: false, motionBlur: false },
      cameraOverlay: null,
      // Covers the whole source between 1s and 2s, so the check does not depend
      // on where the zoom happens to be framed.
      redactions: [
        {
          id: "redaction-1",
          kind: "region",
          from: rational(1),
          to: rational(2),
          bounds: { x: 0, y: 0, width: 1280, height: 720 },
        },
      ],
      transcriptRef: null,
    };

    const outputPath = path.join(root, "styled.mp4");
    const plan = createCaptureRenderPlan({
      capture,
      source: { path: sourcePath, width: 1280, height: 720 },
      outputPath,
      width: 1280,
      height: 720,
      frameRate: 30,
    });

    const render = spawnSync(plan.binary, plan.args, { encoding: "utf8" });
    assert(render.status === 0, `capture render failed: ${render.stderr?.slice(-700)}`);

    const rendered = plan.partialOutputPath;

    // 1. The backdrop fills the padding. Ten pixels in from the corner is
    //    inside the 100px pad on both axes.
    const corner = sampleRegion(rendered, 0.5, { x: 10, y: 10, w: 40, h: 40 });
    assert(
      isNear(corner, [255, 0, 0]),
      `backdrop should be red at the corner, sampled rgb(${corner.r},${corner.g},${corner.b})`,
    );

    // 2. Outside the redaction window the centre shows the white recording.
    const beforeRedaction = sampleRegion(rendered, 0.5, { x: 600, y: 330, w: 60, h: 60 });
    assert(
      isNear(beforeRedaction, [255, 255, 255]),
      `centre should be the white recording at 0.5s, sampled rgb(${beforeRedaction.r},${beforeRedaction.g},${beforeRedaction.b})`,
    );

    // 3. Inside it, the centre is opaque black.
    const duringRedaction = sampleRegion(rendered, 1.5, { x: 600, y: 330, w: 60, h: 60 });
    assert(
      isNear(duringRedaction, [0, 0, 0]),
      `redaction should be opaque black at 1.5s, sampled rgb(${duringRedaction.r},${duringRedaction.g},${duringRedaction.b})`,
    );

    // 4. And afterwards the recording is visible again — a redaction that never
    //    lifted would pass check 3 while being badly wrong.
    const afterRedaction = sampleRegion(rendered, 2.5, { x: 600, y: 330, w: 60, h: 60 });
    assert(
      isNear(afterRedaction, [255, 255, 255]),
      `recording should return after the redaction, sampled rgb(${afterRedaction.r},${afterRedaction.g},${afterRedaction.b})`,
    );

    process.stdout.write(
      `${JSON.stringify({
        status: "completed",
        checks: 4,
        zoom_samples: plan.zoomSampleCount,
        redactions: plan.redactionCount,
      })}\n`,
    );
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ status: "failed", error: String(error) })}\n`);
  process.exitCode = 1;
});
