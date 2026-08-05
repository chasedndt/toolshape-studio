# Toolshape Studio connected-shell milestone

**Date:** 2026-08-05
**Runtime:** Codex
**Status:** IN PROGRESS / MILESTONE 8

## Outcome

Connect the editor interface to the real persistent kernel so that a human and an agent edit **one project, one store, one history**. Today the browser constructs its own `MemoryStudioRepository` while the CLI and MCP transport run against SQLite, so the two never meet: browser edits vanish on refresh and are invisible to agents, and agent edits are invisible to the browser.

This is the milestone that makes the product's central claim operationally true rather than merely architecturally true.

It also establishes the abstraction the desktop shell needs (ADR 0013): the UI becomes a **kernel client with a swappable transport**. Milestone 8 implements the HTTP transport; Milestone 11 substitutes a Tauri IPC channel behind the same interface without touching the interface code.

## Repo-truth baseline

- Milestones 1–7 are committed and verified on `work/studio`. The worktree began clean at `3ec4078`.
- `apps/studio/src/studio-state.ts` builds `new StudioKernel(new MemoryStudioRepository(), new MemoryStudioJobGateway())` inside a React ref. All UI edits land there and nowhere else.
- `packages/studio-mcp` serves the eight capabilities over authenticated HTTP and stdio, backed by `SqliteStudioRepository`. Verified by 21 unit tests and an 11-check HTTP smoke.
- The kernel already enforces grants, expected revisions and idempotency identically regardless of caller. No kernel change is required by this milestone.
- The UI currently seeds from `createGoldenStudioProject()` and holds `project` in React state, refreshed from each operation result.

## Design

### The UI becomes a transport client

```text
before   React ──► StudioKernel(MemoryStudioRepository)          isolated
after    React ──► StudioClient ──► transport ──► StudioKernel(SqliteStudioRepository)
                                       │
                                       ├── http     Milestone 8
                                       ├── memory   tests, storybook, offline demo
                                       └── tauri    Milestone 11
```

`StudioClient` exposes the same surface `useStudioState` exposes today — `inspect`, `apply`, `undo`, `redo`, `queueRender`, `getJob` — but every call is asynchronous and every mutation carries an expected revision obtained from the server rather than from local state.

### Consequences the UI must now handle

Moving from a synchronous in-process kernel to a remote one introduces four states the current code does not model. Each needs an explicit affordance, because silently ignoring them is how the parity claim rots:

1. **Latency.** Operations resolve asynchronously. Pending state must be visible and the affordance disabled while in flight.
2. **Staleness.** An agent may advance the revision between the UI's read and its write. A rejected write must surface as *"the project changed"*, then re-inspect and re-render — never a silent retry at the newer revision, which would discard the agent's work exactly as an agent forcing a write would discard the human's.
3. **Disconnection.** The transport may be unavailable. The UI must say so plainly rather than appearing to work.
4. **External change.** An agent edit should become visible without a manual refresh. Polling `inspect` on an interval is sufficient for this milestone; an event stream is deferred.

### Retained invariants

- **View state stays ephemeral.** Selection, playhead, zoom, drag preview, panel visibility and workspace remain local React state and never traverse the transport (ADR 0009, ADR 0011).
- **One operation per gesture.** A trim drag still commits exactly one `timeline.clip.trim` at pointer-up.
- **The UI holds no domain logic.** It builds envelopes and renders results; validation, grants, revisions and idempotency remain kernel-side.
- **Idempotency keys become load-bearing.** A retried request over a network must not double-apply, so each gesture derives a stable key rather than a fresh UUID per attempt.

## TDD and implementation order

1. Add `StudioClient` tests against a memory transport: inspect, apply, undo/redo, stale-revision surfacing, disconnection. Run red.
2. Implement `StudioClient` plus the `memory` and `http` transports.
3. Rewrite `useStudioState` over `StudioClient`, preserving its public shape so panel code is untouched.
4. Add pending, stale and disconnected affordances to the shell.
5. Add revision polling for externally-applied changes.
6. Add a dev-mode bootstrap that starts the MCP transport alongside Vite and seeds the golden project when the database is empty.
7. Extend browser QA to prove a human edit persists across reload and that an agent edit appears in the UI.
8. Full gates: focused and full tests, typecheck, production build, browser QA, all smokes.

## Acceptance criteria

- A trim or split performed in the UI survives a page reload.
- An operation applied over MCP becomes visible in the UI without a manual refresh.
- A UI edit against a revision an agent has advanced is refused, surfaced as a project-changed notice, and followed by a re-inspect — never a silent overwrite.
- Retrying an interrupted UI operation does not apply it twice.
- Workspace, panel, selection, playhead and zoom changes still perform no transport call and still leave the revision unchanged.
- With the transport unavailable, the UI reports a disconnected state rather than appearing functional.
- A new browser QA assertion proves human and agent edits share one revision sequence.
- Existing render, persistence, revision/idempotency, undo/redo, media, SDK/CLI/MCP and shell tests remain green.

## Explicit non-goals

- The Tauri shell itself (Milestone 11) — this milestone only establishes the transport seam it will use.
- Real-time collaboration, presence, or operational transform. Polling is sufficient; conflicts are resolved by revision refusal, not by merging.
- An event-stream transport. Deferred until polling demonstrably hurts.
- Multi-project management or a project browser. One project, as today.
- Authentication UX. The dev bootstrap uses a local token; a credential surface is future work.
- Offline editing with deferred sync. Out of scope and probably permanently — revision refusal is the concurrency model.
