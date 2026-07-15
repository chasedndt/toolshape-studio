# ADR 0007: Durable render job lifecycle

- **Status:** ACCEPTED
- **Date:** 2026-07-15

## Context

The first milestone executes FFmpeg directly from a script. That proves rendering but not durable capability semantics: a CLI/MCP invocation must return quickly, survive process boundaries, expose progress/cancellation, and register output only after verification.

## Decision

Persist render intent and job state in SQLite before returning `accepted_job`. Public render input names a project asset and render preset plus a safe logical output filename; it never supplies FFmpeg arguments. A separate worker atomically claims one job, resolves the asset from configured content-addressed storage, compiles the typed FFmpeg plan, persists progress/events, polls durable cancellation, verifies output, and only then inserts immutable artifact metadata.

Allowed job transitions are explicit:

```text
created -> queued -> running -> completed
                     |-> cancel_requested -> cancelled
                     `-> retry_scheduled -> running | failed
queued -> cancelled
```

Interrupted `running` work is recovered to `retry_scheduled` when attempts remain, otherwise `failed`. `cancel_requested` recovers to `cancelled`.

## Consequences

- Adapter calls do not stay open for FFmpeg duration.
- SQLite is the coordination point for the initial single-machine worker model.
- The browser can queue/review jobs through a memory gateway, while execution requires the trusted local host.
- Multi-host leases, remote workers, authenticated IPC, and MCP progress mapping remain later compatible layers.
