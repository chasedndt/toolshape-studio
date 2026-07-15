# Evaluation and benchmark strategy

## Why state-based evaluation

A model can produce a convincing explanation while leaving the application in the wrong state. Evaluation therefore starts from a controlled initial state, runs the harness, and inspects final state, policy events, artifacts, and collateral changes.

This follows the strongest lesson from AppWorld and tau-bench: validate goal state and unintended mutations, and measure repeat reliability rather than one successful demonstration.

## Benchmark inspiration

### OSWorld

Use for GUI and fallback pathways. It demonstrates the gap between human computer use and agents, especially GUI grounding and operational knowledge.

### OSWorld-MCP

Use for mixed semantic-tool and GUI cases. Measure whether the harness selects a capability when one exists instead of continuing with pixels.

### WindowsWorld

Use for multi-application, professional, conditional workflows on Windows.

### AppWorld

Use its state-based unit-test philosophy: allow multiple valid trajectories while checking collateral damage.

### tau-bench

Use final-state comparison, domain policies, simulated user interaction, and `pass^k` consistency.

### AgentDojo, InjecAgent, and CaMeL

Use for indirect prompt injection, data-flow control, capability isolation, and exfiltration attempts.

## Evaluation layers

### 1. Contract conformance

- schema validity;
- capability discovery;
- version negotiation;
- idempotency;
- revision conflicts;
- structured errors;
- job state transitions;
- adapter parity.

### 2. Domain correctness

- voice transcription and insertion;
- style/correction preservation;
- scene and timeline invariants;
- render validity;
- export accuracy;
- undo/recovery.

### 3. Harness behaviour

- correct capability selection;
- minimal unnecessary calls;
- no GUI use when a semantic capability exists;
- plan quality;
- handling ambiguity;
- recovery after injected faults;
- cross-harness outcome parity.

### 4. Human supervision

- approval displayed at the correct point;
- semantic diff accuracy;
- interruption and resume;
- correction burden;
- approval fatigue;
- accessibility.

### 5. Security/privacy

- prompt injection;
- secret leakage;
- permission escalation;
- data egress;
- replay;
- denial of wallet;
- memory poisoning;
- malicious plugin/manifest;
- cross-project contamination.

## Core metrics

| Metric | Definition |
|---|---|
| Goal success | Required postconditions pass |
| Collateral mutation | Unexpected state differences |
| pass^k | Probability/observed rate that all k repeated runs pass |
| Capability selection rate | Semantic tool chosen when available |
| GUI fallback rate | Pixel/UI path used despite a supported capability |
| Policy compliance | Required approvals and prohibitions obeyed |
| Recovery success | Fault repaired or safely escalated |
| Human correction burden | Number/time/size of required edits |
| Cost per verified outcome | Total compute/payment per passing task |
| Latency | End-to-end and stage p50/p95/p99 |
| Privacy leakage | Sensitive values appearing outside allowed stores |
| Reproducibility | Identical inputs/toolchain produce equivalent outputs |

## Pass thresholds

Golden workflows should not ship on one passing run.

Suggested pre-alpha gates:

- deterministic kernel tests: 100%;
- schema and adapter parity: 100%;
- no unexpected mutations in fixtures: 100%;
- security hard invariants: 100%;
- golden workflow `pass^8`: at least 7/8 during development, target 8/8 before stable release;
- recovery cases: at least 95% for declared recoverable faults;
- secret leakage fixtures: zero persisted plaintext;
- GUI fallback: zero for operations represented by the tested semantic capability.

Creative-quality scores are not release gates by themselves. Pair them with professional review and user-specific preference evaluation.

## Test case structure

```json
{
  "case_id": "studio.caption.safe-area.001",
  "initial_fixture": "fixtures/project_vertical_interview_v3.json",
  "user_goal": "Add readable branded captions without covering the product",
  "allowed_capabilities": ["studio.caption.generate", "studio.quality.validate"],
  "forbidden_effects": ["publish.external"],
  "required_postconditions": [],
  "collateral_invariants": [],
  "fault_injection": null,
  "repetitions": 8
}
```

## Evaluation evidence archive

Persist:

- initial-state digest;
- harness/model/version;
- capability manifest version;
- operation and job traces with redaction;
- final-state digest;
- verifier output;
- artifacts;
- cost/latency;
- run seed/configuration;
- failure classification.

This evidence feeds regression analysis and future book chapters without retaining secrets or unnecessary private content.
