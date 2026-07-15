# ADR 0008: Probed media ingestion and public contract projection

- **Status:** ACCEPTED
- **Date:** 2026-07-16

## Context

The first two milestones prove content addressing, project persistence, deterministic editing, verified rendering, and durable render jobs. Import still trusts declared media metadata, and the SDK/CLI currently expose rich kernel objects that do not directly match the shared Draft 2020-12 schemas.

## Decision

Use a dedicated local media worker to sniff bytes, store the immutable original, probe that stored blob, build a typed proxy plan, execute FFmpeg without a shell, verify the proxy with a second probe, and only then register the proxy as an immutable derivative.

Migrate the Studio project model to schema v2 so assets can carry normalized probe evidence and derivative references. Existing v1 projects migrate forward with explicit empty media-evidence fields.

Treat shared operation/result/job/artifact schemas as the public adapter contract. The kernel may retain richer internal objects, but SDK/CLI adapters validate public input and project internal results into schema-valid documents. Internal project snapshots, worker ownership fields, and filesystem paths do not cross that boundary.

## Consequences

- Declared metadata becomes a checked hint rather than authority.
- Proxy generation becomes reproducible and evidence-backed.
- Existing project fixtures require a documented v2 migration.
- SDK/CLI consumers receive stable portable documents rather than implementation-specific objects.
- UI code may continue using the in-process kernel and repository projection; it does not become the public transport contract.
- Codec sandboxing, multi-process isolation hardening, MCP, authenticated native IPC, and remote media providers remain later work.
