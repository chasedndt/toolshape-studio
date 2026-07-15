# Executive brief

## What is being built

Toolshape is a reusable harness-native software architecture plus two products:

1. **Toolshape Voice** removes keyboard labour by converting speech into accurate, context-aware, reviewable text in almost any Windows text surface.
2. **Toolshape Studio** removes repetitive content-production labour through one integrated visual-design and video-editing environment.

Both products are designed for an operator who delegates the heavy work to agent harnesses and enters the editor for approval, correction, taste, and final craft.

## Why this is different from an AI feature

The products do not merely contain chat boxes. Their domain state and capabilities are designed for external harnesses from the beginning:

```text
Discover → inspect/resolve → plan → preview → authorize → execute → verify → recover
```

The same operation that a human triggers through a polished control also exists as a typed capability for Codex, Claude Code, ChatGPT/Agents SDK, Chase Agent, CI, scripts, and future harnesses.

## Product and platform split

```text
Shared platform
  ANAC contracts
  semantic kernel
  revision and transaction engine
  jobs, artifacts, provenance
  policy and approval engine
  secret broker
  adapter kit
  conformance and eval suite

Toolshape Voice
  audio and transcription domain
  text transformation and correction learning
  Windows input/insertion adapters
  Flow Bar and Hub
  analytics and coaching

Toolshape Studio
  scene graph and layout domain
  timeline and media domain
  style intelligence
  dynamic review interfaces
  deterministic export/render workers
```

## Success condition

The project succeeds when external harnesses can perform useful, multi-step work without pixel choreography while the operator can inspect the plan, see semantic diffs, approve risk, directly edit the result, and recover safely.

The benchmark target is not merely “better than browser automation.” It is reliable state-based completion, low collateral mutation, policy compliance, and cross-harness portability.

## Immediate build order

Workstreams may run in parallel, but shared contracts are the integration gate:

1. freeze ANAC v0.1 schemas and fixtures;
2. implement the reference semantic kernel and adapter parity tests;
3. build Toolshape Voice’s Windows golden loop;
4. build Toolshape Studio’s unified-project vertical slice;
5. run state, security, latency, quality, and cross-harness conformance evals;
6. expand capabilities only after the 80/20 set is stable.
