# Two-product portfolio and shared platform

## Product 1: Toolshape Voice

Independent local-first voice product with:

- system-wide dictation;
- transformation and context awareness;
- personal language learning;
- analytics and coaching;
- agent/harness capabilities;
- a lightweight overlay plus a full Hub.

## Product 2: Toolshape Studio

One integrated content-creation product covering:

- graphic design;
- images and layouts;
- short- and long-form video editing;
- audio processing;
- captions and transcripts;
- brand/style systems;
- agent-driven generation and edits;
- operator fine-tuning;
- export and review.

Combining the Canva and CapCut categories is architecturally coherent because visual and temporal content share assets, typography, colour, masks, layers, transformations, keyframes, effects, brand tokens, comments, export presets, and publishing workflows.

## Shared platform, not forced shared runtime

Shared contracts and libraries include:

- ANAC;
- identity/delegation objects;
- operation/result envelopes;
- jobs and artifacts;
- policy and approvals;
- secret handles;
- provenance;
- adapter kit;
- conformance harness;
- style profile base schema;
- workflow recipes.

Each product keeps its own domain kernel and persistence boundaries. Do not create one giant database aggregate that couples voice dictation to video timelines.

## Parallel agent orchestration

The build can proceed in parallel when dependencies are explicit:

```text
Platform contracts ───────────────┐
Semantic kernel ──────────────────┼─ integration gate
Security/policy ──────────────────┘

Toolshape Voice runtime ──────────┐
Toolshape Voice experience ───────┼─ voice vertical slice

Studio scene engine ──────────────┐
Studio timeline engine ───────────┼─ studio vertical slice
Studio experience ────────────────┘

Conformance and evals consume every branch continuously.
```

The concern is not that multiple harnesses create unfinished code. The engineering requirement is that parallel outputs merge through stable schemas, fixtures, ownership, and tests.

## Portfolio moat

The moat is not merely feature parity. It is:

- semantic editability;
- external harness control;
- trustworthy approvals and recovery;
- personal style and workflow learning;
- high-quality professional editor UX;
- local-first privacy;
- state-based reliability;
- cross-product and cross-harness workflow composition.
