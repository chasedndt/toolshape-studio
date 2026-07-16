# Toolshape Studio preview-derivative milestone

**Date:** 2026-07-16
**Runtime:** Codex
**Session:** `2026-07-16_toolshape-studio-preview-derivatives`
**Status:** IN PROGRESS

## Outcome

Generate verified thumbnail and audio-waveform derivatives beside the existing editing proxy, persist them as immutable content-addressed asset evidence, and resolve them into the professional editor without putting local paths or browser URLs into canonical project state.

The visible result must replace the current CSS thumbnail treatment and arithmetic waveform bars with real media-worker outputs in the Media browser, Audio source panel, and timeline. The semantic result must remain equally usable by UI, CLI, SDK, and future MCP/IPC adapters.

## Repo-truth baseline

- Milestones 1-4 are committed and verified on `work/studio`.
- MP4 ingestion byte-sniffs the source, records a normalized FFprobe, generates and verifies an H.264/AAC proxy, stores both by SHA-256, and survives SQLite reopen.
- The editor shell exposes functional Media, Audio, and timeline panels, but its asset thumbnails are CSS illustrations and its waveform bars are arithmetic placeholders.
- The canonical asset model already names `thumbnail` and `waveform` derivative kinds, but its mandatory media probe cannot truthfully describe a PNG derivative.
- Preview paths/URLs are not canonical creative truth and must not enter project hashes, operation history, adapter documents, or render plans.

## Media contract

For an accepted video source, ingestion produces:

1. the immutable original;
2. a verified editing proxy;
3. one bounded PNG thumbnail selected from a deterministic source timestamp;
4. one bounded PNG waveform when an audio stream exists.

Every derivative records:

- stable kind and media type;
- SHA-256 identity and `content://sha256/...` reference;
- immutable status;
- dimensions and relevant duration;
- nullable normalized media probe, used only when the derivative is itself probeable media;
- source digest, toolchain, and creation time.

Thumbnail and waveform PNGs are verified from their byte signature and IHDR dimensions before registration. A failed required derivative prevents asset registration. All worker files live under the approved work root and are removed on success or failure.

Videos without audio remain valid and omit the waveform instead of inventing one.

## Schema and migration

Advance the canonical Studio project document from schema version 2 to 3 because image derivatives need `probe: null` rather than a misleading source/proxy probe. The migration must:

- preserve version-2 projects and derivatives;
- normalize missing derivative probes to `null`;
- preserve legacy version-0/1 migration behavior;
- keep the public operation-envelope version unchanged because this is a project-document migration, not an ANAC capability contract change.

## Safe worker plan

- Use `spawn` with `shell: false` through the existing process runner.
- Construct argument arrays only; never accept a raw FFmpeg command.
- Validate absolute input paths, approved work-root containment, safe work IDs, positive bounded dimensions, and finite timestamp values.
- Thumbnail: one PNG frame, aspect-preserving scale, deterministic timestamp.
- Waveform: mono visual analysis only, fixed pixel size, one PNG frame, no destructive audio mutation.
- Preserve originals and proxies exactly as today.

## UI resolution boundary

Canonical derivatives retain content references only. A host-provided preview resolver translates a derivative reference into a browser-safe URL. The web seed uses committed, licence-safe fixture derivatives generated from the verified golden MP4; a future Tauri host will resolve content references through authenticated local IPC/blob URLs.

The UI must show:

- real thumbnail imagery and derivative readiness in Media;
- a real waveform strip, sample-rate/channel evidence, and audible/muted status in Audio;
- the same resolved waveform on audio clips in the timeline;
- an honest icon-only treatment where an asset has no preview derivative, rather than simulated content.

## TDD and verification order

1. Add migration, FFmpeg-plan, derivative-verification, and ingestion expectations; run focused tests red.
2. Implement schema v3 and safe thumbnail/waveform worker plans.
3. Generate, validate, store, and persist derivatives atomically at asset-registration level.
4. Extend the real media-ingest smoke to verify three derivative kinds, content bytes, dimensions, toolchain, path redaction, and SQLite recovery.
5. Generate canonical fixture preview PNGs from the verified golden MP4 and register their real digests in the golden project.
6. Add the UI resolver and replace placeholder thumbnail/waveform visuals.
7. Extend browser QA to assert derivative evidence in Media, Audio, and timeline states and capture the same 1440x1000 viewport.
8. Run focused/full tests, strict typecheck, build, runtime/CLI/media/render checks, audit, handover validator, and visual inspection.

## Acceptance criteria

- Schema-v2 project documents migrate to schema v3 without data loss.
- MP4+audio ingestion returns proxy, thumbnail, and waveform derivatives with distinct content-addressed refs.
- PNG dimensions are verified before derivative registration.
- Video-only ingestion produces proxy+thumbnail and no invented waveform.
- Worker outputs cannot escape the approved root and are removed after every outcome.
- SQLite reopen returns the exact canonical asset record.
- No canonical metadata contains a local path, file URL, blob URL, or runtime work root.
- Media, Audio, and timeline panels display genuine resolved derivative files.
- Existing direct edits, agent review, undo/redo, workspaces, panel visibility, and render queue behavior remain green.
- The final browser state has no cropped primary controls, broken media aspect, unreadable waveform, accidental overflow, or false readiness claim.

## Explicit non-goals

- Copying CapCut/Canva assets, effects, copy, or distinctive layouts.
- Native file selection, authenticated IPC, Tauri packaging, or OS media decode sandboxing.
- Arbitrary user media formats beyond the current MP4 source contract.
- Full waveform zoom/tile pyramids, spectral views, audio editing, or GPU cache policy.
- Treating fixture URLs as production content storage.

