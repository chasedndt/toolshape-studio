# Build log: Toolshape Studio editor-shell UX

- **Date:** 2026-07-16
- **Runtime:** Codex
- **Session descriptor:** `2026-07-16_toolshape-studio-editor-shell-ux`
- **Phase/pass:** Milestone 4 - product-facing and agent-facing editor shell
- **Branch:** `work/studio`
- **Plan commit:** `547a985`
- **Implementation commit:** `8c3fd15`
- **Status:** COMPLETE / VERIFIED EDITOR-SHELL SLICE

## Task summary

Continue Toolshape Studio with UI/UX as a first-class build track while retaining feature and agent capability work. Replace the fixed monolithic editor arrangement with a scalable, accessible shell for multiple workspaces, source panels, context panels, dropdown menus, keyboard commands, panel visibility, agent supervision, and preview-first browser QA.

## Repo-truth baseline

- Milestones 1-3 were committed and the worktree began clean at `c4e510a` on `work/studio`.
- The React editor already performed real semantic operations, undo/redo, validation, render queueing, and scene/timeline preview.
- The screen used one fixed asset/layer rail, combined agent/inspector/quality rail, and always-visible timeline.
- Create, Edit video, Review, and Automate existed in UX documentation but not executable view state.
- Panels were documented as hideable/resizable/keyboard-addressable, but only the underlying fixed surface was verified.
- Several labels and controls were 6-9 px; menus, scalable panel navigation, and workspace keyboard behavior were absent.
- No CapCut reference images were supplied or copied during this pass. The existing original Toolshape editor was the visual source.

## Files read

- Root and Studio instructions, README, Studio PRD/UX/architecture/design/dynamic-interface/feature docs, implementation plan, latest build log, affected app source/state/styles/QA, package configuration, and saved Product Design context preflight.

## Files created

- `apps/studio/src/editor-shell.ts` typed ephemeral shell state and deterministic workspace defaults.
- `apps/studio/src/editor-shell.test.ts` focused view-state tests.
- Milestone 4 plan, ADR 0009, and HCI learning note.
- This build log, documentation-history note, and Codex agent-activity record.

## Files modified

- Editor UI/component structure, visual system, and browser QA.
- App/package lock and third-party licence record for Lucide React 1.24.0 (ISC).
- Root/app/product status, Studio UX, implementation plan, daily note/indexes, and generated handover reports.

## What changed

- Added deterministic Create, Edit, Review, and Automate arrangements over one unchanged project revision.
- Added real Media, Layers, Text, Audio, and Captions source panels with filtering and project-backed content.
- Split Inspector, Agent, and Quality into independent context tabs.
- Added functional File/Edit/View menus, checked visibility commands, honest disabled native project-open action, outside/Escape close behavior, and workspace shortcuts.
- Added independent source/context/timeline visibility and quick restoration controls.
- Preserved semantic text/transform/style/timeline/audio/undo/redo/render commands through the existing kernel.
- Expanded agent context with execution/cost/risk, semantic diff, bounded plan, and selected-object evidence.
- Replaced text-symbol controls with Lucide icons, increased core control sizes and type, preserved focus styles, and added reduced-motion behavior.
- Removed a nonessential backdrop filter after it caused incomplete closed-state paints in headless Chromium.
- Kept all shell state out of canonical project, persistence, hashing, operations, shared contracts, and renders.

## TDD evidence

- First focused run failed one suite before collection because `./editor-shell` did not exist.
- The implemented shell state then passed 4/4 focused tests for edit defaults, workspace defaults, independent region toggles, menu closure, and panel-driven rail reopening.

## Tests and commands run

| Command | Result |
|---|---|
| `npx vitest run src/editor-shell.test.ts --config vite.config.ts` before implementation | EXPECTED TDD RED - missing `./editor-shell`, one failed suite |
| focused editor-shell test after implementation | PASS - 4 tests |
| `npm test` | PASS - 13 test files, 55 tests |
| `npm run typecheck` | PASS - strict `tsc --noEmit` |
| `npm run build` | PASS - 1801 modules, 260.08 kB JS and 28.18 kB CSS |
| `$env:STUDIO_URL='http://127.0.0.1:4178/'; npm run qa:browser` | PASS - final Chrome interaction and visual run |
| `npm audit --audit-level=high` | PASS - 0 vulnerabilities |
| `npm run smoke:runtime` | PASS - operation apply and SQLite reopen digest recovery |
| `npm run smoke:cli` | PASS - separate-process init/invoke |
| `npm run test:render-cancel` | PASS - cancellation observed; no final/partial output; cleanup passed |
| `npm run smoke:render-job` | ARTIFACT VERIFIED / OUTER TIMEOUT - worker completed attempt 1 and verified the artifact, but the command exceeded the 300-second tool wall timeout before a clean exit on the loaded host |
| `python scripts/verify_handover.py` | PASS - 9 checks, 0 warnings, 251 files, 76227 approximate words |
| `git diff --check` | PASS - no whitespace errors; expected LF-to-CRLF working-copy notices only |

## Visual and interaction evidence

- Chrome returned HTTP 200 at 1440x1000.
- Browser QA verified all four workspace arrangements and proved workspace switching left revision at r0.
- View menu opened, Escape closed it, the timeline hid and restored, Text and Inspector tabs activated, and the final Review layout exposed Layers plus Agent context.
- Existing split, ripple trim, transform, agent style, undo, redo, quality, and render queue interactions reached revision 6 with two video clips and `Canonical state valid`.
- Final shell evidence: Review workspace, Layers source, Agent context, timeline visible, 12 tab controls, no horizontal viewport overflow.
- Accepted screenshots: `apps/studio/artifacts/studio-editor-shell-post-edit.png` and `apps/studio/artifacts/studio-editor-shell-view-menu.png` (generated/ignored).
- The verified 540x960 cover was 109104 bytes with SHA-256 `27d535b3e90a84ca744f81d282db7e45826a183dbd42bf70b2db82efb9a83844`.
- Runtime smoke recovered digest `fnv1a64:d41f28d8a7c07dd5`; CLI smoke completed at revision 1 with digest `fnv1a64:f22980fe84aecb09`.
- The render-job rerun produced a verified 204016-byte H.264/AAC artifact with digest `sha256:de7095146423b6b02abb27cdbaad415e05d8446a9368459c54a3b58b401f46df` before the outer timeout.

The recorded readiness timings varied materially while the host was under concurrent process load and are not treated as performance evidence.

## What did not change

- Canonical domain/schema, persistence semantics, public contracts, media ingestion, render plans, and agent authorization boundaries were not weakened or duplicated.
- No arbitrary agent HTML/code, remote provider, egress path, native file dialog, or UI-authored canonical state was introduced.
- No competitor code, proprietary assets, iconography, templates, wording, or distinctive layout was copied.
- Toolshape Voice, archives, donor repositories, secrets, private media, and unrelated files remained untouched.
- No push, merge, release, native install, signing, or distribution occurred.

## Remaining unverified / open loops

- **PARTIAL:** panels hide/show and switch deterministically; drag docking, resizing, saved personal layouts, multi-monitor behavior, and zoom/reflow are not built.
- **PARTIAL:** keyboard and ARIA semantics have browser assertions; screen readers, 200% zoom, high contrast, target-size measurement, and full WCAG auditing remain unverified.
- **PARTIAL:** agent plan/context is a trusted native surface; dynamic `TaskView` schema/rendering and real harness transport remain planned.
- **UNVERIFIED:** large-project UI performance, GPU paths, cross-platform font/render behavior, and native desktop behavior.
- **ENVIRONMENT:** one real render-job rerun verified its worker/artifact but crossed the outer command timeout on the heavily loaded host.
- **NOT BUILT:** waveform/thumbnail derivatives, quarantine/resource budgets, Tauri/authenticated IPC/MCP, signing/updater, publishing, collaboration, and broad feature depth.

## Next recommended pass

Add real thumbnail and waveform derivatives through the existing media worker and render them in the Media, Audio, and timeline panels. Use operator-provided CapCut screenshots to inventory default, import, effects, captions, audio, inspector, export, settings, context-menu, dropdown, and timeline states before the next high-fidelity UX refinement.

## Links

- [Documentation-history note](../../99_ARCHIVE/Documentation-History/2026-07-16_toolshape-studio-editor-shell-ux.md)
- [Daily note](../Daily/2026-07-16.md)
- [Agent activity](../Agent-Activity/2026-07-16-codex-toolshape-studio-editor-shell-ux.md)
- [Milestone plan](../../docs/plans/TOOLSHAPE-STUDIO-EDITOR-SHELL-UX.md)
- [ADR 0009](../../docs/adr/0009-editor-shell-view-state-boundary.md)
- [Learning note](../../docs/learning/2026-07-16-editor-shell-hci.md)
