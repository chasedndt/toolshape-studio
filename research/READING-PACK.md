# Reading pack and extraction plan

The purpose is not to read everything before coding. Read in decision order, take structured notes, and connect each source to one implementation or evaluation question.

## P0 — read before platform implementation

### 1. MCP Specification 2025-11-25

**Extract:** host/client/server boundaries, capability negotiation, tools/resources/prompts, progress, cancellation, errors, logging, consent, security.  
**Apply:** adapter kit and ANAC-to-MCP export.  
**Source:** `mcp-spec` in `SOURCES.json`.

### 2. Anthropic — Building Effective Agents

**Extract:** workflow versus agent, simple composable patterns, orchestrator-worker, evaluator-optimizer, tool-interface design.  
**Apply:** do not build unnecessary in-product swarms; invest in capability descriptions and verifiers.

### 3. OpenAI Agents guide and Agents SDK

**Extract:** agent/tool/handoff/session/guardrail/tracing primitives and current MCP integration.  
**Apply:** ChaseOS harness adapters and Codex prototypes.

### 4. Domain-Driven Design

**Extract:** ubiquitous language, aggregates, bounded contexts, domain services, repositories.  
**Apply:** semantic kernels and separation of Toolshape Voice/Studio domains.

### 5. Designing Data-Intensive Applications

**Extract:** state, logs, transactions, idempotency, consistency, streams, storage trade-offs.  
**Apply:** revisions, jobs, events, artifacts, sync.

### 6. Building Secure and Reliable Systems

**Extract:** security/reliability co-design, least privilege, failure containment, recovery, operational evidence.  
**Apply:** secret broker, workers, update/render paths.

### 7. OWASP Secrets Management and AI Agent Security Cheat Sheets

**Extract:** dynamic/short-lived secrets, isolation, prompt/tool/memory risks, approvals, replay, denial of wallet.  
**Apply:** security hard invariants and misuse cases.

### 8. OSWorld, AppWorld, and tau-bench

**Extract:** GUI grounding/operational-knowledge gaps, state-based evaluation, collateral damage, pass^k.  
**Apply:** conformance/evaluation design.

### 9. AgentDojo, InjecAgent, and CaMeL

**Extract:** indirect prompt injection, untrusted tool data, control/data separation, capabilities and egress.  
**Apply:** prompt-injection threat model and policy execution boundary.

## P0 — read before Voice implementation

### Microsoft RegisterHotKey, TSF, SendInput, and KEYBDINPUT docs

**Extract:** lifecycle, conflicts, Unicode input, UIPI/integrity limitations.  
**Apply:** Windows target/insertion strategy and honest support matrix.

### Wispr Flow features and current release notes

**Extract:** public outcome baseline: any text field, languages, cleanup, correction, dictionary/snippets/styles, developer context, mic failover, history/recovery, insights/data controls.  
**Apply:** product requirement comparison, not UI/source copying.

### whisper.cpp, faster-whisper, sherpa-onnx, Silero VAD

**Extract:** platforms, licences, streaming/VAD, hardware, model formats, APIs, benchmarks.  
**Apply:** provider benchmark instead of premature lock-in.

## P0 — read before Studio implementation

### Canva Visual Suite and Magic Layers

**Extract:** unified formats, AI in one connected suite, structured/editable output, human refinement.  
**Apply:** one Studio product and editability requirement.

### CapCut editor, captions, and keyframes documentation

**Extract:** core timeline, effects, audio, caption, keyframe, easing, export outcome baseline.  
**Apply:** 21-feature list and engine operations.

### CreatiPoster

**Extract:** JSON/multi-layer editability, user assets, responsive/multilingual/animated designs.  
**Apply:** structured design-plan and headless render architecture.

### DesignPref, DesignSense, TASTE, and ViPer

**Extract:** designer disagreement, personal preferences, multi-dimensional quality, candidate selection, small preference elicitation.  
**Apply:** Style Genome and user-specific ranking rather than one generic aesthetic score.

## P1 — architecture depth

### A Philosophy of Software Design

**Extract:** deep modules, information hiding, interface complexity.  
**Apply:** keep adapters thin and domain modules meaningful.

### API Design Patterns

**Extract:** long-running operations, resource/action modelling, versioning, pagination, idempotency.  
**Apply:** jobs, artifacts, APIs, SDKs.

### Software Architecture: The Hard Parts

**Extract:** coupling, granularity, data ownership, trade-off analysis.  
**Apply:** modular monolith and future service splits.

### Release It!

**Extract:** timeouts, circuit breakers, bulkheads, stability patterns, production failure.  
**Apply:** providers, render workers, hosted services.

### Security Engineering

**Extract:** threat modelling, protocols, human/economic failure, secure systems history.  
**Apply:** approvals, payments, endpoint assumptions.

### JSON Schema, W3C PROV, OpenTelemetry agent semantics

**Extract:** contracts, provenance concepts, trace fields.  
**Apply:** ANAC and observability.

## P1 — product and HCI depth

### Human-Centered AI

**Extract:** high automation plus high human control.  
**Apply:** operator editor, review, interruption, reversal.

### The Design of Everyday Things

**Extract:** visibility, mappings, feedback, constraints, error recovery.  
**Apply:** Voice Bar, Studio controls, approvals.

### Guidelines for Human-AI Interaction

Read the Microsoft Research paper and extract expectation setting, context, correction, feedback, dismissal, and learning patterns. Add the exact source to `SOURCES.json` during the next refresh if the canonical publication page changes.

### Continuous Discovery Habits and INSPIRED

**Extract:** outcome discovery, assumption tests, product evidence, empowered decision-making.  
**Apply:** avoid feature parity as the only product strategy.

## P2 — operations, teams, and scale

### Team Topologies

**Extract:** stream-aligned/platform/enabling boundaries and cognitive load.  
**Apply:** parallel human/agent worktree ownership.

### Designing Machine Learning Systems and AI Engineering

**Extract:** data/model feedback, evaluations, monitoring, latency/cost, model/provider operations.  
**Apply:** ASR/style/ranking/provider systems.

### NIST AI RMF and Zero Trust

**Extract:** governance, risk mapping/measurement/management, explicit resource authorization.  
**Apply:** organization release and audit programme.

### x402 documentation

**Extract:** quote/payment/verification/settlement and idempotency extensions.  
**Apply:** paid remote compute only after local workflows are reliable.

## Note-taking protocol

For each source create a note with:

```text
Three direct facts
Three implications
One disagreement/question
One architecture change considered
One experiment/eval
One quote location without copying excessive text
```

Do not read passively. Link each note to a decision, issue, test, or rejected alternative.
