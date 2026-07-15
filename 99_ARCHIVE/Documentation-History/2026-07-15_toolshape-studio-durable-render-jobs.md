# Documentation history: Toolshape Studio durable render jobs

- **Date:** 2026-07-15
- **Runtime:** Codex
- **Pass type:** implementation + architecture + verification + security
- **Result:** COMPLETE / VERIFIED LOCAL JOB SLICE

## Historical change

This pass changed rendering from a verified direct script into a semantic, durable local capability. The permanent Studio repository now owns render acceptance, SQLite job/event state, transactional worker claim, progress/cancellation/recovery, trusted FFmpeg compilation, probe verification, artifact hashing/registration, adapter parity, and visible accepted-job feedback.

## Why it mattered

- It made the long-running work model executable rather than only architectural.
- It kept public operation input free of filesystem paths and FFmpeg arguments.
- It separated queue acceptance from process/media verification evidence.
- It established one completion transaction for terminal job truth and immutable artifact truth.
- It preserved the browser-safe kernel and native-host boundary needed for later Tauri/MCP adapters.

## Affected surfaces

- Kernel job contracts/capabilities and adapter result shapes.
- SQLite migrations, jobs, events, artifacts, transitions, claim, cancellation, and recovery.
- Render worker, FFmpeg toolchain evidence, CLI work/recover commands, and SDK parity tests.
- Editor render control and Chrome QA.
- Product/operator status, jobs architecture, threat model, learning note, build/daily/activity records, and indexes.

## Current boundary

The result is complete for the verified single-machine SQLite render slice. Authenticated IPC, MCP, native Tauri hosting, multi-host leases, real source-media proxy ingestion, signing, and category-complete editing remain partial, not built, or unverified.

## Links

- [Build log](../../07_LOGS/Build-Logs/2026-07-15-ChaseOS-toolshape-studio-durable-render-jobs.md)
- [Daily note](../../07_LOGS/Daily/2026-07-15.md)
- [Agent activity](../../07_LOGS/Agent-Activity/2026-07-15-codex-toolshape-studio-durable-render-jobs.md)
- [Milestone plan](../../docs/plans/TOOLSHAPE-STUDIO-DURABLE-RENDER-JOBS.md)
- [Implementation plan](../../docs/plans/TOOLSHAPE-STUDIO-IMPLEMENTATION-PLAN.md)
