# Semantic application kernel

## Purpose

The semantic kernel makes domain work legible and controllable without reproducing UI choreography. It is not an LLM framework. It is deterministic application software with controlled model boundaries.

## Core modules

```text
Capability Registry
Query Dispatcher
Command Dispatcher
Workflow Runner
Authorization Hook
Revision Store
Idempotency Store
Transaction Manager
Job Manager
Artifact Store
Verification Registry
Recovery Manager
Provenance Ledger
Event Bus
```

## Capability registry

A capability includes:

- stable ID and semantic version;
- description written for both developers and models;
- input and output schemas;
- effects and risk class;
- preconditions and postconditions;
- dry-run support;
- idempotency behaviour;
- latency class;
- job behaviour;
- required grants;
- approval mode;
- cost estimator;
- verifier;
- recovery method;
- examples and counterexamples.

## Transaction and revision model

Every mutable aggregate exposes a revision. A normal write declares `expected_revision`.

```text
current revision = 42
operation expects = 42  → may execute
operation expects = 41  → stale_revision, no mutation
```

Batch operations either:

- apply atomically;
- create a staged plan that is committed atomically later; or
- explicitly declare partial outcomes and compensation.

A model is not allowed to “resolve” a revision conflict by silently overwriting newer work. It must inspect the diff and re-plan.

## Idempotency

Retries are normal in distributed agent systems. Every non-read operation receives an idempotency key scoped to actor, capability, and target.

The idempotency record stores:

- request digest;
- first execution time;
- status;
- resulting operation/job/artifact references;
- expiry;
- conflict result when the same key is reused with a different digest.

## Long-running jobs

A job state machine:

```text
created → queued → running → completed
                    ├→ waiting_for_input
                    ├→ retry_scheduled
                    ├→ failed
                    └→ cancelled
```

Jobs expose progress stages, logs safe for the caller, result artifacts, cancellation semantics, retry policy, resource use, cost, and trace references.

## Verification

Verification is a registered domain function, not a generic “looks good” model statement.

Examples:

- transcript insertion: target field contains the expected text digest;
- design resize: all required artboards exist and overflow/contrast tests pass;
- video render: file probe matches expected duration, dimensions, codec, frame rate, and audio presence;
- style application: hard brand rules pass and preference score clears a configured threshold.

Where objective verification is impossible, return the limitation and evidence used for a probabilistic judgement.

## Recovery

Recovery types:

- inverse operation;
- restore snapshot;
- revert to revision;
- compensating external action;
- retry with corrected provider/input;
- manual repair workflow;
- explicit `irreversible` status.

An undo token is capability- and revision-bound, time-limited, and single-use where appropriate.

## Events

Events are facts emitted after accepted state transitions:

```text
operation.accepted
operation.rejected
revision.created
job.stage_changed
job.completed
artifact.created
approval.requested
approval.resolved
secret.accessed
verification.failed
recovery.completed
```

Events are not commands. Consumers must be idempotent.
