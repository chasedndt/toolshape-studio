# Root instructions for Codex and other implementation harnesses

These rules apply to every file and worktree created from this handover. A nested `AGENTS.md` may add stricter domain rules but may not weaken this contract.

## Mission

Implement a portable harness-native software platform and two polished products:

- **Toolshape Voice** — system-wide voice dictation and learning;
- **Toolshape Studio** — one integrated design and video creation environment.

Multiple harnesses may work in parallel. Parallelism is encouraged when contract ownership, branch boundaries, fixtures, and integration gates are explicit.

## Required reading before edits

1. `README.md`
2. `docs/01-agent-native-constitution.md`
3. `docs/02-chaseos-hierarchy.md`
4. `docs/03-reference-architecture.md`
5. `docs/11-security-secrets-privacy.md`
6. the relevant platform or product handover
7. `research/SOURCES.json` entries referenced by that handover

## Non-negotiable architecture

1. ChaseOS supervises and coordinates harnesses; harnesses perform the actual planning and tool execution.
2. Products must also work without ChaseOS through their standalone policy and approval surfaces.
3. UI, MCP, CLI, SDK, and HTTP/IPC are adapters over the same application services.
4. No React/Tauri component, MCP handler, CLI parser, or HTTP route owns domain logic.
5. Persist canonical domain objects, not renderer widgets, browser canvas objects, FFmpeg command strings, or UI coordinates.
6. All mutating operations use the versioned operation envelope, expected revisions, idempotency keys, structured results, and provenance.
7. Long-running work creates a durable job with progress, cancellation, retries, state transitions, and result artifacts.
8. Model outputs are proposals until deterministic validation and policy allow execution.
9. The model never receives unrestricted credentials and never authorizes itself.
10. Secrets travel by opaque handle; plaintext must not enter operation logs, prompts, traces, analytics, crash dumps, or vector stores.
11. Browser/computer use is a compatibility fallback, not the normal integration path.
12. Human editing remains first-class. Every generated asset must remain structurally editable when the domain permits it.

## Workstream ownership

A parallel build should use isolated branches or worktrees:

```text
platform-contracts     ANAC schemas, generated types, fixtures
semantic-kernel        command/query dispatcher, revisions, jobs, artifacts
security-policy        capability grants, approvals, secret broker, audit
adapter-kit            MCP, SDK, HTTP/IPC, CLI
voice-runtime          audio, ASR, transformations, Windows insertion
voice-experience       Flow Bar, Hub, analytics, profile, settings
studio-engine          scene graph, timeline graph, render planning
studio-experience      editor, agent panel, dynamic review surfaces
conformance-evals      state-based tests, security and reliability suites
research-refresh       source index and dated proposal reports only
```

One workstream must not silently change another workstream’s public schema. Schema changes require:

- a version bump;
- an ADR or decision record;
- compatibility tests;
- fixture migration;
- explicit downstream review.

## Implementation defaults

- Rust for native audio, OS integration, media execution, high-performance rendering, secure memory boundaries, and local workers.
- TypeScript for desktop/web UI, application orchestration, schemas, MCP, HTTP services, SDKs, and CLI unless a Rust CLI is materially simpler.
- Python for evaluation, data analysis, model experiments, and benchmark tooling.
- Tauri for the first desktop shells.
- SQLite and content-addressed local storage for local-first operation.
- PostgreSQL and S3-compatible storage only for hosted, multi-tenant services.
- JSON Schema Draft 2020-12 for public data contracts.
- OpenTelemetry-compatible trace semantics, with redaction before export.
- Safe argument arrays, never shell interpolation, for media and model workers.

## Definition of done for a feature

A feature is incomplete until it has:

- a human interaction flow;
- one or more semantic capabilities;
- input/output schemas;
- declared effects and risk;
- preview behaviour where meaningful;
- an authorization rule;
- deterministic validation;
- a verifier or explicit verification limitation;
- recovery/undo/compensation semantics;
- state-based tests;
- telemetry with secret redaction;
- documentation and one executable example.

## Quality gates

Run relevant gates before handing back:

```text
format
lint
unit tests
schema validation
fixture validation
state-based integration tests
security misuse cases
adapter parity tests
smoke command
```

Report exact commands and results. Do not claim a test ran unless it did.

## Scope and 80/20 discipline

Implement the feature priority lists exactly. Do not add broad marketplaces, social feeds, mobile parity, enterprise administration, arbitrary plugins, or speculative agent swarms before the golden workflows pass their evaluation gates.

This restriction is not doubt about parallel agent execution. It is a merge-quality rule: parallel work must converge on tested contracts instead of expanding uncontrolled surface area.

## Clean-room and dependency rules

- Never copy competitor code, assets, proprietary templates, private prompts, or distinctive branded wording/layout.
- Preserve exact third-party licences, notices, model cards, dataset terms, font licences, music licences, and codec/build flags.
- Never commit user recordings, private projects, credentials, payments, access tokens, or raw secret-bearing traces.
- Do not call source-available software “open source” unless its licence meets the Open Source Definition.
