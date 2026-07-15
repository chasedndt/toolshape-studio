# ADR 0002: Project persistence and content-addressed assets

- **Status:** ACCEPTED
- **Date:** 2026-07-15

## Context

The editor needs durable revisions, replayable operations, idempotency, jobs, provenance, and immutable imported originals without tying the canonical model to a UI renderer.

## Decision

Use repository-owned SQLite with explicit numbered migrations. Store normalized project snapshots plus append-only operation, idempotency, job, artifact, and provenance records. Store imported bytes outside SQLite under a SHA-256 content address and keep filenames/MIME details as untrusted metadata. Transaction boundaries cover the snapshot, operation result, and provenance record together.

Use Node's built-in SQLite API for the initial TypeScript host. Hide it behind repository interfaces so a later Rust/Tauri host can preserve contracts and migration semantics.

## Consequences

- No external database is required.
- Browser code cannot directly own persistence; it calls the host service.
- Originals are deduplicated and immutable.
- SQLite runtime support is a checked host prerequisite.

