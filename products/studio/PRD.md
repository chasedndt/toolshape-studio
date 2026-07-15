# Product requirements document — Toolshape Studio

## Vision

Create the most harness-operable content-creation environment while retaining the visual precision, direct manipulation, discoverability, and speed expected from a serious design and video editor.

The default labour split is:

```text
Human: goal, constraints, taste, references, approval, master touches
Harness: research/context, plan, repetitive edits, variants, timing, captions, checks, exports
Kernel: validity, transactions, rendering, verification, provenance, recovery
```

## Primary users

### Creator/operator

Produces social posts, carousels, thumbnails, ads, short-form video, tutorials, product content, and personal-brand material.

### E-commerce operator

Creates product creatives, listing visuals, promotional variants, UGC edits, and platform-specific exports from structured product data.

### Developer/educator

Creates diagrams, technical visuals, screen-recording edits, captioned lessons, explainers, and reusable course assets.

### Brand/team — later

Needs shared components, brand constraints, review, approvals, permissions, and asset governance.

## Core jobs

1. “Turn a brief and assets into several professional, editable visual directions.”
2. “Convert one design or video into platform variants without breaking hierarchy, crop, captions, or safe areas.”
3. “Edit a talking-head or screen-recording video from its transcript.”
4. “Split, trim, reorder, animate, blur, transition, caption, mix, and export without repetitive manual steps.”
5. “Learn my style from approved examples and corrections instead of giving me a generic AI look.”
6. “Let me review the agent’s plan and differences, then take over with professional controls.”
7. “Keep all design and video assets, comments, versions, outputs, and provenance in one project.”
8. “Use local tools for ordinary editing and pay only when a workflow needs licensed content or remote compute.”

## Product principles

- one unified project rather than a design app plus video app;
- structured outputs before flattened outputs;
- agent automation before browser automation;
- semantic batch operations with preview/diff;
- professional human editor and keyboard workflow;
- style personalisation from evidence, not one generic prompt;
- responsive/platform variants as first-class objects;
- deterministic local rendering for core operations;
- provider-pluggable AI and media services;
- local-first state and explicit cloud boundaries;
- accessibility and licensing checks in the quality pipeline.

## Unified project

A project contains:

```text
Project metadata and revision
Assets and proxies
Style/brand profile references
Pages/artboards/scenes
Layered scene graphs
Timeline graphs and tracks
Components/templates/data bindings
Transcript and caption documents
Audio mix
Comments/review decisions
Export/render presets
Jobs and artifacts
Provenance and operation history
```

A static design is a scene without required timeline duration. A video scene has duration and timeline references. A carousel, presentation, email, and video can live as linked outputs inside one campaign project without losing format-specific constraints.

## Agent work model

### Intent

The user supplies natural language, examples, selected objects, structured fields, and constraints.

### Plan

The harness creates a typed plan with affected objects, style references, providers, cost, and expected artifacts.

### Preview

Studio simulates operations and renders low-cost previews or semantic diffs.

### Approval

Risk policy decides whether reversible local operations run automatically or require review. Paid, public, or destructive actions use exact approval.

### Execute

The semantic kernel applies operations or creates durable jobs.

### Verify

Studio validates project invariants, style/brand hard rules, accessibility, media probes, safe areas, missing assets/fonts, and export parameters.

### Master touches

The operator directly edits the same semantic objects. The agent receives revision changes and may continue only after re-inspection.

## First 21 feature families

The baseline is defined in `FEATURES-21.md`. They cover unified project/workspace, assets, design layers, typography, vectors, image editing, AI smart edits, templates/brand, layout, variants/bulk, timeline, core edits, keyframes, effects, audio, transcript/captions, transcript editing, agent workflows, quality/export, history/review, and operator coaching.

## AI-native capabilities

AI/model use is strongest at uncertainty boundaries:

- brief interpretation;
- asset understanding and retrieval;
- design-plan generation;
- static-image layer reconstruction;
- object/background selection;
- image/audio/video generation through optional providers;
- clip/highlight selection;
- transcript analysis;
- caption translation;
- reframe suggestions;
- style candidate generation and ranking;
- quality critique and explanation.

Deterministic software owns:

- geometry;
- constraints;
- typography metrics;
- timeline arithmetic;
- keyframe interpolation;
- effects parameters;
- transactions;
- permissions;
- costs/bounds;
- file/render validity;
- hard quality rules;
- final state and undo.

## Human experience requirements

- fast canvas and timeline interaction;
- keyboard-first editing;
- precise inspector values;
- multi-select and batch edits;
- snapping/guides/safe areas;
- responsive preview;
- waveform and caption timing;
- semantic history;
- original, coherent visual system;
- agent panel integrated without consuming the entire workspace;
- review mode for plans, variants, and diffs;
- accessibility.

## Non-functional requirements

### Performance

- responsive interaction with realistic project sizes;
- proxy media and background jobs;
- incremental scene/timeline evaluation;
- render cancellation;
- bounded memory and cache eviction;
- hardware capability detection.

### Reliability

- crash-safe project revisions;
- content-addressed assets;
- missing asset/font diagnostics;
- deterministic operation replay;
- no false-success render artifacts;
- adapter parity;
- migration/version tests.

### Privacy and security

- projects local by default;
- provider and egress policy per project;
- untrusted import sandboxing;
- no credentials in project files;
- signed/trusted effect manifests;
- secret handles for publishing/providers;
- prompt-injection and malicious metadata tests.

### Portability

- documented project schema;
- import/export adapters;
- headless render path;
- MCP/CLI/SDK/HTTP;
- ChaseOS-neutral ANAC manifest.

## Release slices

### Alpha

Unified project, asset library, scene graph, basic timeline, text/image/shape, split/trim, captions, simple audio, variants, render/export, history/undo, agent plan/apply/verify.

### Beta

Keyframes/easing, richer effects/blur/transitions, transcript editing, style profiles, bulk data, dynamic review surfaces, provider-backed smart edits, robust import/export.

### Stable

Professional performance/support matrix, accessibility audit, signed installer/updates, migration guarantees, extensive conformance and pass^k evidence, optional hosted services.
