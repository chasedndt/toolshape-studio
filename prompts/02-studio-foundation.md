# Codex execution prompt — Toolshape Studio unified foundation

You are implementing one unified, editable design-and-video vertical slice. Do not create separate Canva-like and CapCut-like codebases joined by exports. They share one project, asset store, style system, operation history, editor and agent surface.

## Preconditions

The shared semantic kernel, policy engine, secret broker, adapters and conformance suite must be available as versioned workspace packages.

## Mandatory reading

- root and `products/studio/AGENTS.md`;
- every Studio document;
- platform handovers;
- all common contracts and examples;
- Canva, CapCut, design-preference, benchmark and security research notes;
- clean-room and licensing documents.

## Golden workflow

Given one source video with audio, one product image/logo, one text brief and one style profile, produce:

1. a shared project and asset graph;
2. a 9:16 editable scene with title and product layers;
3. the video clip on an editable timeline;
4. one split and trim/ripple sequence;
5. a fixture or provider-generated transcript and editable caption track;
6. audio gain, mute and fade controls;
7. one transform/opacity keyframe animation with easing;
8. one blur/effect instance;
9. a preview and semantic diff;
10. deterministic quality checks;
11. a verified MP4 and PNG cover artifact;
12. a direct operator edit followed by harness re-inspection and safe continuation;
13. SDK, HTTP/IPC, CLI and MCP parity for plan, apply, validate, render and job status.

## Canonical architecture

Create original, renderer-independent schemas for:

```text
Project
Asset
Scene / Artboard
SceneNode union
Timeline
Track union
Clip
Keyframe / Curve
Effect instance
Caption segment
Audio automation
StyleProfile reference
RenderPreset
Artifact
```

Requirements:

- stable IDs;
- rational time or frame/timebase pairs;
- immutable originals;
- explicit revisions and migrations;
- no raw FFmpeg shell command in project state;
- no renderer-library object in canonical state;
- no flattened-only AI output;
- no generated executable UI.

## Workstream boundaries

### Contracts/domain

Own schemas, operation unions, migrations, fixtures and generated types.

### Scene/render

Own scene graph, transforms, text/image/shape/group, layout basics, interactive renderer abstraction, headless PNG and diagnostics.

### Timeline/media

Own probe/proxy, tracks/clips, split/trim/ripple, keyframes, captions, audio fades/mute and FFmpeg worker plan.

### Editor UX

Own professional canvas/layers/assets/inspector/timeline/waveform/caption/history/agent-review surfaces. Every manual edit emits canonical operations.

### Style/agent/quality

Own typed plan creation, style-profile application, candidate generation/ranking, structured review interfaces and quality gates.

One schema owner controls each shared contract during an integration window.

## First 21 feature families

Use `FEATURES-21.md` as the product map. Implement the smallest valuable subset of every dependency needed by the golden workflow. Do not simulate completeness with empty buttons.

## Style intelligence

- represent style as structured dimensions and constraints;
- keep personal preference separate from universal technical validators;
- allow approved exemplars and pairwise choices;
- generate several editable candidates;
- rank with attributable evidence;
- support operator override and profile-version rollback;
- record explicit correction/approval events;
- prohibit hidden indefinite retention of source content.

## Dynamic task interfaces

Implement schema-driven trusted components for at least:

- candidate comparison;
- semantic operation preview;
- caption correction;
- quality violations;
- render approval.

The harness supplies declarative data and actions from an allowlist. It cannot inject JavaScript or arbitrary native components.

## Required tests

- scene graph invariant/property tests;
- transform round-trip;
- text overflow/font missing/safe-area fixtures;
- split/trim/ripple rational-time arithmetic;
- keyframe interpolation/easing fixtures;
- audio gain/mute/fade render probe;
- caption timing and safe-area checks;
- render cancellation/process cleanup;
- stale revision after direct operator edit;
- idempotent render job creation;
- malicious media/import fixtures;
- secret and publish-token canaries;
- adapter final-state parity;
- editability assertion after AI-assisted creation;
- golden workflow pass^k report.

## Clean-room requirements

Do not copy competitor source, assets, templates, private prompts, icons, names, wording or distinctive screen layouts. Public outcome categories can inform requirements. The implementation, visual language and project format must be original.

## Handover

Report contracts, changed files, render toolchain and licences, commands/results, measured render performance, generated artifacts, conformance/eval results, fidelity limits and any contract changes that need integration review.
