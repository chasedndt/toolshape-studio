# University learning map

This build should double as deliberate practice for the operator’s Year 2 computer-science development. The known curriculum emphasis includes functional and object-oriented programming, software design/testing, sets/logic/graphs/functions, vectors/matrices, probability, and statistics. Confirm module details against the current university handbook before treating this as assessment guidance.

## Learning by subsystem

| Area | Project application | Evidence to produce |
|---|---|---|
| Object-oriented design | Domain aggregates, provider interfaces, effect plugins, policy strategies | UML/domain notes, interface contracts, tests |
| Functional programming | Pure validators, operation reducers, immutable diffs, transformation pipelines | Property tests and referentially transparent functions |
| Testing principles | Unit, property, integration, state-based, security, and pass^k evals | Test matrix and coverage rationale |
| Sets and logic | Capability grants, policy predicates, allowed/forbidden action sets | Formal rule examples and truth tables |
| Graphs | scene graph, timeline dependencies, workflow DAGs, provenance graph | graph invariants and traversal tests |
| Functions | typed transformations and composable operations | algebraic operation definitions |
| Vectors/matrices | 2D transforms, affine matrices, colour transformations, embeddings | visual transform notebook/examples |
| Probability/statistics | ASR error rates, latency distributions, preference uncertainty, pass^k | analysis notebooks and confidence intervals |
| Concurrency | jobs, cancellation, optimistic locking, event outbox | race-condition tests |
| Operating systems | global hotkeys, processes, IPC, permissions, accessibility/input APIs | Windows integration report |
| Security | capabilities, secret leases, isolation, zero trust, audit | threat model and misuse-case suite |
| Human-computer interaction | editor ergonomics, dynamic review surfaces, accessibility | usability study and design rationale |

## Language practice

### Rust

Use for:

- audio capture and VAD plumbing;
- Windows API boundaries;
- secure worker processes;
- media execution;
- scene/timeline performance hotspots;
- safe concurrency and ownership practice.

Concepts to document:

- ownership and borrowing;
- traits for providers;
- enums for state machines;
- `Result` error handling;
- async/cancellation;
- FFI and unsafe-code boundaries;
- property testing.

### TypeScript

Use for:

- domain/application orchestration;
- generated schema types;
- Tauri UI;
- MCP/HTTP/CLI adapters;
- declarative task-specific interfaces;
- SDKs.

Concepts to document:

- discriminated unions;
- generics;
- exhaustive matching;
- runtime schema validation versus compile-time types;
- state management;
- event streams;
- accessibility.

### Python

Use for:

- benchmark runners;
- preference/model experiments;
- statistical analysis;
- data fixtures;
- reproducible notebooks.

Concepts to document:

- typing;
- data validation;
- experiment isolation;
- metrics and confidence;
- reproducibility.

## Learning-note rule

Every substantial pull request should include a short `docs/learning/<date>-<topic>.md` note:

```text
Concept studied
Where it appears in the code
Why this design was chosen
Alternative considered
Test/evidence
What remains unclear
```

This converts implementation work into a durable university and book archive rather than undocumented “vibe coding.”
