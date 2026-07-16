# Documentation history: Toolshape Studio editor-shell UX

- **Date:** 2026-07-16
- **Runtime:** Codex
- **Pass type:** implementation, product design, accessibility foundation, verification, and operating writeback
- **Status:** COMPLETE / VERIFIED EDITOR-SHELL SLICE

## Historical change

This pass changed Toolshape Studio from a capable but fixed editor screen into the first scalable professional shell shared by human editing and agent supervision. Create, Edit, Review, and Automate now exist as executable view arrangements over one canonical project rather than documentation-only workspace names.

The pass established a durable boundary: source/context/timeline visibility, panel selection, menus, and workspace arrangement are ephemeral UI state and cannot alter project revision, semantic history, persistence, adapter documents, hashes, or renders. Human controls continue to call the same semantic kernel, while the agent occupies a bounded optional context rather than owning the workspace.

## Surfaces affected

- React editor shell, panel registries, menus, workspace controls, agent context, timeline chrome, and visual tokens.
- Browser interaction/visual QA and pure view-state tests.
- Dependency/licence record for Lucide React.
- Studio UX, app/product status, implementation roadmap, Milestone 4 plan, ADR 0009, and HCI learning note.
- Build, daily, activity, history, index, and validation records.

## Truth status

- **VERIFIED:** workspace revision invariance; source/context tabs; View menu and Escape; timeline hide/restore; semantic edits; undo/redo; render queueing; closed/menu screenshots; full tests/typecheck/build/audit.
- **PARTIAL:** accessibility semantics and keyboard coverage exist, but assistive-technology, zoom/reflow, contrast modes, and target measurement remain unverified.
- **PARTIAL:** panels are hideable and registry-driven, not yet drag-dockable/resizable/persisted.
- **DEFERRED:** CapCut-reference fidelity pass until operator screenshots are supplied.
- **ENVIRONMENT:** real render artifact verified, but its rerun exceeded the outer command timeout before clean exit.

## Links

- [Build log](../../07_LOGS/Build-Logs/2026-07-16-ChaseOS-toolshape-studio-editor-shell-ux.md)
- [Daily note](../../07_LOGS/Daily/2026-07-16.md)
- [Agent activity](../../07_LOGS/Agent-Activity/2026-07-16-codex-toolshape-studio-editor-shell-ux.md)
- [Milestone plan](../../docs/plans/TOOLSHAPE-STUDIO-EDITOR-SHELL-UX.md)
- [Studio UX](../../products/studio/UX.md)
