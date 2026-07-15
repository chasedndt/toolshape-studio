# Build log: Toolshape Studio durable render jobs

- **Date:** 2026-07-15
- **Runtime:** Codex
- **Session descriptor:** `2026-07-15_toolshape-studio-durable-render-jobs`
- **Phase/pass:** Milestone 2 - durable local render lifecycle
- **Branch:** `work/studio`
- **Plan commit:** `30316b9`
- **Implementation commit:** `ede82b7`
- **Status:** COMPLETE / VERIFIED LOCAL JOB SLICE

## Task summary

Continue the permanent Toolshape Studio build after the first vertical-slice checkpoint. Replace direct script-only rendering and the placeholder jobs table with a production-shaped local queue, shared semantic capabilities, durable progress/cancellation/recovery, a separate CLI worker, and verified immutable artifact registration.

## Repo-truth baseline

- Milestone 1 was committed and the worktree began clean at `1955b1d` on `work/studio`.
- Direct FFmpeg execution, probe verification, and active-process cancellation were already verified.
- The SQLite jobs table was a placeholder without a repository, transition rules, event history, recovery, or artifact registration.
- `studio.project.render`, `studio.job.get`, and `studio.job.cancel` were absent from the capability registry and CLI.
- The browser render control displayed a static proof notice rather than a semantic accepted job.
- Tauri/native IPC remained blocked because Rust/Cargo/MSVC provisioning is absent on this host.

## Files read

- The attached deep-build prompt and repository `AGENTS.md`.
- Current implementation plan, Milestone 1 build/history/daily/activity records, relevant jobs/events/artifact architecture, schemas, threat model, platform handoffs, and Studio source/tests.
- Current Git branch, worktree, and recent checkpoint commits.

## Files created

- `docs/plans/TOOLSHAPE-STUDIO-DURABLE-RENDER-JOBS.md`
- `docs/adr/0007-durable-render-job-lifecycle.md`
- `docs/learning/2026-07-15-durable-render-jobs.md`
- `packages/studio-kernel/src/jobs.ts`
- `packages/studio-kernel/tests/jobs.test.ts`
- `packages/studio-persistence/tests/jobs-persistence.test.ts`
- `packages/studio-render/src/durable-jobs.ts`
- `packages/studio-render/tests/durable-jobs.test.ts`
- `apps/studio/scripts/smoke-render-job.ts`
- This build log, documentation-history note, and agent-activity record.

## Files modified

- Root/app/product READMEs, implementation plan, jobs architecture, threat model, daily note, and indexes.
- Studio kernel contracts, repository boundary, capability handler, and exports.
- SQLite schema/repository, render runner/exports, SDK parity tests, CLI host/commands, and workspace manifests/lockfile.
- Studio state, Render control, and Chrome QA assertions.
- Generated handover validation manifest/tree/report.

## What changed

- Added transport-neutral job, progress, event, render-request, and artifact contracts plus a browser-safe memory gateway.
- Added `studio.project.render`, `studio.job.get`, and `studio.job.cancel` with grant, project, revision, and idempotency enforcement.
- Added a forward-only SQLite jobs migration, ordered job events, artifact table, allowed transition checks, atomic claim, cancellation, bounded retry/recovery, and atomic job-completion/artifact registration.
- Added a durable render service that resolves only strict `content://sha256/<digest>` sources below the content root, generates outputs below the artifact root, compiles typed FFmpeg arguments inside the worker, polls cancellation, removes failed output, verifies with FFprobe, and hashes the final artifact.
- Added CLI `work` and `recover` commands over the same SQLite repository and kernel construction.
- Added SDK/JSON adapter parity tests for render acceptance, job read, and cancellation.
- Changed the editor Render control to queue through the semantic kernel and show the accepted job ID/status.
- Added a real cross-process smoke covering import, queue, work, job readback, artifact/event readback, and queued cancellation.

## Tests and commands run

| Command | Result |
|---|---|
| `npm test` (first job-contract run) | EXPECTED TDD RED - 27 passed, 3 failed because `MemoryStudioJobGateway` was not yet implemented |
| focused persistence test run (first run) | EXPECTED TDD RED - 4 failed because job/artifact repository methods were not yet implemented |
| focused kernel, persistence, render-worker, and SDK tests | PASS after implementation |
| `npm test` (final) | PASS - 10 files, 39 tests |
| `npm run typecheck` | PASS - strict `tsc --noEmit` |
| `npm run build` | PASS - Vite production build, 43 modules, 236.14 kB JS / 16.44 kB CSS |
| `$env:STUDIO_URL='http://127.0.0.1:4175/'; npm run qa:browser` | PASS - Chrome HTTP 200, revision 6, two video clips, canonical state valid, accepted queued job notice |
| `npm run smoke:render-job` | PASS - separate CLI worker completed verified MP4 and registered artifact; second queued job cancelled |
| `npm run test:render-cancel` | PASS - cancellation observed; neither final nor partial output remained |
| `npm run smoke:runtime` | PASS - content import, dry-run, SQLite close/reopen recovery |
| `npm run smoke:cli` | PASS - separate-process init and revision mutation |
| `npm audit --audit-level=high` | PASS - 0 vulnerabilities |
| `python scripts/verify_handover.py` | PASS - 9 checks, 0 warnings, 224 files, 67686 approximate words |
| `git diff --check` | PASS |

## Verification evidence

- Chrome loaded the canonical app at HTTP 200 and captured `apps/studio/artifacts/studio-editor-post-edit.png` (generated/ignored).
- Visual inspection confirmed coherent selected-title, inspector, timeline, quality-gate, revision, and queued-job states.
- The generated source cover was 540x960, 92634 bytes, SHA-256 `9ce9e233d0b5b5914fff4eb5ddce9a442f3abde26b0436bfd9772fd60f4fbc0b`.
- Job `91c4ef58-d692-4e29-a0e8-fd842d58127f` completed on attempt 1 in a separate CLI worker process.
- FFmpeg/FFprobe 8.1.1 verified H.264 video, AAC audio, 1080x1920 dimensions, and 8.000-second duration.
- Artifact `3bd88df5-3c0b-4e33-8570-5b359f847369` was registered at 196225 bytes with SHA-256 `c31a6ccda1ff111a479de6297a5066ed64584acc9ff0689098ed48381ef1fdb4`.
- Persisted event status history ran from queued through running progress to completed.
- Queued job `eb5253b1-106d-4143-99e6-cad628fe87ef` became cancelled.

## What did not change

- The master archive, earlier donor repository, and Toolshape Voice remained read-only/out of scope.
- No competitor source, private prompts, templates, media, distinctive assets, dependency trees, or Git history were copied.
- No unauthenticated local server, arbitrary FFmpeg argument surface, arbitrary output path, remote transport, or secret value was introduced.
- No push, merge, release, signing, or native toolchain installation was performed.

## Remaining unverified / open loops

- **NOT BUILT:** Tauri shell, authenticated IPC, MCP, installer/signing/updater, and native platform integration. Rust/Cargo/MSVC remain unavailable.
- **PARTIAL:** SQLite atomic claims and recovery are verified for the local model; multi-host leases, heartbeats, arbitrary crash timing, and distributed workers are not.
- **PARTIAL:** generated PNG input and rendering are real; real source video/audio import probing, proxy generation, waveform extraction, and hostile codec coverage remain.
- **PARTIAL:** runtime checks cover the implemented contracts; direct conformance against every shared Draft 2020-12 schema field remains.
- **NOT BUILT:** secret broker, egress/publishing, encrypted database choice, deletion/crypto-erasure, collaboration, and signed distribution.
- **UNVERIFIED:** accessibility, large-project/performance budgets, GPU paths, cross-platform behavior, and worker sandbox/resource limits.
- Node 24 still reports `node:sqlite` as experimental.

## Next recommended pass

Add real media probe/proxy ingestion and direct shared-schema conformance tests. In parallel, provision Rust/MSVC before attempting the thin authenticated Tauri IPC host; do not move domain or render-job logic into the shell.

## Links

- [Documentation-history note](../../99_ARCHIVE/Documentation-History/2026-07-15_toolshape-studio-durable-render-jobs.md)
- [Daily note](../Daily/2026-07-15.md)
- [Agent activity](../Agent-Activity/2026-07-15-codex-toolshape-studio-durable-render-jobs.md)
- [Milestone plan](../../docs/plans/TOOLSHAPE-STUDIO-DURABLE-RENDER-JOBS.md)
- [Implementation plan](../../docs/plans/TOOLSHAPE-STUDIO-IMPLEMENTATION-PLAN.md)
- [Threat model](../../docs/security/THREAT-MODEL.md)
- [Learning note](../../docs/learning/2026-07-15-durable-render-jobs.md)
