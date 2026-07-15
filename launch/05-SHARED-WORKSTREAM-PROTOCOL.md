# Shared workstream protocol

## Branch and path ownership

| Workstream | Branch | Exclusive write scope |
|---|---|---|
| Platform + Voice | `work/voice-platform` | shared platform packages, shared contract process, Voice app/runtime, Voice status/outbox |
| Studio | `work/studio` | Studio app/domain/engine/UI, Studio proposals, Studio status/outbox |

## Shared platform publication

Session A publishes the first tested baseline as `platform-v0.1.0`. The tag must point to a commit containing only the shared baseline and its tests—not unfinished Voice work.

Session B may inspect the tag at any point. It must not idle while the tag is absent. Once present, it integrates the tag in a dedicated commit, runs touched conformance/state tests, and reports incompatibilities as proposals.

## Contract change process

A public contract changes only with:

1. a proposal explaining the domain need;
2. schema/version impact;
3. compatibility/migration strategy;
4. fixture updates;
5. conformance tests;
6. an ADR/decision;
7. a structured control-plane event.

No workstream silently forks operation, job, artifact, provenance, policy or adapter semantics.

## Merge gates

A workstream is integration-ready only when relevant gates pass:

```text
format
lint
typecheck / compile
unit tests
schema and fixture validation
state-based integration tests
collateral-damage assertions
security canaries
adapter parity where available
smoke workflow
licensing/dependency report
handover event
```

## Event discipline

Events are append-only small JSON documents. They report verified facts and point to commits/reports. They are not raw logs.

Required event types:

```text
started
milestone
test_result
contract_baseline_ready
contract_change
contract_proposal
integration
security
blocker
approval_required
artifact
handover
release
```

## Data prohibition

Never place in the event outbox or Discord:

- credentials or secret values;
- raw private transcripts or recordings;
- private source media or customer assets;
- full model prompts containing sensitive context;
- raw chain-of-thought;
- full JSONL execution traces;
- unrestricted filesystem listings;
- provider tokens, payment tokens or licence keys.
