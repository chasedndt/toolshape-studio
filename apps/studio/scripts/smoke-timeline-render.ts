/**
 * Proves the timeline is what gets rendered.
 *
 * The previous render boundary looped a still image and synthesised a tone, so
 * a project could be edited but never produced. This generates real media,
 * builds a two-clip timeline whose total duration differs from any single
 * source, renders it, and probes the output — a still-image fallback could not
 * produce the resulting duration, so the assertion distinguishes them.
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createGoldenStudioProject } from "../../../fixtures/studio/golden-project";
import { applyStudioOperation, rational, toSeconds } from "@toolshape/studio-engine";
import type { StudioOperation, StudioProject } from "@toolshape/studio-domain";
import { createTimelineRenderPlan } from "@toolshape/studio-render";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAILED: ${message}`);
}

let sequence = 0;
function apply(project: StudioProject, type: StudioOperation["type"], payload: unknown): StudioProject {
  sequence += 1;
  return applyStudioOperation(project, {
    operationId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    type,
    actor: "operator",
    expectedRevision: project.revision,
    payload,
  } as StudioOperation).project;
}

function ffprobeDuration(file: string): number {
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  assert(probe.status === 0, `ffprobe failed: ${probe.stderr}`);
  return Number.parseFloat(probe.stdout.trim());
}

async function main(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-timeline-render-"));
  try {
    // Ten seconds of real video with a real tone, so trims and concatenation
    // have something genuine to cut.
    const sourcePath = path.join(root, "source.mp4");
    const make = spawnSync(
      "ffmpeg",
      [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=30:duration=10",
        "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=10",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
        sourcePath,
      ],
      { encoding: "utf8" },
    );
    assert(make.status === 0, `could not build source media: ${make.stderr}`);

    // Split, then trim the tail, so the timeline totals something no single
    // source and no still-image fallback would produce.
    let project = createGoldenStudioProject();
    project = apply(project, "timeline.clip.split", {
      trackId: "track-video",
      clipId: "clip-main",
      splitAt: rational(3),
      rightClipId: "clip-tail",
    });
    project = apply(project, "timeline.clip.trim", {
      trackId: "track-video",
      clipId: "clip-tail",
      newStart: rational(3),
      newDuration: rational(2),
      ripple: false,
    });

    const outputPath = path.join(root, "timeline.mp4");
    const plan = createTimelineRenderPlan({
      project,
      sources: project.assets
        .filter((asset) => asset.kind === "video" || asset.kind === "audio")
        .map((asset) => ({ assetId: asset.id, path: sourcePath, hasAudio: true })),
      outputPath,
      width: 1280,
      height: 720,
      frameRate: 30,
    });

    assert(plan.segments.length === 2, `expected 2 segments, got ${plan.segments.length}`);
    const expected = plan.segments.reduce((total, segment) => total + segment.durationSeconds, 0);
    assert(Math.abs(expected - 5) < 0.01, `expected a 5s timeline, planned ${expected}`);

    const graph = plan.args.join(" ");
    assert(!graph.includes("sine="), "the plan must not synthesise audio");
    assert(!graph.includes("-loop"), "the plan must not loop a still image");

    const render = spawnSync(plan.binary, plan.args, { encoding: "utf8" });
    assert(render.status === 0, `render failed: ${render.stderr?.slice(-600)}`);

    const actual = ffprobeDuration(plan.partialOutputPath);
    // A cover render would have produced the timeline's declared 8s duration;
    // a real concat of a 3s and a 2s segment produces 5s.
    assert(
      Math.abs(actual - 5) < 0.35,
      `rendered duration ${actual}s does not match the 5s timeline — a still-image fallback would give 8s`,
    );

    process.stdout.write(
      `${JSON.stringify({
        status: "completed",
        segments: plan.segments.length,
        planned_seconds: Number(expected.toFixed(3)),
        rendered_seconds: Number(actual.toFixed(3)),
        timeline_declared_seconds: toSeconds(project.timeline.duration),
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
