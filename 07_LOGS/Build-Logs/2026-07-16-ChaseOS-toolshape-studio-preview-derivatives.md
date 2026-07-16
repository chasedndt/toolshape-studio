# Build log: Toolshape Studio preview derivatives

- **Date:** 2026-07-16
- **Runtime:** Codex
- **Session descriptor:** `2026-07-16_toolshape-studio-preview-derivatives`
- **Phase/pass:** Milestone 5 - media preview evidence and product-facing editor integration
- **Branch:** `work/studio`
- **Plan commit:** `05a14e3`
- **Implementation commit:** `2d2b21a`
- **Status:** COMPLETE / VERIFIED PREVIEW-DERIVATIVE SLICE

## Task summary

Continue the active Toolshape Studio goal by building real thumbnail and waveform derivatives and making them useful in the product-facing Media, Audio, and timeline experiences without weakening semantic operations, agent adapters, path privacy, persistence, or render foundations.

## Repo-truth baseline

- Milestones 1-4 were committed; the worktree began clean at `4eab4a6` on `work/studio`.
- MP4 ingestion already performed source-size/byte checks, FFprobe normalization, verified H.264/AAC proxy generation, content-addressed storage, SQLite reopen, and JSON CLI projection.
- The professional editor shell already exposed Media, Audio, and timeline surfaces through the same semantic project/kernel used by adapters.
- Thumbnail/waveform derivative kinds existed in the TypeScript model, but the worker did not generate them and the derivative probe field could not truthfully represent a PNG.
- The Media panel used CSS thumbnail art and the timeline used arithmetic bars unrelated to source evidence.
- Native content resolution, quarantine/resource budgets, tiled waveform zoom, and hostile codec sandboxing remained unbuilt.

## Files read

- Root and Studio instructions; README; agent-native, ChaseOS hierarchy, reference architecture, security, Studio PRD/UX/architecture/video/features/handover docs; relevant research notes/source rows; Milestone 4 plan/ADR/log; affected domain/media/persistence/UI/fixture/tests/QA; Product Design workflow and saved-context preflight.

## Files created

- Safe thumbnail/waveform plan and PNG inspection modules.
- Preview resolver plus digest/dimension conformance tests.
- Committed synthetic thumbnail/waveform fixture PNGs.
- Milestone 5 plan, ADR 0010, and media-systems learning note.
- This build log, documentation-history note, and Codex activity record.

## Files modified

- Canonical Studio model/migration/tests; media types/runner/ingestion/index/tests; persistence migration expectation.
- Golden fixture metadata/README; real media smoke; App, styles, browser QA, and app README.
- Root/product architecture/UX/video/status/implementation-plan truth.
- Daily note/index, Build-Logs index, Documentation-History index, and generated handover reports.

## What changed

- Advanced the internal Studio project document from schema v2 to v3 so PNG derivatives use truthful `probe: null`; v0-v2 migration preserves assets and normalizes derivative probe state.
- Added bounded absolute-path-validated FFmpeg argument plans for one thumbnail and one mono waveform PNG, always using `shell: false`.
- Added PNG signature/IHDR dimension checks, configured bounds, content-addressed import, source lineage, shared toolchain evidence, and work-file cleanup.
- MP4+audio ingestion now registers proxy, thumbnail, and waveform derivatives; silent video registers proxy+thumbnail and invents no waveform.
- Extended CLI media smoke to verify bytes, digests, dimensions, codecs, SQLite recovery, and absence of runtime paths in public metadata.
- Added real licence-safe fixture derivatives and verified their bytes/digests/dimensions against canonical records.
- Added a host preview resolver that maps approved content refs to browser URLs while keeping URLs out of project truth.
- Replaced CSS thumbnail simulation and arithmetic waveform bars with real raster evidence in Media, Audio, video timeline, and audio timeline states.
- Added visible derivative/readiness, sample-rate/channel, gain, and mute evidence while preserving honest type-icon fallback for assets without previews.

## TDD evidence

- The first root-relative focused command found no tests because Vitest filters were relative to `apps/studio`; the corrected command was used immediately.
- Corrected expected-red run: 2 suites, 10 tests collected; 7 failed and 3 passed because schema v3, derivative plans, and generation did not yet exist.
- Focused domain/media closure: 2 suites, 10/10 passed.
- Resolver plus domain/media closure: 3 suites, 12/12 passed.
- Fixture byte/digest/dimension conformance closure: 3/3 passed.

## Tests and commands run

| Command | Result |
|---|---|
| corrected expected-red focused Vitest command | EXPECTED TDD RED - 7 failed, 3 passed |
| focused domain/media Vitest closure | PASS - 10 tests |
| resolver/domain/media focused closure | PASS - 12 tests |
| `npx vitest run src/preview-assets.test.ts --config vite.config.ts` | PASS - 3 tests |
| `npm test` while a real FFmpeg media smoke ran concurrently | ENVIRONMENT STRESS FAILURE - 4 SQLite/media/render tests exceeded Vitest's 5-second per-test limit; 57 tests passed and no assertion regression appeared |
| `npm test` final | PASS - 14 test files, 61 tests |
| `npm run typecheck` | PASS - strict `tsc --noEmit` |
| `npm run build` | PASS - 1802 modules; 266.04 kB JS, 30.08 kB CSS, 27.75 kB emitted thumbnail |
| `npm run smoke:media-ingest` | PASS - real generated MP4, proxy/thumbnail/waveform, CLI, SQLite reopen, path-free metadata |
| `$env:STUDIO_URL='http://127.0.0.1:4178/'; npm run qa:browser` | PASS - real preview/UI/semantic interaction and screenshot run |
| `npm run smoke:runtime` | PASS - operation apply and SQLite digest recovery |
| `npm run smoke:cli` | PASS - separate-process init/invoke |
| `npm run test:render-cancel` | PASS - cancellation observed; final/partial absent; cleanup passed |
| `npm run smoke:render-job` | PASS - worker completed attempt 1 and verified immutable H.264/AAC artifact |
| `npm audit --audit-level=high` | PASS - 0 vulnerabilities |
| `python scripts/verify_handover.py` | PASS - 9 checks, 0 warnings, 263 files, 80889 approximate words |
| `git diff --check` | PASS - no whitespace errors; expected LF-to-CRLF notices only |

## Verification evidence

- Real FFmpeg 8.1.1 media smoke produced a 960x540 H.264/AAC proxy, 480x270 PNG thumbnail, and 1280x160 PNG waveform from a generated 1280x720 MP4 with mono 48 kHz audio.
- The smoke reopened the exact asset record from SQLite and reported `publicMetadataContainsLocalPath: false`.
- Committed preview fixture hashes: thumbnail `sha256:3347e5bac582026c1de26bd45e5b0722bc48a21a28e4642dc14f9712dc7c0116`; waveform `sha256:882cf6f7da00cf04c078efff9c651fff2e95deef0550d4fadd10b0b5ea794014`.
- Chrome returned HTTP 200 at 1440x1000, loaded one Media thumbnail, one timeline thumbnail, one timeline waveform, and one 1280-pixel Audio waveform, with no unresolved ready card or horizontal viewport overflow.
- Accepted screenshots: `apps/studio/artifacts/studio-preview-derivatives-media.png` and `apps/studio/artifacts/studio-preview-derivatives-audio.png` (generated/ignored).
- Existing workspace/menu/panel/edit/undo/redo/render QA still reached revision 6, two video clips, and `Canonical state valid`.
- Runtime smoke recovered digest `fnv1a64:3da50971e687ac7d`; separate CLI smoke completed at revision 1 with digest `fnv1a64:ad21168a4ccf09a3`.
- Render-job smoke registered a 204016-byte verified 1080x1920 H.264/AAC artifact with digest `sha256:de7095146423b6b02abb27cdbaad415e05d8446a9368459c54a3b58b401f46df`.

Browser readiness timings varied under local process load and are not treated as performance evidence.

The concurrent full-suite/real-FFmpeg stress run caused four 5-second test timeouts and cleanup lock follow-ons on the loaded Windows host. After the preview server and competing smoke were stopped, the unchanged full suite passed 61/61 in isolation and the real media smoke passed in isolation. This is classified as an environment/load failure, not a new regression; production-grade worker resource isolation remains an open loop.

## What did not change

- Operation-envelope/capability version remains `0.1.0`; schema v3 is the internal project-document version.
- UI and preview URLs do not own or enter canonical state, operation history, project digests, persistence, public adapter documents, or render plans.
- No arbitrary agent UI code, remote provider/egress, native file access, secret, credential, `.env`, private media, public action, or paid action was introduced.
- No competitor code, proprietary assets, templates, effects, copy, prompts, iconography, or distinctive layout was copied.
- Toolshape Voice, donor repositories/history/dependencies, unrelated files, and protected external state remained untouched.
- No push, merge, release, signing, distribution, or native installation occurred.

## Remaining unverified / open loops

- **PARTIAL:** the full-duration waveform is useful at overview scale but is not a multiresolution/tiled cache for deep zoom or long media.
- **PARTIAL:** PNG signature/IHDR verification is proportionate for trusted FFmpeg output; hostile decode sampling, memory/CPU limits, quarantine, malformed/polyglot corpus, and sandbox evidence remain unbuilt.
- **PARTIAL:** committed fixture resolution proves the browser adapter boundary; native authenticated IPC/blob URL resolution remains unbuilt.
- **NOT BUILT:** direct clip selection, draggable playhead/trim handles, timeline zoom, snapping, ripple gestures, and full keyboard shuttle/edit workflow.
- **UNVERIFIED:** screen readers, accessible media descriptions, 200% zoom/reflow, high contrast, large-project UI performance, GPU caches, native desktop, MCP, signing/updater, publishing, collaboration, and multi-worker leases.

## Next recommended pass

Add direct timeline clip selection, draggable playhead and trim handles, zoom-aware ruler/waveform behavior, and keyboard editing through typed semantic operations. Pair that product pass with importer quarantine/resource budgets and a hostile/truncated/polyglot media corpus; use operator-provided CapCut state screenshots to refine interaction density without copying the visual system.

## Links

- [Documentation-history note](../../99_ARCHIVE/Documentation-History/2026-07-16_toolshape-studio-preview-derivatives.md)
- [Daily note](../Daily/2026-07-16.md)
- [Agent activity](../Agent-Activity/2026-07-16-codex-toolshape-studio-preview-derivatives.md)
- [Milestone plan](../../docs/plans/TOOLSHAPE-STUDIO-PREVIEW-DERIVATIVES.md)
- [ADR 0010](../../docs/adr/0010-content-addressed-preview-derivatives.md)
- [Learning note](../../docs/learning/2026-07-16-preview-derivatives-media-systems.md)
