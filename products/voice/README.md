# Toolshape Voice

Toolshape Voice is the provisional name for the independent voice product. Its primary job is simple to state and difficult to execute reliably:

> Hold or toggle a configured global hotkey, speak while any supported text field is focused, and receive accurate, context-aware, reviewable text in that exact target without breaking technical tokens, privacy, or focus.

The voice product is local-first, agent-controllable, and fully usable without ChaseOS. ChaseOS improves it through workflow memory, policy, scheduled analysis, and cross-application context, but the product owns its domain and standalone operator experience.

## Golden loop

```text
focus a text field
→ hold/toggle hotkey
→ capture audio and show visible listening state
→ stream partial transcript
→ release/stop
→ preserve raw transcript
→ apply dictionary, snippets, protected-token, and cleanup profile
→ preview when policy/context requires
→ insert through the best available Windows strategy
→ verify or provide a precise fallback
→ learn only from accepted corrections
```

## Documents

- `PRD.md` — product requirements and outcomes
- `UX.md` — Flow Bar, Hub, panels, shortcuts, and operator journeys
- `ARCHITECTURE.md` — local services and provider boundaries
- `FEATURES-80-20.md` — priority features and deferred scope
- `WINDOWS-INTEGRATION.md` — system-wide hotkey and insertion strategy
- `PERSONALIZATION-ANALYTICS.md` — dictionary, profile, insights, achievements
- `PRIVACY.md` — local/cloud modes and retention
- `EVALS.md` — latency, quality, insertion, privacy, and harness tests
- `CODEX-HANDOVER.md` — implementation packet

## Research basis

See `research/product-notes/wispr-flow.md`, `research/benchmark-notes/osworld-family.md`, and `research/paper-notes/security-agents.md`.
