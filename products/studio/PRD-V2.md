# Product requirements document — Toolshape Studio v2

**Status:** ACTIVE — supersedes `products/studio/PRD.md`
**Date:** 2026-08-05
**Supersedes:** `products/studio/PRD.md` (v1, 2026-07-15)

## What changed from v1

v1 defined a unified design-and-video editor with an agent control plane. Two things were wrong about its emphasis, and one thing was missing entirely.

1. **Missing pillar.** v1 had no screen-capture surface. Capture was assumed to be someone else's job, with recorded media arriving as an import. This was a mistake: the highest-volume agent content workflow — *record something, cut it, caption it, brand it, export platform variants* — begins at capture. Owning capture is what makes the rest of the pipeline addressable end to end. See §3.
2. **Wrong primary user.** v1 listed harness operation as a portability requirement, alongside "documented project schema" and "headless render path." It is not a portability requirement. **An agent harness is a first-class primary user of this product, coequal with the human operator**, and the product is a failure if a harness cannot do everything a human can. See §2 and §5.
3. **Wrong transport assumption.** v1 assumed harnesses would be co-located — importing the SDK in-process or shelling out to the CLI. The harnesses that matter run as long-lived server processes reachable over a port. Studio must be reachable the same way. See §6.

Everything in v1 §"Unified project", §"AI-native capabilities", and `FEATURES-21.md` remains in force unless contradicted here.

---

## 1. Vision

**Toolshape Studio is one content-creation environment that an AI agent can operate as competently as a human can — covering screen capture, video editing, and visual design in a single semantic project model.**

The category references are deliberate and clean-room. We are building the *outcome set* of three tools without copying any of their code, assets, layout, wording, or interaction details:

| Pillar | Category reference | What Studio owns |
|---|---|---|
| **Capture** | Screen-recording tools that produce polished output (auto-zoom, cursor smoothing, camera overlay) | Recording as a semantic, re-editable document — not a flat video file |
| **Edit** | CapCut-style short-form video editing | Timeline, transcript-driven cuts, captions, audio, effects |
| **Design** | Canva-style visual design | Layered canvas, templates, brand systems, platform variants |

The capture reference is a *polished-output screen recorder* in the Screen Studio / Recordly category: automatic zoom suggestions derived from cursor activity, smoothed cursor motion with motion blur and click-bounce animation, styled backdrops (wallpapers, gradients, padding, rounded corners, shadows), timeline trimming with speed regions and annotations, and clean-loop export. The verified outcome-set breakdown for all three category references is in `docs/product/PILLAR-FEATURE-MATRIX.md`.

**Clean-room note.** Recordly is MIT-licensed, so its licence would permit reuse. Our own policy is stricter than the licence: per `AGENTS.md`, we do not copy competitor code, assets, templates, or distinctive branded layout regardless of licence terms. We implement the *outcome set* independently. If any third-party code is ever vendored, its licence and notices must be preserved exactly.

The unifying claim is not "three tools in one app." It is: **one project model, one operation surface, three creative surfaces over it.** A screen recording is a scene with a timeline and a transcript. A design is a scene without a required duration. A short-form video is a scene with duration, captions, and an audio mix. They are the same object type with different populated fields, so an agent that can operate one can operate all three.

### The labour split

```text
Human:   goal, constraints, taste, references, approval, master touches
Harness: research, plan, repetitive edits, variants, timing, captions, checks, exports
Kernel:  validity, transactions, rendering, verification, provenance, recovery
```

The kernel column is non-negotiable and never delegated to a model. Geometry, timeline arithmetic, permissions, transactions, and final state are deterministic software. Models operate at uncertainty boundaries only (§9 of v1).

---

## 2. Primary users

### 2.1 The agent harness — first-class, coequal

This is the user that distinguishes Toolshape Studio from every tool in its category reference set.

A harness is an autonomous or semi-autonomous AI process — Codex, Claude Code, Hermes, OpenClaw, a ChaseOS-supervised agent, or a bespoke Agents-SDK runtime — that operates Studio on a user's behalf. It may be:

- **co-located** — same machine, same process or a subprocess;
- **networked** — a long-lived server process on a port, possibly on another host;
- **supervised** — coordinated by ChaseOS with injected policy, budgets, and schedules;
- **standalone** — operating Studio directly with no supervisor.

**Requirements specific to this user:**

| ID | Requirement |
|---|---|
| AH-1 | Every capability available to a human is available to a harness through a typed operation, with no exceptions and no human-only path. |
| AH-2 | A harness can discover the full capability surface at runtime without hardcoded knowledge — names, input schemas, risk classes, and required grants. |
| AH-3 | A harness can reach Studio over a network transport it can bind to from a server process, not only in-process or by subprocess. |
| AH-4 | A harness never needs computer-use, screenshot parsing, or DOM automation to accomplish any supported task. |
| AH-5 | Every mutating call is idempotent under retry, revision-checked against concurrent edits, and reversible or explicitly marked irreversible. |
| AH-6 | Long-running work returns a durable job reference immediately; the harness polls or subscribes for progress and can cancel. |
| AH-7 | Errors are structured, machine-branchable, and free of filesystem paths and secrets. |
| AH-8 | A harness operating Studio concurrently with a human never silently overwrites the human's work, and can detect and re-plan on conflict. |

**AH-4 is the load-bearing one.** The constitution (`docs/01-agent-native-constitution.md`) classifies browser/computer use as "a compatibility fallback, not the normal integration path." Any workflow that forces a harness into pixel-driving is a product defect, not an integration gap.

### 2.2 The human operator

Unchanged from v1 §"Primary users": creator/operator, e-commerce operator, developer/educator, and later brand/team. The human is not demoted by §2.1 — direct manipulation, keyboard-first editing, and precise inspector control remain first-class and are what make the product credible as a professional tool.

The human requirement that matters most for agent-nativeness:

| ID | Requirement |
|---|---|
| HO-1 | A human can take over mid-workflow from an agent, and the agent can resume afterward by re-inspecting, without either party corrupting state. |
| HO-2 | Every agent action is visible, attributable, reviewable, and undoable in the same history the human's own edits appear in. |

---

## 3. Pillar A — Capture

**New in v2. Not yet implemented. Specified here; built after the MCP transport milestone.**

### 3.1 Why Studio owns capture

Three reasons, in order of weight:

1. **The pipeline starts here.** The dominant agent content workflow is capture → cut → caption → brand → export variants. If capture is external, the agent's first step is always "wait for a human to hand me a file," and end-to-end automation is impossible.
2. **Flat video destroys semantics.** An external recorder hands over pixels. By the time the agent sees it, the cursor path, click events, window boundaries, active application, keystrokes, and scroll events — everything that makes intelligent auto-editing possible — have been baked into a raster and thrown away. Capturing natively means keeping that as structured data.
3. **It closes the agent-native loop.** An agent that can capture can produce content with no human in the loop at all: drive a demo, record it, edit it, export it. That is the flagship capability of this product.

### 3.2 The capture document

A capture is **not** a video file. It is a semantic document that renders to video:

```text
CaptureDocument
├── source            display / window / region / camera / audio devices
├── media             immutable content-addressed raw video + audio tracks
├── cursor track      timestamped position, velocity, visibility
├── event track       clicks, key events (redactable), scrolls, drags
├── window track      focus changes, app identity, window bounds
├── zoom plan         derived or authored zoom/pan keyframes over time
├── camera overlay    position, shape, size, follow behaviour
├── backdrop          padding, radius, shadow, background fill
└── transcript ref    links to the transcript/caption document
```

The raw recorded bytes are immutable and content-addressed like every other asset (ADR 0002). Everything else is a re-editable derived layer. Changing the zoom plan after recording is a semantic operation producing a new revision — it does not re-record and does not re-encode until render.

**This is the design decision that makes capture agent-operable.** An agent can call `studio.capture.plan_zoom` with an intent like "emphasise every click in the settings panel" and the kernel resolves it against the *event track*, deterministically. Against a flat video, the same request would require vision inference over frames and would be unverifiable.

### 3.3 Capture capabilities

| Capability | Purpose | Risk |
|---|---|---|
| `studio.capture.list_sources` | Enumerate displays, windows, cameras, audio devices | read_only |
| `studio.capture.start` | Begin a recording session against a declared source | reversible_local_write |
| `studio.capture.stop` | End session, finalize immutable media, register document | reversible_local_write |
| `studio.capture.get_session` | Poll an in-flight recording's state and duration | read_only |
| `studio.capture.plan_zoom` | Derive or set zoom/pan keyframes from the event track | reversible_local_write |
| `studio.capture.set_overlay` | Configure camera bubble, backdrop, cursor styling | reversible_local_write |
| `studio.capture.redact` | Mask regions, drop keystroke spans, blur windows | reversible_local_write |
| `studio.capture.to_scene` | Project a capture document into an editable timeline scene | reversible_local_write |

### 3.4 Capture requirements

| ID | Requirement |
|---|---|
| CAP-1 | Recording is consent-gated at the OS level and never starts without an explicit, attributable authorization — an agent cannot silently begin recording. |
| CAP-2 | A visible, non-suppressible recording indicator is present for the entire session, regardless of who initiated it. |
| CAP-3 | Keystroke capture defaults to **off**. When enabled it excludes fields the OS marks as secure, and captured text is redactable before any render. |
| CAP-4 | Cursor, event, window, zoom, and overlay tracks are semantic project data — never baked into the stored original. |
| CAP-5 | Auto-zoom is derived deterministically from the event track, is fully previewable, and is always overridable by an authored plan. |
| CAP-6 | Capture never writes to the trusted content store until the session finalizes and passes the same probe/budget gate as any other media import (ADR 0011). |
| CAP-7 | A capture document projects losslessly into a timeline scene; editing the scene never invalidates the capture's event tracks. |

**CAP-1 through CAP-3 are hard invariants.** Screen recording driven by an autonomous agent is a serious privacy surface. No configuration flag, policy profile, or agent grant may disable the consent gate or the recording indicator. This is the same class of invariant as "never bypass object authorization" in `docs/11-security-secrets-privacy.md`.

---

## 4. Pillar B — Edit, and Pillar C — Design

Substantially as specified in v1 and `FEATURES-21.md`. Restated here only where v2 changes priority.

**Edit (video).** Multi-track timeline, core clip editing, keyframes/easing, transitions/effects, audio mixing, transcripts/captions/translation, and transcript-based editing (families 11–17). Milestone 6 delivered direct timeline manipulation — selection, playhead, frame-snapped trim, split — over the same `timeline.clip.*` operations agents call.

**Design (visual).** Layered canvas, typography, vectors/masks, image editing, smart object edits, templates/brand systems, smart layout, responsive variants and bulk data (families 1–10).

**v2 priority change:** *responsive variants* (family 10) is promoted from P0-alpha to **the flagship agent workflow**. "One design or capture, N platform variants, correctly reframed with hierarchy and safe areas preserved" is the single highest-leverage thing an agent does in this product — it is pure repetitive precision work, it is verifiable deterministically, and it is what human operators most want to stop doing by hand.

---

## 5. The agent operation model

Studio exposes exactly one way to change state, used identically by the human UI, the CLI, the SDK, and the MCP transport.

### 5.1 The operation envelope

Every mutation is a typed envelope carrying: actor identity and type, harness identity, delegation chain, capability ID and version, target resource with expected revision, typed input, authorization grants, risk class, execution mode (dry-run, atomicity), retention class, idempotency key, and trace ID.

Guarantees the envelope buys:

- **Idempotency** — keyed on (actor, capability, target). A replay with an identical digest returns the original result; a replay with a *different* digest is a conflict, not a silent second execution.
- **Optimistic concurrency** — `expected_revision` mismatches are rejected as `stale_revision` with no mutation. An agent must inspect the diff and re-plan; it may not resolve a conflict by overwriting.
- **Provenance** — every artifact records its producing operation, source revision, toolchain versions, and licence posture.
- **Authorization** — grants are checked before dispatch, deterministically, in application code.

### 5.2 The control loop

```text
discover → inspect → plan → preview (dry-run) → authorize → execute → verify → recover
```

A harness executes this loop identically whether supervised or standalone. `dry_run: true` on any mutating capability returns the semantic diff that *would* result, with no state change — this is the mechanism that lets an agent check its work before committing, and lets a human approve a specific, exact change.

### 5.3 What stops a model doing whatever it wants

Stated plainly because it is the most common thing to get wrong:

**Model output cannot grant authority.** A model's text, a tool description from an untrusted MCP server, an imported document, and a web page are all *untrusted data*. They can influence a proposal. They cannot expand permission. Authority is jointly determined by the authenticated user, the delegated agent identity, the policy engine, and the application executor — enforced in deterministic code at dispatch time, re-derived on every call, and never cached from an upstream "already approved" claim.

Prompt-based security is not access control. There is no instruction anywhere in this system that a model is trusted to obey for safety purposes.

---

## 6. Transport requirements

### 6.1 The gap v1 left

As built today, a harness can reach Studio two ways: import `@toolshape/studio-sdk` in-process, or spawn `studio-cli` and speak JSON over stdin/stdout. Both require co-location with the Studio installation.

Harnesses that run as persistent server processes — the deployment shape that matters for autonomous, always-on operation — can do neither cleanly. Without a network transport their only remaining option is computer-use against the React UI, which violates AH-4 and discards every guarantee in §5.1.

### 6.2 Requirements

| ID | Requirement |
|---|---|
| TR-1 | Studio exposes a network transport a server-resident harness can call, carrying the full capability surface. |
| TR-2 | The transport supports runtime capability discovery with input schemas (AH-2). |
| TR-3 | The transport is **adapter-only** — it holds no domain logic, no authorization decisions of its own, and no separate state. It projects onto the same kernel the UI uses (ADR 0006). |
| TR-4 | Loopback is not trusted. Every network session authenticates, and the session's identity becomes the envelope's actor. |
| TR-5 | Long-running work surfaces progress notifications and supports cancellation over the wire. |
| TR-6 | The transport never emits filesystem paths, secrets, or kernel-internal objects (ADR 0008, ADR 0010). |
| TR-7 | Adapter parity is tested: the same logical operation via UI, CLI, SDK, and network transport produces the same state change and the same result document. |

**Decision: Model Context Protocol.** Rationale, alternatives, and the full argument are in `docs/adr/0012-mcp-network-transport.md`. Summary: MCP is the de-facto standard for exactly this shape (typed tool discovery, invocation, progress, cancellation), it is natively spoken by the harnesses we target, and ADR 0006 already pre-declared MCP as the intended transport-only adapter — so this is executing a decision the architecture anticipated, not introducing a new one.

---

## 7. Non-functional requirements

Carried forward from v1 §"Non-functional requirements" (performance, reliability, privacy/security, portability), with these v2 additions:

| ID | Requirement |
|---|---|
| NF-1 | Concurrent human and agent editing of one project is safe by construction — revision checks, not locks, and never silent loss. |
| NF-2 | Capture recording maintains its declared frame rate without dropping semantic event data under load; event tracks degrade last. |
| NF-3 | A cold agent — no prior session, no cached knowledge — can discover the capability surface and complete a documented workflow using only runtime discovery. |
| NF-4 | Every capability has a deterministic verifier or an explicitly declared verification limitation. No capability reports success on a model's say-so. |

---

## 8. Success metrics

The product is working if:

1. **Agent task completion without computer-use** — % of the documented golden workflows a cold harness completes end-to-end via the semantic surface alone. Target: 100% of P0 workflows.
2. **Human-agent parity** — count of capabilities reachable by a human but not an agent. Target: **zero**, permanently. This is a release gate, not a metric to trend.
3. **Conflict safety** — zero incidents of silent overwrite under concurrent human/agent editing across the conformance suite.
4. **Retry safety** — zero duplicate side effects (double render, double export) under adversarial retry testing.
5. **Capture-to-export latency** — wall-clock for the flagship workflow (record → auto-cut → caption → brand → 3 platform variants) driven entirely by an agent.
6. **Verification honesty** — zero artifacts reported as verified that fail an independent probe.

---

## 9. Scope

### In scope for the current phase

MCP network transport; capture pillar; super-app shell covering all pillars; the P0 subset of `FEATURES-21.md`; deterministic local rendering; durable jobs; content-addressed assets; local-first persistence.

### Explicitly out of scope

Carried from `docs/19-non-goals.md` and still binding:

- Arbitrary autonomous code self-modification.
- Marketplace or public plugin execution.
- Broad multi-agent swarms inside the product.
- Real-time multi-user collaboration (local review is foundational; live co-editing is later).
- Full NLE / DAW / Illustrator parity.
- Mobile and web parity.
- Hosted multi-tenant services.

### Permanent prohibitions

- Letting model output bypass policy or domain validation.
- Storing plaintext credentials in prompts, vectors, logs, or project files.
- Claiming deletion or privacy guarantees the system cannot technically and contractually prove.
- Copying competitor code, prompts, assets, templates, or distinctive branded layouts.
- Disabling the capture consent gate or recording indicator (§3.4).

---

## 10. Release phases

| Phase | Contents | Gate |
|---|---|---|
| **Current — Milestone 6 complete** | Unified project, timeline direct editing, media quarantine, durable render jobs, CLI/SDK adapters | Shipped and verified |
| **Milestone 7 — Transport** | MCP server, stdio + HTTP, session auth, capability discovery, adapter parity tests | A networked harness completes a full edit/render workflow with no computer-use |
| **Milestone 8 — Super-app shell** | Home/dashboard, capture workspace, agent activity surface, unified navigation across pillars | Every pillar reachable and coherent in one shell |
| **Milestone 9 — Capture** | Capture document, event tracks, deterministic auto-zoom, overlays, redaction, scene projection | Agent records, edits, and exports without a human touching the recorder |
| **Milestone 10 — Variants** | Responsive resize, platform variants, bulk data binding, localisation | Agent produces N verified platform variants from one source |

Each milestone follows the established repo cadence: plan doc → TDD red → implement → gates (typecheck, tests, build, browser QA, smokes) → ADR → learning record.
