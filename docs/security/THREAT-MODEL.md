# Toolshape Studio threat model

**Date:** 2026-07-15  
**Status:** PARTIAL / ACTIVE

## Protected assets

- immutable user media and fonts;
- editable project state and revision history;
- operation, idempotency, provenance, job, and artifact records;
- operator identity, delegated grants, and approval decisions;
- local filesystem paths and process authority;
- future secret handles and publishing credentials.

## Trust boundaries

| Boundary | Primary threats | Current controls | Remaining work |
|---|---|---|---|
| JSON operation input | schema confusion, stale writes, replay, over-broad authority | runtime envelope checks, capability allowlist, grant check, expected revision, idempotency digest, atomic application | validate directly against shared Draft 2020-12 schemas; richer policy/approval engine |
| Asset import | traversal, executable schemes, oversized files, declared-type spoofing, malicious metadata/codecs, mutable originals, hash collision | basename/control checks, media allowlist, pre-read size limit, byte-signature match, SHA-256 content address, create-once writes, strict `content://sha256/<digest>` refs, normalized FFprobe fields only | quarantine, decompression/resource limits, hostile-codec corpus, proxy worker sandbox |
| SQLite store | partial commits, stale writers, duplicate job claims, invalid lifecycle transitions, tampering, secret persistence | foreign keys, strict tables, immediate transactions, revision predicate, append-only revisions/operation/job-event logs, transactional job claim/completion, transition allowlist, no secret values | at-rest encryption choice, integrity audit, backup/restore, migration rollback drills, multi-worker lease/heartbeat |
| Browser/editor | UI/state divergence, untrusted executable UI, stale review | canonical operations, shared in-process kernel, renderer-neutral JSON state, no dynamic code loading | CSP for packaged shell, accessibility audit, hostile project fuzzing |
| FFmpeg/FFprobe | command injection, path escape, hung process, invalid output | typed render intent, strict content-addressed source refs, approved content/artifact roots, safe output basenames, executable plus argument array, `shell: false`, bounded stderr, partial file, cancellation cleanup, probe-before-register | sandbox/resource budgets, hostile codec corpus, platform-specific worker containment |
| CLI/local adapters | schema confusion, secrets on argv, stdout contamination, path leakage, unauthenticated local callers | Draft 2020-12 input/output validation, explicit internal/public projection, JSON stdin/file input, stable JSON stdout, diagnostics on stderr, path-free media metadata, render/get/cancel parity tests, explicit work/recover/ingest commands, no local server | opaque secret handles, named-pipe/Tauri session authentication, MCP grant mapping |
| Media proxy worker | arbitrary process arguments, path escape, hung codec, invalid proxy, partial registration | fixed typed FFmpeg plan, shell-free spawn, approved work root, 30 s probe/5 min proxy timeouts, partial cleanup, second FFprobe, codec/dimension/duration checks, hash-before-registration | separate-process sandbox policy, CPU/memory budgets, crash containment, hostile corpus |
| External network/publishing | data exfiltration, SSRF, credential leakage, unintended cost | no publishing or remote provider path implemented | egress allowlists, secret broker, consent/cost gates, provider retention records |

## Security invariants proved in this pass

- A malformed envelope is rejected before a handler.
- Missing capability grants and stale revisions reject the operation.
- Reusing an idempotency key with a different payload conflicts.
- A failing operation rolls back the full batch.
- Dry-run planning does not change durable state.
- Traversal names, unsupported executable media, empty imports, mutable sources, invalid hashes, and executable source schemes reject.
- FFmpeg and CLI child processes run without a shell.
- Cancelled renders leave neither final nor partial output.
- Completed video is promoted only after container, codec, dimensions, audio, and duration verification.
- Render requests reject arbitrary paths, non-content-addressed sources, unsafe output names, and unknown presets before enqueue.
- Competing workers cannot claim the same queued job in the tested SQLite transaction model.
- Job events are ordered and persisted; cancellation is idempotent; interrupted work recovers to retry/failure according to its attempt budget.
- A render artifact is inserted only after FFprobe verification and SHA-256 hashing, in the same transaction as job completion.
- Cross-project job reads are denied by the kernel.
- Declared media type must match a supported byte signature before content-addressed storage.
- Public SDK/CLI envelopes and results reject shared-schema violations and incompatible target types before kernel execution.
- Public operation/job/artifact documents exclude internal project snapshots, job ownership fields, and local filesystem paths.
- Failed proxy verification removes worker output and creates no durable media record.
- `npm audit --audit-level=high` reported zero known vulnerabilities on the locked dependency graph.

## Explicit non-claims

The current seed has no secret broker, remote egress, authenticated local IPC, signed native binary, sandboxed/quarantined codec worker, encrypted database, durable multi-host lease protocol, or completed deletion/crypto-erasure workflow. Those surfaces remain **NOT BUILT** and must receive new threat analysis when introduced.
