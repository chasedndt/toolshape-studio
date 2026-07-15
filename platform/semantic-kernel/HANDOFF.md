# Semantic kernel Codex handover

## Goal

Implement the smallest deterministic kernel that proves ANAC operations, revisions, idempotency, jobs, verification, recovery, and adapter parity.

## Inputs

Read:

- root `AGENTS.md`;
- `docs/03-reference-architecture.md`;
- `docs/04-semantic-kernel.md`;
- `specs/*.schema.json`;
- `specs/examples/*.json`;
- `platform/conformance/HANDOFF.md`.

## Recommended implementation

Use a TypeScript package for the first kernel because contracts, adapters, and UI clients are TypeScript-heavy. Keep interfaces language-neutral. Introduce Rust implementations only for measured performance/native boundaries.

Suggested modules:

```text
src/capabilities/registry.ts
src/operations/dispatcher.ts
src/operations/idempotency.ts
src/revisions/repository.ts
src/transactions/unit-of-work.ts
src/jobs/model.ts
src/jobs/repository.ts
src/jobs/worker-protocol.ts
src/artifacts/store.ts
src/provenance/ledger.ts
src/verification/registry.ts
src/recovery/registry.ts
src/errors/catalog.ts
src/events/outbox.ts
```

## Contracts

Generate types from JSON Schema or validate with a well-supported Draft 2020-12 validator. Compile-time TypeScript types do not replace runtime validation.

All handlers receive:

```ts
type CapabilityContext = {
  actor: DelegatedActor;
  grants: CapabilityGrant[];
  traceId: string;
  transaction: UnitOfWork;
  secrets: SecretResolver; // resolves opaque handles only after policy
  jobs: JobManager;
  artifacts: ArtifactStore;
  now: () => Date;
};
```

## Execution sequence

```text
validate transport payload
→ load trusted capability definition
→ authenticate actor/delegation
→ evaluate policy
→ resolve target and revision
→ check idempotency
→ validate inputs/preconditions
→ preview or begin transaction
→ invoke deterministic handler / create job
→ validate postconditions
→ commit
→ verify
→ emit provenance/events
→ return structured result
```

Do not resolve secrets until immediately before the trusted handler/provider call.

## Neutral reference domain

Create a tiny workboard domain:

```text
Board(id, revision, title)
Card(id, board_id, title, status, order)
ExportJob(board_revision → JSON artifact)
```

Capabilities:

- `workboard.board.inspect`
- `workboard.board.apply_operations`
- `workboard.board.export`
- shared `job.get`, `job.cancel`, `artifact.get`, `operation.undo`

## Required tests

- schema rejection before handler;
- unknown capability;
- missing grant;
- stale revision;
- duplicate idempotency same digest returns same result;
- duplicate key different digest conflicts;
- preview produces no state/event side effect except permitted audit;
- atomic batch rollback;
- deterministic verifier pass/fail;
- undo token bound to revision;
- job state transition validity;
- cancellation race;
- outbox idempotency;
- no plaintext secret fixture in persisted stores.

## Smoke commands

Provide commands equivalent to:

```bash
pnpm test
pnpm conformance
pnpm workboard:smoke
```

The smoke script should create a board, preview two card changes, commit them, repeat the request with the same idempotency key, export a JSON artifact, and verify state.

## Stop condition

Do not add product logic. Stop when the neutral domain passes all adapters and the conformance suite can be reused by Voice and Studio.
