import path from "node:path";
import type { Scene } from "@toolshape/studio-domain";
import { SceneRenderError, renderSceneToSvg, type RenderSceneToSvgOptions } from "./scene-svg";

/**
 * Plans a design export.
 *
 * Every format is produced from one SVG rather than from its own renderer, so a
 * PNG and a PDF of the same scene cannot disagree about where the text sits.
 * The plan is pure and fully checked — dimensions, format, path, background —
 * and the only thing left for the executor to do is turn the document into
 * bytes. That split is what makes the whole export testable without a browser
 * anywhere near it.
 */

export type ImageExportFormat = "svg" | "png" | "jpeg" | "webp" | "pdf";

export interface ImageExportPlan {
  format: ImageExportFormat;
  /** The rendered SVG document. For `svg` this is the deliverable itself. */
  document: string;
  mediaType: string;
  /** Pixel dimensions of the raster output, or the point size of the PDF page. */
  width: number;
  height: number;
  /** Multiplier applied to the scene's own size. */
  scale: number;
  finalOutputPath: string;
  partialOutputPath: string;
  /**
   * Quality for lossy formats, 1-100.
   *
   * Null for the lossless ones rather than a default that quietly does nothing,
   * so a caller who set quality on a PNG finds out instead of assuming it took.
   */
  quality: number | null;
  /**
   * Whether the format keeps the alpha channel.
   *
   * A scene with a transparent background exported to JPEG has to become
   * something, and silently compositing it onto black produces a file the
   * designer did not ask for.
   */
  transparent: boolean;
}

export interface CreateImageExportPlanInput extends RenderSceneToSvgOptions {
  scene: Scene;
  outputPath: string;
  /** Defaults to the extension of the output path. */
  format?: ImageExportFormat;
  scale?: number;
  quality?: number;
  /** Drop the scene background so the export carries alpha. Raster and SVG only. */
  transparentBackground?: boolean;
}

const FORMATS: Record<ImageExportFormat, { mediaType: string; lossy: boolean; alpha: boolean }> = {
  svg: { mediaType: "image/svg+xml", lossy: false, alpha: true },
  png: { mediaType: "image/png", lossy: false, alpha: true },
  jpeg: { mediaType: "image/jpeg", lossy: true, alpha: false },
  webp: { mediaType: "image/webp", lossy: true, alpha: true },
  pdf: { mediaType: "application/pdf", lossy: false, alpha: false },
};

const EXTENSIONS: Record<string, ImageExportFormat> = {
  ".svg": "svg",
  ".png": "png",
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".webp": "webp",
  ".pdf": "pdf",
};

/**
 * A ceiling on the rasterised area rather than on either dimension.
 *
 * A 20000x20 export is harmless and a 6000x6000 one is not, so the limit that
 * matters is the pixel count — roughly 100 megapixels, past which the raster
 * buffer alone runs to hundreds of megabytes.
 */
const MAX_PIXELS = 100_000_000;

export function createImageExportPlan(input: CreateImageExportPlanInput): ImageExportPlan {
  const { scene, outputPath } = input;

  if (/[\r\n]/.test(outputPath) || outputPath.trim().length === 0) {
    throw new SceneRenderError("Output path contains an invalid control character.");
  }

  const extension = path.extname(outputPath).toLowerCase();
  const format = input.format ?? EXTENSIONS[extension];
  if (!format) {
    throw new SceneRenderError(
      `Cannot infer an export format from ${JSON.stringify(extension || outputPath)}. Supported: ${Object.keys(FORMATS).join(", ")}.`,
    );
  }
  if (!(format in FORMATS)) {
    throw new SceneRenderError(`Unsupported export format ${JSON.stringify(format)}.`);
  }
  // An explicit format that disagrees with the path is refused rather than
  // resolved. Writing PNG bytes to a file called .jpeg produces something no
  // viewer opens by name and no pipeline can trust by extension.
  if (input.format && EXTENSIONS[extension] && EXTENSIONS[extension] !== input.format) {
    throw new SceneRenderError(
      `Format ${input.format} does not match the output path extension ${extension}.`,
    );
  }

  const descriptor = FORMATS[format];

  const scale = input.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new SceneRenderError("Export scale must be a positive number.");
  }

  const width = Math.round(scene.size.width * scale);
  const height = Math.round(scene.size.height * scale);
  if (width <= 0 || height <= 0) {
    throw new SceneRenderError("Export scale rounds the output down to nothing.");
  }
  if (width * height > MAX_PIXELS) {
    throw new SceneRenderError(
      `Export of ${width}x${height} exceeds the ${MAX_PIXELS / 1_000_000} megapixel limit.`,
    );
  }

  if (input.quality !== undefined) {
    if (!descriptor.lossy) {
      throw new SceneRenderError(`Quality does not apply to ${format}, which is lossless.`);
    }
    if (!Number.isInteger(input.quality) || input.quality < 1 || input.quality > 100) {
      throw new SceneRenderError("Export quality must be an integer between 1 and 100.");
    }
  }

  const transparent = input.transparentBackground === true;
  if (transparent && !descriptor.alpha) {
    throw new SceneRenderError(
      `${format} has no alpha channel, so a transparent background cannot be preserved.`,
    );
  }

  const document = renderSceneToSvg(
    transparent ? { ...scene, background: "#00000000" } : scene,
    { ...input, standalone: format === "svg" },
  );

  const parsed = path.parse(outputPath);
  const partialOutputPath = path.join(parsed.dir, `${parsed.name}.partial${parsed.ext}`);

  return {
    format,
    document,
    mediaType: descriptor.mediaType,
    width,
    height,
    scale,
    finalOutputPath: outputPath,
    partialOutputPath,
    quality: descriptor.lossy ? (input.quality ?? 90) : null,
    transparent,
  };
}

/**
 * Exports every scene in a set to one format.
 *
 * The point of the variant work was producing nine sizes at once, so exporting
 * them one call at a time would have handed the batching problem straight back
 * to the caller. Names are derived from scene ids, which are already unique,
 * rather than from scene names, which are not.
 */
export function createVariantExportPlans(input: {
  scenes: readonly Scene[];
  directory: string;
  format: ImageExportFormat;
  scale?: number;
  quality?: number;
  transparentBackground?: boolean;
  effects?: RenderSceneToSvgOptions["effects"];
  imageData?: RenderSceneToSvgOptions["imageData"];
}): ImageExportPlan[] {
  if (input.scenes.length === 0) {
    throw new SceneRenderError("A variant export needs at least one scene.");
  }
  const extension = input.format === "jpeg" ? ".jpg" : `.${input.format}`;
  const seen = new Set<string>();

  return input.scenes.map((scene) => {
    const name = scene.id.replace(/[^A-Za-z0-9._-]/g, "-");
    if (seen.has(name)) {
      throw new SceneRenderError(`Two scenes resolve to the same export filename ${name}${extension}.`);
    }
    seen.add(name);
    return createImageExportPlan({
      scene,
      outputPath: path.join(input.directory, `${name}${extension}`),
      format: input.format,
      scale: input.scale,
      quality: input.quality,
      transparentBackground: input.transparentBackground,
      effects: input.effects,
      imageData: input.imageData,
    });
  });
}
