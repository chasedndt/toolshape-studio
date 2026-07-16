# Build log: Toolshape Studio media ingestion and contract conformance

- **Date:** 2026-07-16
- **Runtime:** Codex
- **Session descriptor:** `2026-07-16_toolshape-studio-media-ingest-conformance`
- **Phase/pass:** Milestone 3 - probed media/proxy and public contracts
- **Branch:** `work/studio`
- **Plan commit:** `c6f3eb7`
- **Implementation commit:** `2bab9cb`
- **Status:** COMPLETE / VERIFIED MEDIA AND CONTRACT SLICE

## Task summary

Continue Toolshape Studio after durable render jobs. Replace declared-metadata-only imports with real byte sniffing, normalized FFprobe evidence, verified proxy generation, schema-v2 asset/derivative persistence, and a separate-process JSON CLI ingestion flow. Make SDK/CLI operation, result, job, and artifact documents directly conform to the canonical shared Draft 2020-12 schemas without exposing rich internal kernel state.

## Repo-truth baseline

- Milestones 1-2 were committed and the worktree began clean at `43e83a3` on `work/studio`.
- Content import enforced allowed declared types, name/path checks, size, SHA-256 storage, and immutable references, but did not inspect signatures or media streams.
- Canonical assets had declared dimensions/duration but no normalized probe or derivative records; project schema was v1.
- The SQLite `assets` table existed but was unused as a normalized media record.
- Rendering used real FFmpeg/FFprobe but the durable proof began from a generated PNG.
- SDK/CLI exposed rich internal kernel objects that were not direct instances of the canonical shared schemas.
- Rust/Cargo/MSVC remained absent, so native Tauri work stayed blocked.

## Files read

- Repository/root and Studio `AGENTS.md`, README, current plan, prior build log, architecture/security/jobs docs, Studio handover, video engine, relevant research notes, and shared schemas/examples.
- Domain, engine, content store, SQLite, kernel, renderer, SDK, CLI, fixture, tests, smokes, and package configuration.

## Files created

- `packages/studio-media/` process runner, proxy plan, ingestion service, types, package manifest, and tests.
- SDK public contract types, projections, Ajv validators, and conformance tests.
- `apps/studio/scripts/smoke-media-ingest.ts`.
- Milestone 3 plan, ADR 0008, and media/contract learning note.
- This build log, documentation-history note, daily note, and agent-activity record.

## Files modified

- Project model/migration, fixture, project validation, and tests for schema v2 media evidence.
- Content store signature matching and SQLite media/project migration boundaries.
- CLI `ingest-media`, SDK/CLI public shapes, adapter parity, and existing smoke scripts.
- Workspace/app/package manifests, lockfile, Vite/TypeScript test routing.
- Root/app/product status, Studio architecture, threat model, licensing record, implementation plan, indexes, and generated handover reports.

## What changed

- Added byte signature detection for PNG, JPEG, MP4, WAV, MP3, and WOFF2 and rejected declared-type disagreement before storage.
- Added pre-read file size checks for media ingestion.
- Migrated canonical projects from schema v1 to v2 with normalized source probe and immutable derivative fields; repository create/get/revision paths apply the migration.
- Added normalized FFprobe parsing for container, rational duration, video codec/dimensions/frame rate, and audio codec/sample rate/channels without persisting arbitrary tags.
- Added a fixed typed proxy plan, approved work root, shell-free FFmpeg execution, 30-second probe timeout, 5-minute proxy timeout, H.264/AAC/dimension/duration verification, partial cleanup, content hashing, and path-free derivative provenance.
- Added SQLite migration v3 media metadata persistence and close/reopen recovery.
- Added JSON CLI `ingest-media` through stdin; its response contains canonical metadata and no content path.
- Added Ajv 2020 plus format validation at the SDK/CLI boundary, internal/public projections, capability-specific target checks, and conformance tests against the repository schemas.
- Preserved rich internal kernel results while public documents exclude project snapshots, worker ownership fields, and local filesystem paths.

## TDD evidence

- First focused media run: 4 tests failed, 4 passed; failures proved schema v2, declared-type rejection, and the missing media package were not implemented.
- First public-contract run: 4/4 failed; validators/projections were missing and the shared actor shape was rejected by the internal kernel.
- Focused implementation closure: media/domain/engine/persistence/SDK conformance tests passed after implementation.

## Tests and commands run

| Command | Result |
|---|---|
| focused migration/import/media tests (first valid-path run) | EXPECTED TDD RED - 4 failed, 4 passed, one suite missing implementation |
| focused shared-contract tests (first run) | EXPECTED TDD RED - 4/4 failed because validators/projections were absent |
| focused domain/engine/persistence/media/SDK tests | PASS |
| `npm test` | PASS - 12 test files, 51 tests |
| `npm run typecheck` | PASS - strict `tsc --noEmit` |
| `npm run build` | PASS - Vite production build; 43 modules, 236.88 kB JS and 16.44 kB CSS |
| `npm run smoke:media-ingest` | PASS - generated source -> separate CLI -> sniff -> store -> probe -> proxy -> verify -> persist -> reopen |
| `npm run smoke:runtime` | PASS - import/edit/reopen/digest recovery |
| `npm run smoke:cli` | PASS - schema-valid separate-process edit |
| `npm run smoke:render-job` | PASS - durable render plus schema-valid job/artifact projection |
| `npm run test:render-cancel` | PASS - cancellation observed; no final/partial output |
| `$env:STUDIO_URL='http://127.0.0.1:4176/'; npm run qa:browser` | PASS - Chrome HTTP 200, revision 6, two video clips, canonical state valid, queued job notice |
| `npm audit --audit-level=high` | PASS - 0 vulnerabilities |
| `python scripts/verify_handover.py` | PASS - 9 checks, 0 warnings, 243 files, 71743 approximate words |
| `git diff --check` | PASS - no whitespace errors; Git reported expected LF-to-CRLF working-copy notices only |

## Verification evidence

- Generated source: MP4, 1646428 bytes, SHA-256 `b095a21e59ba173d339e2ccd48a74de52de7ddfb69300478e8a831fbe4fbb65d`.
- Source probe: H.264, 1280x720, 30 fps, 4.000 seconds; AAC, 48 kHz, mono.
- Verified proxy: MP4, 583769 bytes, SHA-256 `50fcc40bd1d6ba1e4603dfca6bed79ee321c34b894a64089685d0a3421f1ae5d`.
- Proxy probe: H.264, 960x540, 30 fps, 4.010 seconds; AAC, 48 kHz, mono.
- Toolchain: FFmpeg/FFprobe 8.1.1 full build.
- SQLite close/reopen returned the exact normalized source/derivative record.
- CLI response path-leak assertion was false.
- Shared-schema tests validated actual SDK/CLI operation results and separately validated job/artifact projections; extra public fields and wrong target resource type rejected.
- Durable render smoke completed job `620528a4-0ff0-4917-9354-1f6f9ff52ab6` on attempt 1 and validated the public job/artifact projections; the verified 196225-byte MP4 artifact digest was `sha256:c31a6ccda1ff111a479de6297a5066ed64584acc9ff0689098ed48381ef1fdb4`.
- Chrome screenshot `apps/studio/artifacts/studio-editor-post-edit.png` was visually inspected and remained coherent (generated/ignored).

## What did not change

- Toolshape Voice, the archive, donor repositories, private media, secrets, and unrelated files remained untouched.
- No arbitrary FFmpeg arguments, public filesystem output paths, remote providers, unauthenticated server, or new egress path was introduced.
- Canonical shared schema files remained at 0.1.0 and were not weakened to accept internal fields.
- No push, merge, release, native install, signing, or distribution occurred.

## Remaining unverified / open loops

- **NOT BUILT:** codec quarantine/sandbox, CPU/memory/decode budgets, waveform/thumbnail derivatives, broad importer set, malformed/polyglot media corpus.
- **NOT BUILT:** Tauri shell, authenticated IPC, MCP, installer/signing/updater. Rust/Cargo/MSVC remain unavailable.
- **PARTIAL:** public SDK/CLI operation/result/job/artifact documents conform; capability-specific input schemas remain generic objects and future transports need their own conformance proof.
- **PARTIAL:** SQLite local coordination is verified; multi-host leases and distributed workers are not.
- **NOT BUILT:** secrets, egress/publishing, encrypted storage choice, deletion/crypto-erasure, collaboration, and signed distribution.
- **UNVERIFIED:** accessibility, large-project performance, GPU paths, cross-platform behavior, and licensing of any future bundled FFmpeg distribution.
- Node 24 continues to report `node:sqlite` as experimental.

## Next recommended pass

Create waveform and thumbnail derivatives through the same normalized media boundary, add quarantine/resource budgets and a hostile/truncated/polyglot media corpus, then provision Rust/MSVC before adding approval-bound authenticated Tauri file selection.

## Links

- [Documentation-history note](../../99_ARCHIVE/Documentation-History/2026-07-16_toolshape-studio-media-ingest-conformance.md)
- [Daily note](../Daily/2026-07-16.md)
- [Agent activity](../Agent-Activity/2026-07-16-codex-toolshape-studio-media-ingest-conformance.md)
- [Milestone plan](../../docs/plans/TOOLSHAPE-STUDIO-MEDIA-INGEST-CONFORMANCE.md)
- [Implementation plan](../../docs/plans/TOOLSHAPE-STUDIO-IMPLEMENTATION-PLAN.md)
- [Threat model](../../docs/security/THREAT-MODEL.md)
- [Learning note](../../docs/learning/2026-07-16-media-ingest-conformance.md)
