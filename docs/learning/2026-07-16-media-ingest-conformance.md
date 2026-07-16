# Learning note: media ingestion and public contracts

**Date:** 2026-07-16
**Status:** VERIFIED MEDIA AND CONTRACT SLICE

## Evidence-backed learnings

1. **Declared media type is not evidence.** A MIME allowlist prevents obvious executables but still accepts a WAV renamed as MP4. Byte sniffing must happen before storage, and FFprobe must inspect the immutable stored blob.
2. **Normalize probes; do not persist arbitrary metadata.** Container, duration, dimensions, frame rate, codec, sample rate, and channel count are useful canonical facts. Tags/comments are untrusted input and remain outside project truth.
3. **A proxy is a new immutable asset.** It needs its own digest, content reference, normalized probe, source-digest provenance, and toolchain evidence. It is not a mutable cache path embedded in a project.
4. **Project migration belongs at durable read/write boundaries.** Migrating only a fixture leaves old SQLite snapshots unsafe. Repository create/get/revision paths now normalize v1 projects to v2.
5. **Shared schemas and internal application objects serve different needs.** The kernel benefits from rich snapshots and worker fields; portable SDK/CLI documents must remain deliberately smaller. Explicit projection is safer than making schemas silently accept everything.
6. **Schema validity is necessary but capability-specific checks still matter.** The generic shared schema allows arbitrary resource types; Studio must additionally require a `studio_project` target and consistent revisions.
7. **A smoke should cross the real adapter boundary.** The final media proof uses a separate JSON CLI process, not only a service call, and confirms that returned metadata contains no local path.

## Next experiments

- Generate content-addressed waveform and thumbnail derivatives from the same normalized probe.
- Move FFprobe/FFmpeg ingestion into a sandboxed worker with CPU, memory, decode, and output budgets.
- Add malformed/truncated/polyglot media and metadata-injection corpora.
- Add approval-bound file selection for authenticated Tauri IPC after Rust/MSVC provisioning.
- Extend contract conformance to future MCP resources/progress without exposing internal state.
