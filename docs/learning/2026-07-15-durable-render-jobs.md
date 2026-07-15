# Learning note: durable render jobs

**Date:** 2026-07-15  
**Status:** VERIFIED LOCAL JOB SLICE

## Evidence-backed learnings

1. **Persist intent, not process authority.** A public render request only needs an immutable project asset, a project-owned preset, and a safe logical filename. Paths and FFmpeg arguments belong inside the trusted worker.
2. **Queue acceptance is not render success.** The browser proves semantic acceptance, while a separate worker/process smoke proves claim, execution, probe verification, hashing, and artifact registration.
3. **Completion and artifact registration form one truth boundary.** Writing both in one SQLite transaction prevents a completed job from pointing at an absent artifact or an artifact from escaping a failed completion.
4. **Cancellation has two distinct proofs.** Queued cancellation is an idempotent state transition; active cancellation must also prove process termination and removal of both partial and final output.
5. **Browser safety benefits from a transport-neutral gateway.** The kernel can expose the same render/get/cancel semantics in React without importing Node, SQLite, paths, or child-process APIs.
6. **Recovery needs a bounded policy.** Interrupted running work becomes retryable only while attempts remain; otherwise it becomes failed. A cancellation request recovers to cancelled rather than restarting work.
7. **SQLite transactions solve the current ownership problem, not every future one.** The tested atomic claim is appropriate for one local database. Multi-host workers still require explicit leases, heartbeats, and expiry semantics.

## Next experiments

- Probe real source video/audio on import and generate a content-addressed proxy and waveform.
- Validate envelopes and job/artifact records directly against the shared Draft 2020-12 schemas.
- Add worker heartbeat/lease experiments and forced-crash tests before claiming broader concurrency resilience.
- Provision Rust/MSVC and put authenticated Tauri IPC around the existing service without moving domain logic.
- Add hostile media, resource-budget, accessibility, and large-project performance suites.
