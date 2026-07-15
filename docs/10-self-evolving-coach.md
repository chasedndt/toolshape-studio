# Self-evolving software and operator coaching

## What “self-evolving” should mean

The product must become better for a user and organization without allowing an LLM to rewrite production code or silently mutate policy.

Evolution happens through versioned, reviewable objects:

- dictionaries and pronunciation mappings;
- app/context profiles;
- style profiles and weights;
- reusable workflow recipes;
- correction rules;
- quality thresholds;
- provider routing policies;
- task-specific coaching suggestions;
- benchmark cases and regression data.

## Four learning loops

### 1. Personal operating loop

Learns from direct corrections and approvals:

```text
result → operator edit/reject/approve → classify feedback scope
→ propose profile/rule update → user accepts → versioned update
```

Scope options:

- only this output;
- this project;
- this application/context;
- this style profile;
- permanent personal default.

### 2. Workflow loop

ChaseOS or a standalone workflow archive records successful process structure without retaining secret values:

- capability sequence;
- preconditions;
- decision points;
- expected intermediate states;
- verification rules;
- failure and recovery branches;
- cost/latency evidence.

A workflow is promoted only after repeated success and collateral-damage checks.

### 3. Product loop

Consented telemetry identifies product problems:

- high correction rates;
- recurring insertion failures;
- slow stages;
- confusing approval prompts;
- effect/render failures;
- accessibility defects;
- tool-call ambiguity.

Product analytics should prefer aggregate event counts and bounded diagnostics over raw user content.

### 4. Research loop

ChaseOS can monitor official documentation and new papers, but research never changes production automatically.

```text
new source
  → dated research note
  → claimed implication
  → source quality and uncertainty
  → proposed contract/product change
  → offline experiment
  → eval result
  → architecture review
  → shadow/canary rollout
  → promotion or rejection
```

See `research/research-refresh-workflow.md`.

## The operator coach

Each product includes a coach that teaches the user how to get better outcomes.

### Toolshape Voice examples

- “Your correction rate for technical names dropped after adding five dictionary entries.”
- “You dictate fastest in long-form notes, but insertion failures are concentrated in elevated applications.”
- “This app profile removes too much punctuation; compare balanced cleanup.”
- “You use this paragraph repeatedly. Convert it into a snippet?”

### Toolshape Studio examples

- “Your approved thumbnails use one dominant focal object and high title contrast.”
- “Your last four rejections removed excessive motion. Lower motion-density weight?”
- “This caption style violates the bottom safe area on two target platforms.”
- “Your exports are frequently corrected from 30 fps to 60 fps. Change the channel preset?”

## Gamification and achievements

Milestones can motivate continued use, but they must not reward waste or make sensitive inferences.

Recommended milestone events:

```text
2,000 words  first voice profile
5,000 words  first personalised insight pack
10,000 words app-context comparison
25,000 words advanced workflow insights
50,000 words long-term accuracy and time-saved report
100,000 words mastery profile and exportable year-in-review
```

Titles are generated from transparent usage dimensions such as consistency, breadth of apps, technical vocabulary, or editing workflows. They must be framed as observed activity, not a factual judgement about identity or professional status.

Example:

> “Technical Builder — 62% of your recent dictated sessions contained code or software terminology.”

The user can see the evidence, disable analysis, and delete the derived profile.

## Promotion safety

No learned change may bypass:

- schema validation;
- permissions;
- hard safety rules;
- test suites;
- revision history;
- rollback;
- privacy/retention settings.

The product evolves through controlled configuration and models, not hidden self-modifying authority.
