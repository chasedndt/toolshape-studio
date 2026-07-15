# Style and preference intelligence

## Objective

Generate and edit content that is recognisably aligned with an individual or brand while remaining professional, structured, editable, and non-generic.

There is no universal “human-made” style. Professional designers disagree meaningfully about visual quality. The system therefore models **personal and contextual preference**, not one global aesthetic score.

## Style Profile

A style profile is a versioned, inspectable object with weighted dimensions:

```text
typography
  type families, scale, contrast, line length, tracking, casing
layout
  grids, density, whitespace, alignment, asymmetry, rhythm
colour
  palette, contrast, saturation, temperature, accessibility rules
shape
  corner language, stroke, depth, texture, ornament
imagery
  crop, lighting, composition, treatment, realism, subject emphasis
motion
  duration, easing, energy, transition density, camera movement
captions
  placement, line count, emphasis, animation, safe areas
audio
  loudness, music level, ducking, fade character, silence tolerance
voice/tone
  concise, formal, playful, technical, persuasive, restrained
constraints
  brand tokens, forbidden patterns, legal copy, platform rules
```

Weights have allowed ranges and contextual overrides. A profile has provenance: direct settings, approved examples, pairwise choices, and inferred suggestions.

## Four data stores

1. **Deterministic tokens and rules** — authoritative constraints.
2. **Approved exemplar library** — files or components the user explicitly accepts as representative.
3. **Preference events** — pairwise comparisons, edits, rejections, and rationale.
4. **Embeddings/retrieval index** — finds relevant examples; never overrides explicit rules.

## Candidate pipeline

```text
brief + project context + style profile
  → retrieve relevant exemplars
  → generate multiple structured candidate plans
  → enforce hard constraints
  → render previews
  → run domain quality checks
  → rank with personalised and brand-aware scorers
  → preserve diversity
  → operator selects/edits
  → propose bounded preference update
```

## Professional-quality gates

- text remains editable and uses licensed/available fonts;
- hierarchy and reading order are explicit;
- spacing follows a coherent system;
- overflow, clipping, widows/orphans, and safe-area violations are detected;
- colour contrast and platform accessibility are checked;
- assets are not stretched or unintentionally cropped;
- motion has purposeful easing and does not overuse effects;
- caption timing, line length, and placement are validated;
- audio loudness and clipping are measured;
- templates are varied enough to avoid repeated AI-looking composition;
- output remains traceable to the brief and style evidence.

## Personalisation safety

- Learning is opt-in or clearly disclosed.
- Private projects are not used to train shared models without explicit permission.
- Sensitive attributes are not inferred from content.
- The system may describe observed work patterns, not declare a user’s identity or profession as fact.
- Profile changes are versioned and undoable.
- Deleting a profile removes its retrievable examples and key material according to the retention policy.
