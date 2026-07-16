# Toolshape Studio editor-shell UX milestone

**Date:** 2026-07-16
**Runtime:** Codex
**Session:** `2026-07-16_toolshape-studio-editor-shell-ux`
**Status:** COMPLETE / VERIFIED EDITOR-SHELL SLICE

## Outcome

Turn the verified editor seed into a scalable professional workspace shell without weakening its semantic editing, persistence, media, adapter, or render foundations. The pass establishes functional workspace switching, menus, panel navigation, context separation, keyboard behavior, and visual QA that later CapCut-informed references can refine rather than replace.

This is an original Toolshape interaction system. Public competitor screenshots may be used later to study workflow density and state coverage, but Studio will not copy proprietary code, assets, wording, iconography, or a distinctive screen arrangement.

## Repo-truth baseline

- The current React editor is real and invokes the same semantic kernel used by adapters.
- Asset selection, node selection, text edits, transforms, blur, timeline split/trim/audio mute, undo/redo, render queueing, validation, and preview are functional.
- The screen has a coherent dark visual language and a strong central preview/timeline hierarchy.
- The layout is currently fixed to one arrangement with a combined asset/layer rail, combined agent/inspector/quality rail, and always-visible timeline.
- Documented Create, Edit, Review, and Automate workspaces are not implemented.
- Documented hideable, resizable, keyboard-addressable panels are mostly planned.
- Several labels and controls render at 6-9 px, creating a legibility and target-size risk.
- There is no scalable menu or panel registry for future media, captions, effects, history, tasks, providers, and agent review surfaces.

## Product and agent experience contract

### Stable shell

The stable shell owns:

- application menu and project/revision identity;
- workspace selection;
- undo/redo and render entry points;
- left tool rail and active source panel;
- centre preview/canvas;
- right context panel;
- bottom temporal panel;
- job, quality, privacy, and local/runtime state.

The editor remains fully useful with the agent context closed.

### Workspace arrangements

Workspaces are ephemeral view arrangements over the same project revision:

- **Create:** canvas-first, design/layer sources, inspector context, timeline initially hidden.
- **Edit:** media-first, inspector context, timeline visible.
- **Review:** layer/source context, agent review context, timeline visible.
- **Automate:** media/source context, agent task context, timeline initially hidden.

Switching workspace must not mutate canonical project state or advance revision.

### Left source panels

The first registry exposes functional views backed by current project data:

- Media;
- Layers;
- Text;
- Audio;
- Captions.

Future panels such as templates, elements, effects, transitions, transcript, and brand will extend the registry instead of adding unrelated permanent columns.

### Right context panels

The right rail separates:

- Inspector;
- Agent review;
- Quality.

This prevents the agent from consuming the professional editing surface while keeping plan, semantic diff, approvals, and evidence one click away.

### Menus and commands

- **File:** render/export entry and honest disabled native-file commands where the web seed cannot fulfil them.
- **Edit:** undo and redo.
- **View:** workspace selection plus left/right/timeline visibility toggles.
- Menus close on selection, outside click, or Escape.
- Interactive commands use visible labels, accessible names, and icon-library glyphs.

### Keyboard and accessibility

- `Ctrl/Cmd+Z` invokes undo; `Ctrl/Cmd+Shift+Z` invokes redo.
- `Escape` closes the active menu.
- Tabs use tab/list semantics and selected state.
- Menu items communicate disabled/checked state.
- Focus indicators remain visible.
- Core controls target at least 30 px and important text is raised from the current micro-label scale.
- The pass records screenshot-visible accessibility risks but does not claim WCAG conformance without assistive-technology and zoom/reflow testing.

## State boundary

Workspace, open menu, active panels, panel visibility, and timeline collapse are ephemeral editor view state. They never enter `StudioProject`, operation envelopes, semantic diffs, persistence snapshots, project hashes, or render plans. See ADR 0009.

## TDD and verification order

1. Capture and inspect the current 1440x1000 editor state.
2. Add pure editor-shell state tests for workspace defaults, panel validation, visibility toggles, and menu closing.
3. Run the focused tests red before implementation.
4. Implement the view-state module and accessible shell components.
5. Extend browser QA to exercise workspace switching, source/context tabs, View menu toggles, Escape handling, semantic edits, undo/redo, render queueing, and final layout state.
6. Inspect the post-change screenshot at the same viewport and compare it with the baseline for hierarchy, clipping, density, spacing, and legibility.
7. Run full tests, strict typecheck, production build, runtime/media/render smokes where relevant, dependency audit, and handover validation.

## Acceptance criteria

- Create, Edit, Review, and Automate workspace controls are functional and do not change project revision.
- Media, Layers, Text, Audio, and Captions source panels render real project information.
- Inspector, Agent, and Quality context panels are independently selectable.
- Left rail, right rail, and timeline can be hidden and restored through the View menu.
- Escape closes menus; keyboard undo/redo retain existing semantic behavior.
- Existing canvas selection, semantic edits, timeline actions, validation, undo/redo, render queueing, and export view remain green.
- The final 1440x1000 screenshot has no clipped primary controls, accidental overlays, broken spacing, or unreadable core labels.
- No canonical data model, shared schema, or agent trust boundary is weakened for UI convenience.

## Explicit non-goals

- Pixel-copying CapCut, Canva, or another product.
- Tauri/native file dialogs before Rust/MSVC and authenticated IPC exist.
- Arbitrary agent-authored HTML or executable UI.
- Full docking, drag-resize persistence, mobile layout, collaboration, or complete feature parity.
- Claiming every visible future command is implemented; unavailable commands remain disabled and labelled honestly.

## Follow-on visual-reference pass

Operator-provided CapCut screenshots should cover the editing states that matter rather than only one beauty shot: default editor, media import, effects/transitions, text/captions, audio, speed, adjustment inspector, export, settings, context menus, dropdown menus, timeline zoom, and narrow/wide panel states. Those references will be used to compare information architecture and interaction coverage while preserving Toolshape's original visual language and agent-facing surfaces.

## Verification closure

- Expected-red shell test failed because `editor-shell.ts` did not exist; focused closure passed 4/4 state tests.
- Full Vitest closure passed 55 tests across 13 files.
- Strict TypeScript and the production Vite build passed.
- Chrome QA verified all four workspaces, revision invariance, View-menu open/Escape close, timeline hide/restore, source/context tabs, semantic edit/undo/redo/render behavior, 12 tab controls, and no horizontal viewport overflow.
- Accepted screenshots cover the closed Review workspace and open View-menu state at 1440x1000.
- Runtime and separate-process CLI recovery smokes passed; render cancellation cleanup passed.
- The real render-job rerun completed and verified an H.264/AAC artifact, but the outer command exceeded the 300-second wall timeout before returning a clean process exit on the loaded host. Full durable-render tests remained green; this timeout is recorded rather than hidden.
