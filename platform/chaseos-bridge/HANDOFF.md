# ChaseOS bridge handover

## Goal

Build a neutral bridge that lets ChaseOS register applications and harnesses, resolve abstract workflow requirements, issue delegated grants/approvals, and observe jobs without embedding product logic.

## Architecture

```text
ChaseOS workflow/knowledge layer
  → Harness Registry
  → Application Registry (ANAC manifests)
  → Capability Resolver
  → Delegation/Grant Issuer
  → Approval Coordinator
  → Harness Adapter
  → application transport adapter
```

## Required data

### Application registration

- application ID/version;
- ANAC manifest digest;
- transport endpoints;
- trusted publisher/signature metadata;
- health and conformance status;
- available capabilities filtered by current identity.

### Harness registration

- harness ID/version;
- supported transports and context modes;
- model/tool/filesystem/sandbox capabilities;
- cost/latency constraints;
- trust and isolation profile;
- supported approval callbacks;
- recent conformance evidence.

### Workflow recipe

Store abstract capability IDs, preconditions, verification, and policy constraints. Keep harness-specific prompt templates in adapters.

## Responsibilities

ChaseOS bridge may:

- select a harness;
- attach approved knowledge/context references;
- issue short-lived grants;
- coordinate exact approvals;
- enforce global budgets and schedules;
- subscribe to jobs/events;
- archive successful redacted workflow traces;
- request recovery or a different harness.

It may not:

- bypass application authorization;
- rewrite project state directly;
- expose raw secrets to the harness;
- mark a task successful without application/domain verification;
- silently persist private content outside declared retention.

## Standalone compatibility

Keep ChaseOS metadata optional in the operation actor. An application must accept a direct user + harness delegation without a ChaseOS session when local policy permits it.

## Conformance cases

- same recipe resolved to Codex and Claude adapters;
- capability unavailable in one app version produces a negotiation error;
- harness cannot expand grants;
- expired approval fails;
- global budget blocks an x402 quote;
- application-local policy blocks an action despite ChaseOS request;
- job progress survives harness restart;
- successful workflow archive contains structure but no secret values.

## Deliverables

- bridge interfaces;
- mock ChaseOS registry;
- two mock harness adapters;
- application registration flow;
- recipe resolver;
- delegated grant/approval fixtures;
- conformance report.
