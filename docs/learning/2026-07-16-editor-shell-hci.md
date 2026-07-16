# Learning note: editor shells, view state, and supervisory HCI

**Date:** 2026-07-16
**Milestone:** Toolshape Studio editor-shell UX

## The core distinction

A creative document and the editor arrangement used to view it are different kinds of state.

The document needs deterministic revisions, persistence, replay, adapter parity, rendering, and provenance. The editor arrangement needs speed, flexibility, focus, accessibility, and safe defaults. Persisting workspace tabs, open menus, or hidden panels in the canonical project would create noisy revisions and make agent/headless results depend on one operator's screen preference.

Toolshape therefore models Create, Edit, Review, and Automate as ephemeral arrangements over the same project revision. Panel choices can change rapidly without changing the creative work.

## Stable shell versus dynamic task surfaces

Professional creative work benefits from a stable spatial model:

- sources and layers on the left;
- direct manipulation in the centre;
- selected-object or supervisory context on the right;
- temporal structure at the bottom.

Agent task views should enter this model as trusted context, not replace it. A bounded Agent tab can show intent, cost, risk, semantic diff, plan steps, selected context, and approval. The operator can close that tab and continue editing normally.

This creates a supervisory-control loop:

1. inspect current state;
2. understand the proposed action and affected context;
3. approve or apply a typed operation;
4. observe the semantic and visual result;
5. undo, refine, or continue.

## Scaling to many feature panels

A fixed column for every future feature does not scale. A panel registry lets Media, Layers, Text, Audio, Captions, Effects, Transitions, History, Tasks, and Providers share stable navigation and focus behavior. The active view renders real project information while hidden views consume no permanent canvas width.

Workspace defaults reduce setup cost, while per-panel overrides preserve operator control. Defaults should be deterministic and reversible:

- Create hides the timeline initially;
- Edit shows media, inspector, and timeline;
- Review emphasizes layers, agent evidence, and timeline;
- Automate emphasizes media and agent tasks without assuming temporal work.

## Accessibility and visual QA lessons

- Dense interfaces still need readable labels and sufficiently large control targets.
- Icon-only controls require accessible names and visible focus.
- Tabs, menus, checked menu actions, disabled commands, and status notices need explicit semantics.
- Escape should close transient menus without mutating document state.
- Keyboard undo must not steal native undo while the operator is typing in an input.
- Screenshot evidence should cover transient states such as an open menu, not only the default screen.
- A CSS backdrop filter caused incomplete closed-state paints in headless Chromium. Removing that nonessential compositing layer made visual evidence stable and reduced rendering complexity.

## What remains

Hide/show is not full docking. A later pass needs drag-resize constraints, saved personal layouts outside the project, zoom/reflow verification, assistive-technology testing, target-size measurement, and large-project performance evidence. CapCut reference screenshots can help enumerate important states and density trade-offs, but Toolshape should preserve an original visual language and its explicit agent-supervision model.
