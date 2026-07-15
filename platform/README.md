# Shared platform

The shared platform is a contract and infrastructure layer, not a third user-facing product.

## Packages/services to create

```text
packages/contracts            JSON Schemas, generated types, fixtures
packages/kernel               query/command/workflow interfaces
packages/jobs                 durable job model and worker protocol
packages/artifacts            content-addressed artifacts and provenance
packages/policy               grants, risk profiles, approvals, egress rules
packages/secret-client        opaque handle client; no storage implementation
packages/adapter-sdk          TypeScript/Rust/Python SDK surfaces
packages/adapter-mcp          MCP export
packages/adapter-cli          CLI export
packages/adapter-http         local/remote HTTP export
services/secret-broker        isolated secret storage and lease service
apps/reference-kernel         neutral sample domain used by conformance tests
evals/conformance             cross-adapter and cross-harness tests
```

## Platform invariants

- Product-specific domain objects never enter the generic kernel as untyped blobs merely to avoid modelling.
- The shared layer owns mechanics, not voice/design/video rules.
- Products may add domain-specific risk and verification but cannot weaken global security invariants.
- Schemas are versioned independently from implementation packages.
- The reference application proves contracts without forcing product architecture.

## First integration milestone

Build a neutral “workboard” sample with cards and collections. Through UI-less SDK, CLI, HTTP, and MCP it must:

1. inspect a board;
2. preview an atomic batch;
3. reject a stale revision;
4. apply once under idempotency;
5. create a long-running export job;
6. stream progress;
7. cancel a job;
8. verify final state;
9. undo a local mutation;
10. produce redacted provenance.

The neutral sample prevents early voice/studio implementation details from becoming accidental platform law.
