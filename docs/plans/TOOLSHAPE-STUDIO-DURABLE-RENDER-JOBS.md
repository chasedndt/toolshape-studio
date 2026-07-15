# Toolshape Studio durable render jobs plan

**Date:** 2026-07-15  
**Runtime:** Codex  
**Session:** `2026-07-15_toolshape-studio-durable-render-jobs`  
**Status:** IN PROGRESS

## Repo-truth delta

- Milestone 1 is committed and the worktree starts clean at `1955b1d` on `work/studio`.
- Direct FFmpeg rendering, verification, and in-process cancellation are verified.
- The SQLite schema contains only a placeholder jobs table; it has no typed repository, transition enforcement, event history, recovery, or artifact registration.
- `studio.project.render`, `studio.job.get`, and `studio.job.cancel` are absent from the capability registry.
- The SDK/CLI can invoke project edits, but the CLI cannot enqueue or run durable work.
- Tauri/native IPC remains blocked by missing Rust/Cargo/MSVC, so durable local jobs are the deepest unblocked implementation path.

## Milestone outcome

Implement one production-shaped local render queue that:

1. accepts a revision-bound `studio.project.render` envelope;
2. resolves a project asset by immutable `content://sha256/...` reference and a project render preset;
3. persists a queued job and event before returning `accepted_job`;
4. allows `studio.job.get` and idempotent `studio.job.cancel` through the same kernel;
5. claims work transactionally in a separate CLI worker process;
6. persists progress, attempts, cancellation requests, terminal status, and redacted errors;
7. compiles the typed request into the existing shell-free FFmpeg plan only inside the trusted worker;
8. registers an immutable artifact only after FFprobe verification and SHA-256 hashing;
9. recovers interrupted jobs deterministically after restart;
10. proves SDK/JSON CLI parity and a real queued-to-completed MP4 workflow.

## Canonical changes

### Kernel contracts

- Add shared `DurableJob`, `JobEvent`, `ArtifactRecord`, and `StudioRenderRequest` types matching the existing JSON Schema vocabulary.
- Extend the capability allowlist with `studio.project.render`, `studio.job.get`, and `studio.job.cancel`.
- Extend operation results with `accepted_job`, pending verification, job and artifact references.
- Introduce a transport-neutral `StudioJobGateway`; the kernel remains browser-safe.
- Persist idempotency results for job commands without mutating project revisions.

### Persistence

- Add a forward-only SQLite migration for job lifecycle columns, job events, and artifacts.
- Enforce allowed transitions in repository methods.
- Claim queued/retry work under `BEGIN IMMEDIATE` so two workers cannot own one job.
- Recover `running` jobs to retry/failure and `cancel_requested` jobs to cancelled on worker restart.

### Render worker

- Resolve content and artifact paths beneath configured roots.
- Reject non-content-addressed assets, unsafe output names, missing presets, and path escapes before enqueue.
- Persist only typed render intent; compile FFmpeg arguments at worker execution time.
- Poll durable cancellation while FFmpeg runs.
- Keep partial output unregistered and remove it on failure/cancellation.
- Persist verified artifact digest, media type, size, project revision, producer operation/job, and toolchain evidence.

### Adapters and UI

- Construct the same job gateway in the SDK/CLI host.
- Add a JSON `work` command that claims one durable job and returns structured job/artifact state.
- Add parity tests for render acceptance, job reads, and cancellation.
- Make the editor Render control issue the semantic render capability through an in-memory gateway, displaying the accepted job rather than a static notice. Execution remains a desktop/CLI host responsibility.

## TDD and verification order

1. Add failing kernel tests for render acceptance, revision/grant checks, job reads, cancellation, idempotency, and cross-project denial.
2. Add failing SQLite tests for migration, transitions, competing claims, restart recovery, event order, and artifact durability.
3. Implement the transport-neutral contracts/gateway and SQLite job repository until focused tests pass.
4. Add failing render-worker tests for approved-root resolution, completion, artifact registration, cancellation, and failed-output non-registration.
5. Add SDK/CLI parity and real process smoke for queue → work → get.
6. Wire the editor control and extend browser QA to assert an accepted job ID/status.
7. Run full tests, typecheck, production build, real Chrome QA, real FFmpeg job smoke, audit, validator, and diff checks.

## Planned files

```text
packages/studio-kernel/src/jobs.ts
packages/studio-kernel/src/contracts.ts
packages/studio-kernel/src/repository.ts
packages/studio-kernel/src/kernel.ts
packages/studio-persistence/src/sqlite-repository.ts
packages/studio-render/src/durable-jobs.ts
packages/studio-sdk/src/index.ts
packages/studio-cli/src/bin.ts
apps/studio/src/studio-state.ts
apps/studio/src/App.tsx
apps/studio/scripts/smoke-render-job.ts
packages/*/tests/*.test.ts
```

## Stop conditions

- Do not introduce an unauthenticated loopback server.
- Do not accept arbitrary FFmpeg argument arrays or output paths from the envelope.
- Do not register artifacts before verification.
- Do not claim MCP, Tauri, or crash-proof multi-worker operation beyond the tests actually run.
- Do not modify the master archive, donor repository, or Toolshape Voice.

