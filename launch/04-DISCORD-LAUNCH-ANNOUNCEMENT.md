# Toolshape dual-build programme is live

We are starting two parallel implementation workstreams against one harness-native application contract.

## Session A — Platform + Toolshape Voice

**Branch:** `work/voice-platform`

Owns the first tested shared contracts/kernel/policy/adapters baseline, then builds the Windows local-first dictation golden loop: configurable global hotkey, microphone capture, local ASR, protected-token handling, dictionary/cleanup, target revalidation, Unicode insertion, verification, recoverable history, professional Voice UI, CLI and MCP.

The tested shared baseline will be published as:

```text
platform-v0.1.0
```

## Session B — Toolshape Studio

**Branch:** `work/studio`

Builds one unified design-and-video super app: editable scene graph, asset system, timeline, split/trim/ripple, captions, audio automation, keyframes/easing, blur/effects, style intelligence, professional canvas/timeline UI, semantic previews, verified PNG/MP4 rendering and agent-adapter parity.

Session B proceeds independently inside Studio-owned paths and integrates `platform-v0.1.0` when the tested tag becomes available.

## Shared operating rules

- ChaseOS supervises knowledge, policy, approvals, schedules, budgets and harness coordination.
- Agent harnesses perform the actual planning and tool execution.
- MCP, SDK, HTTP/IPC and CLI are adapters over the same semantic application services.
- The GUI remains first-class for operator review and master touches.
- Natural language proposes; typed operations mutate.
- Writes are revision-aware, idempotent, auditable and recoverable where possible.
- Long-running work is represented as durable jobs.
- Success is verified from final state and collateral-damage checks.
- Secrets are opaque handles and are never posted into prompts, logs, analytics or Discord.
- Public feature references are clean-room outcome references; no competitor code, assets, prompts or distinctive layouts are copied.

Status will be driven by structured events containing commits, tests, contract impact, blockers and artifacts—not guessed percentages.
