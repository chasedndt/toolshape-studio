import type {
  Clip,
  SceneNode,
  StudioOperation,
  StudioProject,
  Track,
} from "@toolshape/studio-domain";

/**
 * Selective revert.
 *
 * The existing `studio.operation.undo` restores a whole revision snapshot: it
 * rewinds everything after a point. That cannot express "undo this one edit and
 * keep the rest", because the later edits are exactly what a snapshot restore
 * discards.
 *
 * Revert is the other model — the `git revert` one rather than `git reset`. It
 * computes the *inverse* of a past operation and applies it forward as a new
 * operation producing a new revision. Nothing is rewritten and nothing is lost:
 * the original operation, and its reversal, both remain in history.
 *
 * Two things make this honest rather than magical:
 *
 * 1. **Not every operation has an inverse in the current vocabulary.** Undoing
 *    a split needs a merge; undoing an insertion needs a deletion. Neither
 *    exists yet. Those operations declare themselves non-revertible with a
 *    reason instead of failing obscurely at apply time.
 * 2. **A later edit to the same object makes reversal unsafe.** Reverting a
 *    trim after something else trimmed the same clip would silently discard
 *    that later intent. Conflicts are detected and reported rather than
 *    resolved by guessing.
 */

/** An inverse without the identity fields, which the caller supplies. */
export type InverseOperationDraft = {
  [K in StudioOperation["type"]]: {
    type: K;
    payload: Extract<StudioOperation, { type: K }>["payload"];
  };
}[StudioOperation["type"]];

export type RevertPlan =
  | { revertible: true; operations: InverseOperationDraft[] }
  | { revertible: false; code: string; reason: string };

export interface RevertConflict {
  operationId: string;
  type: StudioOperation["type"];
  target: string;
}

function notRevertible(code: string, reason: string): RevertPlan {
  return { revertible: false, code, reason };
}

function findTrack(project: StudioProject, trackId: string): Track | undefined {
  return project.timeline.tracks.find((track) => track.id === trackId);
}

function findClip(project: StudioProject, trackId: string, clipId: string): Clip | undefined {
  const track = findTrack(project, trackId);
  if (!track || track.kind === "caption") return undefined;
  return track.clips.find((clip) => clip.id === clipId);
}

function findNode(project: StudioProject, sceneId: string, nodeId: string): SceneNode | undefined {
  return project.scenes.find((scene) => scene.id === sceneId)?.nodes.find((node) => node.id === nodeId);
}

/**
 * Computes the operation that undoes `operation`, given the project state as it
 * was immediately before that operation was applied.
 *
 * The before-state is required rather than optional: an inverse restores prior
 * values, and those values exist nowhere else once the operation has been
 * applied.
 */
export function planOperationInverse(operation: StudioOperation, before: StudioProject): RevertPlan {
  switch (operation.type) {
    case "timeline.clip.trim": {
      const clip = findClip(before, operation.payload.trackId, operation.payload.clipId);
      if (!clip) {
        return notRevertible("revert.target-missing", "The clip this operation trimmed no longer exists.");
      }
      return {
        revertible: true,
        operations: [
          {
            type: "timeline.clip.trim",
            payload: {
              trackId: operation.payload.trackId,
              clipId: operation.payload.clipId,
              newStart: structuredClone(clip.start),
              newDuration: structuredClone(clip.duration),
              // A ripple revert would move neighbours a second time. The
              // inverse restores this clip only; conflict detection is what
              // prevents that from corrupting a rippled track.
              ripple: false,
            },
          },
        ],
      };
    }

    case "timeline.clip.set-audio": {
      const clip = findClip(before, operation.payload.trackId, operation.payload.clipId);
      if (!clip?.audio) {
        return notRevertible("revert.target-missing", "The clip had no prior audio settings to restore.");
      }
      return {
        revertible: true,
        operations: [
          {
            type: "timeline.clip.set-audio",
            payload: {
              trackId: operation.payload.trackId,
              clipId: operation.payload.clipId,
              gainDb: clip.audio.gainDb,
              muted: clip.audio.muted,
              fadeIn: structuredClone(clip.audio.fadeIn),
              fadeOut: structuredClone(clip.audio.fadeOut),
            },
          },
        ],
      };
    }

    case "scene.node.update-text": {
      const node = findNode(before, operation.payload.sceneId, operation.payload.nodeId);
      if (!node || node.type !== "text") {
        return notRevertible("revert.target-missing", "The text node this operation edited no longer exists.");
      }
      return {
        revertible: true,
        operations: [
          {
            type: "scene.node.update-text",
            payload: {
              sceneId: operation.payload.sceneId,
              nodeId: operation.payload.nodeId,
              content: node.content,
            },
          },
        ],
      };
    }

    case "scene.node.update-transform": {
      const node = findNode(before, operation.payload.sceneId, operation.payload.nodeId);
      if (!node) {
        return notRevertible("revert.target-missing", "The node this operation moved no longer exists.");
      }
      // Restore only the keys the original patch actually changed. Rewriting
      // the whole transform would clobber unrelated later adjustments.
      const patch: Record<string, number> = {};
      for (const key of Object.keys(operation.payload.patch)) {
        const previous = (node.transform as unknown as Record<string, number>)[key];
        if (previous !== undefined) patch[key] = previous;
      }
      if (Object.keys(patch).length === 0) {
        return notRevertible("revert.empty-inverse", "The operation changed no restorable transform values.");
      }
      return {
        revertible: true,
        operations: [
          {
            type: "scene.node.update-transform",
            payload: {
              sceneId: operation.payload.sceneId,
              nodeId: operation.payload.nodeId,
              patch: patch as Extract<StudioOperation, { type: "scene.node.update-transform" }>["payload"]["patch"],
            },
          },
        ],
      };
    }

    case "effect.blur.set": {
      const previous = before.effects.find((effect) => effect.id === operation.payload.effectId);
      if (!previous) {
        return notRevertible(
          "revert.no-inverse-capability",
          "Reverting a newly created effect needs an effect removal operation, which does not exist yet.",
        );
      }
      return {
        revertible: true,
        operations: [
          {
            type: "effect.blur.set",
            payload: {
              sceneId: operation.payload.sceneId,
              nodeId: operation.payload.nodeId,
              effectId: operation.payload.effectId,
              radius: previous.radius,
              enabled: previous.enabled,
            },
          },
        ],
      };
    }

    case "style.profile.apply": {
      if (!before.styleProfileRef) {
        return notRevertible(
          "revert.no-inverse-capability",
          "Reverting the first style profile needs a style clear operation, which does not exist yet.",
        );
      }
      return {
        revertible: true,
        operations: [
          { type: "style.profile.apply", payload: { styleProfileRef: structuredClone(before.styleProfileRef) } },
        ],
      };
    }

    case "animation.keyframe.set": {
      const node = findNode(before, operation.payload.sceneId, operation.payload.nodeId);
      const existing = node?.animations?.[operation.payload.property]?.find(
        (keyframe: { id: string }) => keyframe.id === operation.payload.keyframe.id,
      );
      if (!existing) {
        return notRevertible(
          "revert.no-inverse-capability",
          "Reverting a newly added keyframe needs a keyframe removal operation, which does not exist yet.",
        );
      }
      return {
        revertible: true,
        operations: [
          {
            type: "animation.keyframe.set",
            payload: {
              sceneId: operation.payload.sceneId,
              nodeId: operation.payload.nodeId,
              property: operation.payload.property,
              keyframe: structuredClone(existing),
            },
          },
        ],
      };
    }

    case "timeline.caption.upsert": {
      const track = findTrack(before, operation.payload.trackId);
      const existing =
        track?.kind === "caption"
          ? track.segments.find((segment) => segment.id === operation.payload.segment.id)
          : undefined;
      if (!existing) {
        return notRevertible(
          "revert.no-inverse-capability",
          "Reverting a newly added caption needs a caption removal operation, which does not exist yet.",
        );
      }
      return {
        revertible: true,
        operations: [
          { type: "timeline.caption.upsert", payload: { trackId: operation.payload.trackId, segment: structuredClone(existing) } },
        ],
      };
    }

    case "timeline.clip.split":
      return notRevertible(
        "revert.no-inverse-capability",
        "Reverting a split needs a clip merge or delete operation, which does not exist yet.",
      );

    case "scene.node.add":
      return notRevertible(
        "revert.no-inverse-capability",
        "Reverting an added node needs a node delete operation, which does not exist yet.",
      );

    default: {
      const exhaustive: never = operation;
      return notRevertible("revert.unknown-operation", `Unknown operation type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * The objects an operation touches, as stable keys.
 *
 * A ripple edit reports the whole track rather than one clip, because it moves
 * every neighbour — treating it as a single-clip edit would let a revert
 * silently invalidate positions the ripple established.
 */
export function operationTargets(operation: StudioOperation): string[] {
  switch (operation.type) {
    case "timeline.clip.trim":
      return operation.payload.ripple
        ? [`track:${operation.payload.trackId}`, `clip:${operation.payload.trackId}:${operation.payload.clipId}`]
        : [`clip:${operation.payload.trackId}:${operation.payload.clipId}`];
    case "timeline.clip.split":
      return [
        `track:${operation.payload.trackId}`,
        `clip:${operation.payload.trackId}:${operation.payload.clipId}`,
        `clip:${operation.payload.trackId}:${operation.payload.rightClipId}`,
      ];
    case "timeline.clip.set-audio":
      return [`clip:${operation.payload.trackId}:${operation.payload.clipId}`];
    case "timeline.caption.upsert":
      return [`caption:${operation.payload.trackId}:${operation.payload.segment.id}`];
    case "scene.node.add":
      return [`scene:${operation.payload.sceneId}`, `node:${operation.payload.sceneId}:${operation.payload.node.id}`];
    case "scene.node.update-text":
    case "scene.node.update-transform":
      return [`node:${operation.payload.sceneId}:${operation.payload.nodeId}`];
    case "animation.keyframe.set":
      return [
        `node:${operation.payload.sceneId}:${operation.payload.nodeId}`,
        `animation:${operation.payload.nodeId}:${operation.payload.property}`,
      ];
    case "effect.blur.set":
      return [`effect:${operation.payload.effectId}`, `node:${operation.payload.sceneId}:${operation.payload.nodeId}`];
    case "style.profile.apply":
      return ["style:profile"];
    default: {
      const exhaustive: never = operation;
      throw new TypeError(`Unknown operation type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Later operations that touched anything the candidate touched.
 *
 * A non-empty result means reverting would discard intent expressed after the
 * operation being reverted. The caller reports that rather than guessing at a
 * merge — a wrong guess here silently destroys work, which is the exact failure
 * the revision model exists to prevent.
 */
export function detectRevertConflicts(
  candidate: StudioOperation,
  laterOperations: readonly StudioOperation[],
): RevertConflict[] {
  const touched = operationTargets(candidate);
  const conflicts: RevertConflict[] = [];
  for (const later of laterOperations) {
    const overlap = operationTargets(later).find((target) =>
      touched.some((existing) => targetsOverlap(existing, target)),
    );
    if (overlap) {
      conflicts.push({ operationId: later.operationId, type: later.type, target: overlap });
    }
  }
  return conflicts;
}

/**
 * Targets are hierarchical, and containment has to be checked in both
 * directions.
 *
 * A ripple edit claims `track:X` because it moves every clip in that track. An
 * earlier edit to one clip claims only `clip:X:main`. Comparing the two sets by
 * exact membership finds no overlap and would report the revert as safe — while
 * in fact the ripple repositioned the very clip about to be restored. Scene and
 * node targets nest the same way.
 */
function targetsOverlap(left: string, right: string): boolean {
  if (left === right) return true;
  return contains(left, right) || contains(right, left);
}

function contains(container: string, member: string): boolean {
  if (container.startsWith("track:")) {
    return member.startsWith(`clip:${container.slice("track:".length)}:`);
  }
  if (container.startsWith("scene:")) {
    return member.startsWith(`node:${container.slice("scene:".length)}:`);
  }
  return false;
}
