# Delivery plan for parallel agent orchestration

## Principle

Use multiple harnesses aggressively, but give them bounded ownership, exact inputs, contract fixtures, and merge gates.

## Phase 0 — contract freeze

Parallel workstreams:

- ANAC schemas and examples;
- reference kernel;
- policy/secret model;
- adapter contract;
- conformance suite;
- product PRDs and original UX wireflow specifications.

Exit gate:

- schemas validate;
- one neutral sample application works through SDK, CLI, HTTP/IPC, and MCP;
- duplicate idempotency requests do not duplicate work;
- stale revision tests fail correctly;
- preview produces no mutation;
- secret fixtures never persist plaintext.

## Phase 1 — Toolshape Voice golden loop

Parallel workstreams:

- Rust Windows audio/hotkey/insertion runtime;
- ASR/provider benchmark harness;
- transformation and correction-learning engine;
- Flow Bar and Hub UI;
- analytics/profile/milestones;
- voice MCP/CLI/SDK;
- voice eval target matrix.

Golden loop:

```text
hold configured hotkey
→ speak in front of any supported text target
→ see live state
→ release
→ preserve raw transcript
→ apply dictionary/protected-token/cleanup policy
→ insert or return actionable fallback
→ record correction and latency evidence
```

Exit gate:

- target matrix passes declared support levels;
- password fields are refused;
- local-only mode has no content network egress;
- protected technical tokens survive;
- interruption and recovery work;
- analytics are correct and deletable.

## Phase 2 — Toolshape Studio unified vertical slice

Parallel workstreams:

- unified project and asset schema;
- scene graph and headless image renderer;
- timeline graph and media worker;
- interactive editor shell;
- style-profile and candidate pipeline;
- transcript/caption/audio processing;
- Studio MCP/CLI/SDK;
- quality/eval suite.

Golden workflow:

```text
brief + assets + style profile + source video
→ agent creates a design/video plan
→ operator reviews structured alternatives
→ editable scene and timeline are produced
→ captions/audio/effects are applied
→ quality gates run
→ square, portrait, story, and vertical-video artifacts render
→ operator performs master touches
→ final exports retain provenance
```

Exit gate:

- all outputs remain editable;
- scene/timeline revisions and undo work;
- 21-feature baseline has tested core paths;
- deterministic renders/probes pass;
- style choices show evidence and improve through pairwise feedback;
- semantic tools replace GUI choreography in harness tests.

## Phase 3 — hosted and economic layers

Only after local golden workflows:

- encrypted sync;
- collaboration;
- remote compute providers;
- x402 quotes/payments/receipts;
- licensed asset marketplace;
- organization governance;
- publishing integrations.

## Branch and integration policy

- one owner per schema during an integration window;
- contract changes through pull requests with fixtures;
- generated types committed or reproducibly generated;
- no workstream merges with disabled tests;
- no agent may “fix” a failing cross-workstream test by weakening the assertion without review;
- integration branch runs adapter parity, state, security, and golden workflow evals.
