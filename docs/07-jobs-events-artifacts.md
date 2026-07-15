# Jobs, events, and artifacts

**Implementation status (2026-07-15): PARTIAL / DURABLE LOCAL RENDER JOBS VERIFIED.** The Studio seed implements SQLite-backed render jobs, ordered events/progress, transactional claim, cancellation, bounded retry/restart recovery, and verified immutable artifact registration. General persisted outbox delivery, multi-host leases, and non-render job families remain planned.

## Jobs

Use jobs for transcription, imports, proxy generation, OCR when unavoidable, background removal, generation, batch variants, rendering, analysis, model downloads, sync, and large exports.

A job must support:

- stable ID;
- parent operation and trace;
- stages and fractional progress;
- current worker/provider;
- cancellation request and actual cancellation state;
- retry count and next retry;
- warnings and machine-safe logs;
- inputs by immutable reference/digest;
- outputs by artifact reference;
- cost estimate and actual cost;
- retention and deletion status.

Do not keep an MCP invocation open for a long render when a durable job can be returned.

The current Studio render envelope stores typed intent only: project, expected revision, immutable project asset, render preset, and safe logical output name. FFmpeg argument construction and approved-root path resolution occur inside the trusted worker.

## Artifacts

An artifact is an immutable output or materialised preview:

- transcript;
- audio normalisation result;
- preview image;
- design export;
- video render;
- subtitle file;
- operation diff;
- evaluation report;
- provenance bundle.

Artifact metadata includes media type, size, digest, source project/revision, producing operation/job, model/provider/toolchain versions, licence/provenance, sensitivity, and retention.

## Content-addressed storage

Store local assets by cryptographic digest and keep logical names in metadata. Benefits:

- deduplication;
- reliable provenance;
- immutable references for jobs;
- reproducible renders;
- integrity checks;
- safe retry semantics.

Content addressing does not remove the need for access control. Knowing a digest must not grant read access.

## Events

Events enable ChaseOS, UIs, harnesses, and background workers to observe progress without polling every object.

Event payloads contain references and redacted summaries, not raw secret-bearing content.

## Event delivery

- local process: in-memory bus plus persisted outbox for durable events;
- desktop daemon: local subscription stream;
- hosted: outbox/inbox pattern with idempotent consumers;
- MCP: resources/progress notifications as an adapter over internal events;
- webhooks: signed, replay-protected, allowlisted destinations.
