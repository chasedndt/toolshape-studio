# Agent-native software constitution

## Definitions

### AI-featured

A model performs a bounded function such as generation, transcription, classification, or summarisation.

### Copilot-assisted

AI assists a human who remains the primary driver of the existing interface.

### Agent-compatible

An external agent can discover and invoke typed capabilities and receive structured state, results, and errors.

### Harness-native

An external harness can discover, inspect, plan, preview, authorize, execute, verify, and recover meaningful work without depending on visual UI choreography.

### Agent-native ecosystem

Capabilities, workflows, delegation, provenance, evaluation, and economics compose across applications and harnesses through portable contracts.

## Working definition

> A harness-native application is a semantic, stateful, policy-enforced execution environment whose capabilities can be discovered, inspected, simulated, invoked, verified, and recovered by an external agent harness without depending on the human GUI.

## Twenty design laws

1. The GUI is never the only control plane.
2. The GUI remains professional, fast, accessible, and complete for human craft.
3. One semantic application model serves humans and agents.
4. Durable domain actions are semantic operations, not mouse coordinates.
5. Natural language can express intent; typed schemas define execution.
6. Model output cannot grant authority.
7. Imported content is untrusted data and cannot change permissions.
8. Every meaningful write is revision-aware and idempotent.
9. Multi-object edits are transactional or declare partial-failure semantics.
10. High-impact actions support preview and exact approval binding.
11. Long-running work is a durable job.
12. All outputs retain provenance.
13. Success is verified against state or an explicit domain verifier.
14. Reversibility is the default; irreversible limits are declared.
15. Errors are machine-actionable.
16. Secrets are referenced by opaque handles and have explicit retention.
17. Style learning is versioned preference data, not hidden prompt drift.
18. Capabilities remain portable across models and harnesses.
19. Every capability ships with state-based evals.
20. New autonomy is promoted only after measured reliability improves.

## Anti-patterns

### Chat facade over a UI-only application

The agent still needs pixels, hidden state remains inaccessible, and operations cannot be verified reliably.

### One MCP tool per button

This reproduces the toolbar instead of the domain and creates high planning cost.

### One giant “make it good” tool

It hides side effects, makes preview vague, and prevents precise verification and recovery.

### Agent-authored database writes

Plausible JSON is not a transaction engine. Domain invariants must remain deterministic.

### Silent preference learning

A system that changes style or wording without a reviewable profile becomes unpredictable and difficult to debug.

### Prompt-based security

Asking a model not to reveal a secret is not access control. Authority lives in the executor and policy engine.

## Maturity model

| Level | Description | Exit test |
|---:|---|---|
| 0 | GUI-only | Agent must manipulate pixels for normal work |
| 1 | AI-featured | AI performs isolated functions but cannot operate the application |
| 2 | Automatable | API/CLI exists but may expose CRUD or UI-shaped actions |
| 3 | Agent-compatible | Typed capabilities, state, jobs, errors, and docs exist |
| 4 | Harness-native | Preview, delegation, revisions, verification, provenance, and recovery exist |
| 5 | Agent-native ecosystem | Multiple harnesses and applications compose through stable portable contracts |

The first release target is Level 4 for the golden workflows.
