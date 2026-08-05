# Why Studio needs a native shell — and what Rust and Tauri actually are

**Date:** 2026-08-05
**Status:** EXPLAINER — background for Milestone 11
**Short answer:** we do not need it yet, it is genuinely easy to add when we do, and there is a real choice to make when we get there.

---

## 1. What a "shell" means here

Toolshape Studio is two things wearing one coat:

- **The kernel** — the project model, operations, validation, jobs, render pipeline, MCP transport. This runs in **Node.js**. It already has full machine access: it reads and writes files, spawns FFmpeg, opens SQLite.
- **The interface** — the React editor. This currently runs in a **browser tab**.

A "shell" is what turns those two into a single installable application — one icon, one process tree, one thing a person downloads.

Today you run `npm run dev` and open a browser. That is fine for development. It is not a product you can hand to a marketer.

---

## 2. What a browser tab cannot do — and why that blocks capture

Browsers are sandboxed on purpose. A web page is untrusted code from the internet, so the browser refuses it the following, permanently and by design:

| Capability | In a browser tab | Why it matters to us |
|---|---|---|
| Record the screen without a prompt every single time | ❌ Prompt on every call | An agent cannot start a recording; a human must click a picker each time |
| Read window titles, bounds, focus changes | ❌ Never | **This is the window track** — the differentiator |
| See cursor position outside the page | ❌ Never | **This is the cursor track** |
| See keystrokes outside the page | ❌ Never | Keystroke events for redaction and emphasis |
| Capture system audio | ⚠️ Partial, platform-dependent | Narration plus app audio as separate tracks |
| Write files anywhere on disk | ❌ Downloads folder only | Render output to a chosen location |
| Run FFmpeg | ❌ Never | All rendering |
| Auto-start, live in the tray, survive a browser restart | ❌ | A recorder you have to keep a tab open for is not a recorder |

Read that table again with the capture pillar in mind. **The rows the browser refuses are precisely the ones that make our capture pillar better than a screen recorder.** Pixels we could get. The structured event data — which clicks happened, in which window, at what time — is exactly what the sandbox exists to deny.

That is the whole reason a native shell is on the roadmap.

---

## 3. So what is Tauri?

**Tauri is a framework for building desktop applications where the interface is web technology and the backend is native code.**

You keep the React app exactly as it is. Tauri wraps it in a real desktop window and gives it a native backend that *is* allowed to do the things in the table above. The React side calls the native side through a typed command channel — for us, that is simply another adapter over the same kernel, which is what [ADR 0006](../adr/0006-local-ipc-and-adapters.md) already anticipated.

Two things distinguish it from the obvious alternative:

- **It uses the operating system's built-in webview** rather than bundling a whole copy of Chromium. A Tauri app is typically **3–10 MB**. The Electron equivalent is **80–150 MB**.
- **Its backend is Rust**, which is where the second half of your question comes in.

---

## 4. And Rust?

Rust is a systems programming language — the same category as C and C++, but with memory safety enforced at compile time rather than left to the programmer.

We need it for two reasons, and only two:

1. **Tauri's backend is written in Rust.** Choosing Tauri means the native half of the app is Rust.
2. **The OS screen-capture APIs are native APIs.** Windows Graphics Capture and macOS ScreenCaptureKit are C/C++/Swift interfaces. Reaching them means native code, and mature Rust crates already wrap both.

**Important: this does not mean rewriting Studio in Rust.** The kernel, the operations, the timeline, the render planning, the MCP transport all stay TypeScript. The Rust surface is deliberately small — a capture worker and a thin command bridge. `AGENTS.md` already scopes it that way: *"Rust for native audio, OS integration, media execution, high-performance rendering, secure memory boundaries, and local workers."*

---

## 5. Is it easy to install?

**Yes. Under an hour, mostly download time, on a well-trodden path.**

| Step | What | Time | Size |
|---|---|---|---|
| 1 | **Rust** via `rustup` — one installer, official | ~5 min | ~700 MB |
| 2 | **MSVC Build Tools** (Windows only) — Visual Studio Build Tools with the C++ workload. Rust needs a system linker | ~20 min | ~3–6 GB |
| 3 | **Tauri CLI** — an npm package, no separate install | ~2 min | small |

On macOS, step 2 is `xcode-select --install` instead. On Linux it is a handful of `apt` packages.

Nothing here is exotic or fragile. It is the standard setup every Tauri developer does once. The reason it is called out as a blocker is narrower than it sounds: **it is not currently on this machine**, so I cannot compile or verify a native build today — and I will not claim a build works when I have not run it.

This is also why the roadmap puts it in **its own milestone (M11)**. Toolchain provisioning is infrastructure risk. Bundling it into a feature milestone is how you end up unable to tell whether a feature is broken or the build environment is.

---

## 6. Tauri or Electron — the choice we will actually face

Worth stating honestly, because the repo picked Tauri early and the reasoning deserves re-examination when we get to M11.

| | **Tauri** | **Electron** |
|---|---|---|
| Backend language | Rust | **Node.js — what our kernel already is** |
| App size | 3–10 MB | 80–150 MB |
| Memory | Lower | Higher |
| Rendering consistency | OS webview — differs across platforms | Bundled Chromium — identical everywhere |
| Screen capture | Rust crates, excellent | `desktopCapturer`, mature, well-documented |
| Toolchain | Rust + MSVC | **Node only — already installed** |
| Ecosystem maturity | Younger | Very mature |

**The honest tension:** our kernel is already Node. Electron would let the desktop backend *be* that kernel with no bridge at all, and we could start today with zero new toolchain.

**Why Tauri still likely wins:** app size and memory are not vanity metrics for a tool that runs alongside a screen recorder and a video encoder — a 150 MB baseline competing for RAM with FFmpeg is a real cost. And the capture worker wants to be a separate, tightly-scoped, resource-bounded process regardless of shell choice, which is a natural fit for a small Rust binary and matches the isolation posture in `docs/11-security-secrets-privacy.md`.

**Decision deferred to M11, deliberately.** By then M9 and M10 will have defined the capture-worker interface precisely, and the choice becomes an informed one rather than a guess. Either way, the shell is an *adapter* — the kernel does not change.

---

## 7. What this means for the roadmap

Nothing before Milestone 11 needs any of this.

- **M8** — assembly and effects: TypeScript, existing stack
- **M9** — capture document, zoom derivation, styling and compositing: TypeScript, developed against an imported video plus a synthetic event track
- **M10** — browser-driven capture via Playwright: TypeScript. The agent supplies its own event track from actions it performed, so no OS-level capture is required at all
- **M11** — toolchain and shell
- **M12** — native capture worker

By the time the toolchain matters, the capture engine will already be built, tested, and shipping against web demos. Native capture swaps in a better recorder behind an interface that already exists.

That is the sequencing payoff: **the hard, unfamiliar, platform-specific work is the last thing we do, not the first.**
