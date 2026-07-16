# Toolshape Studio

Toolshape Studio is one integrated visual-design and video-editing super app. It combines the strongest common workflow of Canva-like visual creation and CapCut-like media editing without treating them as separate codebases or separate user journeys.

**Implementation status (2026-07-16): PARTIAL / MILESTONES 1-4 VERIFIED.** The repository now contains a runnable unified project/editor/kernel/persistence/render seed, a durable local render-job lifecycle, real probed video/audio ingestion with a verified editing proxy, schema-valid SDK/CLI documents, and a browser-verified professional shell with four workspace arrangements, functional menus, five source panels, separate inspector/agent/quality contexts, and hideable temporal/context regions. It is not yet a native desktop release or a claim of full category parity. Current evidence and deferred surfaces are recorded in `../../07_LOGS/Build-Logs/2026-07-16-ChaseOS-toolshape-studio-editor-shell-ux.md`.

## Product promise

> Give an agent harness a brief, assets, source media, style profile, constraints, and target platforms; receive a fully editable project and verified output variants; then let the operator perform precise master touches in a professional editor.

## Why one application

Design and video share:

- assets;
- pages/scenes;
- layers;
- typography;
- shapes and masks;
- colour and effects;
- transforms;
- keyframes;
- brand/style tokens;
- comments and approvals;
- export presets;
- publishing workflows;
- provenance.

Toolshape Studio uses one project model with a spatial scene graph and temporal timeline graph rather than gluing two applications together.

## Documents

- `PRD.md` — product requirements
- `UX.md` — professional editor and agent/operator interaction
- `ARCHITECTURE.md` — unified project/kernel/render architecture
- `FEATURES-21.md` — first 21 feature families and priorities
- `DESIGN-ENGINE.md` — scene, layout, typography, image, templates, variants
- `VIDEO-ENGINE.md` — timeline, keyframes, effects, audio, captions, render
- `STYLE-INTELLIGENCE.md` — personalised professional style system
- `DYNAMIC-INTERFACES.md` — task-specific agent review surfaces
- `EVALS.md` — state, visual, media, security, and harness evaluation
- `CODEX-HANDOVER.md` — parallel implementation packet

## Research basis

See `research/product-notes/canva.md`, `research/product-notes/capcut.md`, `research/paper-notes/design-preference.md`, and `research/benchmark-notes/osworld-family.md`.
