import type { Easing, Id, RationalTime } from "./model";

/**
 * The capture document.
 *
 * A capture is not a video file. It is a semantic document that renders to one.
 * The recorded bytes are immutable and content-addressed like any other asset;
 * everything else here is a re-editable derived layer, which is what makes
 * changing the zoom next week possible without re-recording.
 *
 * It is also what makes capture agent-operable. An agent asked to "emphasise
 * every click in the settings panel" reads the event and window tracks and
 * answers deterministically. Against a flat video the same request needs
 * frame-by-frame vision inference and cannot be verified.
 *
 * See `docs/product/CAPTURE-PILLAR.md`.
 */

export type CaptureSourceKind = "display" | "window" | "region" | "camera";

export interface CaptureSource {
  id: Id;
  kind: CaptureSourceKind;
  label: string;
  width: number;
  height: number;
}

/**
 * What the user did, as data.
 *
 * Keystrokes are included in the type because redaction needs to address them,
 * but capture defaults to not recording them at all (CAP-3).
 */
export type CaptureEventKind = "click" | "double-click" | "drag" | "scroll" | "key";

export interface CaptureEvent {
  id: Id;
  kind: CaptureEventKind;
  time: RationalTime;
  /** Screen coordinates, in the source's pixel space. */
  x: number;
  y: number;
  /** Which window had focus, when known. Zoom regions are clipped to it. */
  windowId?: Id;
}

export interface CaptureWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureWindowFocus {
  id: Id;
  time: RationalTime;
  windowId: Id;
  application: string;
  bounds: CaptureWindowBounds;
}

export interface CursorSample {
  time: RationalTime;
  x: number;
  y: number;
  visible: boolean;
}

/**
 * One point in the zoom plan.
 *
 * `center` is normalised to the source frame so a plan survives a change of
 * output resolution — a 9:16 export of a 2560×1440 capture keeps the same
 * points of interest.
 */
export interface ZoomKeyframe {
  id: Id;
  time: RationalTime;
  /** 1 is the whole frame. Larger values zoom in. */
  scale: number;
  centerX: number;
  centerY: number;
  easing: Easing;
}

export interface ZoomPlan {
  id: Id;
  revision: number;
  /**
   * True when generated from the event track, false when a person or an agent
   * authored it. A derived plan is a proposal; an authored one replaces it and
   * is never silently re-derived (CAP-5).
   */
  derived: boolean;
  keyframes: ZoomKeyframe[];
}

export type BackdropFill =
  | { kind: "solid"; colour: string }
  | { kind: "gradient"; from: string; to: string; angleDeg: number }
  | { kind: "wallpaper"; assetId: Id };

export interface CaptureBackdrop {
  fill: BackdropFill;
  paddingPx: number;
  cornerRadiusPx: number;
  shadowOpacity: number;
}

export interface CaptureCursorStyle {
  /** Smooths the recorded path so the pointer reads as animated, not captured. */
  smoothing: number;
  sizeScale: number;
  clickEmphasis: boolean;
  motionBlur: boolean;
}

export type CameraOverlayShape = "circle" | "rounded" | "square";

export interface CaptureCameraOverlay {
  assetId: Id;
  shape: CameraOverlayShape;
  sizeFraction: number;
  /** Normalised position within the frame. */
  x: number;
  y: number;
  followsActivity: boolean;
}

export type RedactionKind = "region" | "window" | "keystrokes" | "application";

export interface CaptureRedaction {
  id: Id;
  kind: RedactionKind;
  from: RationalTime;
  to: RationalTime;
  bounds?: CaptureWindowBounds;
  windowId?: Id;
  application?: string;
}

export interface CaptureDocument {
  id: Id;
  revision: number;
  source: CaptureSource;
  /** Immutable, content-addressed recording. */
  mediaAssetId: Id;
  audioAssetIds: Id[];
  duration: RationalTime;
  frameRate: RationalTime;
  cursorTrack: CursorSample[];
  eventTrack: CaptureEvent[];
  windowTrack: CaptureWindowFocus[];
  zoomPlan: ZoomPlan;
  backdrop: CaptureBackdrop;
  cursorStyle: CaptureCursorStyle;
  cameraOverlay: CaptureCameraOverlay | null;
  redactions: CaptureRedaction[];
  transcriptRef: Id | null;
}
