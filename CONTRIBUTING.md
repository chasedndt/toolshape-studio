# Contributing

## Attribution

**Commits are authored by the human or named runtime doing the work.** Do not add AI tools as authors, co-authors, or `Co-Authored-By` trailers. This applies to every commit, including those produced with heavy assistance.

## The rules that are not negotiable

Before changing anything, read [`AGENTS.md`](AGENTS.md). The short version:

1. **UI, MCP, CLI, SDK and HTTP are adapters over the same application services.** No React component, MCP handler or CLI parser owns domain logic.
2. **Persist canonical domain objects**, never renderer widgets, FFmpeg command strings, browser blob URLs, or UI coordinates.
3. **All mutating operations use the operation envelope** — expected revisions, idempotency keys, structured results, provenance.
4. **Long-running work creates a durable job** with progress, cancellation, retries and result artifacts.
5. **Model output is a proposal** until deterministic validation and policy allow execution. Model output never grants authority.
6. **View state never enters canonical state.** Selection, playhead, zoom, scroll, drag previews and panel visibility must not advance the project revision (ADR 0009, ADR 0011).

A change that gives one adapter a capability another cannot reach is a bug, however convenient.

## Clean-room

Never copy competitor code, assets, templates, prompts, wording, iconography or distinctive layout — **regardless of licence**. Our policy is stricter than the licences we could otherwise rely on. Researching what outcomes a category delivers is fine and is recorded in [`docs/product/PILLAR-FEATURE-MATRIX.md`](docs/product/PILLAR-FEATURE-MATRIX.md); reproducing an implementation is not.

If third-party code is ever vendored deliberately, preserve its licence, notices and attribution exactly.

## Milestone cadence

Substantial work follows the established cycle:

```text
plan doc  → docs/plans/TOOLSHAPE-STUDIO-<MILESTONE>.md
TDD red   → write failing tests first
implement
gates     → typecheck · tests · build · browser QA · smokes
ADR       → docs/adr/NNNN-<decision>.md for architectural decisions
learning  → docs/learning/<date>-<topic>.md
```

## Quality gates

Run before handing back. Report exact commands and results.

```bash
npm run typecheck
npm test
npm run build
npm run smoke:mcp
npm run smoke:runtime
npm run smoke:cli
npm run smoke:render-job
npm run smoke:media-ingest
npm run qa:browser          # needs STUDIO_URL
npm run render:golden
npm run test:render-cancel
```

**Do not claim a test ran unless it did.** If something is blocked, say so and say why — a partial result reported honestly is worth more than a green summary that is not true.

## Tests

- New capabilities need state-based tests, not just unit tests of helpers.
- Security boundaries need adversarial tests: a wrong token, a missing grant, a stale revision, a hostile filename, a signature mismatch.
- Adapter parity: a new capability must be proven equivalent across the surfaces that expose it.
- Screenshots in documentation are regenerated, never hand-placed:

```bash
npm run build && npm run docs:screenshots
```

## Commit messages

Conventional prefix, imperative subject, and a body that explains **why** — the diff already shows what.

```text
feat(mcp): add agent network transport over MCP

Closes the gap that made the agent-native claim false for harnesses
running as server processes...
```

Prefixes in use: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

## Dependencies

This repository stays close to Node built-ins on purpose — `node:sqlite` rather than a native driver, a hand-rolled JSON-RPC layer rather than an SDK. Adding a dependency is a real decision: justify it in the PR, and prefer the standard library where the surface you need is small and stable.

## Security

Do not open a public issue for a vulnerability. See [`SECURITY.md`](SECURITY.md).
