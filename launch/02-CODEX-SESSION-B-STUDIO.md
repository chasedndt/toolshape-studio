# Codex Session B — Toolshape Studio unified design-and-video super app

You are **Codex Session B**, the implementation owner for Toolshape Studio: one unified, editable design, image, motion, audio and video creation environment with a first-class operator UI and a semantic agent control plane.

This is an implementation run. Do not return another planning-only document. Inspect the repository, create buildable Studio-owned packages and application code, run tests, commit coherent milestones, and continue until the vertical-slice gates pass or a real environment blocker prevents further execution.

## Parallel-build context

Codex Session A is running simultaneously on `work/voice-platform`. It owns the first shared contracts/kernel/policy/adapters baseline and Toolshape Voice.

You do not need to wait for Session A. Work from the frozen schemas and handover inside Studio-owned paths. When the tested Git tag `platform-v0.1.0` appears, integrate it in a dedicated commit and run parity/state tests. Do not duplicate the generic kernel inside Studio.

## Verify before editing

1. Print the current directory, Git branch, worktree list, and clean/dirty status.
2. Confirm this checkout is `work/studio`, or a Codex-created detached worktree dedicated to this task. If detached, create a named local branch `work/studio` before the first commit when safe.
3. Read the complete instruction chain, beginning with root `AGENTS.md` and nested Studio instructions.
4. Read completely:
   - `README.md`;
   - `START-HERE-DUAL-CODEX.md`;
   - `docs/01-agent-native-constitution.md`;
   - `docs/02-chaseos-hierarchy.md`;
   - `docs/03-reference-architecture.md`;
   - `docs/04-semantic-kernel.md`;
   - `docs/05-operation-envelope-vs-memory.md`;
   - `docs/06-capability-design.md`;
   - `docs/07-jobs-events-artifacts.md`;
   - `docs/08-human-agent-ux.md`;
   - `docs/09-style-preference-intelligence.md`;
   - `docs/10-self-evolving-coach.md`;
   - `docs/11-security-secrets-privacy.md`;
   - `docs/12-evals-benchmarks.md`;
   - `docs/13-protocol-selection.md`;
   - all common schemas/examples under `specs/`;
   - every file under `products/studio/`;
   - Canva, CapCut, design-preference, OSWorld/state-eval and security research notes;
   - clean-room and licensing documents.
5. Validate that referenced files exist. Record missing references but continue with the best available source of truth.
6. Create an initial control-plane event using `launch/control-plane-event.schema.json` with `event_type: "started"`.

## Write ownership

You may write to:

```text
apps/studio/**
packages/studio-*/**
crates/studio-*/**
fixtures/studio/**
docs/adr/studio-*/**
coordination/studio-status.json
coordination/proposals/studio/**
ops/control-plane/outbox/studio/**
```

Before `platform-v0.1.0` is integrated, treat these as read-only:

```text
root workspace manifests
packages/contracts/**
packages/kernel/**
packages/policy/**
packages/adapters/**
packages/secret-broker/**
specs/**
apps/voice/**
crates/voice-*/**
```

Missing shared capabilities must be proposed through `coordination/proposals/studio/`; do not invent a competing generic operation envelope, job system, policy engine or MCP framework.

After the shared tag is available, integrate it into this branch in a dedicated commit. Preserve Studio work, resolve conflicts explicitly, run all touched tests, and emit an `integration` event.

## Product mission

Build one unified content super app. Do not create separate Canva-like and CapCut-like products joined only by flattened exports.

Shared canonical domain:

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
- rational time or explicit frame/timebase pairs;
- immutable source assets;
- explicit revisions and migrations;
- renderer-independent canonical schemas;
- no browser-canvas objects in persisted state;
- no raw FFmpeg shell strings in project state;
- safe argument arrays and validated render plans;
- no flattened-only AI output;
- no arbitrary agent-generated executable UI;
- every manual editor action emits canonical semantic operations;
- every agent operation remains visible, inspectable, reversible or explicitly compensatable.

## Golden vertical slice

Given one source video with audio, one product image/logo, one text brief and one style profile, produce:

1. a shared project and content-addressed asset graph;
2. a 9:16 editable scene with title, background and product layers;
3. an imported video clip on the shared timeline;
4. one split plus trim/ripple sequence;
5. an editable transcript/caption track from a fixture or provider adapter;
6. audio gain, mute and fade controls;
7. one transform/opacity keyframe animation with easing;
8. one blur/effect instance;
9. typed plan, preview and semantic diff;
10. deterministic quality checks;
11. a verified MP4 plus PNG cover artifact;
12. a direct operator edit followed by harness re-inspection and safe continuation;
13. SDK, HTTP/IPC, CLI and MCP parity for plan, apply, validate, render and job status after the platform baseline is integrated.

## Work phases inside this session

### S0 — Studio scaffold and contracts

Create Studio-owned packages and fixtures without editing the frozen shared contract. Define original scene/timeline/domain types, migrations, operation unions and property-test fixtures. Keep any temporary integration boundary narrow and removable.

### S1 — scene and timeline engines

Implement the minimum real engine needed by the golden slice:

- text/image/shape/group scene nodes;
- transforms, z-order, layout basics and safe areas;
- assets and immutable originals;
- tracks, clips, rational-time split/trim/ripple;
- captions;
- audio gain/mute/fade automation;
- transform/opacity keyframes and easing;
- one blur/effect instance;
- deterministic validators.

### S2 — rendering and artifact verification

Implement an original render plan and worker boundary:

- headless PNG cover rendering;
- FFmpeg-backed MP4 render through validated argument arrays;
- progress and cancellation hooks;
- incomplete render never becomes an artifact;
- output probe verifies codec/container/duration/dimensions/audio/caption expectations;
- preserve exact third-party licensing/build information.

### S3 — first-class operator editor

Implement a professional minimal editor shell, preferably Tauri with TypeScript UI clients:

- assets/layers/canvas/inspector;
- timeline, playhead, waveform placeholder or real waveform when available, caption lane;
- history/undo;
- agent/review panel;
- keyboard and accessibility baseline;
- direct edits emit canonical operations;
- chat is one control surface, not the whole product.

### S4 — style intelligence and trusted dynamic interfaces

Implement structured style dimensions and attributed evidence, not a single vague aesthetic prompt.

Support at least:

- style-profile application;
- several editable candidate variants;
- approved exemplars and pairwise selection records;
- universal technical validators separated from personal preference;
- operator override and profile-version rollback;
- correction/approval events;
- trusted schema-driven interfaces for candidate comparison, semantic preview, caption correction, quality violations and render approval;
- declarative allowlisted actions only—no injected JavaScript or arbitrary native components.

### S5 — shared-platform integration

Check for the tag without idling:

```bash
git tag --list platform-v0.1.0
git show platform-v0.1.0 --stat
```

When present:

1. ensure your Studio changes are committed;
2. integrate the tagged baseline using the safest Git operation for the current history;
3. replace temporary boundaries with the shared contracts/kernel/adapters;
4. run schema, state, adapter-parity and collateral-damage tests;
5. emit an `integration` event with exact commit and results;
6. submit incompatible needs as explicit proposals instead of silently forking the contract.

## Required tests

- scene graph invariant/property tests;
- matrix/transform round-trip;
- missing-font, text-overflow and safe-area fixtures;
- split/trim/ripple rational-time arithmetic;
- keyframe interpolation and easing fixtures;
- audio gain/mute/fade render probe;
- caption timing and safe-area checks;
- render cancellation and process cleanup;
- stale revision after an operator edit;
- idempotent render-job creation after platform integration;
- malicious media/import fixtures;
- secret and publish-token canaries;
- final-state parity across adapters after integration;
- editability assertion after AI-assisted creation;
- golden-workflow repeated-run `pass^k` report;
- collateral-damage assertions proving unrelated nodes/clips remain unchanged.

## Scope discipline

Use `products/studio/FEATURES-21.md` as the roadmap. Build the dependency-complete 80/20 vertical slice rather than empty buttons.

Do not add yet:

- real-time collaboration;
- arbitrary third-party native plugins;
- mobile/web parity;
- full 3D, professional compositing, DAW or colour-grading suites;
- dozens of generation providers;
- direct public publishing before exact approval/idempotency exists;
- copied competitor assets, source, private prompts, templates, names, wording, icons or distinctive screen arrangements.

## Coordination rules

- Work in small coherent commits.
- Never modify or rewrite Session A’s branch.
- Do not wait idly for the shared tag; continue inside owned paths.
- Emit structured events for `milestone`, `test_result`, `contract_proposal`, `blocker`, `artifact`, `integration`, and `handover`.
- Events must contain verified outcomes, commands, commits and contract impact—not guessed percentages.
- Never place credentials, private media, raw prompts, licensed source assets or secret values in Discord/outbox events.

## Final handover

Before ending, write a final event and report:

1. commits created;
2. Studio packages, operations and schemas added;
3. exact commands and results;
4. platform tag integration status;
5. render toolchain and licences;
6. measured render and UI performance;
7. golden workflow artifacts and verification;
8. adapter/state/collateral-damage results;
9. known fidelity limits and real blockers;
10. proposed contract changes requiring Session A review;
11. the smallest next integration step.
