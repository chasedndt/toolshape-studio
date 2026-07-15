# Codex execution prompt — Phase 0 reference kernel

You are the lead implementation agent for the Toolshape harness-native platform foundation.

## Mission

Implement a small runnable neutral application proving the Agent-Native Application Contract before product-specific code expands. This is an implementation task, not another planning document.

## Mandatory reading

Read completely, in order:

1. root `AGENTS.md` and `README.md`;
2. `docs/01-agent-native-constitution.md`;
3. `docs/02-chaseos-hierarchy.md`;
4. `docs/03-reference-architecture.md`;
5. `docs/04-semantic-kernel.md`;
6. `docs/05-operation-envelope-vs-memory.md`;
7. `docs/06-capability-design.md`;
8. `docs/07-jobs-events-artifacts.md`;
9. `docs/11-security-secrets-privacy.md`;
10. every file in `platform/`;
11. every schema and example in `specs/`;
12. `docs/12-evals-benchmarks.md`.

Report conflicts before changing a frozen schema. Do not silently reinterpret ChaseOS as the active harness; the hierarchy is ChaseOS → harnesses → adapters → application.

## Deliverable

Create a TypeScript workspace containing a neutral `workboard` reference domain:

```text
Board(id, revision, title)
Card(id, board_id, title, status, order)
ExportJob(board_revision → JSON artifact)
```

Required capabilities:

- `workboard.board.inspect`
- `workboard.board.apply_operations`
- `workboard.board.export`
- `job.get`
- `job.cancel`
- `artifact.get`
- `operation.undo`

Expose the same handler path through:

- in-process SDK;
- local HTTP API;
- CLI;
- STDIO MCP server.

Use runtime Draft 2020-12 schema validation. Compile-time types are not sufficient.

## Required execution path

```text
transport validation
→ trusted capability lookup
→ actor/delegation validation
→ policy decision
→ target/revision resolution
→ idempotency lookup
→ input/precondition validation
→ preview or transaction
→ handler/job creation
→ postcondition validation
→ commit
→ independent verification
→ provenance/outbox emission
→ structured result
```

## Required persistence

SQLite is acceptable for the reference implementation. Separate repositories/interfaces for:

- domain state and revisions;
- idempotency records;
- jobs;
- artifacts;
- provenance/audit;
- outbox events.

Do not persist plaintext secret values. The neutral app may use fake opaque secret handles only to prove non-persistence.

## Tests that must exist

1. invalid schema rejected before handler invocation;
2. unknown capability rejected;
3. missing grant rejected;
4. stale revision rejected;
5. duplicate idempotency key plus same digest returns original result;
6. duplicate key plus different digest returns conflict;
7. preview creates no domain mutation;
8. atomic batch rolls back fully;
9. postcondition/verifier failure is distinct from handler failure;
10. undo token is revision-bound;
11. job transitions reject invalid edges;
12. cancellation race is deterministic;
13. outbox delivery is idempotent;
14. SDK/HTTP/CLI/MCP paths reach equivalent final state;
15. secret canary never appears in database, logs, artifacts or traces.

## Required commands

Provide and run commands equivalent to:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm conformance
pnpm workboard:smoke
```

The smoke workflow must create a board, preview a two-card operation batch, apply it, repeat it with the same idempotency key, export an artifact, verify final state, then undo one reversible operation.

## Boundaries

- Do not add Voice or Studio domain logic.
- Do not add a chatbot UI.
- Do not create microservices without measured need.
- Do not let adapters contain domain rules.
- Do not weaken schemas or tests to make the smoke path pass.
- Do not expose arbitrary shell execution.
- Do not resolve opaque secrets before policy approval and trusted-handler entry.

## Handover format

Return:

1. files changed;
2. architecture decisions and deviations;
3. exact commands and results;
4. conformance result matrix;
5. schema changes requiring review;
6. remaining risks;
7. the next smallest integration step.
