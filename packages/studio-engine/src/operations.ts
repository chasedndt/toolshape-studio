import type {
  AudioTrack,
  CaptionTrack,
  Clip,
  Scene,
  SceneNode,
  SemanticDiff,
  StudioOperation,
  StudioProject,
  Track,
  VideoTrack,
} from "@toolshape/studio-domain";
import { assertStudioProjectValid } from "./validation";
import {
  addRational,
  compareRational,
  rational,
  subtractRational,
} from "./rational";

export class StaleStudioRevisionError extends Error {
  readonly expectedRevision: number;
  readonly actualRevision: number;

  constructor(expectedRevision: number, actualRevision: number) {
    super(`Expected Studio revision ${expectedRevision}, but current revision is ${actualRevision}.`);
    this.name = "StaleStudioRevisionError";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export interface ApplyOperationResult {
  project: StudioProject;
  diff: SemanticDiff;
}

function findScene(project: StudioProject, sceneId: string): Scene {
  const scene = project.scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new RangeError(`Unknown scene: ${sceneId}`);
  }
  return scene;
}

function findNode(scene: Scene, nodeId: string): SceneNode {
  const node = scene.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    throw new RangeError(`Unknown scene node: ${nodeId}`);
  }
  return node;
}

function findTrack(project: StudioProject, trackId: string): Track {
  const track = project.timeline.tracks.find((candidate) => candidate.id === trackId);
  if (!track) {
    throw new RangeError(`Unknown track: ${trackId}`);
  }
  return track;
}

function findClipTrack(project: StudioProject, trackId: string): VideoTrack | AudioTrack {
  const track = findTrack(project, trackId);
  if (track.kind === "caption") {
    throw new TypeError(`Track ${trackId} does not contain clips.`);
  }
  return track;
}

function findCaptionTrack(project: StudioProject, trackId: string): CaptionTrack {
  const track = findTrack(project, trackId);
  if (track.kind !== "caption") {
    throw new TypeError(`Track ${trackId} is not a caption track.`);
  }
  return track;
}

function findClip(track: VideoTrack | AudioTrack, clipId: string): Clip {
  const clip = track.clips.find((candidate) => candidate.id === clipId);
  if (!clip) {
    throw new RangeError(`Unknown clip: ${clipId}`);
  }
  return clip;
}

function incrementNodeAndScene(node: SceneNode, scene: Scene): void {
  node.revision += 1;
  scene.revision += 1;
}

export function applyStudioOperation(
  currentProject: StudioProject,
  operation: StudioOperation,
): ApplyOperationResult {
  if (operation.expectedRevision !== currentProject.revision) {
    throw new StaleStudioRevisionError(operation.expectedRevision, currentProject.revision);
  }

  const project = structuredClone(currentProject);
  const changedPaths: string[] = [];
  let summary = "Studio operation applied.";

  switch (operation.type) {
    case "scene.node.add": {
      const scene = findScene(project, operation.payload.sceneId);
      if (scene.nodes.some((node) => node.id === operation.payload.node.id)) {
        throw new RangeError(`Scene node ID already exists: ${operation.payload.node.id}`);
      }
      scene.nodes.push(structuredClone(operation.payload.node));
      scene.nodeIds.push(operation.payload.node.id);
      scene.revision += 1;
      changedPaths.push(`scenes.${scene.id}.nodes.${operation.payload.node.id}`);
      summary = `Added ${operation.payload.node.type} layer “${operation.payload.node.name}”.`;
      break;
    }
    case "scene.node.update-transform": {
      const scene = findScene(project, operation.payload.sceneId);
      const node = findNode(scene, operation.payload.nodeId);
      node.transform = { ...node.transform, ...operation.payload.patch };
      incrementNodeAndScene(node, scene);
      for (const key of Object.keys(operation.payload.patch)) {
        changedPaths.push(`scenes.${scene.id}.nodes.${node.id}.transform.${key}`);
      }
      summary = `Updated transform for “${node.name}”.`;
      break;
    }
    case "scene.node.update-text": {
      const scene = findScene(project, operation.payload.sceneId);
      const node = findNode(scene, operation.payload.nodeId);
      if (node.type !== "text") {
        throw new TypeError(`Scene node ${node.id} is not editable text.`);
      }
      node.content = operation.payload.content;
      incrementNodeAndScene(node, scene);
      changedPaths.push(`scenes.${scene.id}.nodes.${node.id}.content`);
      summary = `Updated copy for “${node.name}”.`;
      break;
    }
    case "timeline.clip.split": {
      const track = findClipTrack(project, operation.payload.trackId);
      const clipIndex = track.clips.findIndex((clip) => clip.id === operation.payload.clipId);
      if (clipIndex < 0) {
        throw new RangeError(`Unknown clip: ${operation.payload.clipId}`);
      }
      if (track.clips.some((clip) => clip.id === operation.payload.rightClipId)) {
        throw new RangeError(`Split target ID already exists: ${operation.payload.rightClipId}`);
      }
      const clip = track.clips[clipIndex];
      const clipEnd = addRational(clip.start, clip.duration);
      if (
        compareRational(operation.payload.splitAt, clip.start) <= 0 ||
        compareRational(operation.payload.splitAt, clipEnd) >= 0
      ) {
        throw new RangeError("Split time must fall strictly inside the clip.");
      }
      const leftDuration = subtractRational(operation.payload.splitAt, clip.start);
      const rightDuration = subtractRational(clip.duration, leftDuration);
      const rightClip: Clip = {
        ...structuredClone(clip),
        id: operation.payload.rightClipId,
        name: `${clip.name} B`,
        start: operation.payload.splitAt,
        sourceIn: addRational(clip.sourceIn, leftDuration),
        duration: rightDuration,
        revision: clip.revision + 1,
      };
      clip.duration = leftDuration;
      clip.revision += 1;
      track.clips.splice(clipIndex + 1, 0, rightClip);
      project.timeline.revision += 1;
      changedPaths.push(
        `timeline.tracks.${track.id}.clips.${clip.id}.duration`,
        `timeline.tracks.${track.id}.clips.${rightClip.id}`,
      );
      summary = `Split “${clip.name}” at ${operation.payload.splitAt.numerator}/${operation.payload.splitAt.denominator}s.`;
      break;
    }
    case "timeline.clip.trim": {
      const track = findClipTrack(project, operation.payload.trackId);
      const clip = findClip(track, operation.payload.clipId);
      if (compareRational(operation.payload.newDuration, rational(0)) <= 0) {
        throw new RangeError("Trimmed duration must remain positive.");
      }
      const previousStart = clip.start;
      const previousEnd = addRational(clip.start, clip.duration);
      const sourceDelta = subtractRational(operation.payload.newStart, previousStart);
      const nextSourceIn = addRational(clip.sourceIn, sourceDelta);
      if (compareRational(nextSourceIn, rational(0)) < 0) {
        throw new RangeError("Trim would read before the immutable source asset.");
      }
      const nextEnd = addRational(operation.payload.newStart, operation.payload.newDuration);
      const rippleDelta = subtractRational(nextEnd, previousEnd);
      clip.start = operation.payload.newStart;
      clip.sourceIn = nextSourceIn;
      clip.duration = operation.payload.newDuration;
      clip.revision += 1;
      if (operation.payload.ripple) {
        for (const candidate of track.clips) {
          if (candidate.id !== clip.id && compareRational(candidate.start, previousEnd) >= 0) {
            candidate.start = addRational(candidate.start, rippleDelta);
            candidate.revision += 1;
            changedPaths.push(`timeline.tracks.${track.id}.clips.${candidate.id}.start`);
          }
        }
      }
      project.timeline.revision += 1;
      changedPaths.push(
        `timeline.tracks.${track.id}.clips.${clip.id}.start`,
        `timeline.tracks.${track.id}.clips.${clip.id}.sourceIn`,
        `timeline.tracks.${track.id}.clips.${clip.id}.duration`,
      );
      summary = `${operation.payload.ripple ? "Ripple t" : "T"}rimmed “${clip.name}”.`;
      break;
    }
    case "timeline.clip.set-audio": {
      const track = findClipTrack(project, operation.payload.trackId);
      if (track.kind !== "audio") {
        throw new TypeError("Audio settings can only be edited on an audio track.");
      }
      const clip = findClip(track, operation.payload.clipId);
      clip.audio = {
        gainDb: operation.payload.gainDb,
        muted: operation.payload.muted,
        fadeIn: operation.payload.fadeIn,
        fadeOut: operation.payload.fadeOut,
      };
      clip.revision += 1;
      project.timeline.revision += 1;
      changedPaths.push(`timeline.tracks.${track.id}.clips.${clip.id}.audio`);
      summary = `Updated gain, mute and fades for “${clip.name}”.`;
      break;
    }
    case "timeline.caption.upsert": {
      const track = findCaptionTrack(project, operation.payload.trackId);
      const index = track.segments.findIndex((segment) => segment.id === operation.payload.segment.id);
      if (index >= 0) {
        track.segments[index] = structuredClone(operation.payload.segment);
      } else {
        track.segments.push(structuredClone(operation.payload.segment));
      }
      track.segments.sort((left, right) => compareRational(left.start, right.start));
      project.timeline.revision += 1;
      changedPaths.push(`timeline.tracks.${track.id}.segments.${operation.payload.segment.id}`);
      summary = `${index >= 0 ? "Updated" : "Added"} an editable caption segment.`;
      break;
    }
    case "animation.keyframe.set": {
      const scene = findScene(project, operation.payload.sceneId);
      const node = findNode(scene, operation.payload.nodeId);
      const channel = [...(node.animations[operation.payload.property] ?? [])];
      const index = channel.findIndex((keyframe) => keyframe.id === operation.payload.keyframe.id);
      if (index >= 0) {
        channel[index] = structuredClone(operation.payload.keyframe);
      } else {
        channel.push(structuredClone(operation.payload.keyframe));
      }
      channel.sort((left, right) => compareRational(left.time, right.time));
      node.animations[operation.payload.property] = channel;
      incrementNodeAndScene(node, scene);
      changedPaths.push(
        `scenes.${scene.id}.nodes.${node.id}.animations.${operation.payload.property}`,
      );
      summary = `Set an easing keyframe on “${node.name}”.`;
      break;
    }
    case "effect.blur.set": {
      if (operation.payload.radius < 0 || operation.payload.radius > 100) {
        throw new RangeError("Blur radius must be between 0 and 100.");
      }
      const scene = findScene(project, operation.payload.sceneId);
      const node = findNode(scene, operation.payload.nodeId);
      const existing = project.effects.find((effect) => effect.id === operation.payload.effectId);
      if (existing) {
        existing.radius = operation.payload.radius;
        existing.enabled = operation.payload.enabled;
      } else {
        project.effects.push({
          id: operation.payload.effectId,
          type: "blur",
          radius: operation.payload.radius,
          enabled: operation.payload.enabled,
        });
      }
      if (!node.effectIds.includes(operation.payload.effectId)) {
        node.effectIds.push(operation.payload.effectId);
      }
      incrementNodeAndScene(node, scene);
      changedPaths.push(
        `effects.${operation.payload.effectId}`,
        `scenes.${scene.id}.nodes.${node.id}.effectIds`,
      );
      summary = `Set blur to ${operation.payload.radius}px on “${node.name}”.`;
      break;
    }
    case "style.profile.apply": {
      project.styleProfileRef = structuredClone(operation.payload.styleProfileRef);
      changedPaths.push("styleProfileRef");
      summary = `Applied style profile “${operation.payload.styleProfileRef.name}” v${operation.payload.styleProfileRef.version}.`;
      break;
    }
  }

  const beforeRevision = currentProject.revision;
  project.revision += 1;
  project.provenance.push({
    operationId: operation.operationId,
    type: operation.type,
    actor: operation.actor,
    beforeRevision,
    afterRevision: project.revision,
  });
  assertStudioProjectValid(project);

  return {
    project,
    diff: {
      operationId: operation.operationId,
      summary,
      changedPaths,
      beforeRevision,
      afterRevision: project.revision,
    },
  };
}

