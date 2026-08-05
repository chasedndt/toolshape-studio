import type {
  AudioTrack,
  CaptionTrack,
  CaptureDocument,
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
import { reframeScene } from "./variants";
import {
  addRational,
  compareRational,
  divideRational,
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

function findCapture(project: StudioProject, captureId: string): CaptureDocument {
  const capture = project.captures.find((candidate) => candidate.id === captureId);
  if (!capture) {
    throw new RangeError(`Unknown capture: ${captureId}`);
  }
  return capture;
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
    case "timeline.clip.move": {
      const track = findClipTrack(project, operation.payload.trackId);
      const clip = findClip(track, operation.payload.clipId);
      if (compareRational(operation.payload.newStart, rational(0)) < 0) {
        throw new RangeError("A clip cannot move before the start of the timeline.");
      }
      const previousStart = clip.start;
      const delta = subtractRational(operation.payload.newStart, previousStart);
      // A move repositions; it does not change what the clip reads. sourceIn
      // and duration are deliberately untouched — that is what makes this
      // different from a trim.
      clip.start = operation.payload.newStart;
      clip.revision += 1;
      if (operation.payload.ripple) {
        for (const candidate of track.clips) {
          if (candidate.id !== clip.id && compareRational(candidate.start, previousStart) > 0) {
            candidate.start = addRational(candidate.start, delta);
            candidate.revision += 1;
            changedPaths.push(`timeline.tracks.${track.id}.clips.${candidate.id}.start`);
          }
        }
      }
      project.timeline.revision += 1;
      changedPaths.push(`timeline.tracks.${track.id}.clips.${clip.id}.start`);
      summary = `Moved “${clip.name}”.`;
      break;
    }
    case "timeline.clip.set-speed": {
      const track = findClipTrack(project, operation.payload.trackId);
      const clip = findClip(track, operation.payload.clipId);
      if (compareRational(operation.payload.speed, rational(0)) <= 0) {
        throw new RangeError("Clip speed must be positive.");
      }
      const previousEnd = addRational(clip.start, clip.duration);
      // Exact division, so repeated speed changes round-trip without drift.
      const nextDuration = divideRational(clip.duration, operation.payload.speed);
      if (compareRational(nextDuration, rational(0)) <= 0) {
        throw new RangeError("Speed change would collapse the clip to nothing.");
      }
      clip.duration = nextDuration;
      clip.revision += 1;
      if (operation.payload.ripple) {
        const rippleDelta = subtractRational(addRational(clip.start, nextDuration), previousEnd);
        for (const candidate of track.clips) {
          if (candidate.id !== clip.id && compareRational(candidate.start, previousEnd) >= 0) {
            candidate.start = addRational(candidate.start, rippleDelta);
            candidate.revision += 1;
            changedPaths.push(`timeline.tracks.${track.id}.clips.${candidate.id}.start`);
          }
        }
      }
      project.timeline.revision += 1;
      changedPaths.push(`timeline.tracks.${track.id}.clips.${clip.id}.duration`);
      summary = `Set “${clip.name}” to ${operation.payload.speed.numerator}/${operation.payload.speed.denominator}x speed.`;
      break;
    }
    case "timeline.clip.duplicate": {
      const track = findClipTrack(project, operation.payload.trackId);
      const clip = findClip(track, operation.payload.clipId);
      if (track.clips.some((candidate) => candidate.id === operation.payload.newClipId)) {
        throw new RangeError(`Clip already exists: ${operation.payload.newClipId}`);
      }
      if (compareRational(operation.payload.at, rational(0)) < 0) {
        throw new RangeError("A duplicate cannot start before the timeline.");
      }
      // References the same immutable asset. Duplication copies a view of the
      // source, never the media itself (ADR 0002).
      const copy = structuredClone(clip);
      copy.id = operation.payload.newClipId;
      copy.name = `${clip.name} copy`;
      copy.start = operation.payload.at;
      copy.revision = 0;
      track.clips.push(copy);
      track.clips.sort((left, right) => compareRational(left.start, right.start));
      project.timeline.revision += 1;
      changedPaths.push(`timeline.tracks.${track.id}.clips.${copy.id}`);
      summary = `Duplicated “${clip.name}”.`;
      break;
    }
    case "timeline.clip.delete": {
      const track = findClipTrack(project, operation.payload.trackId);
      const clip = findClip(track, operation.payload.clipId);
      if (track.clips.length <= 1) {
        throw new RangeError("Cannot delete the last clip on a track.");
      }
      const removedStart = clip.start;
      const removedDuration = clip.duration;
      track.clips = track.clips.filter((candidate) => candidate.id !== clip.id);
      // A transition is a boundary between two clips. Removing one clip leaves
      // the other holding half a transition, so it goes with it.
      if (track.kind === "video" && track.transitions) {
        track.transitions = track.transitions.filter(
          (candidate) => candidate.fromClipId !== clip.id && candidate.toClipId !== clip.id,
        );
      }
      if (operation.payload.ripple) {
        for (const candidate of track.clips) {
          if (compareRational(candidate.start, removedStart) >= 0) {
            candidate.start = subtractRational(candidate.start, removedDuration);
            candidate.revision += 1;
            changedPaths.push(`timeline.tracks.${track.id}.clips.${candidate.id}.start`);
          }
        }
      }
      project.timeline.revision += 1;
      changedPaths.push(`timeline.tracks.${track.id}.clips.${clip.id}`);
      summary = `${operation.payload.ripple ? "Ripple d" : "D"}eleted “${clip.name}”.`;
      break;
    }
    case "timeline.clip.merge": {
      const track = findClipTrack(project, operation.payload.trackId);
      const left = findClip(track, operation.payload.leftClipId);
      const right = findClip(track, operation.payload.rightClipId);
      if (left.id === right.id) {
        throw new RangeError("Cannot merge a clip with itself.");
      }
      if (left.assetId !== right.assetId) {
        throw new RangeError("Only clips reading the same source asset can be merged.");
      }
      // Deliberately narrow: merging is the inverse of a split, so it accepts
      // exactly the shape a split produces. Joining clips that are not
      // contiguous in the source would invent footage that never existed.
      if (compareRational(addRational(left.start, left.duration), right.start) !== 0) {
        throw new RangeError("Clips must be adjacent on the timeline to merge.");
      }
      if (compareRational(addRational(left.sourceIn, left.duration), right.sourceIn) !== 0) {
        throw new RangeError("Clips must be contiguous in the source to merge.");
      }
      left.duration = addRational(left.duration, right.duration);
      left.revision += 1;
      track.clips = track.clips.filter((candidate) => candidate.id !== right.id);
      project.timeline.revision += 1;
      changedPaths.push(
        `timeline.tracks.${track.id}.clips.${left.id}.duration`,
        `timeline.tracks.${track.id}.clips.${right.id}`,
      );
      summary = `Merged “${right.name}” into “${left.name}”.`;
      break;
    }
    case "timeline.clip.reorder": {
      const track = findClipTrack(project, operation.payload.trackId);
      const clip = findClip(track, operation.payload.clipId);
      const ordered = [...track.clips].sort((a, b) => compareRational(a.start, b.start));
      if (operation.payload.toIndex < 0 || operation.payload.toIndex >= ordered.length) {
        throw new RangeError(`Reorder index is out of range: ${operation.payload.toIndex}`);
      }
      const from = ordered.findIndex((candidate) => candidate.id === clip.id);
      const [moved] = ordered.splice(from, 1);
      ordered.splice(operation.payload.toIndex, 0, moved);
      // Re-pack end to end. Reordering without repacking would leave every clip
      // where it was, which is a visual no-op and not what the operation means.
      let cursor = rational(0);
      for (const candidate of ordered) {
        candidate.start = cursor;
        candidate.revision += 1;
        cursor = addRational(cursor, candidate.duration);
        changedPaths.push(`timeline.tracks.${track.id}.clips.${candidate.id}.start`);
      }
      track.clips = ordered;
      project.timeline.revision += 1;
      summary = `Reordered “${clip.name}” to position ${operation.payload.toIndex + 1}.`;
      break;
    }
    case "timeline.clip.insert": {
      const track = findClipTrack(project, operation.payload.trackId);
      if (track.clips.some((candidate) => candidate.id === operation.payload.clip.id)) {
        throw new RangeError(`Clip already exists: ${operation.payload.clip.id}`);
      }
      const inserted = structuredClone(operation.payload.clip);
      if (operation.payload.ripple) {
        for (const candidate of track.clips) {
          if (compareRational(candidate.start, inserted.start) >= 0) {
            candidate.start = addRational(candidate.start, inserted.duration);
            candidate.revision += 1;
            changedPaths.push(`timeline.tracks.${track.id}.clips.${candidate.id}.start`);
          }
        }
      }
      track.clips.push(inserted);
      track.clips.sort((left, right) => compareRational(left.start, right.start));
      project.timeline.revision += 1;
      changedPaths.push(`timeline.tracks.${track.id}.clips.${inserted.id}`);
      summary = `Inserted “${inserted.name}”.`;
      break;
    }
    case "capture.zoom.set-plan": {
      const capture = findCapture(project, operation.payload.captureId);
      // Marked authored, so a later derivation cannot silently overwrite a
      // decision a person or an agent deliberately made (CAP-5).
      capture.zoomPlan = { ...structuredClone(operation.payload.plan), derived: false };
      capture.zoomPlan.revision += 1;
      capture.revision += 1;
      changedPaths.push(`captures.${capture.id}.zoomPlan`);
      summary = `Set an authored zoom plan on “${capture.source.label}”.`;
      break;
    }
    case "capture.redaction.add": {
      const capture = findCapture(project, operation.payload.captureId);
      if (capture.redactions.some((candidate) => candidate.id === operation.payload.redaction.id)) {
        throw new RangeError(`Redaction already exists: ${operation.payload.redaction.id}`);
      }
      capture.redactions.push(structuredClone(operation.payload.redaction));
      capture.revision += 1;
      changedPaths.push(`captures.${capture.id}.redactions.${operation.payload.redaction.id}`);
      summary = `Added a ${operation.payload.redaction.kind} redaction to “${capture.source.label}”.`;
      break;
    }
    case "capture.redaction.remove": {
      const capture = findCapture(project, operation.payload.captureId);
      const existing = capture.redactions.find((candidate) => candidate.id === operation.payload.redactionId);
      if (!existing) {
        throw new RangeError(`Unknown redaction: ${operation.payload.redactionId}`);
      }
      capture.redactions = capture.redactions.filter((candidate) => candidate.id !== existing.id);
      capture.revision += 1;
      changedPaths.push(`captures.${capture.id}.redactions.${existing.id}`);
      summary = `Removed a ${existing.kind} redaction from “${capture.source.label}”.`;
      break;
    }
    case "timeline.transition.set": {
      const track = findClipTrack(project, operation.payload.trackId);
      if (track.kind !== "video") {
        throw new TypeError("Transitions are only supported on video tracks.");
      }
      const from = findClip(track, operation.payload.transition.fromClipId);
      const to = findClip(track, operation.payload.transition.toClipId);
      if (compareRational(operation.payload.transition.duration, rational(0)) <= 0) {
        throw new RangeError("Transition duration must be positive.");
      }
      // Adjacency is required because a transition is a boundary, not a
      // free-floating overlay: two clips with a gap between them have nothing
      // to cross-fade through.
      if (compareRational(addRational(from.start, from.duration), to.start) !== 0) {
        throw new RangeError("A transition requires the two clips to be adjacent.");
      }
      // It consumes tail and head, so neither clip may be shorter than it.
      if (
        compareRational(operation.payload.transition.duration, from.duration) > 0 ||
        compareRational(operation.payload.transition.duration, to.duration) > 0
      ) {
        throw new RangeError("A transition cannot be longer than either clip it joins.");
      }

      track.transitions ??= [];
      const existing = track.transitions.findIndex(
        (candidate) =>
          candidate.id === operation.payload.transition.id ||
          (candidate.fromClipId === from.id && candidate.toClipId === to.id),
      );
      const next = structuredClone(operation.payload.transition);
      if (existing >= 0) {
        next.revision = track.transitions[existing].revision + 1;
        track.transitions[existing] = next;
      } else {
        next.revision = 0;
        track.transitions.push(next);
      }
      project.timeline.revision += 1;
      changedPaths.push(`timeline.tracks.${track.id}.transitions.${next.id}`);
      summary = `Set a ${next.kind} between “${from.name}” and “${to.name}”.`;
      break;
    }
    case "timeline.transition.remove": {
      const track = findClipTrack(project, operation.payload.trackId);
      if (track.kind !== "video") {
        throw new TypeError("Transitions are only supported on video tracks.");
      }
      const existing = (track.transitions ?? []).find(
        (candidate) => candidate.id === operation.payload.transitionId,
      );
      if (!existing) {
        throw new RangeError(`Unknown transition: ${operation.payload.transitionId}`);
      }
      track.transitions = (track.transitions ?? []).filter((candidate) => candidate.id !== existing.id);
      project.timeline.revision += 1;
      changedPaths.push(`timeline.tracks.${track.id}.transitions.${existing.id}`);
      summary = `Removed a ${existing.kind} transition.`;
      break;
    }
    case "capture.to-scene": {
      const capture = findCapture(project, operation.payload.captureId);
      if (project.timeline.tracks.some((track) => track.id === operation.payload.trackId)) {
        throw new RangeError(`Track already exists: ${operation.payload.trackId}`);
      }
      const media = project.assets.find((asset) => asset.id === capture.mediaAssetId);
      if (!media) {
        throw new RangeError(`Capture media is not a project asset: ${capture.mediaAssetId}`);
      }

      // A capture's declared duration and its media should agree, but if they
      // disagree the clip is clamped to what the source actually contains.
      // Projecting the longer figure would produce a clip reading past the end
      // of its own asset, which the validator rejects — better to make the
      // projection usable and let validation report the capture itself.
      const projectedDuration = media.duration && compareRational(capture.duration, media.duration) > 0
        ? media.duration
        : capture.duration;

      // The capture is projected, not consumed. Its cursor, event and window
      // tracks stay intact so a zoom plan can still be re-derived after the
      // scene has been edited (CAP-7).
      const clip: Clip = {
        id: `clip-${capture.id}`,
        name: capture.source.label,
        assetId: capture.mediaAssetId,
        start: rational(0),
        duration: structuredClone(projectedDuration),
        sourceIn: rational(0),
        revision: 0,
        audio: { gainDb: 0, muted: false, fadeIn: rational(0), fadeOut: rational(0) },
        effectIds: [],
      };
      project.timeline.tracks.push({
        id: operation.payload.trackId,
        kind: "video",
        name: capture.source.label,
        locked: false,
        clips: [clip],
      });

      // A projection that left the timeline shorter than the clip would produce
      // a project that fails its own validation.
      if (compareRational(projectedDuration, project.timeline.duration) > 0) {
        project.timeline.duration = structuredClone(projectedDuration);
      }
      project.timeline.revision += 1;
      changedPaths.push(`timeline.tracks.${operation.payload.trackId}`);
      summary = `Projected “${capture.source.label}” onto the timeline.`;
      break;
    }
    case "design.variant.create": {
      const scene = findScene(project, operation.payload.sceneId);
      if (operation.payload.width <= 0 || operation.payload.height <= 0) {
        throw new RangeError("Variant dimensions must be positive.");
      }
      const variant = reframeScene({
        scene,
        format: {
          id: operation.payload.formatId,
          name: operation.payload.formatName,
          size: { width: operation.payload.width, height: operation.payload.height },
        },
      });
      if (project.scenes.some((candidate) => candidate.id === variant.id)) {
        throw new RangeError(`Variant already exists: ${variant.id}`);
      }
      project.scenes.push(variant);
      changedPaths.push(`scenes.${variant.id}`);
      summary = `Created the ${operation.payload.formatName} variant of “${scene.name}”.`;
      break;
    }
    case "design.data.bind": {
      const scene = findScene(project, operation.payload.sceneId);
      const entries = Object.entries(operation.payload.values);
      if (entries.length === 0) {
        throw new RangeError("Data binding requires at least one value.");
      }
      for (const [nodeId, value] of entries) {
        const node = findNode(scene, nodeId);
        // Rejected rather than skipped: a bulk run that silently ignores a
        // mismatched column produces a hundred designs missing the same field,
        // and nobody notices until they are published.
        if (node.type !== "text") {
          throw new TypeError(`Cannot bind data to a ${node.type} layer: ${nodeId}`);
        }
        node.content = value;
        incrementNodeAndScene(node, scene);
        changedPaths.push(`scenes.${scene.id}.nodes.${node.id}.content`);
      }
      summary = `Bound ${entries.length} value${entries.length === 1 ? "" : "s"} into “${scene.name}”.`;
      break;
    }
    case "scene.node.remove": {
      const scene = findScene(project, operation.payload.sceneId);
      const node = findNode(scene, operation.payload.nodeId);
      scene.nodes = scene.nodes.filter((candidate) => candidate.id !== node.id);
      // The scene keeps a parallel ordering array; leaving it behind produces a
      // node-list mismatch the validator rejects.
      scene.nodeIds = scene.nodeIds.filter((candidate) => candidate !== node.id);
      scene.revision += 1;
      changedPaths.push(`scenes.${scene.id}.nodes.${node.id}`);
      summary = `Removed “${node.name}”.`;
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

