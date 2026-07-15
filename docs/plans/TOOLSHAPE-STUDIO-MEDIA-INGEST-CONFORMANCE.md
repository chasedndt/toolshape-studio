# Toolshape Studio media ingestion and contract conformance plan

**Date:** 2026-07-16  
**Runtime:** Codex  
**Session:** `2026-07-16_toolshape-studio-media-ingest-conformance`  
**Status:** IN PROGRESS

## Repo-truth delta

- Milestones 1-2 are verified and committed; the worktree starts clean at `43e83a3` on `work/studio`.
- Content import hashes bytes and enforces names, declared media types, size limits, and approved roots, but it does not inspect magic bytes or probe real media.
- The canonical asset model contains declared dimensions/duration but no normalized probe evidence or derivative/proxy records.
- The SQLite `assets` table exists but is not used as a durable normalized media record.
- Rendering is a durable verified job, but its golden input is a generated PNG rather than a probed source video/audio asset.
- Shared Draft 2020-12 schemas and examples validate as a packet, while current SDK/CLI runtime objects are richer internal shapes and are not directly validated against those schemas.
- Tauri/native IPC remains blocked by absent Rust/Cargo/MSVC, so media and contract boundaries are the deepest unblocked next slice.

## Milestone outcome

Implement and verify one hostile-boundary media workflow that:

1. reads a generated source MP4 with video and audio;
2. rejects a declared media type that disagrees with byte signatures;
3. stores the original once by SHA-256 without mutation;
4. probes only the immutable stored blob with `ffprobe` through a shell-free process;
5. normalizes container, duration, video dimensions/frame rate, audio codec/rate/channels, and toolchain evidence;
6. creates a bounded H.264/AAC editing proxy through a typed, approved-root FFmpeg plan;
7. probes the proxy and registers it only after codec, stream, dimension, and duration checks pass;
8. stores the normalized original and proxy records durably in SQLite;
9. migrates canonical projects to schema v2 with explicit asset probe/derivative fields;
10. accepts and emits shared-schema-valid operation/result/job/artifact documents through SDK/JSON CLI adapters;
11. proves SDK/CLI projection parity without exposing internal project snapshots or filesystem paths;
12. leaves originals, failed partial proxies, and unrelated repositories untouched.

## Architecture decisions

### Media boundary

- Add a Node-only `@toolshape/studio-media` worker package.
- Treat declared media type as a hint that must match byte sniffing and probe evidence.
- Invoke `ffprobe`/`ffmpeg` with executable-plus-argument arrays and `shell: false`.
- Resolve source, temporary proxy, and derivative destinations beneath configured roots.
- Persist normalized metadata only; do not persist arbitrary input tags, comments, or embedded instructions.
- Import the verified proxy into content-addressed storage, then remove the temporary worker output.

### Canonical asset schema v2

- Add normalized probe evidence and immutable derivative records to every asset.
- Provide a forward-only v1 -> v2 migration that supplies empty probe/derivative state for existing projects.
- Keep source originals immutable and model proxies as derived content references with their own digest and provenance.

### Public contract boundary

- Keep shared contract version `0.1.0`; do not rewrite the canonical schemas in this pass.
- Introduce shared-schema-shaped public TypeScript documents and explicit internal-to-public projections.
- Validate public operation input and SDK/CLI output with Ajv 2020 plus format checks.
- Keep rich project snapshots, internal job ownership fields, and local paths inside the kernel/host boundary.
- Put schema-valid job documents in verification evidence and return schema-valid resource references at top level.

## TDD and verification order

1. Add failing byte-sniff/import tests for real signatures and declared-type mismatch.
2. Add failing domain migration/validation tests for schema v2 probe and derivative invariants.
3. Add failing media-worker tests for probe normalization, approved-root proxy planning, verification, and cleanup.
4. Add failing SQLite tests for normalized media records and restart durability.
5. Add failing public-contract tests using actual shared schemas and SDK/CLI results.
6. Implement the smallest code required to make focused tests green.
7. Generate a license-safe source MP4 with audio, run import -> probe -> proxy -> persist -> reopen, and record exact evidence.
8. Run the full suite, strict typecheck, production build, existing browser/render regressions, audit, validator, and Git checks.

## Planned files

```text
packages/studio-media/src/*
packages/studio-media/tests/*
packages/studio-domain/src/model.ts
packages/studio-domain/src/migrations.ts
packages/studio-engine/src/validation.ts
packages/studio-persistence/src/content-store.ts
packages/studio-persistence/src/sqlite-repository.ts
packages/studio-sdk/src/contracts.ts
packages/studio-sdk/src/index.ts
packages/studio-cli/src/bin.ts
apps/studio/scripts/smoke-media-ingest.ts
specs and adapter conformance tests (read-only schemas)
```

## Stop conditions

- Do not trust filename extensions or declared media type alone.
- Do not persist arbitrary FFprobe tags or raw stderr.
- Do not accept arbitrary FFmpeg arguments, filter graphs, or output paths.
- Do not register a proxy before a successful probe and digest.
- Do not expose internal filesystem paths through SDK/CLI operation results.
- Do not claim sandboxed codecs, native desktop readiness, MCP parity, or hostile-codec completeness.
- Do not modify Toolshape Voice, the archive, donor repositories, or private media.
