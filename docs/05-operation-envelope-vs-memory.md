# Operation envelope, memory, vectors, and weights

## Operation envelope

The operation envelope is the canonical request to inspect, simulate, or change application state.

It answers:

- who is acting;
- through which harness;
- under whose delegation;
- which capability is requested;
- which object and revision are targeted;
- which structured inputs are supplied;
- what risk and retention classes apply;
- whether this is a dry run;
- which secret handles may be resolved by the executor;
- which trace and idempotency identities bind retries.

It does **not** contain arbitrary hidden memory or raw secrets.

## Four separate knowledge stores

### 1. Domain state

Authoritative projects, transcripts, scenes, timelines, settings, revisions, and artifacts.

### 2. Preference and style state

Versioned, inspectable style tokens, rules, weights, anti-patterns, per-app preferences, and approval history.

### 3. Workflow knowledge

Reusable recipes, preconditions, successful traces, failure notes, and evaluation evidence.

### 4. Retrieval indexes

Embeddings and indexes that help find relevant exemplars, assets, or workflows. An embedding is a lookup aid, not authoritative truth.

## Example: changing a style weight

The user changes `typography.display_scale` from `0.65` to `0.8`.

1. UI or agent issues `style.profile.update` with expected profile revision.
2. Policy permits a reversible local preference change.
3. Kernel validates the allowed range.
4. A new style-profile revision is written.
5. The operation result records the semantic diff.
6. The embedding index is refreshed asynchronously if necessary.
7. Future candidate generation reads the new profile revision.

The weight lives in the style profile. The envelope proves how and why it changed.

## Memory retention classes

```text
R0 ephemeral       prompt/runtime scratch; destroyed at task end
R1 operational     job state and retries; short TTL
R2 user history    explicitly retained transcripts/projects
R3 learned config  dictionaries, profiles, recipes, corrections
R4 audit           minimal immutable security/provenance records
R5 aggregate       consented, de-identified product analytics
```

Each object declares its retention class, user visibility, deletion mechanism, export mechanism, and whether it can leave the device.

## Rules

- Do not embed raw credentials, password fields, access tokens, or private keys.
- Do not use a vector store as an unbounded transcript dump.
- Do not silently convert content into permanent memory.
- Every learned change must be attributable, inspectable, reversible, and scoped.
- A workflow can remember structure after the secret values used in one execution are destroyed.
