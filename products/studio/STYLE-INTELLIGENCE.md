# Studio style intelligence

## Goal

Make generated and edited work feel like the user’s deliberate professional system rather than a repeated generic AI template.

## Style Genome

Studio extends the shared `StyleProfile` into design/video dimensions:

```text
typography
layout and spacing
colour and contrast
shape and edge language
image treatment
composition and focal hierarchy
texture/depth
motion energy and easing
transition density
caption style
sound/music/ducking
copy tone
platform-specific conventions
brand constraints
forbidden patterns
```

Every dimension has a weight, settings, confidence, scope, and evidence.

## Evidence hierarchy

```text
explicit hard rule
> direct user setting
> approved brand token/component
> repeated accepted edit
> pairwise preference with rationale
> approved exemplar
> inferred pattern
> general model prior
```

Lower evidence cannot override higher evidence.

## Preference elicitation

Initial setup should not demand hundreds of labels. Use:

- import of existing work;
- selection of 5–15 representative pieces;
- small pairwise comparisons across typography/layout/colour/motion;
- explicit “avoid” examples;
- target audience and platform constraints;
- optional brand kit.

The system produces a transparent first profile and asks the user to correct it.

## Candidate generation and ranking

Do not ask one model for one final output.

```text
1. create several structured plans with meaningful diversity
2. enforce hard rules and editability
3. render low-cost previews
4. run specialised quality checks
5. rank with personal/brand preference models
6. preserve non-dominated alternatives
7. let operator select/merge/edit
```

Specialised scorers can cover typography, hierarchy, colour harmony, image quality, motion, captions, audio, brief fidelity, and accessibility. No single score should silently decide taste.

## Human-made/professional indicators

- intentional hierarchy and focal point;
- coherent spacing rhythm;
- typography appropriate to content and platform;
- controlled repetition/variation;
- purposeful image crop and subject emphasis;
- restrained effects where not justified;
- motion with timing/easing designed for meaning;
- audio that supports speech rather than competes;
- platform-safe and accessible composition;
- editability and consistent component/token use;
- asset and copy fidelity;
- avoidance of unexplained stock gradients, excessive glow, identical card grids, and generated-text artefacts.

These are diagnostics, not a universal style formula.

## Learning from master touches

After manual edits, Studio computes a semantic diff and asks the scope:

- this variant only;
- this project;
- this campaign/channel;
- update style profile;
- add anti-pattern;
- create/revise component;
- ignore as one-off.

A proposed profile update shows before/after weights and examples. Accepted profile changes become versioned operations.

## Negative preference

Record not only what the user likes but what they consistently reject:

- too much text;
- weak contrast;
- generic gradient;
- overly smooth/corporate;
- excessive zoom transitions;
- captions covering focal objects;
- music too loud;
- AI-looking images or malformed typography.

Negative rules can be hard, soft, contextual, or expiring.

## Private learning

- local inference/evaluation where possible;
- private exemplars remain local unless sync is enabled;
- embeddings are encrypted and scoped;
- no shared training without explicit opt-in;
- derived profile export/delete;
- no hidden retention of rejected private assets.

## Evaluation

Use personalised pairwise accuracy, operator selection rate, post-generation edit distance, repeated rejection rate, hard-rule failures, diversity, and professional review. Aggregate aesthetic models are baselines, not ground truth.
