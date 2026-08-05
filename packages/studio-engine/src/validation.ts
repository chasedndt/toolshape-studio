import type {
  Asset,
  Clip,
  RationalTime,
  Scene,
  StudioProject,
  Track,
} from "@toolshape/studio-domain";
import { addRational, compareRational, rational, toSeconds } from "./rational";

export interface ValidationIssue {
  code: string;
  severity: "error" | "warning";
  path: string;
  message: string;
}

function validateAsset(asset: Asset, index: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (asset.immutable !== true) {
    issues.push({
      code: "asset.mutable-source",
      severity: "error",
      path: `assets[${index}].immutable`,
      message: "Source assets must be immutable.",
    });
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(asset.contentHash)) {
    issues.push({
      code: "asset.invalid-content-hash",
      severity: "error",
      path: `assets[${index}].contentHash`,
      message: "Assets require a SHA-256 content hash.",
    });
  }
  if (
    !asset.sourceRef.startsWith("fixture://") &&
    !asset.sourceRef.startsWith("asset://") &&
    !/^content:\/\/sha256\/[a-f0-9]{64}$/i.test(asset.sourceRef)
  ) {
    issues.push({
      code: "asset.unsafe-source-reference",
      severity: "error",
      path: `assets[${index}].sourceRef`,
      message: "Persisted assets use an opaque fixture://, asset://, or content://sha256 reference.",
    });
  }
  for (const [derivativeIndex, derivative] of asset.derivatives.entries()) {
    const derivativePath = `assets[${index}].derivatives[${derivativeIndex}]`;
    if (!/^sha256:[a-f0-9]{64}$/i.test(derivative.contentHash)) {
      issues.push({
        code: "asset.derivative-invalid-content-hash",
        severity: "error",
        path: `${derivativePath}.contentHash`,
        message: "Derived assets require a SHA-256 content hash.",
      });
    }
    if (!/^content:\/\/sha256\/[a-f0-9]{64}$/i.test(derivative.sourceRef)) {
      issues.push({
        code: "asset.derivative-unsafe-source-reference",
        severity: "error",
        path: `${derivativePath}.sourceRef`,
        message: "Derived assets require an immutable content-addressed source reference.",
      });
    }
    if (derivative.immutable !== true) {
      issues.push({
        code: "asset.derivative-mutable",
        severity: "error",
        path: `${derivativePath}.immutable`,
        message: "Derived assets must be immutable.",
      });
    }
  }
  return issues;
}

function validateClip(
  clip: Clip,
  track: Track,
  timelineDuration: RationalTime,
  sourceDuration: RationalTime | undefined,
  path: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (compareRational(clip.start, rational(0)) < 0 || compareRational(clip.sourceIn, rational(0)) < 0) {
    issues.push({
      code: "timeline.negative-time",
      severity: "error",
      path,
      message: "Clip start and source-in must be non-negative.",
    });
  }
  if (compareRational(clip.duration, rational(0)) <= 0) {
    issues.push({
      code: "timeline.non-positive-duration",
      severity: "error",
      path: `${path}.duration`,
      message: "Clip duration must be positive.",
    });
  }
  if (compareRational(addRational(clip.start, clip.duration), timelineDuration) > 0) {
    issues.push({
      code: "timeline.clip-after-end",
      severity: "warning",
      path,
      message: `${track.kind} clip extends beyond the timeline duration.`,
    });
  }
  if (sourceDuration && compareRational(addRational(clip.sourceIn, clip.duration), sourceDuration) > 0) {
    issues.push({
      code: "timeline.clip-after-source",
      severity: "error",
      path,
      message: `${track.kind} clip reads beyond the immutable source duration.`,
    });
  }
  if (clip.audio) {
    if (clip.audio.gainDb < -96 || clip.audio.gainDb > 24) {
      issues.push({
        code: "audio.gain-out-of-range",
        severity: "error",
        path: `${path}.audio.gainDb`,
        message: "Audio gain must remain between -96 dB and +24 dB.",
      });
    }
    const fades = addRational(clip.audio.fadeIn, clip.audio.fadeOut);
    if (compareRational(fades, clip.duration) > 0) {
      issues.push({
        code: "audio.fades-exceed-clip",
        severity: "error",
        path: `${path}.audio`,
        message: "Combined fades cannot exceed clip duration.",
      });
    }
  }
  return issues;
}

function validateScene(scene: Scene, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const listed = new Set(scene.nodeIds);
  for (const [index, node] of scene.nodes.entries()) {
    const nodePath = `${path}.nodes[${index}]`;
    if (!listed.has(node.id)) {
      issues.push({
        code: "scene.node-not-listed",
        severity: "error",
        path: nodePath,
        message: "Every scene node must appear in nodeIds.",
      });
    }
    if (node.transform.opacity < 0 || node.transform.opacity > 1) {
      issues.push({
        code: "scene.opacity-out-of-range",
        severity: "error",
        path: `${nodePath}.transform.opacity`,
        message: "Opacity must be between 0 and 1.",
      });
    }
    if (node.type === "text") {
      if (!node.fontFamily.trim()) {
        issues.push({
          code: "text.missing-font",
          severity: "error",
          path: `${nodePath}.fontFamily`,
          message: "Text nodes require an explicit font family.",
        });
      }
      const approximateLineWidth = node.content.length * node.fontSize * 0.55;
      if (approximateLineWidth > node.size.width * Math.max(1, node.maxLines)) {
        issues.push({
          code: "text.overflow-risk",
          severity: "warning",
          path: `${nodePath}.content`,
          message: "Text is likely to overflow its declared bounds.",
        });
      }
    }
    if (node.type === "text" || node.type === "image") {
      const right = node.transform.x + node.size.width * node.transform.scaleX;
      const bottom = node.transform.y + node.size.height * node.transform.scaleY;
      const outside =
        node.transform.x < scene.safeArea.left ||
        node.transform.y < scene.safeArea.top ||
        right > scene.size.width - scene.safeArea.right ||
        bottom > scene.size.height - scene.safeArea.bottom;
      if (outside) {
        issues.push({
          code: "scene.safe-area-risk",
          severity: "warning",
          path: nodePath,
          message: "Visible content extends outside the declared safe area.",
        });
      }
    }
  }
  if (listed.size !== scene.nodes.length) {
    issues.push({
      code: "scene.node-list-mismatch",
      severity: "error",
      path: `${path}.nodeIds`,
      message: "nodeIds must contain each node exactly once.",
    });
  }
  return issues;
}

export function validateStudioProject(project: StudioProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Map<string, string>();
  const register = (id: string, path: string): void => {
    const existing = ids.get(id);
    if (existing) {
      issues.push({
        code: "project.duplicate-id",
        severity: "error",
        path,
        message: `ID ${id} is already used at ${existing}.`,
      });
    } else {
      ids.set(id, path);
    }
  };

  register(project.id, "id");
  project.assets.forEach((asset, index) => {
    register(asset.id, `assets[${index}].id`);
    issues.push(...validateAsset(asset, index));
  });
  project.effects.forEach((effect, index) => register(effect.id, `effects[${index}].id`));
  project.scenes.forEach((scene, sceneIndex) => {
    const scenePath = `scenes[${sceneIndex}]`;
    register(scene.id, `${scenePath}.id`);
    scene.nodes.forEach((node, nodeIndex) => register(node.id, `${scenePath}.nodes[${nodeIndex}].id`));
    issues.push(...validateScene(scene, scenePath));
  });

  register(project.timeline.id, "timeline.id");
  for (const [trackIndex, track] of project.timeline.tracks.entries()) {
    const trackPath = `timeline.tracks[${trackIndex}]`;
    register(track.id, `${trackPath}.id`);
    if (track.kind === "caption") {
      for (const [segmentIndex, segment] of track.segments.entries()) {
        const segmentPath = `${trackPath}.segments[${segmentIndex}]`;
        register(segment.id, `${segmentPath}.id`);
        if (compareRational(segment.start, segment.end) >= 0) {
          issues.push({
            code: "caption.invalid-timing",
            severity: "error",
            path: segmentPath,
            message: "Caption start must be before its end.",
          });
        }
        if (compareRational(segment.end, project.timeline.duration) > 0) {
          issues.push({
            code: "caption.after-timeline",
            severity: "error",
            path: segmentPath,
            message: "Caption ends after the timeline.",
          });
        }
      }
    } else {
      for (const [clipIndex, clip] of track.clips.entries()) {
        const clipPath = `${trackPath}.clips[${clipIndex}]`;
        register(clip.id, `${clipPath}.id`);
        const source = project.assets.find((asset) => asset.id === clip.assetId);
        if (!source) {
          issues.push({
            code: "timeline.clip-source-missing",
            severity: "error",
            path: `${clipPath}.assetId`,
            message: `${track.kind} clip references a missing source asset.`,
          });
        }
        issues.push(...validateClip(clip, track, project.timeline.duration, source?.duration, clipPath));
      }
    }
  }

  if (!project.scenes.some((scene) => scene.id === project.activeSceneId)) {
    issues.push({
      code: "project.active-scene-missing",
      severity: "error",
      path: "activeSceneId",
      message: "activeSceneId must reference an existing scene.",
    });
  }
  if (toSeconds(project.timeline.duration) <= 0) {
    issues.push({
      code: "timeline.invalid-duration",
      severity: "error",
      path: "timeline.duration",
      message: "Timeline duration must be positive.",
    });
  }

  return issues;
}

export function assertStudioProjectValid(project: StudioProject): void {
  const errors = validateStudioProject(project).filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new StudioValidationError(errors);
  }
}

export class StudioValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.code}: ${issue.message}`).join("\n"));
    this.name = "StudioValidationError";
    this.issues = issues;
  }
}
