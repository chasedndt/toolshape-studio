import type { NormalizedMediaProbe } from "@toolshape/studio-domain";

export type { NormalizedMediaProbe } from "@toolshape/studio-domain";

export interface FfmpegProxyPlan {
  binary: "ffmpeg";
  args: string[];
  inputPath: string;
  partialOutputPath: string;
  maxWidth: number;
  maxHeight: number;
}

export interface FfmpegThumbnailPlan {
  binary: "ffmpeg";
  args: string[];
  inputPath: string;
  partialOutputPath: string;
  maxWidth: number;
  maxHeight: number;
  atSeconds: number;
}

export interface FfmpegWaveformPlan {
  binary: "ffmpeg";
  args: string[];
  inputPath: string;
  partialOutputPath: string;
  width: number;
  height: number;
}

export interface MediaProcessRunner {
  probe(filePath: string): Promise<NormalizedMediaProbe>;
  createProxy(plan: FfmpegProxyPlan): Promise<void>;
  createThumbnail(plan: FfmpegThumbnailPlan): Promise<void>;
  createWaveform(plan: FfmpegWaveformPlan): Promise<void>;
  toolchain(): Promise<Array<Record<string, unknown>>>;
}
