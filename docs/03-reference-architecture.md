# Reference architecture

## System view

```text
Operator UI / generated review surfaces
                    │
ChaseOS-managed or standalone agent harnesses
                    │
     MCP · SDK · HTTP/IPC · CLI adapters
                    │
          Application service boundary
   ┌────────────────┼────────────────┐
 Queries          Commands          Workflows
   │                 │                 │
   └──────── Semantic domain kernel ──┘
            │          │          │
       revisions     jobs      verification
            │          │          │
        provenance  artifacts   recovery
                    │
     SQLite/content-addressed local storage
                    │
 optional hosted sync/control/compute services
```

## Architectural style

Start with a **modular monolith** per product plus shared contract packages. The semantic boundaries matter; separate processes do not prove good design.

Split a service only when one of these is measured:

- an isolation requirement;
- a materially different scaling profile;
- independent deployment ownership;
- a security boundary;
- a long-running worker lifecycle;
- licensing or hardware separation.

Good early process boundaries are media render workers, model workers, and the secret broker. A “design microservice” for every toolbar section is not.

## Canonical layers

### Domain model

Objects, value types, invariants, and legal transitions.

### Application services

Queries, commands, workflows, transaction boundaries, authorization hooks, and job creation.

### Infrastructure

Persistence, asset storage, model providers, renderers, OS integration, network clients, and telemetry.

### Adapters

UI, MCP, SDK, HTTP/IPC, CLI, import/export formats, and computer-use fallback.

## Commands and queries

Queries return projections and must not silently mutate state.

Commands request versioned state transitions. A command may create a job instead of completing synchronously.

Workflows compose commands but do not bypass their policy, validation, revision, or audit requirements.

## State projections for agents

Do not send entire large projects to the model. Provide bounded projections:

```text
project.summary
project.structure
project.selection
project.changed_since(revision)
project.validation_report
project.pending_approvals
project.jobs
project.artifacts
```

Each projection declares token/byte size, sensitivity, and cache semantics.

## Adapter parity

The following must resolve to the same application handler and result schema:

```text
UI button:          “Generate captions”
CLI:                toolshape studio captions generate ... --json
MCP:                studio.caption.generate
TypeScript SDK:     client.studio.caption.generate(...)
HTTP:               POST /v1/capabilities/studio.caption.generate:invoke
```

Parity tests compare state and result envelopes, not merely HTTP status codes.

## Local-first deployment

```text
Tauri desktop shell
  ├─ local application daemon
  ├─ SQLite
  ├─ content-addressed asset store
  ├─ local model workers
  ├─ local render workers
  ├─ stdio MCP server
  └─ loopback IPC/HTTP with OS-authenticated session
```

No local feature should require x402 or a hosted account unless the feature inherently depends on paid remote compute, licensed media, or cloud collaboration.

## Hosted extensions

Hosted services may add:

- encrypted multi-device sync;
- team collaboration and governance;
- managed model routing;
- GPU rendering and generation;
- asset licensing;
- high-volume APIs;
- organization policy;
- marketplace/payment settlement.

Hosted extensions must not become hidden dependencies of declared offline capabilities.
