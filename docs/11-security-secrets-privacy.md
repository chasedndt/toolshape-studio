# Security, secrets, privacy, and deletion

## Threat model

Assume all of the following may be malicious, compromised, mistaken, or merely unsafe:

- imported web pages, documents, transcripts, captions, templates, projects, and media metadata;
- MCP tool descriptions from untrusted servers;
- external agent messages;
- model outputs;
- plugins and effect packs;
- third-party model/provider responses;
- clipboard history and operating-system accessibility surfaces;
- crash reports, traces, analytics, screenshots, thumbnails, and temporary files.

The main risks are prompt injection, tool misuse, excessive agency, data exfiltration, memory poisoning, credential leakage, cross-tenant access, replay, stale writes, supply-chain compromise, denial of wallet, and destructive or public actions without valid approval.

## Security axiom

> Data can influence a proposal but cannot grant authority.

The authenticated user, delegated agent identity, policy engine, and application executor jointly determine authority. A prompt, document, webpage, or model response cannot expand it.

## Secret architecture

### Never put plaintext secrets in an operation envelope

The envelope may contain:

```json
{
  "secret_refs": [
    {
      "handle": "secret://job/9f.../github-token",
      "purpose": "publish approved artifact",
      "audience": "github.com",
      "expires_at": "2026-07-14T18:00:00Z"
    }
  ]
}
```

Only the trusted executor can resolve the handle, and only after policy approval.

### Secret broker responsibilities

- accept credentials through an OS or enterprise secure entry surface;
- encrypt at rest with platform/enterprise key management;
- issue opaque handles;
- issue short-lived, scoped, audience-bound leases;
- enforce one job/capability/target where possible;
- inject just in time into an isolated worker;
- avoid environment variables when a safer file descriptor, named pipe, or in-memory channel exists;
- audit access without logging values;
- revoke leases at completion/failure/cancellation;
- rotate long-lived credentials;
- expose deletion and revocation evidence.

### Execution isolation

High-risk or secret-bearing tasks use:

- separate process/container/sandbox;
- minimal filesystem mount;
- allowlisted network destinations;
- no inherited browser profile or ambient user credential;
- tmpfs or encrypted ephemeral storage;
- bounded clipboard access;
- no screenshot capture unless explicitly needed and approved;
- stdout/stderr redaction before persistence;
- memory zeroing where the language/runtime permits it;
- process destruction after the job.

## Detecting secrets

Use several layers:

- explicit structured secret fields;
- known credential prefixes and checksums;
- entropy/pattern detectors;
- OS password/secure-field metadata;
- provider-specific token validators that do not transmit the candidate;
- data-loss-prevention rules;
- user marking (“treat selection as secret”).

Detection is imperfect. The product must design flows that avoid asking the model to inspect credentials in the first place.

## Sanitisation

Redaction placeholders should be deterministic within one job so workflows can preserve references:

```text
<SECRET:github_token:1>
<PII:email:2>
<PRIVATE_PATH:workspace:3>
```

Do not use visual corruption or emoji substitution as the security boundary. Such transformations are reversible, ambiguous, and can damage structured data. Use typed labels and opaque handles.

## Deletion and crypto-erasure

At job end:

1. stop and isolate the worker;
2. revoke secret leases and provider sessions;
3. zero in-process buffers where feasible;
4. remove temporary files and IPC objects;
5. clear application-owned clipboard content when safely identifiable;
6. destroy the per-job data-encryption key;
7. delete encrypted temporary blobs and indexes;
8. expire task context and vector entries;
9. preserve only minimal redacted provenance/audit records;
10. record deletion results and failures.

Destroying a unique data-encryption key can make remaining ciphertext computationally inaccessible, but it is not a magic guarantee. It does not remove:

- plaintext already sent to a remote provider;
- provider logs, backups, abuse-monitoring systems, or legal retention;
- OS swap/core dumps created before isolation;
- malware or screenshots on a compromised endpoint;
- copies made by the user or another authorized process;
- immutable backups governed by a longer retention policy.

Therefore, the product must never promise universal “permanent deletion from every source” unless every processor and storage layer is under verified control. It should provide a retention report identifying each boundary and contractual guarantee.

## Privacy modes

### Local-only

- local ASR/rendering only;
- network denied for content workers;
- no cloud sync;
- local analytics;
- explicit local retention.

### Hybrid private

- remote providers allowed only for selected capabilities;
- provider allowlist and zero/limited-retention contracts where available;
- content minimisation and encrypted transport;
- per-capability approval for sensitive projects.

### Cloud collaborative

- encrypted sync and team services;
- organization retention, legal hold, audit, and admin policy;
- clear disclosure that server copies exist.

## Prompt-injection defence

- split trusted instructions/control flow from untrusted data;
- label source and trust level for every context segment;
- use capability-scoped executors;
- require explicit egress permission;
- validate every tool input/output against schemas;
- use allowlists for destinations and file paths;
- re-evaluate policy after tool results, not just before a plan;
- bind approvals to exact action parameters;
- keep memory namespaces separate by tenant, project, trust, and task;
- quarantine suspicious content and degrade to read-only;
- use deterministic validators for policy and data flow;
- red-team with AgentDojo/InjecAgent-style cases.

## Configurable risk without unsafe defaults

Users may configure automatic approval for reversible local actions, but some controls are hard invariants:

- never type into detected password/secret fields by default;
- never expose raw secrets to models when a handle can be used;
- never bypass object authorization;
- never reuse an approval for materially changed parameters;
- never charge beyond a bound;
- never publish, send, purchase, or irreversibly delete through a hidden action;
- never let imported content redefine system policy.

Enterprise policy may strengthen these rules. It may not silently weaken platform invariants.

## Security acceptance criteria

- secret-pattern fixtures never appear in persisted prompts, logs, traces, crash fixtures, embeddings, or artifacts;
- a prompt-injected document cannot grant a new tool, destination, or permission;
- stale/replayed approvals fail;
- idempotency prevents duplicate external and paid actions;
- cancelled jobs revoke leases;
- deletion reports cover every application-owned store;
- cross-tenant and cross-project tests fail closed;
- policy engine behaviour is deterministic and replayable.
