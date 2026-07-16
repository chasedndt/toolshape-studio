# Toolshape Studio direct-timeline milestone

**Date:** 2026-07-16
**Runtime:** Codex
**Session:** `2026-07-16_toolshape-studio-direct-timeline`
**Status:** IN PROGRESS / MILESTONE 6

## Outcome

Turn the existing Edit workspace timeline into a real operator editing surface while preserving one semantic operation model for people and agents. Add direct clip selection, a draggable and keyboard-addressable playhead, frame-snapped trim handles, selection-aware split/trim commands, zoom-adaptive ruler and waveform presentation, and working preview transport controls.

Pair the product pass with a stricter hostile-media boundary: untrusted bytes are signature-checked and probed from an ephemeral quarantine snapshot, resource budgets are enforced before the original reaches the trusted content-addressed store, rejection is structured for adapters, and every quarantine file is removed after acceptance or rejection.

This milestone advances the professional alpha editor. It does not claim finished playback synchronization, multiresolution waveform tiling, broad format support, or OS-level codec sandboxing.

## Repo-truth baseline

- Milestones 1-5 are committed and verified on `work/studio`; the worktree began clean at `cc4ed2c`.
- The Edit workspace already renders real thumbnail and waveform derivatives, but clips are non-interactive spans, the playhead is hard-coded, ruler density is fixed, toolbar edits target fixture IDs/times, and transport buttons do not change view state.
- `timeline.clip.split` and `timeline.clip.trim` already provide deterministic canonical edit operations through the same kernel used by the UI and adapters.
- Selection, playhead position, zoom, active drag, and playback preview are editor view state; they must not enter `StudioProject`, revisions, operation history, adapter documents, or project digests.
- MP4 ingestion checks file size and signature, then imports the original into the trusted content store before FFprobe validation. Duration, dimensions, frame rate, audio-channel, sample-rate, subprocess-output, and pre-store quarantine budgets are not yet enforced.

## Direct-edit interaction contract

### Ephemeral view state

The browser editor owns only:

- selected track/clip identity;
- playhead time;
- zoom factor and scroll position;
- active pointer drag and transient trim preview;
- preview-transport running state;
- ripple-mode preference.

Changing this state never advances the project revision. A drag becomes canonical only once, at pointer-up, by submitting a typed `timeline.clip.trim` operation. Split buttons and keyboard commands submit `timeline.clip.split`. Undo/redo remains kernel-backed.

### Human controls

- Click or keyboard-focus a clip to select it and expose both trim handles.
- Click/drag the ruler or timeline background to scrub the playhead.
- Drag either trim handle with frame snapping; commit one semantic operation on release.
- Split the selected clip at the current playhead with the toolbar or `S`.
- Trim the selected in/out boundary to the playhead with `[` / `]`.
- Move the playhead by one frame with Left/Right, one second with Shift+Left/Right, and to bounds with Home/End.
- Zoom with buttons, slider, or `+` / `-`; ruler density changes with zoom and source-relative waveform cropping remains correct after trims.
- Start/stop the bounded visual preview transport and use working start/end/frame-step controls.
- Toggle ripple mode explicitly. The current mode is visible and included in the committed trim operation.

All controls require semantic labels, visible focus, disabled states for invalid commands, and no shortcut interception while typing.

### Agent parity

The UI does not create a second timeline command path. Human gestures call the existing application service and operation union. Agents continue to use the same split/trim payloads, expected revisions, authorization grant, idempotency, validation, provenance, and semantic diff behavior.

Add source-range validation so either adapter is rejected when a trim would read past the immutable source duration. UI clamping is usability, not the security/invariant boundary.

## Timeline visual model

- Preserve Toolshape's existing dark neutral shell, acid-lime focus/accent, compact professional density, Lucide icon language, panel proportions, and original clean-room layout.
- Keep track labels fixed while one synchronized timeline viewport scrolls horizontally.
- Scale the semantic duration region rather than individual clip coordinates. Clip geometry remains derived from rational canonical time.
- Generate major/minor ruler ticks from duration, zoom, and available density; never hard-code an eight-second ruler.
- Map the full-duration waveform to source time. Trimming changes the visible crop, not the waveform's meaning.
- Clearly label the current derivative as an overview cache. Multiresolution waveform tiles remain deferred.

## Media quarantine and resource contract

Before trusted import:

1. validate source size, safe original name, declared media type, and byte signature;
2. write the already-read bytes to a unique ephemeral file beneath the approved media-work quarantine root;
3. FFprobe that immutable snapshot with a subprocess timeout and bounded captured output;
4. normalize and validate container/video/audio evidence;
5. enforce configured maximum duration, dimensions, pixel count, frame rate, audio channels, and sample rate;
6. import accepted bytes into the content-addressed store and continue existing derivative generation;
7. remove the quarantine snapshot in every outcome.

Rejected sources return a structured, path-free `MediaIngestionRejectedError` with a stable code, stage, safe reason, and bounded numeric evidence. Rejection must not register an asset or place the source in the trusted object store.

The alpha defaults are intentionally generous for ordinary creator media and bounded against obvious resource exhaustion. They remain configurable at the application-service boundary.

## TDD and implementation order

1. Add pure timeline geometry/timecode/tick/trim tests and source-bound operation validation tests; run focused tests red.
2. Add media rejection tests for duration, pixel count, frame rate, audio limits, signature/polyglot mismatch, truncated probe failure, quarantine cleanup, and trusted-store non-admission; run focused tests red.
3. Implement the pure timeline interaction module and canonical source-range validation.
4. Rebuild the Timeline panel around selection, shared scroll geometry, working transport, pointer capture, trim preview/commit, zoom controls, and keyboard commands.
5. Implement pre-store quarantine probing, structured budgets/rejections, subprocess-output bounds, and CLI error-code projection.
6. Extend browser QA to prove view-state revision invariance, direct trim/split revision changes, zoom/ruler/waveform behavior, keyboard edits, focus/labels, and viewport containment.
7. Run focused/full tests, typecheck, production build, real browser QA, media/runtime/CLI/render/cancellation smokes, audit, handover validation, and visual inspection.

## Acceptance criteria

- Initial selection, playhead, zoom, transport, and ripple changes leave project revision unchanged.
- Clip selection works by pointer and keyboard and has a clearly visible selected/focused state.
- Playhead pointer scrubbing and all documented keyboard movement clamp and snap correctly.
- Left/right handle drags show a transient preview and commit exactly one typed trim operation on release.
- Split/trim toolbar and keyboard commands target the selected clip and current playhead, not fixture IDs or fixed times.
- The kernel rejects source ranges beyond the immutable asset duration for UI and agent callers.
- Ruler density increases with zoom; labels remain readable; waveform crop maps to `sourceIn` and clip duration.
- Timeline horizontal scrolling retains fixed track identity and does not create page-level overflow.
- Rejected sources are absent from the trusted object store and repository, quarantine files are removed, and adapters receive stable path-free rejection codes.
- Existing render, persistence, revision/idempotency, undo/redo, media derivatives, SDK/CLI, and workspace-shell tests remain green.
- Chrome QA at 1440x1000 captures and verifies the direct-edit state without cropped primary controls or broken imagery.

## Explicit non-goals

- Copying CapCut/Canva layout, icons, wording, effects, media, templates, or interaction details.
- Native synchronized video/audio playback, decode-frame preview, J/K/L shuttle, or audio scrubbing.
- Clip move/reorder, snapping to other clips/markers, linked A/V edit groups, ripple delete, or multitrack selection.
- Multiresolution/tiled waveform generation, spectral views, cache eviction, or large-project performance claims.
- OS sandbox/container enforcement, codec allowlisting, antivirus integration, archive import, or broad format support.
- Tauri packaging, authenticated IPC, MCP transport, publishing, collaboration, or signed distribution.
