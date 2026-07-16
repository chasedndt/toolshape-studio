import { randomUUID } from "node:crypto";
import path from "node:path";
import type { FfmpegThumbnailPlan, FfmpegWaveformPlan } from "./types";

function isWithin(root: string, target: string): boolean {
  const normalizedRoot = `${path.resolve(root)}${path.sep}`.toLowerCase();
  return path.resolve(target).toLowerCase().startsWith(normalizedRoot);
}

function assertInputAndWorkId(inputPath: string, workId: string): void {
  if (!path.isAbsolute(inputPath)) throw new TypeError("Derivative input path must be absolute.");
  if (!/^[a-zA-Z0-9_-]+$/.test(workId)) throw new TypeError("Derivative work ID is unsafe.");
}

function assertDimension(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 16 || value > 8192) {
    throw new RangeError(`${label} must be an integer between 16 and 8192 pixels.`);
  }
}

export interface CreateThumbnailPlanInput {
  inputPath: string;
  workRoot: string;
  maxWidth: number;
  maxHeight: number;
  atSeconds: number;
  workId?: string;
}

export function createFfmpegThumbnailPlan(input: CreateThumbnailPlanInput): FfmpegThumbnailPlan {
  const workId = input.workId ?? randomUUID();
  assertInputAndWorkId(input.inputPath, workId);
  assertDimension(input.maxWidth, "Thumbnail width");
  assertDimension(input.maxHeight, "Thumbnail height");
  if (!Number.isFinite(input.atSeconds) || input.atSeconds < 0 || input.atSeconds > 24 * 60 * 60) {
    throw new RangeError("Thumbnail timestamp is outside the supported range.");
  }
  const workRoot = path.resolve(input.workRoot);
  const partialOutputPath = path.resolve(workRoot, `${workId}.thumbnail.partial.png`);
  if (!isWithin(workRoot, partialOutputPath)) throw new TypeError("Thumbnail output escaped the work root.");
  const scale = `scale=w='min(${input.maxWidth},iw)':h='min(${input.maxHeight},ih)':force_original_aspect_ratio=decrease`;
  return {
    binary: "ffmpeg",
    inputPath: path.resolve(input.inputPath),
    partialOutputPath,
    maxWidth: input.maxWidth,
    maxHeight: input.maxHeight,
    atSeconds: input.atSeconds,
    args: [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-ss",
      input.atSeconds.toFixed(3),
      "-i",
      path.resolve(input.inputPath),
      "-map",
      "0:v:0",
      "-frames:v",
      "1",
      "-vf",
      scale,
      "-c:v",
      "png",
      "-compression_level",
      "6",
      "-update",
      "1",
      partialOutputPath,
    ],
  };
}

export interface CreateWaveformPlanInput {
  inputPath: string;
  workRoot: string;
  width: number;
  height: number;
  workId?: string;
}

export function createFfmpegWaveformPlan(input: CreateWaveformPlanInput): FfmpegWaveformPlan {
  const workId = input.workId ?? randomUUID();
  assertInputAndWorkId(input.inputPath, workId);
  assertDimension(input.width, "Waveform width");
  assertDimension(input.height, "Waveform height");
  const workRoot = path.resolve(input.workRoot);
  const partialOutputPath = path.resolve(workRoot, `${workId}.waveform.partial.png`);
  if (!isWithin(workRoot, partialOutputPath)) throw new TypeError("Waveform output escaped the work root.");
  const filter = `[0:a:0]aformat=channel_layouts=mono,showwavespic=s=${input.width}x${input.height}:colors=0x79bfe8,format=rgba[wave]`;
  return {
    binary: "ffmpeg",
    inputPath: path.resolve(input.inputPath),
    partialOutputPath,
    width: input.width,
    height: input.height,
    args: [
      "-hide_banner",
      "-nostdin",
      "-y",
      "-i",
      path.resolve(input.inputPath),
      "-filter_complex",
      filter,
      "-map",
      "[wave]",
      "-frames:v",
      "1",
      "-c:v",
      "png",
      "-compression_level",
      "6",
      "-update",
      "1",
      partialOutputPath,
    ],
  };
}
