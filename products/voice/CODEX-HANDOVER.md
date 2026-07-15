# Codex handover — Toolshape Voice foundation

## Mission

Build the Windows local-first golden loop without hiding domain logic in the Tauri UI or OS adapters.

## Read first

- root `AGENTS.md`;
- `products/voice/AGENTS.md`;
- all Voice documents;
- `platform/semantic-kernel/HANDOFF.md`;
- `platform/secret-broker/HANDOFF.md`;
- relevant schemas/examples;
- `research/product-notes/wispr-flow.md`;
- `research/benchmark-notes/osworld-family.md`.

## Workstream split

### Runtime worktree

- Rust daemon;
- hotkey registration;
- microphone enumeration/ranking/capture;
- VAD/provider interface;
- session state machine;
- target inspector;
- insertion strategy interfaces and fakes.

### Recognition/transformation worktree

- local ASR worker adapter;
- transcript schema;
- protected spans;
- dictionary/snippets;
- deterministic cleanup;
- diff generation;
- provider benchmark fixtures.

### Experience worktree

- Tauri shell;
- Voice Bar states;
- Hub navigation and settings;
- Scratchpad;
- history/recovery;
- analytics event views.

### Agent/conformance worktree

- Voice capabilities;
- CLI/MCP/local IPC;
- adapter parity;
- target matrix and pass^k runner;
- privacy/secret canaries.

## First vertical slice

Implement:

```text
Register one configurable global hotkey
→ capture from selected microphone
→ stream to one local ASR provider
→ final raw transcript
→ apply minimal protected-token/dictionary pass
→ insert into Notepad using Unicode input
→ verify through UI Automation if available
→ preserve session result/history under local retention
→ expose same operation through CLI and MCP inspection
```

Include clipboard copy fallback but do not present it as equivalent verification.

## Required architecture

- one daemon owns microphone sessions;
- UI is a client;
- operation/job kernel records state transitions;
- ASR and insertion behind traits;
- raw and final transcript are separate immutable revisions/artifacts;
- no plaintext secrets in any fixture/log;
- network can be disabled at worker boundary;
- Windows-specific code has fake adapters for CI on non-Windows systems.

## First tests

- hotkey state machine;
- mic disconnect/failover fake;
- cancellation;
- protected technical terms;
- dictionary casing;
- stale target descriptor;
- password target block;
- UIPI/elevated error mapping;
- duplicate insertion idempotency;
- local egress denial;
- session recovery after simulated daemon restart;
- SDK/CLI/MCP result parity.

## Smoke acceptance

On Windows:

1. start local daemon and UI;
2. run doctor and network test;
3. focus Notepad;
4. hold hotkey and speak fixture phrase;
5. observe raw/final transcript and insertion;
6. confirm operation/job/provenance records;
7. repeat idempotency request and confirm no duplicate insertion;
8. focus a password field and confirm hard block;
9. disconnect preferred microphone during fake/integration test and observe fallback;
10. run the automated target matrix subset.

## Do not add yet

- mobile;
- team/admin;
- broad cloud provider catalogue;
- social achievements;
- TSF production text service before the simpler insertion matrix is measured;
- autonomous voice commands that execute external actions;
- hidden content retention for personalisation.

## Handover response

Report changed files, architecture decisions, commands/results, actual target apps tested, measured latency, network/privacy evidence, known Windows limitations, and the next smallest integration step.
