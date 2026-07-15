# Toolshape Voice UX

## Experience architecture

Toolshape Voice has two surfaces:

1. **Voice Bar** — minimal movable overlay for current state and rapid controls.
2. **Voice Hub** — complete desktop application for history, learning, analytics, configuration, privacy, and agent access.

The visual design must be original. Requirements describe outcomes, not a competitor screen to copy.

## Voice Bar

### States

```text
idle
listening
speech detected
transcribing
transforming
preview required
inserting
completed
recoverable failure
blocked/unsupported target
```

### Controls

- stop/cancel;
- language/profile indicator;
- input level;
- raw/final quick toggle after completion;
- copy when insertion is unavailable;
- open current session in Hub;
- hide/move/dock.

The bar remembers position per display and avoids covering the active control when possible. It can collapse to a small indicator.

## Hotkey onboarding

1. user chooses hold, toggle, or both;
2. app checks system conflict;
3. user tests with a sandbox text field;
4. app explains permission and target limitations;
5. user sees exact fallback chain;
6. app stores per-device hotkey profile.

Default examples are suggestions only. Do not steal common system/application shortcuts silently.

## Hub navigation

### Home

- current readiness: mic, model, permissions, local/cloud path;
- start Scratchpad or file transcription;
- recent recoverable dictations;
- key insights;
- privacy indicator;
- agent activity indicator.

### History

Each row shows:

- time/application/language;
- final text preview;
- raw/final diff availability;
- insertion status;
- retry/copy/open/delete;
- provider and privacy path;
- correction/feedback status.

Search occurs locally unless sync is enabled. Secret/password-field sessions are never stored.

### Dictionary

Fields:

- canonical term;
- spoken variants/pronunciation;
- case sensitivity;
- languages;
- app/context scope;
- examples;
- source: manual/correction/team/import;
- confidence and last use;
- enabled/disabled.

### Snippets

- spoken cue;
- expansion;
- formatting mode;
- placeholders resolved by approved deterministic functions;
- app/language scope;
- collision warnings;
- preview and test.

Never allow a snippet to hide an external/financial action. Snippets insert text; workflows invoke capabilities under policy.

### Styles and transforms

- verbatim/light/balanced/polished;
- custom deterministic rules;
- optional model-backed transforms;
- per-app defaults;
- protected-token strictness;
- side-by-side examples;
- raw restore.

### Languages

- fixed/auto language;
- language priority list;
- regional spelling;
- per-app language;
- provider availability/download status;
- benchmarked confidence/latency.

### App profiles

For each application/context:

- default language;
- cleanup style;
- code/technical mode;
- insertion strategy preference;
- history policy;
- context-read permission;
- preview threshold;
- hotkey override.

### Insights

See `PERSONALIZATION-ANALYTICS.md`.

### Your Voice

- usage archetype based on transparent metrics;
- milestone progression;
- commonly accepted cleanup patterns;
- top language/app contexts;
- personal accuracy and correction trends;
- “what changed” between profile versions;
- delete/rebuild/export profile.

### Models and providers

- local model download/status;
- approved cloud providers;
- quality/latency/privacy/cost comparison;
- routing policy;
- local-only enforcement test;
- benchmark button.

### Privacy and data controls

- local-only/hybrid/cloud mode;
- audio/history TTL;
- sync/training permissions separated;
- project/app exclusions;
- provider retention disclosures;
- export/delete;
- last deletion report.

### Agent access

- registered harnesses;
- granted capabilities;
- active sessions/jobs;
- recent operations and diffs;
- approval profile;
- revoke/pause;
- conformance status.

### Diagnostics

- hotkey registration;
- microphone list/priority/failover;
- audio path;
- model health;
- insertion target inspector;
- integrity/UIPI status;
- clipboard fallback test;
- network egress test;
- logs export after redaction.

## Scratchpad

A floating, keyboard-accessible note surface for dictation when no external target is appropriate. It is also the safest first-run target and recovery destination.

## File transcription

“File transcription” means selecting an existing audio or video file and producing a timestamped transcript. It is useful for meetings, interviews, lectures, podcasts, and video workflows, but it is secondary to system-wide live dictation in the first product milestone.

## Dynamic agent interfaces

Examples:

- ambiguity resolver for names/technical terms;
- raw-versus-polished review;
- “learn this correction?” scope selector;
- provider comparison after a failed dictation;
- batch approval of candidate dictionary entries.

These surfaces are rendered from trusted schemas, not arbitrary agent code.
