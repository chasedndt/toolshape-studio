import { randomUUID } from "node:crypto";
import path from "node:path";
import type { FfmpegProxyPlan } from "./types";

function isWithin(root: string, target: string): boolean {
  const normalizedRoot = `${path.resolve(root)}${path.sep}`.toLowerCase();
  return path.resolve(target).toLowerCase().startsWith(normalizedRoot);
}

export interface CreateProxyPlanInput {
  inputPath: string;
  workRoot: string;
  maxWidth: number;
  maxHeight: number;
  workId?: string;
}

export function createFfmpegProxyPlan(input: CreateProxyPlanInput): FfmpegProxyPlan {
  if (!path.isAbsolute(input.inputPath)) throw new TypeError("Proxy input path must be absolute.");
  if (!Number.isInteger(input.maxWidth) || !Number.isInteger(input.maxHeight) || input.maxWidth < 16 || input.maxHeight < 16) {
    throw new RangeError("Proxy dimensions must be positive integers of at least 16 pixels.");
  }
  const workRoot = path.resolve(input.workRoot);
  const workId = input.workId ?? randomUUID();
  if (!/^[a-zA-Z0-9_-]+$/.test(workId)) throw new TypeError("Proxy work ID is unsafe.");
  const partialOutputPath = path.resolve(workRoot, `${workId}.partial.mp4`);
  if (!isWithin(workRoot, partialOutputPath)) throw new TypeError("Proxy output escaped the work root.");
  const scale = `scale=w='min(${input.maxWidth},iw)':h='min(${input.maxHeight},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`;
  return {
    binary: "ffmpeg",
    inputPath: path.resolve(input.inputPath),
    partialOutputPath,
    maxWidth: input.maxWidth,
    maxHeight: input.maxHeight,
    args: [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-i",
      path.resolve(input.inputPath),
      "-map",
      "0:v:0",
      "-map",
      "0:a:0?",
      "-vf",
      scale,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      partialOutputPath,
    ],
  };
}
