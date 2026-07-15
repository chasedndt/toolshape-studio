# Editable design and personal preference research

## CreatiPoster

Important direction: generate an editable JSON/multi-layer composition from instructions and user assets rather than only a flat image. It also addresses responsive, multilingual, and animated outputs.

**Toolshape use:** structured plan/scene first; background/image generation as one layer, not the whole design truth.

## AesthetiQ

Explores preference alignment and layout-quality heuristics rather than treating layout as a coordinate-prediction problem.

**Toolshape use:** design-quality checks and candidate ranking, with caution around model judges.

## DesignSense

Introduces 10,235 human preference pairs and reports that general frontier VLMs remain unreliable for nuanced multi-class layout judgement. It reports gains from specialised reward modelling and generating multiple candidates then selecting.

**Toolshape use:** specialised scorers and inference-time candidate selection; never rely on one generic VLM critique.

## DesignPref

Professional designers substantially disagree; personalised models reportedly outperform aggregate baselines with far fewer examples.

**Toolshape use:** per-user/brand Style Genome, pairwise choices, rationale, and bounded personal rankers.

## TASTE

Professional designers judge separate dimensions such as typography, hierarchy, colour harmony, layout, and brief fidelity. General scorers in the reported benchmark had limited agreement with designers.

**Toolshape use:** multi-dimensional quality evidence and human review, not a single aesthetic number.

## ViPer

Uses a small one-time preference elicitation with liked/disliked rationales to infer structured visual attributes.

**Toolshape use:** lightweight onboarding and explicit positive/negative attributes.

## Combined architecture

```text
structured editable candidate generator
+ deterministic hard rules
+ specialised dimension scorers
+ personal/brand preference ranker
+ diversity preservation
+ operator pairwise/edit feedback
```

## Limits

These are mostly recent preprints. Datasets may emphasize posters/UI/static images and may not transfer to motion, audio, or a specific user. Toolshape must collect its own consented evaluation evidence.
