# MCP, SDK, HTTP/IPC, CLI, A2A, and computer use

## One kernel, multiple adapters

No adapter is the source of truth. The adapter validates transport concerns, maps to the canonical capability invocation, and maps the result back.

## In-process SDK

Best for trusted product code, extensions, tests, and high-throughput local integration.

- fastest;
- strongly typed;
- easiest transaction and streaming integration;
- language-specific.

## Local IPC or loopback HTTP

Best for the desktop daemon and separate local workers.

- stable process boundary;
- supports multiple clients;
- easy health and job endpoints;
- must authenticate local sessions and defend against cross-origin/loopback abuse.

## CLI

Best for development, debugging, shell composition, CI, reproducible examples, and human power users.

CLI rules:

- structured JSON input/output mode;
- JSONL for streams;
- stable exit codes;
- no prompts in non-interactive mode;
- explicit `--dry-run` and `--expected-revision`;
- read secrets from handles/stdin/OS broker, not command-line arguments;
- print operation/job IDs and verification status.

Not every UI gesture receives a CLI command. Every durable semantic operation does.

## MCP

Best for model/harness discovery and invocation.

Use:

- tools for actions;
- resources for bounded state and schemas;
- prompts only for approved reusable workflows/instructions;
- progress and cancellation as adapters over jobs;
- logging only after redaction;
- capability negotiation for optional features.

Deployment:

- stdio for local desktop/harness use;
- authenticated Streamable HTTP for remote service use.

Keep roughly 12–20 stable product tools. Avoid exposing the entire internal CRUD surface.

## A2A

Use when delegating to an autonomous specialist service that owns a task lifecycle, such as a managed creative-review agent or external research agent.

Do not wrap deterministic renderers, databases, or simple application operations as conversational agents merely to use A2A.

## Computer use

Fallback order:

```text
semantic capability
> SDK/API
> CLI
> accessibility semantics
> visual computer use
```

Use visual automation for legacy applications, unsupported functionality, migration, and last-mile interoperability. Evaluate it with OSWorld/WindowsWorld-style grounding and state checks.

## Capability portability

ANAC defines the application-level meaning above transports. The same capability can be exported as:

```text
MCP tool
SDK method
HTTP endpoint
CLI command
ChaseOS capability record
```

Transport-specific details must not leak into the domain schema unless genuinely required.
