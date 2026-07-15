import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFfmpegRenderPlan, verifyProbeDocument } from "../src";

describe("validated render plans", () => {
  it("creates a shell-free FFmpeg argument array and partial output", () => {
    const outputPath = path.resolve("artifacts", "golden.mp4");
    const plan = createFfmpegRenderPlan({
      coverPath: path.resolve("artifacts", "cover.png"),
      outputPath,
      width: 1080,
      height: 1920,
      durationSeconds: 8,
    });
    expect(plan.binary).toBe("ffmpeg");
    expect(plan.args).toContain("libx264");
    expect(plan.args).toContain("aac");
    expect(plan.partialOutputPath).toMatch(/golden\.partial\.mp4$/);
    expect(plan.args.at(-1)).toBe(plan.partialOutputPath);
    expect(plan.finalOutputPath).toBe(outputPath);
  });

  it("rejects control characters and invalid H.264 dimensions", () => {
    expect(() =>
      createFfmpegRenderPlan({
        coverPath: "cover.png\n-y",
        outputPath: "golden.mp4",
        width: 1080,
        height: 1920,
        durationSeconds: 8,
      }),
    ).toThrow(/control character/i);
    expect(() =>
      createFfmpegRenderPlan({
        coverPath: "cover.png",
        outputPath: "golden.mp4",
        width: 1079,
        height: 1920,
        durationSeconds: 8,
      }),
    ).toThrow(/even numbers/i);
  });

  it("verifies container, streams, dimensions and duration", () => {
    const report = verifyProbeDocument(
      {
        format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "8.000" },
        streams: [
          { codec_type: "video", codec_name: "h264", width: 1080, height: 1920 },
          { codec_type: "audio", codec_name: "aac" },
        ],
      },
      {
        width: 1080,
        height: 1920,
        durationSeconds: 8,
        container: "mp4",
        videoCodec: "h264",
        audioCodec: "aac",
        requiresAudio: true,
      },
    );
    expect(report.passed).toBe(true);
    expect(report.checks.every((check) => check.passed)).toBe(true);
  });
});

