# Secret broker handover

## Goal

Keep credentials and other high-sensitivity values out of prompts, operation payloads, logs, vectors, traces, and project documents while enabling approved jobs.

## Non-goals

- automatic discovery of every possible secret with perfect accuracy;
- claiming deletion from remote systems outside contractual/technical control;
- acting as a general password manager in the first release;
- exposing secret values back to agent harnesses.

## Recommended architecture

Use a separate process with a minimal API:

```text
secret.create        secure UI/OS integration only
secret.issue_handle  returns opaque reference
secret.resolve       trusted executor only, policy-bound
secret.revoke
secret.status
secret.delete
secret.retention_report
```

The agent-facing surface should normally see only `issue_handle` metadata/status, not `resolve`.

## Storage

- platform secure storage or enterprise vault for long-lived secret material;
- envelope encryption with per-secret or per-job data keys;
- key encryption key in OS/enterprise KMS;
- metadata database contains no plaintext;
- short TTL cache only in locked memory where practical;
- no secret values in SQLite WAL, logs, backups, crash dumps, or search indexes.

## Lease

A lease is bound to:

- owner principal;
- executor identity;
- capability;
- target/destination;
- purpose;
- expiry;
- maximum resolutions;
- optional request/resource digest.

## Injection mechanisms

Prefer, in order:

1. direct in-memory library call inside trusted executor;
2. inherited file descriptor or named pipe;
3. protected temporary file with restrictive permissions and immediate deletion;
4. environment variable only when required by a third-party executable and in an isolated process.

Never put a secret in command arguments.

## Redaction pipeline

Redaction occurs before persistence, not when a log viewer opens.

Cover:

- structured fields;
- headers/query strings;
- stdout/stderr;
- model prompts/responses;
- exception messages;
- traces/spans;
- crash breadcrumbs;
- clipboard events;
- generated diagnostic bundles.

Use synthetic canary secrets in tests.

## Retention report

For every secret-bearing job, produce a redacted report:

```text
application stores cleared: yes/no
worker destroyed: yes/no
lease revoked: yes/no
per-job key destroyed: yes/no
clipboard cleanup attempted: yes/no/not-used
remote processors used: list
remote retention guarantee: declared contract/status
known limitations: list
```

## Acceptance

- zero canary secret matches across persisted stores;
- one-time lease resolves once;
- wrong audience/capability/target fails;
- cancellation revokes lease;
- expiry fails closed;
- worker crash triggers cleanup/revocation;
- remote-provider use creates an explicit retention boundary;
- audit proves access without including value.
