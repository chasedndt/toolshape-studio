# Toolshape Studio capture-engine milestone

**Date:** 2026-08-05
**Runtime:** Codex
**Status:** PHASE 1 AND 2 COMPLETE / MILESTONE 9
**Spec:** `docs/product/CAPTURE-PILLAR.md`

## Outcome

Build the part of the capture pillar that has no platform dependency: the
capture document, and the deterministic derivation of a zoom plan from an event
track.

This is the piece the whole pillar rests on. A screen recorder that produces
pixels is a commodity; one that keeps *what happened* as structured data is not.
The claim in the spec — that an agent asking to "zoom on every click in the
settings panel" is answered by reading an event log rather than by frame-by-frame
vision inference — is only true if the derivation is a real, deterministic
function over that log. So it gets built first, and it gets built pure.

## Repo-truth baseline

- Milestone 8b is committed and verified. The worktree began clean at `3460f19`.
- `StudioOperation` has 18 members; every timeline and scene operation reverts.
- `packages/studio-engine` holds exact rational arithmetic (ADR 0003),
  keyframe interpolation with easing, validation, operations, and the inverse
  planner. Nothing there touches the filesystem or the platform.
- No capture types exist yet.
- The capture worker, the desktop shell, and OS APIs are **out of scope for
  this phase** and remain unbuilt.

## What phase 1 delivers

1. **Capture document types** — media reference, cursor track, event track,
   window track, zoom plan, overlay and backdrop.
2. **`deriveZoomPlan`** — a pure function from an event track to zoom
   keyframes, with no clock, no randomness, and no I/O.
3. Tests driven by synthetic event tracks, which is all the derivation needs.

## Derivation design

```text
events + window track + config
  → cluster by time and screen proximity
  → bound each cluster by the window it happened in
  → discard clusters too brief to be worth a zoom
  → merge clusters closer together than the settle time
  → emit keyframes: lead-in, hold, lead-out
  → clamp so the plan never exceeds the configured zoom rate
```

**Clustering is by time *and* space.** Two clicks a second apart in opposite
screen corners are two separate points of interest, not one wide region that
zooms to almost nothing. Time alone would merge them; space alone would merge
a click now with a click two minutes later in the same place.

**Regions are window-bounded.** A zoom region is clipped to the bounds of the
window the events occurred in, from the window track. Without this a click near
a window edge produces a frame that is half application and half desktop, which
is the characteristic ugly failure of naive auto-zoom.

**Brief clusters are discarded.** A single stray click should not cause a zoom
that arrives and leaves before a viewer registers it. A cluster must span at
least `minimumHoldSeconds` of interest, or be dense enough to matter.

**Nearby clusters merge.** If two regions are separated by less than the settle
time, zooming out and straight back in reads as a jitter. They become one
region spanning both.

**Idle produces nothing.** Stretches with no events emit no keyframes at all,
rather than drifting toward some default.

**Rate is bounded.** The plan is rejected — not silently smoothed — if it would
require a scale change faster than `maximumScaleChangePerSecond`. Silently
smoothing would make the output differ from the plan the agent previewed.

## Determinism

`deriveZoomPlan` takes its inputs and a config and returns keyframes. It reads
no clock, generates no randomness, and performs no I/O. Keyframe identifiers are
derived from the cluster index so two runs over the same events produce byte-
identical plans — which is what makes a preview trustworthy and a diff meaningful.

## Acceptance criteria

- The same event track always produces the same plan.
- Clicks clustered in time and space produce one zoom region; clicks far apart
  in either dimension produce separate regions.
- A zoom region never extends beyond the bounds of the window its events
  occurred in.
- An event track with no events produces an empty plan, not a default zoom.
- A plan that would exceed the configured zoom rate is rejected with a reason.
- Two regions closer than the settle time merge into one.
- A single isolated click below the hold threshold produces no zoom.

## Phase 2 — camera path (complete)

Turns a zoom plan into concrete framing over time, still with no platform
dependency.

- `sampleZoomAt` interpolates the plan with easing, holding the first and last
  values outside its range rather than extrapolating toward a framing nobody
  asked for.
- `planCameraPath` produces a crop rectangle per frame. The crop always matches
  the **output** aspect, not the source's, which is what makes one recording
  become a 16:9 lesson and a 9:16 short without re-deriving anything — the plan
  stores points of interest normalised to the frame rather than pixel
  rectangles. Crops are clamped inside the source, so a region centred near an
  edge is pushed inward instead of sampling pixels that do not exist.
- `smoothCursorPath` runs an exponential filter forwards then backwards, so the
  smoothed pointer has no directional lag. A single pass would make it trail
  behind where it actually was.

## Non-goals for this phase

- The capture worker and any OS API. Phase 2, after the shell.
- Cursor smoothing and click emphasis at render. Phase 3, with compositing.
- Backdrop and overlay rendering. Phase 3.
- Redaction. Phase 3.
- `studio.capture.*` capabilities. They land once the document is stable.
