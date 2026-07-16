import { spawn } from "node:child_process";
import type { RationalTime, NormalizedMediaProbe } from "@toolshape/studio-domain";
import type { FfmpegProxyPlan, MediaProcessRunner } from "./types";

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  duration?: string;
}

interface ProbeDocument {
  format?: { format_name?: string; duration?: string };
  streams?: ProbeStream[];
}

interface ProcessOutput { stdout: string; stderr: string }

function run(binary: string, args: string[], timeoutMs: number): Promise<ProcessOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk: Buffer) => { stderr = `${stderr}${chunk.toString("utf8")}`.slice(-24_000); });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (timedOut) reject(new Error(`${binary} exceeded the ${timeoutMs} ms media-worker timeout.`));
      else if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${binary} exited with code ${String(code)}.\n${stderr}`));
    });
  });
}

function gcd(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

function rational(numerator: number, denominator: number): RationalTime {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    throw new TypeError("Media probe returned an invalid rational value.");
  }
  const divisor = gcd(Math.round(numerator), Math.round(denominator));
  return { numerator: Math.round(numerator) / divisor, denominator: Math.round(denominator) / divisor };
}

function seconds(value: string | undefined): RationalTime {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError("Media probe returned an invalid duration.");
  return rational(Math.round(parsed * 1_000_000), 1_000_000);
}

function rate(value: string | undefined): RationalTime {
  const match = /^(\d+)\/(\d+)$/.exec(value ?? "");
  if (!match) throw new TypeError("Media probe returned an invalid frame rate.");
  return rational(Number(match[1]), Number(match[2]));
}

export function normalizeProbeDocument(document: ProbeDocument): NormalizedMediaProbe {
  const streams = document.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  if (!video && !audio) throw new TypeError("Media probe found no supported audio or video stream.");
  const duration = seconds(document.format?.duration ?? video?.duration ?? audio?.duration);
  if (video && (
    !Number.isInteger(video.width) || Number(video.width) <= 0 ||
    !Number.isInteger(video.height) || Number(video.height) <= 0
  )) throw new TypeError("Media probe returned invalid video dimensions.");
  if (audio && (
    !Number.isInteger(Number(audio.sample_rate)) || Number(audio.sample_rate) <= 0 ||
    !Number.isInteger(audio.channels) || Number(audio.channels) <= 0
  )) throw new TypeError("Media probe returned invalid audio properties.");
  return {
    container: document.format?.format_name?.trim() || "unknown",
    duration,
    ...(video
      ? {
          video: {
            codec: video.codec_name?.trim() || "unknown",
            width: Number(video.width),
            height: Number(video.height),
            frameRate: rate(video.r_frame_rate),
          },
        }
      : {}),
    ...(audio
      ? {
          audio: {
            codec: audio.codec_name?.trim() || "unknown",
            sampleRate: Number(audio.sample_rate),
            channels: Number(audio.channels),
          },
        }
      : {}),
  };
}

export class FfmpegMediaProcessRunner implements MediaProcessRunner {
  async probe(filePath: string): Promise<NormalizedMediaProbe> {
    const result = await run("ffprobe", [
      "-v", "error",
      "-show_entries",
      "format=format_name,duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels,duration",
      "-of", "json",
      filePath,
    ], 30_000);
    return normalizeProbeDocument(JSON.parse(result.stdout) as ProbeDocument);
  }

  async createProxy(plan: FfmpegProxyPlan): Promise<void> {
    await run(plan.binary, plan.args, 5 * 60_000);
  }

  async toolchain(): Promise<Array<Record<string, unknown>>> {
    const [ffmpeg, ffprobe] = await Promise.all([
      run("ffmpeg", ["-version"], 10_000),
      run("ffprobe", ["-version"], 10_000),
    ]);
    return [
      { name: "ffmpeg", version: ffmpeg.stdout.split(/\r?\n/, 1)[0] ?? "unknown" },
      { name: "ffprobe", version: ffprobe.stdout.split(/\r?\n/, 1)[0] ?? "unknown" },
    ];
  }
}
