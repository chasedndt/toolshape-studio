# Product requirements document — Toolshape Voice

## Product vision

Make speech the fastest, safest, and most adaptable way to enter text across a computer, while giving humans and agent harnesses the same semantic control over dictation, transformation, insertion, history, analytics, and learning.

## Primary users

### Operator/developer

Dictates prompts, technical plans, code-related prose, search queries, messages, documentation, and notes across many applications. Requires exact handling of names, commands, paths, casing, and punctuation.

### Creator/entrepreneur

Captures ideas quickly, writes posts/scripts/emails, and expects app-specific tone and reusable snippets.

### Accessibility and high-volume user

Needs reliable reduced-keyboard interaction, clear state, recoverability, and configurable hotkeys.

### Team/enterprise user — later

Needs shared vocabulary, policy, retention, adoption analytics, and administrative controls.

## Jobs to be done

1. “While any normal text field is focused, let me speak and put cleaned text there.”
2. “Do not change names, code, URLs, money, dates, or exact phrases without showing me.”
3. “Learn the vocabulary and formatting I repeatedly correct.”
4. “Use a different language, cleanup, or tone depending on the application and task.”
5. “Never lose a dictation because the target, microphone, model, or network failed.”
6. “Show me how much I use voice, where it helps, where it fails, and how I can improve.”
7. “Let my agent harness transcribe, transform, inspect, and insert through typed capabilities.”
8. “Keep private work local and make every retention/network decision visible.”

## Product principles

- system-wide loop before secondary transcription tools;
- local-first, provider-pluggable;
- raw source preservation and visible diffs;
- deterministic cleanup before generative rewriting;
- exact technical token protection;
- insertion is a verified operation, not a blind key event;
- graceful fallbacks and recovery;
- personalisation without hidden profile drift;
- motivational analytics without sensitive identity claims;
- first-class keyboard accessibility and low-latency feedback.

## Functional requirements

### Capture and session

- hold-to-talk and toggle-to-talk modes;
- multiple configurable global hotkeys and per-app overrides;
- visible listening/transcribing/inserting/error state;
- microphone priority list and automatic failover;
- audio-level meter and device diagnostics;
- VAD and endpointing;
- interruption handling and recoverable session history;
- optional whisper/quiet-speech profile.

### Recognition

- one local/offline ASR provider at launch;
- optional approved cloud providers behind explicit privacy/cost policy;
- auto or fixed language;
- mixed-language handling declared as experimental until measured;
- partial and final results;
- timestamps/confidence where provider supports them;
- punctuation and spoken formatting commands;
- domain vocabulary injection where supported.

### Transformation

Pipeline stages:

```text
raw transcript
→ normalisation
→ spoken correction/backtracking resolution
→ protected-token alignment
→ personal/team dictionary
→ snippet expansion
→ deterministic cleanup profile
→ optional model-backed rewrite proposal
→ diff and policy
→ final text
```

Cleanup levels:

- verbatim;
- light punctuation;
- balanced cleanup;
- polished;
- custom/app profile.

The user can restore the raw form.

### Context

Collect the minimum necessary context:

- process/application identity;
- control type and security state;
- optional window/document title after redaction;
- optional selected text or nearby text only with explicit policy;
- app-specific profile;
- current language/input mode.

Never read password values. Do not capture whole screens/documents merely to spell one word.

### Insertion

- target capability detection;
- tiered Windows strategies;
- focus revalidation before commit;
- insertion preview for sensitive/high-change transformations;
- copy-only fallback;
- insertion result and diagnostics;
- optional immediate undo when the target strategy supports it;
- elevated/protected-target disclosure.

### Learning

- manually managed personal dictionary;
- candidate dictionary entries from repeated corrections;
- pronunciation/spoken-form mapping;
- snippets and formatted expansions;
- per-app and per-language profiles;
- correction history with accept/reject;
- profile export/import;
- local style/tone examples;
- bounded decay and confidence.

### Hub and analytics

- history/recovery;
- dictionary;
- snippets;
- styles/transforms;
- languages;
- app profiles;
- microphone/hotkey settings;
- provider/model settings;
- Insights dashboard;
- Your Voice/profile/achievements;
- privacy and data controls;
- agent access/audit;
- diagnostics and benchmark results.

### Agent compatibility

Expose semantic tools/resources listed in `ARCHITECTURE.md`. A harness can inspect session/history summaries, create or transform transcripts, manage profiles under grants, start asset transcription, request insertion preview, commit insertion, and read analytics. Live microphone ownership remains an explicit session resource to avoid two harnesses recording simultaneously.

## Non-functional requirements

### Latency

Record by provider/hardware/language:

- hotkey-to-listening;
- speech-to-first-partial;
- stop-to-final;
- final-to-insertion;
- total p50/p95/p99.

Do not publish one universal latency promise before the supported hardware matrix exists.

### Reliability

- no silent lost dictations;
- failed sessions remain recoverable under retention policy;
- microphone failover does not corrupt session identity;
- idempotent insertion prevents duplicate text after retries;
- application restart recovers incomplete jobs/history safely.

### Privacy

- local-only network enforcement;
- visible provider and data path;
- configurable history/audio retention;
- delete/export controls;
- redacted telemetry;
- no model access to secrets/password fields;
- no raw content in achievement analytics by default.

### Accessibility

- full keyboard operation;
- screen-reader labels;
- visible and audible state options;
- high-contrast overlay;
- reduced motion;
- alternative hotkeys;
- errors that explain remediation.

## Release slices

### Alpha

Windows local-first golden loop; English plus selected benchmark languages; dictionary/snippets; history; basic insights; CLI/MCP; target matrix.

### Beta

More languages/providers; robust app profiles; richer correction learning; milestones/profile; installer/updater; optional encrypted sync.

### Stable

Documented support matrix, strong pass^k reliability, accessibility audit, enterprise-ready privacy evidence, signed releases, migration guarantees.

## Business model

The local golden loop must remain genuinely useful. Paid value can include premium cloud recognition, encrypted sync, mobile, team vocabulary, managed policies, enterprise support, and optional advanced models. See `docs/14-x402-monetization.md`.
