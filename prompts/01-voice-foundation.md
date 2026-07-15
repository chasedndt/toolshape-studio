# Codex execution prompt — Toolshape Voice foundation

You are implementing the first useful Windows vertical slice of Toolshape Voice. The primary product is system-wide dictation into supported text fields, not a file-transcription utility.

## Preconditions

The Phase 0 semantic kernel and adapter conformance suite must be present or imported as a versioned dependency. Do not recreate an incompatible product-local operation system.

## Mandatory reading

- root and `products/voice/AGENTS.md`;
- all files under `products/voice/`;
- `docs/02-chaseos-hierarchy.md`;
- `docs/05-operation-envelope-vs-memory.md`;
- `docs/08-human-agent-ux.md`;
- `docs/10-self-evolving-coach.md`;
- `docs/11-security-secrets-privacy.md`;
- platform handovers;
- relevant schemas/examples;
- Voice, OSWorld and security research notes.

## Golden loop

Implement one end-to-end path:

```text
focus Notepad or another declared supported normal-integrity text field
→ hold one configurable global hotkey
→ capture selected microphone
→ expose listening/transcribing/finalising/inserting states
→ run one local ASR provider behind an interface
→ preserve raw transcript
→ protect URLs, emails, identifiers, code-like spans, names and numbers
→ apply dictionary and deterministic cleanup
→ insert Unicode text into the still-valid target
→ verify with UI Automation when possible
→ store recoverable local history under retention settings
→ expose session/job/provenance through UI, CLI and MCP
```

Clipboard fallback is allowed but must be reported as a fallback, not verified direct insertion.

## Architecture

- Tauri shell with Rust native runtime and TypeScript UI/application clients.
- One local daemon owns microphone and dictation sessions.
- ASR, VAD, target inspection and insertion use traits/interfaces.
- Local-first provider benchmark; do not hard-wire the project format to one model.
- Raw transcript, normalized transcript and inserted output are separate immutable revisions/artifacts.
- Operation envelopes never become style memory.
- Dictionary, snippets, corrections and profiles are versioned personalisation objects.
- Windows-specific adapters have deterministic fakes for CI.

## Windows requirements

- use documented global-hotkey lifecycle and expose conflicts;
- detect and refuse password/secure fields;
- preserve the original target descriptor and revalidate focus/revision before insertion;
- map UIPI/elevated-process failures into structured errors;
- handle microphone disconnect/failover without silent target corruption;
- support cancellation and daemon restart recovery;
- include a `voice doctor` command covering permissions, hotkey, microphone, provider, model and network mode.

## First UI

Build a professional minimal surface:

- Voice Bar overlay with explicit states and cancel/retry;
- Hub with Home, History, Dictionary, Snippets, Styles, Analytics, Achievements and Settings routes;
- Scratchpad for safe capture when insertion is unavailable;
- semantic before/after text diff;
- privacy/retention and network-mode controls.

Routes may contain initial functional skeletons, but the golden loop must be real.

## Agent surface

Start with no more than the stable capabilities in `FEATURES-80-20.md`, including inspection, session control, transform preview/apply, insertion, dictionary/snippet/profile management, analytics summary and job/history access. Do not expose button-click tools.

## Evaluation

Create:

- target matrix fixtures and a Windows runner;
- latency measurements for capture-to-partial and release-to-final-insert;
- protected-token corpus;
- correction/dictionary tests;
- local network-egress denial test;
- password-field and integrity-boundary tests;
- idempotent insertion test;
- adapter final-state parity test;
- repeated-run pass^k report.

## University learning annotations

For each major module add short architecture notes linking implementation to:

- finite-state machines;
- interfaces/traits and OOP/functional boundaries;
- sets/logic for policy;
- graphs for workflows/provenance;
- vectors/matrices for audio representation;
- probability/statistics for confidence and latency;
- testing strategy.

Do not turn production source into a textbook; place explanations in `docs/learning/` and link to concrete code/tests.

## Do not add yet

- mobile;
- broad cloud provider catalogue;
- autonomous commands that execute unrelated external actions;
- hidden raw-content retention for personalisation;
- claims that every Windows field is supported;
- achievements before analytics correctness and deletion controls exist.

## Handover

Report actual Windows targets tested, support tier, latency distribution, network evidence, protected-token accuracy, adapter parity, known OS limitations, changed files and the next measured integration step.
