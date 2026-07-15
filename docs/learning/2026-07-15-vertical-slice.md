# Learning note: first Toolshape Studio vertical slice

**Date:** 2026-07-15  
**Status:** VERIFIED

## Evidence-backed learnings

1. **A valid handover is not a build.** The packet validator passed before the repository had any application source. Build readiness requires independent toolchain and executable-surface proof.
2. **The archive is a reference, not a dependency.** The newer archive clarified independent product ownership. Shared contracts were copied/adapted into the Studio repository; no runtime path points back to the archive.
3. **Stale preview surfaces are a real operational hazard.** Port 4173 already served the earlier donor app. The canonical server selected 4174, and the first QA attempt exposed the mismatch when undo semantics differed. Future QA must bind to the URL printed by the current process and use strict-port startup where possible.
4. **The import URI is part of the security boundary.** The first runtime smoke failed because the validator did not recognize `content://sha256/...`. The fix added only the exact digest form; arbitrary schemes remain rejected.
5. **Undo/redo should preserve monotonic durable revisions.** Restoring an older snapshot creates a new revision instead of moving the revision counter backward. The returned inverse token enables immediate redo.
6. **One projection is enough for strong early proof.** The editor and export cover consume the same scene state. Chrome interaction QA plus decoded PNG dimensions and FFprobe-verified MP4 caught more than source review alone.
7. **Generated-tree validators must exclude dependencies and runtime output.** The handover validator originally traversed every directory. It now excludes `.git`, dependencies, builds, runtime state, and artifacts while continuing to cover canonical source/docs.

## Next experiments

- Replace TypeScript-only envelope assertions with direct JSON Schema conformance while preserving helpful error codes.
- Add durable render job rows, progress events, crash recovery, and adapter-level `render`, `job.get`, and `job.cancel` parity.
- Probe/import a generated source MP4 and create a real proxy instead of using fixture media metadata.
- Provision Rust/MSVC, scaffold the thin Tauri host, and prove authenticated IPC without moving business logic out of the semantic service.
- Run accessibility, hostile-project, malformed-media, and performance regression suites.
