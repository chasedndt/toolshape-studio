# Toolshape Studio implementation plan

**Date:** 2026-07-15  
**Runtime:** Codex  
**Session:** `2026-07-15_toolshape-studio-vertical-slice`  
**Status:** IN PROGRESS

## Repo-truth baseline

- The permanent repository contains a validated launch and research packet but no application source, package manifest, persistence layer, renderer, or executable editor.
- `VALIDATION.md` proves handover structure and schema/document integrity only. It does not prove build or product readiness.
- The master archive is reference-only. The Studio repository must own its kernel, persistence, policy, adapters, jobs, releases, and migrations.
- The newer archive contracts and the repository contracts are semantically aligned. Archive differences are primarily naming and schema-identifier changes, including placeholder archive URLs.
- A separate earlier Studio seed contains useful domain, editing, rendering, and browser-QA code. It may be selectively adapted as donor material; its Git history, dependencies, generated output, caches, and private data must not be copied.
- The direct build prompt selects **Toolshape Studio** and the slug `toolshape-studio`. This takes precedence for this repository over the archive's spaced family-name convention; see ADR 0001.

## Outcome for this pass

Build and verify one honest end-to-end slice:

1. create/open a versioned project;
2. import a locally generated, license-safe asset through a hostile-input boundary;
3. add and edit canonical scene nodes and timeline clips through typed operations;
4. preview changes in the real editor surface;
5. persist revisions, idempotency records, operations, assets, and jobs in SQLite/content-addressed storage;
6. expose the same inspect/plan/apply/validate/render/job-status semantics through an SDK service and JSON CLI adapter;
7. export a verified PNG and H.264/AAC MP4 using safe FFmpeg argument arrays;
8. prove undo/redo, stale-revision rejection, idempotent replay, atomic rollback, cancellation, and deterministic state digests;
9. capture visual QA from the running editor.

This is a production-shaped foundation, not a claim of Canva/CapCut feature parity or a finished desktop release.

## Architecture slices

### 1. Contracts and deterministic domain

- Keep project state JSON-serializable and renderer-independent.
- Use stable identifiers and normalized rational timeline time (`numerator` plus positive `denominator`). Public operation, job, and artifact envelopes use UUIDs.
- Model immutable asset originals, scenes, nodes, tracks, clips, captions, effects, render presets, jobs, artifacts, and provenance.
- Represent every user or agent mutation as a typed operation.
- Normalize state before hashing so replay and adapter comparisons are stable.

### 2. Semantic kernel

- Validate operation envelopes at runtime before handler invocation.
- Enforce expected revision, grants, idempotency key/digest rules, dry-run behavior, and atomic batches.
- Persist operation results and provenance.
- Produce undo tokens bound to the committed revision.
- Keep inspect, plan, apply, validate, render, job get, and job cancel as the compact public capability surface.

### 3. Persistence and assets

- Use a repository-owned SQLite database with explicit migrations and foreign keys.
- Store project snapshots and append-only operation/provenance rows transactionally.
- Store imported bytes under a SHA-256 content address; retain original filename only as metadata.
- Reject traversal, unsupported media, size-limit violations, and malformed metadata before durable import.
- Never mutate originals; proxies and renders are derived artifacts.

### 4. Editor

- React/TypeScript operator UI with asset rail, scene canvas, properties, timeline, transport, revision/status indicators, and render controls.
- UI commands call the same semantic service as adapters; component-local state is not authoritative project state.
- Selection and viewport state remain ephemeral, while document edits are canonical operations.

### 5. Rendering

- Use one scene projection for interactive preview and deterministic headless PNG capture.
- Compile timeline/render intent into a typed render plan.
- Execute FFmpeg only behind a validated process boundary using an executable plus argument array; never construct shell command strings.
- Probe codecs/filters at runtime and fail with structured diagnostics.
- Validate artifacts with image decoding and `ffprobe`, not file existence alone.

### 6. Adapters

- TypeScript SDK is the in-process reference adapter.
- JSON CLI maps stdin/files to canonical envelopes and reserves stdout for result JSON.
- Local IPC and MCP remain transport-only mappings over the same service; no duplicated business logic.
- Add parity fixtures that compare normalized results and final state digests across implemented adapters.

## Test-driven implementation order

1. Port only the donor domain tests and make them fail against the empty canonical repo.
2. Implement rational time, matrices, animation, model validation, migrations, and typed edit operations.
3. Add failing kernel tests for schema rejection, grants, stale revisions, idempotency, dry-run, atomic rollback, replay, undo/redo, and deterministic hashing; implement until green.
4. Add failing SQLite/content-store tests for migrations, transactional rollback, immutable deduplicated assets, hostile paths, and restart recovery; implement until green.
5. Build the editor against the service, then add browser interaction and accessibility assertions.
6. Add failing render-plan, FFmpeg safety, cancellation, and artifact-verification tests; implement until green.
7. Add SDK/CLI parity tests and smoke scripts.
8. Run the full unit/integration suite, production build, real browser QA, PNG render, MP4 render, cancellation test, and `ffprobe`/image verification.

## Planned repository shape

```text
apps/studio/                    React editor and browser QA
packages/studio-domain/        model, rational time, validation, migrations
packages/studio-engine/        typed deterministic edit operations
packages/studio-kernel/        envelopes, revisions, idempotency, transactions
packages/studio-persistence/   SQLite repositories and content store
packages/studio-render/        typed render plans and FFmpeg runner
packages/studio-sdk/           in-process public client
packages/studio-cli/           JSON CLI transport
fixtures/studio/               generated, license-safe fixtures
runtime/                       ignored databases, imports, jobs, artifacts
docs/adr/                      durable architecture decisions
docs/plans/                    executable implementation plans
```

## Commit checkpoints

1. `docs(studio): lock implementation plan and architecture decisions`
2. `feat(studio): add deterministic project editing core`
3. `feat(studio): persist projects operations and content assets`
4. `feat(studio): add unified editor and verified render path`
5. `feat(studio): expose sdk and json cli parity`
6. `docs(studio): record verification and session writeback`

Each checkpoint is committed only with its focused tests green. Existing user changes remain intact.

## Acceptance evidence

- Exact commands and exit codes in the build log.
- Unit and integration test counts.
- A browser-QA screenshot of the running real editor after interaction.
- Decoded PNG dimensions and digest.
- `ffprobe` JSON proving MP4 duration, dimensions, frame rate, and H.264/AAC streams.
- State digest equality for SDK/CLI parity.
- Restart recovery from SQLite.
- Explicit list of deferred and unverified surfaces, including desktop packaging and any adapter not exercised end to end.

## Stop conditions and non-goals

- Do not copy competitor code, layouts, wording, templates, icons, prompts, or media.
- Do not copy donor `.git`, dependency folders, caches, build outputs, secrets, or private media.
- Do not put raw renderer objects, file handles, process objects, or FFmpeg strings in project state.
- Do not claim desktop release readiness until a signed Tauri build is exercised on a provisioned Rust/MSVC host.
- Do not claim MCP or local IPC parity until those transports have end-to-end conformance evidence.
- Do not widen the feature surface before the vertical slice is deterministic, persisted, renderable, and recoverable.
