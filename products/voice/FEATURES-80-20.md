# Toolshape Voice 80/20 feature plan

## The 20% that must deliver 80% of value

### P0 — golden loop

1. **Global hold/toggle hotkeys** with conflict detection.
2. **Microphone priority and failover** with visible state.
3. **Streaming local transcription** with partial and final text.
4. **Auto/fixed language selection** for a benchmarked initial set.
5. **Raw transcript preservation** and interruption recovery.
6. **Protected-token pipeline** for names, numbers, URLs, emails, paths, commands, casing, and code identifiers.
7. **Balanced deterministic cleanup** including punctuation, filler handling, lists, and spoken corrections.
8. **Personal dictionary** with manual and proposed correction learning.
9. **Snippets** with formatted text expansion.
10. **Per-app profiles** for language, cleanup, privacy, and insertion.
11. **Tiered Windows insertion** with copy fallback and precise errors.
12. **History and retry** under configurable retention.
13. **Insights baseline**: words, time estimate, WPM, latency, correction/undo, top apps, languages, local/cloud path.
14. **Hotkey/mic/provider/privacy/agent settings**.
15. **MCP, CLI, SDK, and local IPC parity** for the stable semantic surface.

### P1 — strong beta

- optional model rewrite proposals;
- advanced spoken formatting and code mode;
- multiple local/cloud provider routing;
- richer language/regional spelling;
- Your Voice profile and milestone packs;
- correction confidence/decay;
- encrypted sync;
- shared team vocabulary/snippets;
- file transcription UX;
- exportable analytics/profile.

### P2 — later

- mobile clients;
- personalised acoustic models;
- enterprise administration;
- organization-wide analytics;
- advanced accessibility integrations;
- plugin/provider marketplace;
- voice-controlled application workflows beyond text insertion.

## Feature acceptance template

Every feature answers:

```text
Human workflow
Semantic capabilities
State and revisions
Risk/approval
Privacy/retention
Verifier
Recovery
Metrics
Target matrix
```

## What not to prioritise before reliability

- decorative avatar systems;
- social leaderboards;
- dozens of rewrite personas;
- untested support claims for all languages/apps;
- cloud-only AI features that weaken local golden-loop reliability;
- broad voice-command automation hidden inside text dictation.

Achievements and profile insights ship after analytics correctness and privacy controls, not instead of them.
