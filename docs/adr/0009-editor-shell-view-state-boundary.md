# ADR 0009: Editor shell and view-state boundary

**Date:** 2026-07-16
**Status:** Accepted for Milestone 4

## Context

Toolshape Studio needs a professional editor that can grow from the current vertical slice to many design, video, review, automation, and agent surfaces. The current screen places assets, layers, agent review, inspector, quality, preview, and timeline in one fixed arrangement. Adding more permanent panels directly would reduce usable canvas space and blur the boundary between project truth and operator view preferences.

## Decision

Introduce a typed editor-shell view model with:

- workspace IDs: `create`, `edit`, `review`, `automate`;
- left panel IDs: `media`, `layers`, `text`, `audio`, `captions`;
- right panel IDs: `inspector`, `agent`, `quality`;
- independent visibility for left rail, right rail, and timeline;
- one active application menu at a time.

Workspace selection applies deterministic view defaults. Operators may then override panel visibility or active panel without changing project state.

All editor-shell state is ephemeral React/UI state. It is excluded from:

- `StudioProject` and project migrations;
- semantic operations and diffs;
- revision and idempotency calculations;
- SQLite project snapshots;
- shared SDK/CLI contracts;
- preview and production render plans.

The stable UI invokes existing semantic services for actual edits. Dynamic agent task views remain validated declarative components rendered inside trusted Studio surfaces; they cannot modify shell code or project state directly.

Use a maintained icon library for interface glyphs instead of handwritten SVG, CSS drawings, emoji, or text-symbol approximations.

## Consequences

### Positive

- More feature panels can be added through registries instead of more permanent columns.
- Human editing remains usable with agent context closed.
- Workspaces can optimize emphasis without creating separate project formats.
- UI preferences cannot pollute canonical hashes, history, adapters, or renders.
- Browser tests can verify deterministic shell arrangements independently of kernel tests.

### Trade-offs

- The first pass implements hide/show and workspace defaults, not drag docking or persisted custom layouts.
- Workspace switching is a view operation and therefore will not appear in semantic project history.
- Disabled native-file actions remain visible only when their unavailable state is explicit.

## Alternatives rejected

- **Store layout inside the project:** rejected because layout preference is not creative document truth and would create noisy revisions.
- **Create separate Create/Edit/Review applications:** rejected because Studio owns one project, scene, timeline, and operation model.
- **Let the agent generate arbitrary UI code:** rejected because dynamic surfaces must remain declarative, allowlisted, and application-controlled.
- **Add every feature as another fixed panel:** rejected because it does not scale visually or cognitively.
