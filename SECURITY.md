# Security

## Reporting a vulnerability

Do not open a public issue. Report privately through GitHub's **Security → Report a vulnerability** on this repository.

Useful reports include: what boundary was crossed, reproduction steps, affected commit, and what an attacker gains. If you are unsure whether something is a vulnerability, report it anyway.

## Status — read this before assessing

**Toolshape Studio is pre-alpha and is not hardened for hostile environments.** It runs locally, stores projects locally, and has no network egress path. [`docs/security/THREAT-MODEL.md`](docs/security/THREAT-MODEL.md) states the boundaries and, importantly, the **explicit non-claims**.

Not built, and therefore not claimed to be secure:

- secret broker and credential handling
- network egress or publishing
- policy/approval engine beyond capability grants
- at-rest database encryption
- sandboxed or containerized codec execution
- signed binaries and packaging
- multi-host job leases
- completed deletion / crypto-erasure workflow

These surfaces need fresh threat analysis when they are introduced. Reporting that they are absent is not a finding; reporting that something *claims* to provide one of them and does not, is.

## What is in scope

| Area | Expectation |
|---|---|
| **MCP transport** | Every HTTP request authenticates. Anonymous or wrong-token requests are refused before reaching the kernel. Tokens compare in constant time. The registry fails closed rather than defaulting to open. |
| **Authorization** | Grants are checked in the kernel on every call. No adapter may authorize on the kernel's behalf, and no upstream "already approved" claim substitutes for the check. |
| **Actor identity** | Comes from the authenticated session, never from caller-supplied arguments. |
| **Concurrency** | A stale `expected_revision` is refused with no mutation. Silent overwrite is a vulnerability, not a race to tolerate. |
| **Idempotency** | Replaying a key with the same payload returns the original result. Replaying with a *different* payload is a conflict, not a second execution. |
| **Media ingestion** | Untrusted bytes are signature-checked, quarantined, probed from the immutable snapshot, and budget-checked before reaching the trusted store. Quarantine is deleted on every outcome. |
| **Subprocess execution** | Media workers are spawned with an argument array and `shell: false`, with timeouts and bounded captured output. Never shell interpolation. |
| **Error surfaces** | Structured errors must not leak filesystem paths, secrets, or kernel internals. |
| **Prompt injection** | Content inside a project (captions, asset names, imported documents) is data. If it can cause a privileged action, that is a vulnerability. |

## The security axiom

> Data can influence a proposal but cannot grant authority.

Model output, imported documents, web pages, and tool descriptions from other MCP servers are all untrusted. Authority is determined jointly by the authenticated user, the delegated agent identity, the policy engine, and the application executor — enforced in deterministic code, re-derived on every call.

**Prompt-based security is not access control.** There is no instruction anywhere in this system that a model is trusted to obey for safety purposes. A report showing that a safety property depends on a model choosing to comply is a valid and valuable finding.

## Hard invariants

These hold regardless of configuration, policy profile, or agent grant. A bypass is a vulnerability:

- Object authorization is never bypassed.
- An approval is never reused for materially changed parameters.
- Imported content never redefines system policy.
- No publish, send, purchase, or irreversible delete occurs through a hidden action.
- **Screen recording never starts without explicit consent, and the recording indicator can never be suppressed** — including when an agent initiates the session ([capture spec](docs/product/CAPTURE-PILLAR.md) §4.1).

## Running safely

- Bind the MCP transport to loopback. `--host 0.0.0.0` exposes your editor to the network.
- Loopback is **not** an authorization boundary — any local process can reach a bound port. That is why the bearer token exists; do not disable it.
- Scope harness sessions with `--grants` rather than defaulting to `studio.*`.
- Treat project files from other people as untrusted input.
