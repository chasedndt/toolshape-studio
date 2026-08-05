import type {
  CaptureEvent,
  CaptureWindowBounds,
  CaptureWindowFocus,
  ZoomKeyframe,
  ZoomPlan,
} from "@toolshape/studio-domain";
import { rational, toSeconds } from "./rational";

/**
 * Derives a zoom plan from what actually happened during a capture.
 *
 * This is the function the capture pillar's claim rests on. "Zoom on every
 * click in the settings panel" is answerable because clicks and window focus
 * were kept as data — so the answer is a query, computed the same way every
 * time, previewable before it is committed, and checkable afterwards. Against
 * a flat video the same request would need frame-by-frame vision inference and
 * could not be verified at all.
 *
 * Deliberately pure: no clock, no randomness, no I/O. The same event track
 * always produces a byte-identical plan, which is what makes a preview
 * trustworthy and a diff meaningful.
 *
 * A derived plan is a *proposal*. An authored plan replaces it and is never
 * silently re-derived (CAP-5).
 */

export interface ZoomDerivationConfig {
  /** Events further apart than this in time start a new region. */
  clusterGapSeconds: number;
  /** Events further apart than this on screen start a new region. */
  clusterRadiusPx: number;
  /**
   * How far apart two regions can be and still merge. Wider than the cluster
   * radius, because neighbouring regions should join, but regions across the
   * screen should not.
   */
  mergeRadiusPx: number;
  /** A region shorter than this is not worth zooming for. */
  minimumHoldSeconds: number;
  /** Regions closer together than this merge, rather than zooming out and back. */
  settleSeconds: number;
  /** Fewest events a region must contain to earn a zoom. */
  minimumEventsPerRegion: number;
  /** How far in to zoom. 1 is the whole frame. */
  targetScale: number;
  leadInSeconds: number;
  leadOutSeconds: number;
  /** Padding around the events, as a fraction of the source's smaller side. */
  regionPaddingFraction: number;
  /** Above this, the plan is rejected rather than smoothed. */
  maximumScaleChangePerSecond: number;
}

export const DEFAULT_ZOOM_DERIVATION: ZoomDerivationConfig = {
  clusterGapSeconds: 1.5,
  clusterRadiusPx: 400,
  mergeRadiusPx: 700,
  minimumHoldSeconds: 0.4,
  settleSeconds: 1.2,
  minimumEventsPerRegion: 1,
  targetScale: 1.8,
  leadInSeconds: 0.45,
  leadOutSeconds: 0.45,
  regionPaddingFraction: 0.08,
  maximumScaleChangePerSecond: 3,
};

export interface ZoomRegion {
  index: number;
  fromSeconds: number;
  toSeconds: number;
  eventCount: number;
  bounds: CaptureWindowBounds;
  windowId?: string;
}

export interface DerivedZoomPlan extends ZoomPlan {
  regions: ZoomRegion[];
}

export interface DeriveZoomPlanOptions {
  events: readonly CaptureEvent[];
  windows: readonly CaptureWindowFocus[];
  source: { width: number; height: number };
  config?: Partial<ZoomDerivationConfig>;
}

export class ZoomRateExceededError extends Error {
  readonly name = "ZoomRateExceededError";
  constructor(readonly observed: number, readonly limit: number) {
    super(
      `Zoom plan changes scale at ${observed.toFixed(2)}/s, faster than the ${limit}/s limit. ` +
        "Lengthen the lead-in or lower the target scale.",
    );
  }
}

interface Cluster {
  events: CaptureEvent[];
  fromSeconds: number;
  toSeconds: number;
  windowId?: string;
}

function distance(left: CaptureEvent, right: CaptureEvent): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

/**
 * Groups events by time *and* proximity.
 *
 * Time alone would merge two clicks a second apart in opposite screen corners
 * into one region spanning most of the display, which zooms to almost nothing.
 * Space alone would merge a click now with a click two minutes later.
 */
function clusterEvents(events: readonly CaptureEvent[], config: ZoomDerivationConfig): Cluster[] {
  const ordered = [...events].sort((left, right) => toSeconds(left.time) - toSeconds(right.time));
  const clusters: Cluster[] = [];

  for (const event of ordered) {
    const at = toSeconds(event.time);

    // Considers every cluster still open in time, not just the most recent
    // one. Two activity streams running at once — a click here, a click across
    // the screen, back to the first — interleave in the event track, and
    // comparing only against the last cluster would start a new region on
    // every alternation.
    let best: Cluster | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const cluster of clusters) {
      if (at - cluster.toSeconds > config.clusterGapSeconds) continue;
      const nearest = Math.min(...cluster.events.map((candidate) => distance(candidate, event)));
      if (nearest <= config.clusterRadiusPx && nearest < bestDistance) {
        best = cluster;
        bestDistance = nearest;
      }
    }

    if (best) {
      best.events.push(event);
      best.toSeconds = Math.max(best.toSeconds, at);
      best.windowId ??= event.windowId;
    } else {
      clusters.push({ events: [event], fromSeconds: at, toSeconds: at, windowId: event.windowId });
    }
  }
  return clusters.sort((left, right) => left.fromSeconds - right.fromSeconds);
}

/** Centre of a cluster's events, for deciding whether two regions are near. */
function centroid(cluster: Cluster): { x: number; y: number } {
  const count = cluster.events.length;
  return {
    x: cluster.events.reduce((total, event) => total + event.x, 0) / count,
    y: cluster.events.reduce((total, event) => total + event.y, 0) / count,
  };
}

/** The window in focus at a given moment, if the track knows. */
function windowFor(
  cluster: Cluster,
  windows: readonly CaptureWindowFocus[],
): CaptureWindowFocus | undefined {
  if (cluster.windowId) {
    const byId = windows.find((candidate) => candidate.windowId === cluster.windowId);
    if (byId) return byId;
  }
  // Otherwise the most recent focus change at or before the cluster started.
  return [...windows]
    .filter((candidate) => toSeconds(candidate.time) <= cluster.fromSeconds)
    .sort((left, right) => toSeconds(right.time) - toSeconds(left.time))[0];
}

function clampBounds(bounds: CaptureWindowBounds, limit: CaptureWindowBounds): CaptureWindowBounds {
  const x = Math.max(limit.x, Math.min(bounds.x, limit.x + limit.width));
  const y = Math.max(limit.y, Math.min(bounds.y, limit.y + limit.height));
  return {
    x,
    y,
    width: Math.max(1, Math.min(bounds.width, limit.x + limit.width - x)),
    height: Math.max(1, Math.min(bounds.height, limit.y + limit.height - y)),
  };
}

function boundsFor(
  cluster: Cluster,
  windows: readonly CaptureWindowFocus[],
  source: { width: number; height: number },
  config: ZoomDerivationConfig,
): CaptureWindowBounds {
  const xs = cluster.events.map((event) => event.x);
  const ys = cluster.events.map((event) => event.y);
  const padding = Math.min(source.width, source.height) * config.regionPaddingFraction;

  const raw: CaptureWindowBounds = {
    x: Math.min(...xs) - padding,
    y: Math.min(...ys) - padding,
    width: Math.max(...xs) - Math.min(...xs) + padding * 2,
    height: Math.max(...ys) - Math.min(...ys) + padding * 2,
  };

  // Clip to the window the events happened in. Without this, a click near a
  // window edge frames half application and half desktop — the characteristic
  // ugly failure of naive auto-zoom.
  const focus = windowFor(cluster, windows);
  const limit: CaptureWindowBounds = focus
    ? focus.bounds
    : { x: 0, y: 0, width: source.width, height: source.height };
  return clampBounds(raw, limit);
}

/**
 * Merges regions that are close in time *and* in space.
 *
 * Merging exists to avoid a zoom-out-and-straight-back-in jitter between
 * neighbouring points of interest. Between regions that are far apart on
 * screen, that movement is meaningful rather than jittery — and merging them
 * would produce exactly the screen-spanning region the spatial clustering just
 * worked to prevent, undoing it one step later.
 */
function mergeAdjacent(clusters: Cluster[], config: ZoomDerivationConfig): Cluster[] {
  const merged: Cluster[] = [];
  for (const cluster of clusters) {
    const open = merged.at(-1);
    const closeInTime = open !== undefined && cluster.fromSeconds - open.toSeconds < config.settleSeconds;
    const closeInSpace =
      open !== undefined &&
      Math.hypot(centroid(open).x - centroid(cluster).x, centroid(open).y - centroid(cluster).y) <=
        config.mergeRadiusPx;

    if (open && closeInTime && closeInSpace) {
      open.events.push(...cluster.events);
      open.toSeconds = Math.max(open.toSeconds, cluster.toSeconds);
      open.windowId ??= cluster.windowId;
    } else {
      merged.push({ ...cluster, events: [...cluster.events] });
    }
  }
  return merged;
}

/**
 * Drops regions whose event spans overlap another's.
 *
 * A frame cannot be zoomed to two places at once, so two clusters active over
 * the same moments are ambiguous rather than additive — clicking in two distant
 * places simultaneously has no single correct framing. Rather than inventing
 * one, the denser region wins and the other is left unzoomed, which is both
 * deterministic and the visually calmer answer.
 *
 * Ties break toward the earlier region so the result never depends on sort
 * stability.
 */
function dropOverlapping(clusters: Cluster[]): Cluster[] {
  const kept: Cluster[] = [];
  for (const cluster of clusters) {
    const clash = kept.findIndex(
      (existing) => cluster.fromSeconds < existing.toSeconds && existing.fromSeconds < cluster.toSeconds,
    );
    if (clash < 0) {
      kept.push(cluster);
      continue;
    }
    if (cluster.events.length > kept[clash].events.length) kept[clash] = cluster;
  }
  return kept.sort((left, right) => left.fromSeconds - right.fromSeconds);
}

/**
 * Shortens leads so a region's zoom-out does not run into the next zoom-in.
 *
 * Without this, two regions closer together than their combined leads emit
 * keyframes that collide, and the rate check reads the collision as an
 * impossibly fast zoom.
 */
function fitLeads(
  regions: ZoomRegion[],
  config: ZoomDerivationConfig,
): Array<{ region: ZoomRegion; leadIn: number; leadOut: number }> {
  return regions.map((region, index) => {
    const previous = regions[index - 1];
    const next = regions[index + 1];
    const beforeGap = previous ? region.fromSeconds - previous.toSeconds : Number.POSITIVE_INFINITY;
    const afterGap = next ? next.fromSeconds - region.toSeconds : Number.POSITIVE_INFINITY;
    return {
      region,
      leadIn: Math.min(config.leadInSeconds, Math.max(0, beforeGap / 2), region.fromSeconds),
      leadOut: Math.min(config.leadOutSeconds, Math.max(0, afterGap / 2)),
    };
  });
}

export function deriveZoomPlan(options: DeriveZoomPlanOptions): DerivedZoomPlan {
  const config = { ...DEFAULT_ZOOM_DERIVATION, ...options.config };
  const { source, windows } = options;

  const clusters = dropOverlapping(mergeAdjacent(clusterEvents(options.events, config), config)).filter((cluster) => {
    // A cluster earns a zoom by lasting long enough or by containing enough
    // activity. One stray click should not produce a zoom that arrives and
    // leaves before a viewer registers it.
    const span = cluster.toSeconds - cluster.fromSeconds;
    return span >= config.minimumHoldSeconds || cluster.events.length >= config.minimumEventsPerRegion + 1;
  });

  const regions: ZoomRegion[] = clusters.map((cluster, index) => ({
    index,
    fromSeconds: cluster.fromSeconds,
    toSeconds: cluster.toSeconds,
    eventCount: cluster.events.length,
    bounds: boundsFor(cluster, windows, source, config),
    ...(cluster.windowId ? { windowId: cluster.windowId } : {}),
  }));

  const keyframes: ZoomKeyframe[] = [];
  const at = (seconds: number) => rational(Math.max(0, Math.round(seconds * 1000)), 1000);

  for (const { region, leadIn, leadOut } of fitLeads(regions, config)) {
    const centerX = (region.bounds.x + region.bounds.width / 2) / source.width;
    const centerY = (region.bounds.y + region.bounds.height / 2) / source.height;
    const start = Math.max(0, region.fromSeconds - leadIn);
    const end = region.toSeconds + leadOut;

    // Out, in, hold, out. Idle stretches between regions get nothing at all —
    // the frame simply sits unzoomed rather than drifting toward a default.
    keyframes.push(
      { id: `zoom-${region.index}-a`, time: at(start), scale: 1, centerX, centerY, easing: "ease-in-out" },
      { id: `zoom-${region.index}-b`, time: at(region.fromSeconds), scale: config.targetScale, centerX, centerY, easing: "ease-in-out" },
      { id: `zoom-${region.index}-c`, time: at(region.toSeconds), scale: config.targetScale, centerX, centerY, easing: "ease-in-out" },
      { id: `zoom-${region.index}-d`, time: at(end), scale: 1, centerX, centerY, easing: "ease-in-out" },
    );
  }

  keyframes.sort((left, right) => toSeconds(left.time) - toSeconds(right.time));
  assertWithinRateLimit(keyframes, config);

  return {
    id: "zoom-plan-derived",
    revision: 0,
    derived: true,
    keyframes,
    regions,
  };
}

/**
 * Rejects a plan that would zoom faster than the configured limit.
 *
 * Rejected rather than silently smoothed: smoothing would make the rendered
 * output differ from the plan an agent previewed and a person approved, which
 * is exactly the kind of quiet divergence the preview step exists to prevent.
 */
function assertWithinRateLimit(keyframes: readonly ZoomKeyframe[], config: ZoomDerivationConfig): void {
  for (let index = 1; index < keyframes.length; index += 1) {
    const previous = keyframes[index - 1];
    const current = keyframes[index];
    const elapsed = toSeconds(current.time) - toSeconds(previous.time);
    if (elapsed <= 0) continue;
    const rate = Math.abs(current.scale - previous.scale) / elapsed;
    if (rate > config.maximumScaleChangePerSecond) {
      throw new ZoomRateExceededError(rate, config.maximumScaleChangePerSecond);
    }
  }
}
