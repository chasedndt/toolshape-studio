# Policy and approval engine handover

## Goal

Implement deterministic, configurable risk and approval decisions shared by standalone products and ChaseOS integrations.

## Inputs

- principal and delegation chain;
- capability definition;
- target resource and ownership;
- operation effects/risk;
- parameter digest and meaningful bounds;
- data sensitivity and egress destination;
- cost quote;
- user, project, organization, and application policy;
- current time and invocation count;
- trusted environment/device posture when available.

## Output

```ts
type PolicyDecision =
  | { kind: 'allow'; grantIds: string[]; constraints: Constraint[] }
  | { kind: 'approval_required'; request: ApprovalRequest }
  | { kind: 'deny'; code: string; reason: string; recovery: string[] };
```

## Risk tiers

| Tier | Typical effects | Default |
|---:|---|---|
| 0 | read/inspect | automatic under read grant |
| 1 | preview/simulate/validate | automatic |
| 2 | reversible local write | configurable policy |
| 3 | external but reversible | explicit delegation or contextual approval |
| 4 | public, financial, destructive, sensitive, irreversible | exact human approval immediately before execution |

## Policy precedence

```text
platform hard invariants
> legal/organization mandatory policy
> application policy
> project policy
> user profile
> workflow preference
> agent request
```

Lower levels cannot weaken higher ones.

## Exact approval binding

Bind an approval to:

- principal;
- agent and harness;
- capability/version;
- resource and expected revision/digest;
- parameter digest or bounded fields;
- effects;
- destination allowlist;
- maximum cost;
- expiry;
- invocation count.

A plan edit invalidates approval when any bound element changes materially.

## Configurable profiles

Provide profiles such as:

```text
Cautious
  all writes previewed; external actions explicit
Balanced
  reversible local edits automatic; external explicit
Operator
  selected local workflows automatic; batch review; strict public/financial boundary
Enterprise locked
  centrally managed; user may only strengthen
```

Expose the effective rule and reason in the UI and audit log.

## Test matrix

- inherited policy precedence;
- exact action mutation invalidates approval;
- time expiry and replay;
- maximum invocation;
- stale target revision;
- destination mismatch;
- cost exceeds bound;
- mixed-risk batch splits or escalates safely;
- prompt-injected content cannot create a grant;
- ChaseOS request denied by app hard invariant;
- standalone and ChaseOS decisions equivalent for same effective policy.
