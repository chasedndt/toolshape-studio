import path from "node:path";

export interface RenderExpectation {
  width: number;
  height: number;
  durationSeconds: number;
  container: "mp4";
  videoCodec: "h264";
  audioCodec: "aac";
  requiresAudio: boolean;
}

export interface RenderPlan {
  binary: "ffmpeg";
  args: string[];
  finalOutputPath: string;
  partialOutputPath: string;
  expectation: RenderExpectation;
}

export interface CreateRenderPlanInput {
  coverPath: string;
  outputPath: string;
  width: number;
  height: number;
  durationSeconds: number;
  frameRate?: number;
}

function assertSafeArgument(value: string, label: string): void {
  if (!value || /[\u0000\r\n]/.test(value)) {
    throw new TypeError(`${label} contains an invalid control character.`);
  }
}

export function createFfmpegRenderPlan(input: CreateRenderPlanInput): RenderPlan {
  assertSafeArgument(input.coverPath, "Cover path");
  assertSafeArgument(input.outputPath, "Output path");
  if (path.extname(input.outputPath).toLowerCase() !== ".mp4") {
    throw new TypeError("The first Studio render boundary only accepts an .mp4 output path.");
  }
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height)) {
    throw new TypeError("Render dimensions must be integers.");
  }
  if (input.width <= 0 || input.height <= 0 || input.width % 2 || input.height % 2) {
    throw new RangeError("H.264 render dimensions must be positive even numbers.");
  }
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    throw new RangeError("Render duration must be positive.");
  }

  const parsed = path.parse(input.outputPath);
  const partialOutputPath = path.join(parsed.dir, `${parsed.name}.partial.mp4`);
  const frameRate = input.frameRate ?? 30;
  const duration = input.durationSeconds.toFixed(3);
  const args = [
    "-hide_banner",
    "-loglevel",
    "info",
    "-loop",
    "1",
    "-i",
    input.coverPath,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=220:sample_rate=48000:duration=${duration}`,
    "-t",
    duration,
    "-r",
    String(frameRate),
    "-vf",
    `scale=${input.width}:${input.height}:flags=lanczos,format=yuv420p`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-movflags",
    "+faststart",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-shortest",
    "-y",
    partialOutputPath,
  ];

  return {
    binary: "ffmpeg",
    args,
    finalOutputPath: input.outputPath,
    partialOutputPath,
    expectation: {
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      requiresAudio: true,
    },
  };
}

