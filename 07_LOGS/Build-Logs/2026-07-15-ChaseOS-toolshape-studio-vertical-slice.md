# Build log: Toolshape Studio vertical slice

- **Date:** 2026-07-15
- **Runtime:** Codex
- **Session descriptor:** `2026-07-15_toolshape-studio-vertical-slice`
- **Phase/pass:** foundation and first unified vertical slice
- **Branch:** `work/studio`
- **Status:** PARTIAL / VERIFIED VERTICAL SLICE

## Task summary

Turn the documentation-only permanent repository into the beginning of an independently owned Toolshape Studio product. Reuse only useful source from the earlier donor seed, then add a canonical semantic kernel, durable persistence, content-addressed import, real editor interaction, adapter proof, security boundaries, and verified PNG/MP4 output.

## Repo-truth baseline

- The permanent repository contained 137 handover/reference files and no application packages.
- `python scripts/verify_handover.py` passed 9 document/schema checks, but that established packet integrity only.
- The newer master archive defined Studio as an independent repository and was treated read-only.
- Archive and repository shared schemas were semantically aligned; placeholder archive schema IDs were not copied.
- The direct user prompt selected `Toolshape Studio` / `toolshape-studio`, overriding the archive's spaced naming for active implementation.
- A donor repository had a useful domain/editor/render seed but no shared-envelope kernel, SQLite persistence, content store, or canonical CLI.

## Files read

- Root and product `AGENTS.md` files in the permanent repository and master archive.
- Permanent-repo README, launch, validation, change log, all `docs/00` through `docs/19`, all `products/studio/*`, platform handoffs, schemas/examples, research notes/sources, legal documents, and launch scripts.
- Archive `README.md`, `MASTER-HANDOVER.md`, `CANONICAL-NAMES-AND-PATHS.md`, newer `projects/Tool Shape Studio/*`, and relevant shared-foundation handoffs/specs.
- Donor domain, engine, render, fixture, editor, and QA source files only.

## Files created

- Root npm workspace manifests and ignore rules.
- `apps/studio/` React editor, QA, render, runtime, and CLI smoke scripts.
- `packages/studio-domain/`, `studio-engine/`, `studio-kernel/`, `studio-persistence/`, `studio-render/`, `studio-sdk/`, and `studio-cli/`.
- Generated/license-safe fixtures under `fixtures/studio/`.
- Implementation plan and ADRs under `docs/plans/` and `docs/adr/`.
- Threat model and learning note under `docs/security/` and `docs/learning/`.
- This build log, documentation-history note, daily note, agent-activity log, and their indexes.

## Files modified

- `README.md` and `products/studio/README.md` with truthful current implementation status.
- `apps/studio/README.md` and `THIRD_PARTY.md` with current run, boundary, and audit evidence.
- `scripts/verify_handover.py` to exclude noncanonical dependency/build/runtime/artifact folders.
- Generated `MANIFEST.sha256`, `TREE.txt`, and `VALIDATION.md` through the handover validator.

## What changed

- Added a versioned, renderer-neutral unified project model with immutable assets, scenes, nodes, tracks, clips, captions, audio settings, effects, animation keyframes, render presets, and provenance.
- Added exact rational-time helpers, matrix math, interpolation, validation, migrations, and typed split/trim/ripple/text/transform/audio/caption/keyframe/effect/style operations.
- Added a browser-safe semantic kernel with runtime envelope checks, capability grants, expected revisions, deterministic state digests, dry-run planning, atomic batches, idempotency replay/conflict, immutable results, and revision-bound undo/redo.
- Added SQLite migrations and transactional projects, revisions, operation logs, idempotency, asset/job tables, plus restart recovery.
- Added SHA-256 content-addressed import with filename, media-type, size, path, and create-once controls.
- Added a thin SDK and JSON stdin/file CLI over the same kernel.
- Wired the editor's human and agent-style edits through the same kernel, retaining direct-selection/viewport state as ephemeral UI state.
- Added a real three-panel editor with scene canvas, assets/layers, inspector/review panel, timeline, captions, waveform, operations, quality gate, undo/redo, and export view.
- Added safe FFmpeg plans (`spawn` argument arrays, `shell: false`), partial-output promotion, bounded diagnostics, cancellation cleanup, and FFprobe verification.

## Tests and commands run

| Command | Result |
|---|---|
| `python scripts/verify_handover.py` (pre-build) | PASS — 9 checks, 0 warnings, 137 files |
| `pnpm install` | ENVIRONMENT FAILURE — produced no tree and timed out; no dependency output was retained |
| `npm install --ignore-scripts --no-audit --no-fund` | PASS — fresh canonical install, 115 packages |
| `npm test` (first canonical run) | 25 passed, 1 failed due overly narrow assertion; runtime rejection itself was correct |
| `npm test` (final) | PASS — 7 files, 27 tests |
| `npm run typecheck` | PASS — strict `tsc --noEmit` |
| `npm run build` | PASS — Vite production build, 42 modules, 232.18 kB JS / 16.44 kB CSS |
| `npm run qa:browser` against stale port 4173 | EXPECTED DIAGNOSTIC FAILURE — discovered donor app occupying port |
| `$env:STUDIO_URL='http://127.0.0.1:4174/'; npm run qa:browser` | PASS — Chrome HTTP 200, canonical revisions r0→r6, two video clips, valid quality gate, editor/cover captures |
| `npm run render:golden` | PASS — H.264/AAC MP4, 1080×1920, 8.000 s, 196225 bytes, SHA-256 `c31a6ccda1ff111a479de6297a5066ed64584acc9ff0689098ed48381ef1fdb4` |
| `npm run test:render-cancel` | PASS — cancellation observed; no final or partial artifact remained |
| `npm run smoke:runtime` | PASS — real PNG imported by SHA-256, dry-run nonmutation, SQLite close/reopen digest recovery `fnv1a64:059fd5faf3d291d7` |
| `npm run smoke:cli` | PASS — separate process initialized project and committed revision 1, digest `fnv1a64:bb30136fba9b5606` |
| `npm audit --audit-level=high` | PASS — 0 vulnerabilities |
| `git diff --check` | PASS |
| `python scripts/verify_handover.py` (post-build) | PASS — final canonical source/docs validation; generated report/index refreshed |

## Verification evidence

- Editor screenshot: `apps/studio/artifacts/studio-editor-post-edit.png` (generated, ignored).
- PNG cover: `apps/studio/artifacts/golden-cover.png`, decoded 540×960, 92634 bytes, SHA-256 `9ce9e233d0b5b5914fff4eb5ddce9a442f3abde26b0436bfd9772fd60f4fbc0b` (generated, ignored).
- MP4: `apps/studio/artifacts/golden-studio.mp4` with all FFprobe checks passing (generated, ignored).
- Visual inspection confirmed the screenshot is the real editor and the cover has no visible layout or encoding corruption.
- Runtime and CLI smoke databases are under ignored `runtime/` directories and recover the expected revisions/digests.

## What did not change

- The master archive and earlier donor repository remained read-only.
- No competitor code, private prompts, templates, media, distinctive layout, or assets were copied.
- No donor `.git`, dependency folder, cache, build output, or private media was copied.
- Existing shared JSON schema identifiers were not rewritten to archive placeholder URLs.
- No remote, branch merge, push, or release tag was created.

## Remaining unverified / open loops

- **NOT BUILT:** Tauri shell, native IPC, installer/signing, updater, and platform integration. Cargo/Rust and Visual Studio provisioning tools are absent on this host.
- **PARTIAL:** render execution is verified, but durable render job lifecycle/progress/retry/crash recovery is not yet exposed through the public envelope.
- **PARTIAL:** SDK and real JSON CLI are verified; MCP, authenticated local IPC, and cross-transport render/job parity are not built.
- **PARTIAL:** runtime envelope checks cover the implemented subset but are not yet direct Draft 2020-12 validation against every shared schema field.
- **PARTIAL:** import uses a real generated PNG; real video/audio probe, proxy generation, waveform extraction, hostile codec corpus, and project archive format remain.
- **NOT BUILT:** secret broker, egress/publishing, encrypted database choice, deletion/crypto-erasure, collaboration, and signed distribution.
- **UNVERIFIED:** accessibility audit, performance budgets, large-project stress, GPU paths, native fonts, and cross-platform behavior.
- Node 24 reports `node:sqlite` as experimental; the repository abstraction is intended to preserve migrations if the host moves to Rust/SQLite.

## Next recommended pass

Implement durable render jobs and event/progress/cancellation persistence, expose `render`, `job.get`, and `job.cancel` through SDK and JSON CLI parity tests, then provision Rust/MSVC and add the thin Tauri IPC host without moving domain logic.

## Links

- [Documentation-history note](../../99_ARCHIVE/Documentation-History/2026-07-15_toolshape-studio-vertical-slice.md)
- [Daily note](../Daily/2026-07-15.md)
- [Agent activity](../Agent-Activity/2026-07-15-codex-toolshape-studio-vertical-slice.md)
- [Implementation plan](../../docs/plans/TOOLSHAPE-STUDIO-IMPLEMENTATION-PLAN.md)
- [Threat model](../../docs/security/THREAT-MODEL.md)
- [Learning note](../../docs/learning/2026-07-15-vertical-slice.md)
