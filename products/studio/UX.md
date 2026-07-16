# Toolshape Studio UX

## Experience model

Studio combines a stable professional editor with an agent workbench.

### Stable editor

- top command bar and workspace switcher;
- left project/assets/layers panel;
- centre canvas/preview;
- right property/effect/style inspector;
- bottom timeline when temporal content is active;
- optional agent/review panel;
- status bar with revision, render, provider, privacy, and quality state.

Panels are dockable, resizable, keyboard-addressable, and hideable. The product must remain useful with the agent panel closed.

## Workspaces

### Create

Canvas-first layout for static and multi-page design.

### Edit video

Preview plus multi-track timeline, waveform, captions, and media inspector.

### Review

Plan, semantic diff, variants, comments, quality findings, approvals, and provenance.

### Automate

Workflow recipe, data binding, batch variants, jobs, and harness activity.

These are workspace arrangements over one project, not separate applications or formats.

## Agent panel

The agent panel contains:

- task goal and active constraints;
- selected objects/context;
- current plan;
- affected object count;
- local/remote providers and cost;
- previews/variant comparisons;
- approvals;
- progress/jobs;
- verification report;
- “continue from my edits” action after human changes.

Natural-language chat is one input mode. Structured fields, selections, references, style profiles, and target presets reduce ambiguity.

## Human master-touch loop

1. Agent produces structured editable result.
2. Studio enters review mode with before/after comparison.
3. Operator accepts/rejects operations or variants.
4. Operator directly edits canvas/timeline/inspector.
5. Revision advances and agent plan becomes stale.
6. Harness re-inspects changed objects before continuing.
7. Accepted changes can become bounded style/workflow evidence.

## Canvas interaction

- select, multi-select, group, lock, hide;
- move/resize/rotate with numeric inspector;
- snapping, guides, margins, grids, safe areas;
- align/distribute;
- layers and z-order;
- direct text editing;
- crop/mask handles;
- component overrides;
- responsive variant comparison;
- zoom/pan/minimap;
- keyboard nudge and modifier keys;
- accessible object tree.

## Timeline interaction

- tracks with visibility/lock/mute/solo;
- playhead, time ruler, markers, snapping;
- clip drag, trim handles, split, ripple/delete;
- waveform and transcript/caption lanes;
- keyframe diamonds and graph/easing editor;
- effect stacks;
- proxy/render status;
- frame-accurate numeric editing;
- keyboard shuttle and edit commands;
- linked/unlinked audio and video.

## Inspector

Inspector fields are backed by the same schemas agents use. It shows:

- mixed values for multi-selection;
- constraints and source of value: direct, token, component, style, expression, keyframe;
- validation errors;
- reset/inherit;
- animate property;
- operation history for the field;
- agent explanation/evidence when generated.

## Variant review

Use a comparison grid with:

- consistent scale;
- target platform/safe-area overlay;
- style and hard-rule findings;
- content differences;
- render cost/latency;
- select/rank/merge;
- “what I prefer” rationale;
- open selected variant in full editor.

## Dynamic task-specific surfaces

See `DYNAMIC-INTERFACES.md`. They supplement rather than replace the stable editor.

## Onboarding

1. choose local-only or hybrid mode;
2. import or create style/brand profile;
3. select first workflow: social design, thumbnail, talking-head short, product ad, lesson clip;
4. show agent plan and semantic editor relationship;
5. complete a small result with direct manual edit;
6. demonstrate history, raw sources, and privacy;
7. optionally connect ChaseOS/harness.

## Operator teaching

Studio explains improvements in context:

- why a safe-area rule failed;
- why text overflow occurred;
- why one layout ranked higher for the user’s profile;
- how keyframe easing changes motion;
- how audio fade/ducking affects speech clarity;
- how to turn repeated manual edits into a reusable rule;
- which harness capability performed each operation.

## Implementation checkpoint - 2026-07-16

Milestone 4 implements the first stable editor-shell contract in the browser seed:

- Create, Edit, Review, and Automate arrangements over one unchanged project revision;
- a five-panel source registry for real Media, Layers, Text, Audio, and Captions data;
- independent Inspector, Agent, and Quality context tabs;
- functional File/Edit/View menus, panel visibility, keyboard undo/redo, Escape handling, and Alt workspace shortcuts;
- a bounded agent plan/context surface that remains optional and does not replace direct editing;
- browser assertions for revision invariance, tab/menu state, timeline hide/restore, semantic editing, undo/redo, render queueing, and viewport overflow.

The shell is hideable and keyboard-addressable but not yet drag-dockable, resizable, layout-persistent, screen-reader audited, or proven under zoom/reflow. Those remain partial rather than implied complete.
