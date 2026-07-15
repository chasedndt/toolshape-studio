# Conformance and evaluation handover

## Goal

Create the executable evidence that an application is harness-native rather than merely API-accessible.

## Profiles

### Agent-compatible

- manifest and schema discovery;
- typed invocation;
- structured state/errors;
- jobs.

### Harness-native

Adds:

- preview/dry-run;
- revisions and idempotency;
- delegated grants;
- exact approvals;
- verification;
- provenance;
- recovery;
- secret-handle and egress policy;
- state-based tests.

### Ecosystem-ready

Adds:

- cross-harness and cross-app recipe portability;
- signed manifests;
- version/migration compatibility;
- organization policy;
- metered resource/payment compatibility where declared.

## Test runner

Recommended Python layout:

```text
evals/
  cases/
  fixtures/
  harness_adapters/
  verifiers/
  perturbations/
  results/
  run.py
```

Each case defines initial state, goal, allowed/forbidden capabilities, required postconditions, collateral invariants, repetitions, and optional faults.

## Perturbations

- provider unavailable;
- delayed job events;
- duplicate response;
- stale revision;
- network timeout;
- cancellation race;
- malformed tool output;
- injected untrusted instruction;
- expired approval;
- budget exhausted;
- secret lease revoked;
- application restart;
- harness restart.

## Cross-harness suite

Run the same abstract recipe through at least two harness adapters. Do not require identical reasoning text or call sequence. Require equivalent allowed final state, policy behaviour, and verification.

## GUI/tool selection suite

When a semantic capability exists, record whether the harness selected it. Include fallback cases where the capability is intentionally missing and the harness must use accessibility/computer use.

## Reports

Produce JSON and Markdown containing:

- pass/fail by case;
- pass^k;
- unexpected mutations;
- capability selection rate;
- GUI fallback rate;
- approval correctness;
- recovery success;
- cost/latency;
- secret/security incidents;
- harness/model/app versions;
- trace and artifact references.

## Release rule

No product may self-declare `harness_native` in its ANAC manifest unless the current conformance suite passes the declared profile and the report digest is attached to the release.
