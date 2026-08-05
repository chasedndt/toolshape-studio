# ADR 0014 — Canonical project state in public operation results

**Date:** 2026-08-05
**Status:** ACCEPTED
**Extends:** ADR 0008 (media ingest and public contract boundary)
**Prompted by:** Milestone 8 (connected shell)

## Context

Wiring the editor to the real kernel over the MCP transport surfaced a gap that had gone unnoticed because nothing external had yet needed to read a project.

`projectOperationResult` in `packages/studio-sdk/src/projection.ts` mapped the kernel's internal result onto the public contract and **dropped `state.project` entirely**. `specs/operation-result.schema.json` reinforced this with `additionalProperties: false` on `state`, whose only members were `revision_before`, `revision_after` and `semantic_diff`.

The consequence: **`studio.project.inspect` returned a revision number and no project.**

- An agent could not read the project it was about to edit. It could learn *that* the project was at revision 7, and nothing about what was in it.
- The editor could not render a project it fetched over the transport.
- `docs/agent-integration/CAPABILITY-CATALOG.md` described inspect as "Returns canonical project state and current revision", which was false for every caller outside the process.

This had not caused a visible failure because the only in-repo consumers were tests asserting schema validity and the UI, which held its own in-memory kernel and therefore never fetched anything.

The exclusion was not accidental. `packages/studio-sdk/tests/conformance.test.ts` asserts `expect(cli.state).not.toHaveProperty("project")` alongside assertions that no digest and no filesystem path appear. That test exercises a **render** envelope, where excluding project state is correct: a render returns a durable job, and attaching a full project to it would be noise.

The real defect was that the boundary was drawn per-schema rather than per-capability.

## Decision

**Add `project` to the public result `state`, populated for the capabilities whose caller is asking about project state, and omitted for the rest.**

Returns the project:

```text
studio.project.inspect            reading state is the entire purpose
studio.project.validate           the caller needs to see what is invalid
studio.project.apply_operations   otherwise every mutation forces a re-inspect
studio.operation.undo             same
```

Does not return the project:

```text
studio.project.plan     a preview over an unchanged project; the diff is the payload
studio.project.render   returns a durable job
studio.job.get          returns a job
studio.job.cancel       returns a job
```

The field is **optional and omitted rather than null-filled**, so its absence remains meaningful rather than ambiguous.

### Why this does not weaken ADR 0008

ADR 0008 established that *kernel-internal* objects must never cross into adapter-facing documents, naming internal snapshots, worker ownership fields, and filesystem paths.

`StudioProject` is none of those. It is the **canonical domain object** — the thing that is persisted, migrated, versioned, and validated, and the thing every operation is defined against. It carries no filesystem paths (ADR 0010 moved preview derivatives to `content://` references precisely so that it would not). Exposing it is what makes the contract usable; withholding it made a read capability unable to read.

The boundary ADR 0008 drew still holds: internal snapshots, `contentPath`, worker ownership and digests remain excluded, and the conformance suite still asserts it.

### Schema versioning

The change is **additive and optional**: an existing consumer that ignores unknown members is unaffected, and every previously valid document remains valid.

`STUDIO_SCHEMA_VERSION` is **not** bumped. The kernel compares capability versions for exact equality (`packages/studio-kernel/src/contracts.ts`), so a bump would invalidate every existing envelope, test fixture and transport call for a purely additive change. `AGENTS.md` requires that schema changes not happen *silently*; this ADR, the schema description, and the new tests are that non-silence.

This decision should be revisited the first time a change is genuinely breaking, at which point a real version negotiation mechanism is needed rather than an equality check.

## Consequences

**Positive.**
- `studio.project.inspect` becomes useful to external callers, which is a precondition for both the connected shell and any real agent workflow.
- The editor can render a project fetched over the transport, unblocking Milestone 8.
- Mutations return resulting state, so a caller does not need a second round trip after every edit.
- The capability catalog's description of inspect becomes true.

**Negative / accepted.**
- Read and mutation results grow by the size of the project. Acceptable at current scale; if projects grow large enough for this to matter, the answer is a partial-read or projection parameter, not re-hiding the state.
- The per-capability rule lives in one set in `projection.ts`. A new capability that should return project state must be added there deliberately — which is the intent, since the default of *not* returning it is the safer one.

**Neutral.**
- The conformance suite continues to assert that render results carry no project, no digest and no paths, so the boundary that was correct stays enforced.

## Alternatives rejected

**Leave the contract as it was.** Would have meant the editor keeping its own in-memory kernel indefinitely and agents being unable to read project state at all. The product claim depends on both.

**Return the project on every capability.** Simpler rule, but attaches a full project to render and job queries that did not ask for it, and would have broken a conformance assertion that was correct.

**Add a separate `studio.project.read` capability returning a different document.** Duplicates inspect for no benefit and leaves inspect misleadingly named.

**Return a URL or reference the caller dereferences separately.** Adds a round trip and a second endpoint to secure, to avoid a payload that is currently a few kilobytes.
