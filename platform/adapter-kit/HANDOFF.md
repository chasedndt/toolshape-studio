# Adapter kit handover

## Goal

Expose one capability registry and dispatcher through SDK, local HTTP/IPC, CLI, and MCP without duplicating domain logic.

## Shared adapter contract

Every adapter maps to:

```ts
invoke(envelope: OperationEnvelope): Promise<OperationResult>
getResource(uri: string, actor: DelegatedActor): Promise<ResourceProjection>
subscribeJob(jobId: string, actor: DelegatedActor): AsyncIterable<JobEvent>
```

Authentication and transport errors are mapped to the common error catalogue where possible.

## CLI

Suggested shape:

```bash
toolshape capabilities list --app studio --json
toolshape invoke studio.project.apply_operations --input operation.json --json
toolshape job get <id> --json
toolshape job watch <id> --jsonl
toolshape job cancel <id> --json
toolshape resource get 'toolshape-studio://projects/p1/summary' --json
```

Rules:

- no secrets on argv;
- non-interactive by default in JSON mode;
- stable exit codes;
- stdout reserved for result data; stderr for diagnostics;
- explicit schema/version display;
- `--dry-run` mutates the envelope rather than invoking a separate hidden path.

## Local HTTP/IPC

Suggested endpoints:

```text
GET  /health
GET  /v1/anac
GET  /v1/capabilities
POST /v1/operations:invoke
GET  /v1/jobs/{id}
POST /v1/jobs/{id}:cancel
GET  /v1/resources?uri=...
GET  /v1/events/stream
```

Use local authentication bound to the desktop session. Do not assume `127.0.0.1` is trusted by itself.

## MCP

Export a deliberately curated subset:

- product capabilities as tools;
- project/job/schema summaries as resources;
- approved workflow recipes as prompts where useful;
- progress/cancellation over the internal job layer.

MCP tool handlers perform no business logic beyond transport mapping and caller/consent integration.

## SDKs

TypeScript first. Generate Python and Rust clients after the HTTP/IPC and schemas stabilise. SDKs expose typed helpers but preserve the canonical operation/result envelope for audit.

## Adapter parity tests

For each fixture:

1. reset the reference domain;
2. invoke through each adapter;
3. compare normalized result envelopes;
4. compare final state digests;
5. compare event/provenance semantics;
6. ensure idempotency is shared across adapters.

## Security cases

- local web page cannot invoke loopback service without session auth;
- MCP caller cannot read a resource without grant;
- CLI JSON output never prints plaintext secret fixtures;
- malformed schemas rejected before handler;
- path/command injection payloads remain data;
- cancellation and retries remain idempotent.
