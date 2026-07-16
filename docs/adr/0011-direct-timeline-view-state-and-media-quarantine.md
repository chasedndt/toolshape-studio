# ADR 0011: Direct timeline view state and pre-store media quarantine

**Date:** 2026-07-16
**Status:** Accepted for Milestone 6

## Context

The Studio seed has deterministic split/trim operations and a browser-rendered timeline, but the visible surface is mostly a fixture demonstration: clip elements are not selectable, the playhead is fixed, edit buttons target known fixture IDs/times, and zoom/transport controls do not drive the view. Moving pointer coordinates or mutable drag state into `StudioProject` would couple canonical truth to one renderer and create noisy revisions.

The media path also imports byte-sniffed source bytes into the trusted content-addressed store before FFprobe has established bounded duration, dimensions, frame rate, and audio properties. A rejected or malformed source therefore cannot become a registered asset, but its bytes may already exist in the trusted object namespace.

## Decision

### Timeline boundary

Selection, playhead time, zoom, scroll, active drag, trim preview, ripple preference, and preview-transport state are ephemeral editor state. They are deterministic projections of interaction and are excluded from canonical project documents and public adapters.

At commit boundaries:

```text
pointer / keyboard intent
  -> frame-snapped semantic time
  -> existing typed split or trim draft
  -> Studio application service
  -> revision / validation / provenance / undo / semantic diff
```

React may preview trim geometry during a pointer capture, but pointer-up submits at most one operation. The engine validates that every resulting source range stays within the immutable asset duration. UI clamping cannot replace this invariant because agents and future transports call the same operation independently.

Timeline geometry is rendered from rational clip times against an ephemeral duration scale. Zoom changes the scale and ruler density, not canonical times. The existing full-duration waveform is cropped against `sourceIn` and clip duration so visual evidence retains source-time meaning.

### Media boundary

Untrusted bytes are read once, metadata/signature checked, and written to a unique ephemeral quarantine snapshot under the approved media-work root. FFprobe reads that snapshot, not the mutable caller path and not the trusted object store. Normalized probe evidence must satisfy configurable duration, dimension, pixel-count, frame-rate, channel-count, and sample-rate budgets before the original enters content-addressed storage.

Probe capture is timeout- and output-bounded. Rejection returns a stable, path-free error code and safe numeric evidence. The quarantine snapshot is deleted after every accepted or rejected outcome. Accepted originals remain immutable and continue through the existing verified proxy/thumbnail/waveform path.

## Consequences

### Positive

- Direct human editing and agent editing converge on the same semantic commands.
- High-frequency gestures remain responsive without polluting project revisions or operation logs.
- Keyboard and pointer workflows can be tested from resulting canonical state.
- Source-range invariants apply equally to UI, CLI, SDK, and future MCP/IPC adapters.
- Untrusted rejected media does not enter the trusted object namespace.
- FFprobe evaluates the same byte snapshot that is later content-addressed, closing a path-replacement race.
- Structured error codes let harnesses distinguish retryable technical failures from policy rejection.

### Trade-offs

- Browser view state resets with the current session because layout/view persistence is still deferred.
- The current waveform is an overview derivative; deep zoom can expose its finite raster resolution.
- Quarantine briefly duplicates source bytes beneath the bounded work root.
- Process timeout/output bounds reduce denial-of-service exposure but do not provide OS-level CPU/memory isolation.
- Accepted-original orphan garbage collection after a later derivative failure remains a separate persistence concern.

## Alternatives rejected

- **Persist playhead/selection/zoom in the project:** rejected because these are renderer/session concerns, not creative truth.
- **Create UI-only trim logic:** rejected because it breaks adapter parity and lets agents bypass invariants.
- **Commit an operation for every pointer move:** rejected because it creates revision noise, poor undo semantics, and avoidable persistence load.
- **Probe the caller path then import previously read bytes:** rejected because the path may change between read and probe.
- **Probe from the trusted object store:** rejected because rejected bytes would already cross the trust boundary.
- **Trust UI resource limits:** rejected because CLI, SDK, and future MCP/IPC callers share the ingestion service.
