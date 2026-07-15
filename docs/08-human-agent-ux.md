# Human-agent UX

## Product stance

Agent-first does not mean chat-only. The operator should spend less time on mechanical labour and more time on taste, constraints, approval, and final craft.

The products therefore provide three simultaneous modes:

1. **Direct manipulation** — professional controls, canvas, timeline, text fields, inspectors, shortcuts.
2. **Agent delegation** — describe goals and constraints; harness plans and executes semantic capabilities.
3. **Structured supervision** — plans, comparison grids, semantic diffs, risk prompts, quality reports, and approval checkpoints.

## Stable shell plus dynamic task interfaces

The main editor is stable and learnable. The agent may request a task-specific surface rendered from a trusted declarative schema.

Examples:

- compare four campaign variants against style and brand scores;
- approve five transcript removals with waveform context;
- resolve ambiguous names before insertion;
- choose among three motion treatments;
- review every external/paid action in a batch.

The agent never sends arbitrary JavaScript/HTML that executes with application authority. It sends a typed view model. The application renders approved components and emits typed operations.

## Operator control loop

```text
Goal and constraints
  → agent plan
  → affected objects and cost
  → preview/diff
  → approval when required
  → execution and live progress
  → verified result
  → direct master touches
  → optional feedback captured as preference evidence
```

## Semantic selection

When a human selects a layer, clip, caption segment, transcript span, or text region, the selection is exposed as stable object references to the harness—subject to privacy policy. The harness must not infer selection from screenshot coordinates when semantic selection exists.

## Approval design

An approval screen shows:

- exact action and target;
- meaningful parameter differences;
- external recipients or publication destination;
- data leaving the device;
- estimated and maximum cost;
- reversibility;
- expiry;
- what will happen if rejected.

Avoid approval fatigue. Group low-risk homogeneous actions into a reviewable batch; never hide a high-risk action inside it.

## Corrections as learning

After a user changes an agent result, the system asks or infers cautiously:

- one-off correction;
- project-level rule;
- app-level preference;
- permanent personal style preference;
- dictionary/snippet update;
- rejected pattern.

The proposed learning is visible and reversible. Do not silently generalise every edit.

## Accessibility

Agent-generated and static interfaces must support keyboard navigation, screen readers, focus visibility, motion reduction, contrast checks, captions, and semantic labels. Automated accessibility verification is part of export quality gates, not an optional polish task.
