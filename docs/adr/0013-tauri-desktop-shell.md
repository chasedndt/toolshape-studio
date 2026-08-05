# ADR 0013 — Tauri as the desktop shell

**Date:** 2026-08-05
**Status:** ACCEPTED — decided by the operator
**Relates to:** ADR 0006 (local IPC and adapters), ADR 0012 (MCP network transport)
**Background:** `docs/architecture/NATIVE-SHELL.md`

## Context

Toolshape Studio's interface currently runs in a browser tab. Two consequences follow, and they are different in kind.

**1. Capture is impossible.** A browser sandbox permanently refuses window titles and focus changes, cursor position outside the page, keystrokes outside the page, and silent screen capture. Those are precisely the signals that make the capture pillar better than a screen recorder (`docs/product/CAPTURE-PILLAR.md` §2.1). Pixels are obtainable; the structured event data is exactly what the sandbox exists to deny.

**2. The UI holds its own kernel.** `apps/studio/src/studio-state.ts` constructs a `MemoryStudioRepository`. The browser therefore runs a *second, separate* instance of the kernel over an in-memory store, while the CLI and MCP transport run against SQLite. Architecturally the operation path is identical; operationally a human and an agent are editing two different projects. Edits do not persist across a refresh and are invisible to agents.

The second consequence is the more urgent one, and it is not caused by the browser as such — it is caused by the UI having no host process to talk to. A desktop shell supplies that host.

## Decision

**Adopt Tauri as the desktop shell.**

The React application is retained unchanged. Tauri hosts it in a native window and provides a Rust backend that holds the trusted kernel, the SQLite repository, the media workers, and — later — the capture worker.

The UI becomes a **client of the kernel** rather than an owner of one. Per ADR 0006 this is a transport-only adapter: the Tauri command channel carries the same operation envelope the CLI, SDK and MCP transports carry, and holds no domain logic or authorization decisions of its own.

### Why Tauri rather than Electron

Electron is the serious alternative and the argument for it is real: our kernel is already Node, so an Electron backend could *be* that kernel with no bridge and no new toolchain. We considered it properly.

| | Tauri | Electron |
|---|---|---|
| Shell footprint | 3–10 MB | 80–150 MB |
| Backend language | Rust | Node — already ours |
| Toolchain | Rust + platform linker | Already installed |
| Webview | OS-provided | Bundled Chromium |

**The deciding factor is resource headroom during capture.** This application's defining workload is recording the screen while an encoder runs. FFmpeg alone can occupy 1–4 GB of RAM and saturate available cores; a capture worker concurrently buffers raw frames. On ordinary creator hardware, a shell that carries its own browser engine competes for exactly the memory and CPU that determine whether recorded frames are dropped. A dropped frame is a visible product defect, and it is caused by a decision made here.

Two supporting reasons:

- The capture worker should be a **separate, tightly-scoped, resource-bounded process** regardless of shell choice, which matches the execution-isolation posture in `docs/11-security-secrets-privacy.md`. A small Rust binary is a natural fit.
- `AGENTS.md` already scopes Rust to "native audio, OS integration, media execution, high-performance rendering, secure memory boundaries, and local workers" — precisely this surface.

### Scope of Rust

Deliberately narrow. **This is not a rewrite.**

| Stays TypeScript | Becomes Rust |
|---|---|
| Domain model, migrations | Tauri command bridge |
| Engine — timeline, rational time, validation | Capture worker (Milestone 12) |
| Kernel — dispatch, grants, revisions, idempotency | Native API bindings |
| Persistence, media, render planning | |
| SDK, CLI, MCP transport | |
| The entire React interface | |

### Sequencing

The shell is **Milestone 11**. Nothing before it requires Rust.

The persistence problem, however, is urgent and is solved *first and separately*: the UI is wired to the real kernel over the existing MCP HTTP transport (Milestone 8). That work is directly reusable — the UI becomes a kernel client with a swappable transport, and Tauri later substitutes an IPC channel for HTTP behind the same interface. Building it now against HTTP is not throwaway work; it is the same abstraction with a different wire.

This also produces a useful proof: the human interface becomes just another adapter, which is what the architecture has claimed since ADR 0006.

## Consequences

**Positive.**
- Capture becomes reachable; the sandbox limits stop applying.
- Human and agent share one persistent project — the central product claim becomes operationally true, not merely architecturally true.
- Studio becomes installable: an icon, a tray presence, auto-update, code signing.
- The React interface is preserved intact.

**Negative / accepted.**
- A Rust toolchain and platform linker become build prerequisites (~1 hour, one time). Not currently present on the development host, so native builds cannot be verified until provisioned.
- The OS webview differs across platforms; rendering must be tested on each rather than assumed uniform from bundled Chromium.
- A new IPC surface requires authentication and its own threat analysis (ADR 0006 requires session authentication; `docs/security/THREAT-MODEL.md` requires new analysis for new surfaces).
- Two native targets to build and sign.

**Neutral.**
- Tauri's ecosystem is younger than Electron's. Mitigated by keeping the Rust surface small and the kernel portable — if this decision were ever reversed, the TypeScript side is unaffected.

## Alternatives rejected

**Electron.** Lower toolchain cost, but the shell footprint competes with the encoder and capture worker for the resources that determine recording quality. Rejected on the application's defining workload.

**Stay in the browser.** Forecloses the capture pillar entirely and leaves the UI unable to reach a persistent kernel. Not viable.

**Browser UI talking to a local HTTP server, permanently.** This is the Milestone 8 intermediate and it is genuinely useful, but it is not a product: it requires the user to run a server, provides no installable artifact, and still cannot capture.

**Progressive Web App.** Installable and lighter, but the sandbox constraints are unchanged. Same fatal flaw as staying in the browser.
