import { spawn } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { RenderExpectation, RenderPlan } from "./render-plan";

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
}

interface FfprobeDocument {
  format?: {
    format_name?: string;
    duration?: string;
  };
  streams?: FfprobeStream[];
}

export interface RenderVerificationReport {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; actual: string }>;
  probe: FfprobeDocument;
}

export interface RunRenderOptions {
  signal?: AbortSignal;
  onProgress?: (seconds: number) => void;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

export async function probeMediaToolchain(): Promise<Array<Record<string, unknown>>> {
  const [ffmpeg, ffprobe] = await Promise.all([
    runCommand("ffmpeg", ["-version"]),
    runCommand("ffprobe", ["-version"]),
  ]);
  return [
    { name: "ffmpeg", version: ffmpeg.stdout.split(/\r?\n/, 1)[0] ?? "unknown" },
    { name: "ffprobe", version: ffprobe.stdout.split(/\r?\n/, 1)[0] ?? "unknown" },
  ];
}

function runCommand(
  binary: string,
  args: string[],
  options: RunRenderOptions = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    const abort = (): void => {
      child.kill("SIGTERM");
    };
    options.signal?.addEventListener("abort", abort, { once: true });

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr = `${stderr}${text}`.slice(-24_000);
      const match = /time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(text);
      if (match) {
        const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
        options.onProgress?.(seconds);
      }
    });
    child.on("error", reject);
    child.on("close", (code) => {
      options.signal?.removeEventListener("abort", abort);
      if (options.signal?.aborted) {
        reject(new DOMException("Render cancelled.", "AbortError"));
      } else if (code !== 0) {
        reject(new Error(`${binary} exited with code ${String(code)}.\n${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export function verifyProbeDocument(
  probe: FfprobeDocument,
  expectation: RenderExpectation,
): RenderVerificationReport {
  const streams = probe.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(probe.format?.duration ?? video?.duration ?? 0);
  const checks = [
    {
      name: "container",
      passed: (probe.format?.format_name ?? "").split(",").includes(expectation.container),
      actual: probe.format?.format_name ?? "missing",
    },
    {
      name: "video codec",
      passed: video?.codec_name === expectation.videoCodec,
      actual: video?.codec_name ?? "missing",
    },
    {
      name: "dimensions",
      passed: video?.width === expectation.width && video?.height === expectation.height,
      actual: `${String(video?.width ?? "missing")}x${String(video?.height ?? "missing")}`,
    },
    {
      name: "audio codec",
      passed: expectation.requiresAudio ? audio?.codec_name === expectation.audioCodec : true,
      actual: audio?.codec_name ?? "missing",
    },
    {
      name: "duration",
      passed: Math.abs(duration - expectation.durationSeconds) <= 0.15,
      actual: Number.isFinite(duration) ? duration.toFixed(3) : "missing",
    },
  ];
  return { passed: checks.every((check) => check.passed), checks, probe };
}

export async function executeVerifiedRender(
  plan: RenderPlan,
  options: RunRenderOptions = {},
): Promise<RenderVerificationReport> {
  await mkdir(path.dirname(plan.finalOutputPath), { recursive: true });
  await rm(plan.partialOutputPath, { force: true });

  try {
    await runCommand(plan.binary, plan.args, options);
    const probeResult = await runCommand("ffprobe", [
      "-v",
      "error",
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      plan.partialOutputPath,
    ]);
    const probe = JSON.parse(probeResult.stdout) as FfprobeDocument;
    const report = verifyProbeDocument(probe, plan.expectation);
    if (!report.passed) {
      throw new Error(
        `Render verification failed: ${report.checks
          .filter((check) => !check.passed)
          .map((check) => `${check.name}=${check.actual}`)
          .join(", ")}`,
      );
    }
    await rm(plan.finalOutputPath, { force: true });
    await rename(plan.partialOutputPath, plan.finalOutputPath);
    return report;
  } catch (error) {
    await rm(plan.partialOutputPath, { force: true });
    throw error;
  }
}
