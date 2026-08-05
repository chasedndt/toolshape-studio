# ADR 0012 — MCP as the agent network transport

**Date:** 2026-08-05
**Status:** ACCEPTED
**Supersedes:** nothing
**Extends:** ADR 0006 (local IPC and adapter boundary)

## Context

Toolshape Studio claims to be agent-native. As built through Milestone 6, a harness can reach the semantic kernel exactly two ways:

1. **In-process** — import `@toolshape/studio-sdk` and call `StudioSdk.invoke(envelope)` from the same Node process.
2. **Subprocess** — spawn `packages/studio-cli/src/bin.ts` and speak JSON over stdin/stdout.

Both require the harness to be co-located with the Studio installation and to be able to execute Node in that installation's context. Neither is reachable from a harness that runs as a **long-lived server process on a port** — which is the deployment shape of the harnesses we most care about (Hermes, OpenClaw, ChaseOS-supervised runtimes, hosted Agents-SDK services).

A server-resident harness that cannot reach the semantic surface has exactly one remaining option: drive the React UI with computer-use. That path:

- is explicitly classified as "a compatibility fallback, not the normal integration path" (`AGENTS.md`, non-negotiable architecture #11, and `docs/01-agent-native-constitution.md`);
- discards every guarantee the operation envelope exists to provide — no idempotency key, no expected-revision check, no provenance, no structured error, no dry-run preview, no undo token;
- is unverifiable: success is inferred from pixels rather than probed from state;
- breaks silently whenever the UI changes.

So the product's central claim is currently false for the harnesses that matter most. This ADR closes that gap.

`docs/security/THREAT-MODEL.md` lists "MCP grant mapping" under *remaining work* and states that the current seed has "no ... authenticated local IPC." ADR 0006 already anticipated the resolution, pre-declaring that any future local HTTP or MCP process is "a transport-only adapter with session authentication, grants, schema validation, and shared idempotency storage." This ADR executes that pre-declaration rather than introducing a new architectural direction.

## Decision

**Adopt the Model Context Protocol (MCP) as Studio's agent network transport, implemented as a transport-only adapter in `packages/studio-mcp`.**

### Why MCP rather than a bespoke HTTP API

1. **Capability discovery is built in.** MCP's `tools/list` gives a harness the full capability surface with JSON Schema for every input, at runtime, with no hardcoded client knowledge. PRD v2 requirement AH-2 and NF-3 ("a cold agent can discover and complete a workflow using only runtime discovery") are satisfied by the protocol itself rather than by a bespoke discovery endpoint we would have to design, document, and version.
2. **The target harnesses already speak it.** MCP is the de-facto standard for agent-to-tool integration. Choosing it means Hermes, OpenClaw, Claude Code, Codex, and Agents-SDK runtimes connect with existing client code. A bespoke REST API would require every harness to write and maintain a Studio-specific client — a permanent adoption tax.
3. **Progress and cancellation are native.** Studio's durable render jobs already expose fractional progress and cooperative cancellation (ADR 0007). MCP progress notifications map onto this directly, satisfying TR-5 without inventing a polling convention.
4. **It matches the semantics we already have.** Studio's capabilities are typed, discrete, schema-validated, and individually authorized. That is precisely MCP's tool model. A REST resource model would be a worse fit — our surface is verbs over one aggregate, not CRUD over many.
5. **The mapping is nearly free.** The capability registry, envelope schema, result schema, and validation logic all exist. MCP is a projection over them, not new domain surface.

### Transport modes

Both are supported; they differ only in framing.

| Mode | Consumer | Framing |
|---|---|---|
| **stdio** | Co-located harnesses launched as a child process (Claude Code, Codex) | JSON-RPC over stdin/stdout |
| **streamable HTTP** | Server-resident harnesses binding to a port (Hermes, OpenClaw, remote/supervised runtimes) | JSON-RPC over HTTP POST with SSE for notifications |

HTTP is the mode that closes the gap this ADR exists to close. stdio is included because it is nearly free once the JSON-RPC layer exists and it is the lowest-friction path for local development.

### Tool surface

One MCP tool per kernel capability. Tool names substitute underscores for dots
because MCP clients commonly constrain tool names to `[a-zA-Z0-9_-]`; the dotted
capability ID is carried in the tool metadata and description so discovery stays
unambiguous.

```text
studio_project_inspect            → studio.project.inspect            read-only
studio_project_plan               → studio.project.plan               simulation, dry-run forced
studio_project_validate           → studio.project.validate           read-only
studio_project_apply_operations   → studio.project.apply_operations   mutating, revision-checked, idempotent
studio_project_render             → studio.project.render             mutating, returns accepted_job
studio_job_get                    → studio.job.get                    read-only
studio_job_cancel                 → studio.job.cancel                 mutating, idempotent
studio_operation_undo             → studio.operation.undo             mutating, token-bound
```

The tool input schema is deliberately **not** the raw operation envelope. An
agent supplies `project_id`, `expected_revision`, and typed operations; the
adapter fills identity, trace, retention, and risk from the authenticated
session. Making an agent hand-assemble trace IDs and retention classes would be
poor agent experience and would let a caller assert its own actor identity.

Capture capabilities (PRD v2 §3.3) join this list at Milestone 9 with no protocol change.

### Security posture

- **Loopback is not trusted.** Every HTTP session authenticates with a bearer token before any tool call is dispatched. An unauthenticated request is rejected before it reaches the kernel. This follows ADR 0006's explicit refusal to introduce an unauthenticated loopback server.
- **The session identity becomes the envelope actor.** A token maps to a principal, an agent identity, and a grant set. The transport cannot mint authority; it can only carry an identity the kernel then authorizes independently.
- **The transport holds no authorization logic.** It validates schema and authenticates the session. Every substantive check — capability allowlist, grant check, expected revision, idempotency digest — happens in the kernel exactly as it does for the UI and CLI. Re-implementing checks in the adapter would create the divergence ADR 0006 exists to prevent.
- **Tool descriptions are untrusted in the other direction too.** `docs/06-capability-design.md` warns that an MCP tool description from an untrusted server is executable attack surface. Studio is a *server* here, so the reciprocal obligation applies: our descriptions must be accurate and must not overstate safety, because clients may reasonably act on them.
- **No paths, no secrets, no internals.** Results are projected through the same public contract used by the SDK (ADR 0008), so filesystem paths, worker ownership fields, and kernel-internal snapshots never cross the wire.

### What the adapter must never do

- Own domain logic, validation rules, or authorization decisions.
- Maintain state separate from the kernel's SQLite store — in particular, idempotency records are shared, not per-transport.
- Expose a capability the UI cannot reach, or hide one the UI can.
- Bypass the operation envelope for "convenience" endpoints.

## Consequences

**Positive.**
- Server-resident harnesses gain full semantic access; computer-use stops being necessary for any supported task (AH-4).
- Capability discovery becomes a protocol feature rather than documentation a harness must read.
- Adapter parity is now testable across four surfaces (UI, CLI, SDK, MCP), strengthening the guarantee that no caller gets a looser path.
- The capture pillar and every future capability inherit network reach for free.

**Negative / accepted costs.**
- Studio now has a network listening surface, which is new attack surface requiring its own threat analysis. `docs/security/THREAT-MODEL.md` must be updated when the HTTP mode ships — the current document explicitly states that new surfaces "must receive new threat analysis when introduced."
- Bearer-token session auth is the minimum viable control, not the end state. It does not yet provide per-capability grant scoping, approval binding, or rotation. Those depend on the policy engine and secret broker, which remain unbuilt.
- Two transport modes mean two framing paths to test; parity tests must cover both.

**Neutral.**
- MCP protocol version drift will require maintenance. Mitigated by keeping the adapter thin — the protocol layer is isolated from the capability projection.

## Alternatives rejected

**Bespoke REST/HTTP API.** Rejected: no discovery, every harness needs a custom client, we would design and version our own progress/cancellation conventions, and we would still need MCP eventually for the harnesses that expect it.

**gRPC.** Rejected: strong typing and streaming are genuine advantages, but no target harness speaks it natively, and it adds a toolchain and codegen step to a repository that has deliberately stayed close to Node built-ins (`node:sqlite`, no ORM).

**stdio-only MCP.** Rejected: it is the cheapest option and it does not solve the stated problem. A harness on a port cannot spawn a child process inside a Studio installation it may not share a filesystem with.

**Unauthenticated loopback HTTP.** Rejected explicitly by ADR 0006 and by `docs/11-security-secrets-privacy.md`. Any local process, including a malicious one, could then drive the user's editor and exfiltrate project content. Loopback is not an authorization boundary.

**Continue with computer-use for networked harnesses.** Rejected: this is the failure mode the entire architecture exists to avoid, and it would make the product's central claim false.
