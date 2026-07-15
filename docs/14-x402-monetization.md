# x402 and monetization architecture

## Role of x402

x402 belongs at a paid HTTP resource boundary. It is not the application’s operation protocol and it is not required for free local editing.

Appropriate boundaries:

- premium cloud transcription;
- GPU image/video generation;
- high-resolution or accelerated cloud rendering;
- licensed stock media retrieval;
- specialist agent services;
- paid datasets or enrichment;
- high-volume API access.

Inappropriate boundaries:

- local project edits;
- local transcription/rendering;
- undo/history;
- basic export;
- local agent orchestration;
- every individual tool call.

## Paid-operation lifecycle

```text
1. preflight request
2. price/terms quote with expiry and resource digest
3. ChaseOS or standalone spending policy evaluation
4. exact human approval above configured threshold
5. reserve budget and bind idempotency key
6. x402 payment authorization/verification
7. create job exactly once
8. execute
9. verify deliverable
10. settle and emit signed receipt
11. refund or credit when the service fails under declared terms
```

## Quote contract

A quote declares:

- resource/capability;
- input digest, not sensitive plaintext;
- currency/network/payment scheme;
- exact or maximum amount;
- expiry;
- provider identity;
- service-level expectations;
- refund/credit policy;
- content retention and data processing;
- output licence;
- idempotency scope.

## Denial-of-wallet controls

- per-operation maximum;
- per-workflow maximum;
- daily/monthly budget;
- provider allowlist;
- rate limits;
- cost estimate before generation loops;
- no automatic retries after a charged failure without policy;
- separate exploration and production budgets;
- batch settlement where it reduces overhead;
- anomaly detection.

## Monetization by product

### Toolshape Voice

Free/local:

- local ASR providers;
- hotkeys and insertion;
- dictionary/snippets/styles;
- local history and analytics;
- agent API.

Paid:

- managed premium ASR;
- encrypted sync;
- mobile clients;
- team dictionaries and governance;
- enterprise support and policy;
- advanced optional model services.

### Toolshape Studio

Free/local:

- scene/timeline editor;
- local rendering;
- core effects and captions;
- templates/components owned by the user;
- local style profiles;
- agent control.

Paid:

- cloud GPU rendering and generation;
- licensed stock, music, fonts, and effect packs;
- collaboration and review;
- brand governance;
- high-volume/batch APIs;
- managed publishing and analytics;
- enterprise support.

## Product principle

The free path must complete real work. Monetize scarce compute, licensed content, synchronization, collaboration, governance, reliability, and convenience—not access to the user’s own local project state.
