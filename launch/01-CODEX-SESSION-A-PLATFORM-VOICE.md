# Codex Session A — shared platform baseline + Toolshape Voice

You are **Codex Session A**, the implementation owner for the first shared Toolshape platform baseline and the first useful Windows vertical slice of Toolshape Voice.

This is an implementation run. Do not return another planning-only document. Inspect the repository, create or repair the buildable workspace, write code, run tests, commit coherent milestones, and continue until the acceptance gates pass or a real environment blocker prevents further execution.

## Parallel-build context

A second Codex session is running simultaneously on branch/worktree `work/studio` and owns Toolshape Studio. Parallel development is intentional.

You are the initial schema owner for the shared application contract during this integration window. Publish a small tested baseline quickly, then continue Voice development. Do not edit Studio-owned code.

## Verify before editing

1. Print the current directory, Git branch, worktree list, and clean/dirty status.
2. Confirm this checkout is `work/voice-platform`, or a Codex-created detached worktree dedicated to this task. If detached, create a named local branch `work/voice-platform` before the first commit when safe.
3. Read the complete instruction chain, beginning with root `AGENTS.md` and any nested `AGENTS.md` files.
4. Read completely:
   - `README.md`;
   - `START-HERE-DUAL-CODEX.md`;
   - `docs/01-agent-native-constitution.md`;
   - `docs/02-chaseos-hierarchy.md`;
   - `docs/03-reference-architecture.md`;
   - `docs/04-semantic-kernel.md`;
   - `docs/05-operation-envelope-vs-memory.md`;
   - `docs/06-capability-design.md`;
   - `docs/07-jobs-events-artifacts.md`;
   - `docs/08-human-agent-ux.md`;
   - `docs/10-self-evolving-coach.md`;
   - `docs/11-security-secrets-privacy.md`;
   - `docs/12-evals-benchmarks.md`;
   - every file under `platform/`;
   - every schema and example under `specs/`;
   - every file under `products/voice/`;
   - relevant Voice, OSWorld, state-based-eval, tool-use, and security research notes.
5. Validate that referenced files exist. Report missing references in the handover log, but continue with the best available source of truth.
6. Create an initial control-plane event using `launch/control-plane-event.schema.json` with `event_type: "started"`.

## Write ownership

You may write to:

```text
package/workspace root manifests
packages/contracts/**
packages/kernel/**
packages/policy/**
packages/adapters/**
packages/secret-broker/**
apps/voice/**
crates/voice-*/**
specs/**                          only through the schema-change process
docs/adr/platform-*/**
docs/adr/voice-*/**
coordination/voice-status.json
coordination/proposals/platform/**
ops/control-plane/outbox/voice-platform/**
```

Treat these as read-only:

```text
apps/studio/**
packages/studio-*/**
crates/studio-*/**
coordination/studio-status.json
coordination/proposals/studio/**
```

Do not silently change a public schema. Any schema change requires a version bump, ADR, migrated fixture, compatibility test, and a `contract_change` event.

## Mission A — publish the shared platform baseline

Create the smallest real shared platform that both products can use. Prefer a modular monorepo, not premature microservices.

Implement:

1. a workspace using the repository’s chosen package managers;
2. generated TypeScript types from the Draft 2020-12 schemas where practical;
3. runtime schema validation;
4. a trusted capability registry;
5. operation dispatch with actor/delegation validation;
6. expected-revision checks;
7. idempotency using key plus request digest;
8. preview mode with no mutation;
9. atomic operation batches;
10. structured errors;
11. jobs with valid state transitions, progress, cancellation, and results;
12. artifacts and content hashes;
13. provenance/audit records and an idempotent outbox;
14. policy hooks and approval-required responses;
15. opaque secret handles with no plaintext persistence;
16. SDK, local HTTP/IPC, CLI, and STDIO MCP adapters reaching the same application handlers;
17. a neutral reference domain or fixture proving adapter parity without embedding Voice or Studio rules.

Required shared tests:

- invalid schema rejected before handler invocation;
- unknown capability rejected;
- missing grant rejected;
- stale revision rejected;
- same idempotency key and digest returns the original result;
- same key with a different digest conflicts;
- preview causes no mutation;
- atomic batch fully rolls back;
- handler failure and verification failure are distinct;
- undo/compensation is revision-bound;
- job transitions and cancellation races are deterministic;
- outbox delivery is idempotent;
- SDK/HTTP/CLI/MCP paths produce equivalent final state;
- a secret canary does not appear in database, logs, artifacts, traces, analytics, or vector/retrieval storage.

As soon as this baseline passes its tests:

1. commit it with a clear message such as `feat(platform): establish harness-native v0.1 baseline`;
2. create annotated tag `platform-v0.1.0` pointing to that tested commit;
3. write a `contract_baseline_ready` event containing the tag, commit, commands, test results, schema version, and any known limitations;
4. do not include unfinished Voice work in the tagged baseline commit.

## Mission B — implement the Toolshape Voice golden loop

After the platform baseline is tagged, continue in the same session and branch.

Primary product outcome:

```text
focus a declared supported normal-integrity Windows text field
→ hold a configurable global hotkey
→ capture the selected microphone
→ show listening / transcribing / finalising / inserting states
→ run one local ASR provider behind an interface
→ preserve immutable raw transcript
→ protect URLs, emails, identifiers, code-like spans, names and numbers
→ apply dictionary and deterministic cleanup
→ revalidate the original target
→ insert Unicode text
→ verify through UI Automation where possible
→ store recoverable local history under explicit retention settings
→ expose session, job, operation and provenance through UI, CLI and MCP
```

Architecture requirements:

- Tauri desktop shell with Rust native runtime and TypeScript UI/application clients;
- one local daemon owns microphone and dictation sessions;
- ASR, VAD, microphone, target inspection and insertion are traits/interfaces;
- local-first provider abstraction; do not bind the project format to one model;
- raw transcript, normalized transcript, proposed rewrite and inserted output are separate immutable revisions/artifacts;
- operation envelopes are not memory or style profiles;
- dictionary, snippets, corrections, languages and style profiles are versioned objects;
- Windows-specific adapters have deterministic fakes so shared CI can run elsewhere;
- no hidden network request in declared local-only mode;
- no raw secret or private transcript enters prompts, logs, analytics, crash reports or vector stores without explicit policy.

Windows behavior:

- configurable global-hotkey registration and conflict reporting;
- microphone enumeration, selection, ranking, disconnect and failover;
- password/secure-field hard refusal;
- focus/target descriptor capture and revalidation before insertion;
- structured mapping for UIPI, elevation and unsupported-target failures;
- direct Unicode input strategy with UI Automation verification when available;
- clipboard only as an explicitly reported fallback;
- cancellation and daemon-restart recovery;
- `voice doctor` command for hotkey, microphone, provider/model, permissions, target support and network mode.

First human surface:

- Voice Bar overlay with clear states, cancel, retry and fallback;
- Hub routes for Home, History, Dictionary, Snippets, Styles, Languages, Analytics, Achievements and Settings;
- Scratchpad for safe capture when target insertion is unavailable;
- semantic before/after diff;
- local/cloud and retention controls;
- functional golden loop first; route skeletons must not pretend to be completed features.

Agent surface:

Expose only stable semantic capabilities from the 80/20 feature list. Do not expose button-click or pixel-motion tools. UI, SDK, HTTP/IPC, CLI and MCP must call the same application services.

Evaluation:

- target-application matrix with support tiers;
- capture-to-partial and release-to-final-insert latency;
- protected-token corpus;
- dictionary/correction tests;
- local network-egress denial;
- secure-field and integrity-boundary cases;
- idempotent insertion;
- daemon-restart recovery;
- final-state adapter parity;
- repeated-run `pass^k` report;
- OSWorld-inspired GUI-fallback cases only where no semantic path exists.

University learning documentation:

Create concise `docs/learning/` notes tied to real modules/tests for finite-state machines, traits/interfaces, policy logic/sets, workflow/provenance graphs, audio vectors, probability/statistics, concurrency and testing. Do not pollute production source with textbook prose.

## Coordination rules

- Work in small coherent commits.
- Never merge or rewrite Session B’s branch.
- Do not wait idly for Session B.
- Inspect Studio contract proposals only when they appear; resolve accepted proposals with ADRs and compatibility tests.
- Emit structured events for `milestone`, `test_result`, `contract_change`, `blocker`, `artifact`, and `handover`.
- Events must contain verified facts, not guessed percentages.
- Never put credentials, private audio/transcripts, raw prompts or secret values in the control-plane outbox.

## Final handover

Before ending, write a final event and report:

1. commits and tag created;
2. files and contracts changed;
3. exact commands and results;
4. platform conformance matrix;
5. actual Windows targets tested and support tier;
6. measured latency and protected-token results;
7. privacy/network evidence;
8. screenshots/artifacts only when useful and non-sensitive;
9. known limitations and real blockers;
10. the smallest next integration step.
