# ADR 0006: Local IPC and adapter boundary

- **Status:** ACCEPTED
- **Date:** 2026-07-15

## Context

Humans, CLI automation, MCP clients, and a future Tauri shell must invoke identical behavior. Loopback networking is not trusted merely because it is local.

## Decision

Keep all business logic in one semantic service with `inspect`, `plan`, `apply`, `validate`, `render`, `job.get`, and `job.cancel` capabilities. The TypeScript SDK calls it in process. The first CLI uses JSON files/stdin and stable JSON stdout. The desktop shell will use Tauri commands over its application IPC. Any future local HTTP or MCP process is a transport-only adapter with session authentication, grants, schema validation, and shared idempotency storage.

## Consequences

- Adapters stay thin and parity-testable.
- No unauthenticated loopback server is introduced in the first slice.
- Tauri/Rust packaging can follow after the semantic service and current-host render proof are stable.

