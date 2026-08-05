import type { CaptureDocument, CaptureRedaction, ZoomPlan } from "./capture";

export type Id = string;

export interface RationalTime {
  numerator: number;
  denominator: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
  opacity: number;
}

export type Easing = "linear" | "ease-in" | "ease-out" | "ease-in-out";
export type AnimationProperty = "transform.x" | "transform.y" | "opacity";

export interface Keyframe {
  id: Id;
  time: RationalTime;
  value: number;
  easing: Easing;
}

export interface SceneNodeBase {
  id: Id;
  name: string;
  revision: number;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  transform: Transform;
  size: Size;
  effectIds: Id[];
  animations: Partial<Record<AnimationProperty, Keyframe[]>>;
}

export interface TextNode extends SceneNodeBase {
  type: "text";
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  alignment: "left" | "center" | "right";
  color: string;
  maxLines: number;
}

export interface ImageNode extends SceneNodeBase {
  type: "image";
  assetId: Id;
  fit: "contain" | "cover" | "fill";
  cornerRadius: number;
}

export interface ShapeNode extends SceneNodeBase {
  type: "shape";
  shape: "rectangle" | "ellipse";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius: number;
}

export interface GroupNode extends SceneNodeBase {
  type: "group";
  childIds: Id[];
}

export type SceneNode = TextNode | ImageNode | ShapeNode | GroupNode;

export interface Scene {
  id: Id;
  name: string;
  revision: number;
  size: Size;
  safeArea: SafeArea;
  background: string;
  nodeIds: Id[];
  nodes: SceneNode[];
}

export interface Asset {
  id: Id;
  name: string;
  kind: "video" | "audio" | "image" | "font";
  mediaType: string;
  contentHash: string;
  sourceRef: string;
  immutable: true;
  width?: number;
  height?: number;
  duration?: RationalTime;
  probe: NormalizedMediaProbe | null;
  derivatives: AssetDerivative[];
}

export interface MediaVideoProbe {
  codec: string;
  width: number;
  height: number;
  frameRate: RationalTime;
}

export interface MediaAudioProbe {
  codec: string;
  sampleRate: number;
  channels: number;
}

export interface NormalizedMediaProbe {
  container: string;
  duration: RationalTime;
  video?: MediaVideoProbe;
  audio?: MediaAudioProbe;
}

export interface AssetDerivative {
  id: Id;
  kind: "proxy" | "thumbnail" | "waveform";
  mediaType: string;
  contentHash: string;
  sourceRef: string;
  immutable: true;
  width?: number;
  height?: number;
  duration?: RationalTime;
  probe: NormalizedMediaProbe | null;
  createdAt: string;
  provenance: {
    sourceDigest: string;
    toolchain: Array<Record<string, unknown>>;
  };
}

export interface AudioSettings {
  gainDb: number;
  muted: boolean;
  fadeIn: RationalTime;
  fadeOut: RationalTime;
}

export interface Clip {
  id: Id;
  name: string;
  assetId: Id;
  start: RationalTime;
  sourceIn: RationalTime;
  duration: RationalTime;
  revision: number;
  audio?: AudioSettings;
  effectIds: Id[];
}

export type TransitionKind = "crossfade" | "fade-to-black" | "dip-to-white";

/**
 * A transition between two adjacent clips.
 *
 * Stored on the track rather than on either clip, because it belongs to the
 * boundary between them: neither clip owns it, and deleting one must not leave
 * the other holding half a transition.
 */
export interface Transition {
  id: Id;
  kind: TransitionKind;
  /** The clip the transition runs out of. */
  fromClipId: Id;
  /** The clip it runs into. */
  toClipId: Id;
  duration: RationalTime;
  revision: number;
}

export interface VideoTrack {
  id: Id;
  name: string;
  kind: "video";
  locked: boolean;
  clips: Clip[];
  transitions?: Transition[];
}

export interface AudioTrack {
  id: Id;
  name: string;
  kind: "audio";
  locked: boolean;
  clips: Clip[];
}

export interface CaptionSegment {
  id: Id;
  start: RationalTime;
  end: RationalTime;
  text: string;
  confidence?: number;
  speaker?: string;
}

export interface CaptionTrack {
  id: Id;
  name: string;
  kind: "caption";
  locked: boolean;
  segments: CaptionSegment[];
  safeAreaInset: number;
}

export type Track = VideoTrack | AudioTrack | CaptionTrack;

export interface Timeline {
  id: Id;
  revision: number;
  duration: RationalTime;
  frameRate: RationalTime;
  tracks: Track[];
}

export interface BlurEffect {
  id: Id;
  type: "blur";
  radius: number;
  enabled: boolean;
}

export type Effect = BlurEffect;

export interface StyleProfileRef {
  id: Id;
  version: number;
  name: string;
}

export interface RenderPreset {
  id: Id;
  name: string;
  container: "mp4";
  videoCodec: "h264";
  audioCodec: "aac";
  width: number;
  height: number;
  frameRate: RationalTime;
}

export interface OperationRecord {
  operationId: Id;
  type: StudioOperation["type"];
  actor: "operator" | "agent";
  beforeRevision: number;
  afterRevision: number;
}

export interface StudioProject {
  schemaVersion: 4;
  id: Id;
  name: string;
  revision: number;
  assets: Asset[];
  scenes: Scene[];
  activeSceneId: Id;
  timeline: Timeline;
  effects: Effect[];
  styleProfileRef: StyleProfileRef | null;
  renderPresets: RenderPreset[];
  /**
   * Screen captures belonging to this project.
   *
   * They live here rather than in a separate store because every capture edit
   * is an ordinary revision-checked operation. Keeping them outside the project
   * would mean a second source of truth with its own concurrency story.
   */
  captures: CaptureDocument[];
  provenance: OperationRecord[];
}


type Operation<TType extends string, TPayload> = {
  operationId: Id;
  type: TType;
  actor: "operator" | "agent";
  expectedRevision: number;
  payload: TPayload;
};

export type StudioOperation =
  | Operation<"scene.node.add", { sceneId: Id; node: SceneNode }>
  | Operation<
      "scene.node.update-transform",
      { sceneId: Id; nodeId: Id; patch: Partial<Transform> }
    >
  | Operation<"scene.node.update-text", { sceneId: Id; nodeId: Id; content: string }>
  | Operation<
      "timeline.clip.split",
      { trackId: Id; clipId: Id; splitAt: RationalTime; rightClipId: Id }
    >
  | Operation<
      "timeline.clip.trim",
      {
        trackId: Id;
        clipId: Id;
        newStart: RationalTime;
        newDuration: RationalTime;
        ripple: boolean;
      }
    >
  | Operation<
      "timeline.clip.set-audio",
      {
        trackId: Id;
        clipId: Id;
        gainDb: number;
        muted: boolean;
        fadeIn: RationalTime;
        fadeOut: RationalTime;
      }
    >
  | Operation<
      "timeline.caption.upsert",
      { trackId: Id; segment: CaptionSegment }
    >
  | Operation<
      "animation.keyframe.set",
      { sceneId: Id; nodeId: Id; property: AnimationProperty; keyframe: Keyframe }
    >
  | Operation<
      "effect.blur.set",
      { sceneId: Id; nodeId: Id; effectId: Id; radius: number; enabled: boolean }
    >
  | Operation<
      "timeline.clip.move",
      { trackId: Id; clipId: Id; newStart: RationalTime; ripple: boolean }
    >
  | Operation<
      "timeline.clip.reorder",
      { trackId: Id; clipId: Id; toIndex: number }
    >
  | Operation<
      "timeline.clip.delete",
      { trackId: Id; clipId: Id; ripple: boolean }
    >
  | Operation<
      "timeline.clip.duplicate",
      { trackId: Id; clipId: Id; newClipId: Id; at: RationalTime }
    >
  | Operation<
      "timeline.clip.merge",
      { trackId: Id; leftClipId: Id; rightClipId: Id }
    >
  | Operation<
      "timeline.clip.set-speed",
      /** `speed` is a ratio, not a duration: 2/1 is double speed. */
      { trackId: Id; clipId: Id; speed: RationalTime; ripple: boolean }
    >
  | Operation<
      "timeline.clip.insert",
      /** Carries the whole clip, so a deleted one can be put back exactly. */
      { trackId: Id; clip: Clip; ripple: boolean }
    >
  | Operation<
      "capture.zoom.set-plan",
      /** An authored plan replaces a derived one and is never re-derived (CAP-5). */
      { captureId: Id; plan: ZoomPlan }
    >
  | Operation<"capture.redaction.add", { captureId: Id; redaction: CaptureRedaction }>
  | Operation<"capture.redaction.remove", { captureId: Id; redactionId: Id }>
  | Operation<
      "capture.to-scene",
      /** Projects a capture into an editable track. The capture is not consumed. */
      { captureId: Id; trackId: Id }
    >
  | Operation<"timeline.transition.set", { trackId: Id; transition: Transition }>
  | Operation<"timeline.transition.remove", { trackId: Id; transitionId: Id }>
  | Operation<
      "design.variant.create",
      /** Reframes a scene into a new format, added alongside the original. */
      { sceneId: Id; formatId: Id; formatName: string; width: number; height: number }
    >
  | Operation<
      "design.data.bind",
      /**
       * Fills text layers from one row of data. Keys are node ids; values are
       * the copy to place. Unmatched keys are rejected rather than ignored.
       */
      { sceneId: Id; values: Record<string, string> }
    >
  | Operation<"scene.node.remove", { sceneId: Id; nodeId: Id }>
  | Operation<"style.profile.apply", { styleProfileRef: StyleProfileRef }>;

export interface SemanticDiff {
  operationId: Id;
  summary: string;
  changedPaths: string[];
  beforeRevision: number;
  afterRevision: number;
}
