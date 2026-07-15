# Codex handover — Toolshape Studio foundation

## Mission

Build one unified content-creation vertical slice proving that design and video share a project, asset store, style system, operation kernel, history, human editor, and agent surface.

## Read first

- root and Studio `AGENTS.md`;
- all Studio documents;
- platform handovers;
- schemas/examples;
- `research/product-notes/canva.md`;
- `research/product-notes/capcut.md`;
- `research/paper-notes/design-preference.md`;
- benchmark/security notes.

## Parallel workstreams

### Contracts/domain

- project/asset/scene/timeline schemas;
- operation unions;
- revisions/migrations;
- fixtures;
- generated types.

### Scene/render

- scene graph;
- text/image/shape/group;
- transforms/layout basics;
- interactive renderer abstraction;
- headless PNG render;
- overflow/font diagnostics.

### Timeline/media

- asset probe/proxy;
- timeline/tracks/clips;
- split/trim/ripple;
- simple keyframes;
- captions/audio fade/mute;
- FFmpeg render plan/worker;
- output verification.

### Editor UX

- Tauri shell;
- layers/assets/canvas/inspector;
- timeline/waveform/caption lane;
- history/undo;
- agent/review panel;
- keyboard and accessibility baseline.

### Agent/style/quality

- Studio capability surface;
- brief-to-typed-plan stub/provider;
- style profile application;
- variant generation;
- quality checks;
- dynamic review schemas;
- cross-adapter conformance.

## First unified vertical slice

Input:

- one source video with audio;
- one product image/logo;
- one text brief;
- one style profile.

Produce:

1. a project with a 9:16 video scene;
2. editable title/product graphic layers;
3. imported video clip on timeline;
4. split/trim operation;
5. generated caption track from fixture transcript;
6. music/audio track with gain, mute, and fade controls;
7. one transform/opacity keyframe animation;
8. one blur/effect instance;
9. preview and semantic diff;
10. verified MP4 plus PNG cover artifact;
11. operator direct edit followed by harness re-inspection;
12. CLI/MCP/SDK parity for plan, apply, validate, render, and job status.

## Architecture constraints

- canonical schemas independent of UI/render libraries;
- stable IDs and rational time;
- no raw shell execution;
- deterministic local P0 operations;
- provider-backed generation isolated;
- originals immutable;
- incomplete render never becomes an artifact;
- every UI change creates canonical operations;
- style profile separate from operation envelope;
- no arbitrary generated UI code.

## Required tests

- scene graph invariant/property tests;
- matrix transform round-trip;
- text overflow fixture;
- split/trim/ripple time arithmetic;
- keyframe interpolation fixtures;
- audio fade/mute render probe;
- caption timing/safe-area checks;
- cancellation/process cleanup;
- stale revision after operator edit;
- idempotent render job creation;
- malicious import fixtures;
- secret/publish token canary;
- adapter final-state parity;
- golden workflow `pass^k` harness cases.

## Do not add yet

- real-time collaboration;
- arbitrary third-party native plugins;
- mobile/web parity;
- full 3D/compositing/DAW/colour suite;
- dozens of generation providers;
- direct public publishing before exact approval and idempotency exist;
- flatten-only AI output.

## Handover response

Report changed files, operations/schemas, render toolchain and licences, commands/results, measured performance, golden workflow artifacts, eval results, UI screenshots only if useful, known fidelity limits, and integration issues requiring contract review.
