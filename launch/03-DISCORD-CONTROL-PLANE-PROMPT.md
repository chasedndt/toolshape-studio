# Prompt — expand the Discord development control plane for Toolshape

You are the management agent for the existing development Discord control plane on this computer.

Your task is to make the server aware of, and operationally useful for, two parallel Toolshape builds:

1. **Toolshape Voice** — local-first, system-wide voice dictation, transformation, personalisation, analytics and agent control.
2. **Toolshape Studio** — one unified Canva-and-CapCut-class design, image, motion, audio and video creation super app with a professional human editor and a semantic agent control plane.

The supervising architecture is:

```text
ChaseOS
  → harness registry, knowledge, policy, approvals, budgets, schedules and workflow archive
    → Codex / Claude Code / ChatGPT Agents SDK / Chase Agent / other harnesses
      → MCP / SDK / HTTP or local IPC / CLI
        → application policy boundary
          → semantic application kernel
            → revisions, jobs, artifacts, provenance and verification
```

Agent harnesses do the actual planning and tool execution. ChaseOS coordinates and improves their context and governance. The applications remain independently usable without ChaseOS.

## First inspect; then make additive changes

1. Inspect the existing server, categories, channels, roles, permissions, forum support, webhooks, bots, naming conventions and current development-control workflows.
2. Reuse or extend equivalent existing structures instead of creating duplicates.
3. Do not delete, rename, move, archive or change permissions on existing channels without explicit operator approval.
4. Make the smallest coherent additive change that gives both workstreams clear routing, status visibility, decisions, blockers, evals and handoffs.
5. Preserve least privilege. A build agent does not need server-administration rights.
6. Produce a dry-run plan first if the control plane supports preview. Then apply safe additive changes.

## Target server structure

Adapt names to existing conventions while preserving these functions.

### `00 | TOOLSHAPE CONTROL`

- `#toolshape-overview` — canonical mission, architecture, links, current release and pinned launch message.
- `#workstream-ledger` — one continuously updated status message per workstream; avoid progress spam.
- `architecture-decisions` — preferably a forum channel with one thread per ADR.
- `blockers-and-approvals` — preferably a forum channel for operator decisions and genuine blockers.
- `#integration-queue` — platform tag, cross-branch integration, merge gates and conflict status.

### `10 | SHARED PLATFORM`

- `#contracts-kernel` — ANAC/contracts, operation envelope, revisions, idempotency, policy and semantic-kernel changes.
- `#adapters-mcp-sdk-cli` — MCP, SDK, HTTP/IPC, CLI parity and harness compatibility.
- `#security-privacy` — secret handles, redaction, retention, deletion evidence, egress and misuse cases.
- `#jobs-artifacts-provenance` — job lifecycle, artifacts, hashes, audit and verification.

### `20 | TOOLSHAPE VOICE`

- `#voice-build` — runtime/ASR/Windows integration milestones.
- `#voice-ui-ux` — Voice Bar, Hub, analytics, achievements, language and operator experience.
- `#voice-evals` — target matrix, latency, protected tokens, privacy and repeated-run results.
- `#voice-handoffs` — milestone and end-of-session handovers.

### `30 | TOOLSHAPE STUDIO`

- `#studio-build` — scene/timeline/render/style engine milestones.
- `#studio-ui-ux` — canvas, layers, inspector, timeline, captions, agent/review interfaces.
- `#studio-evals` — render verification, editability, state parity, collateral damage and `pass^k`.
- `#studio-handoffs` — milestone and end-of-session handovers.

### `40 | RESEARCH & DELIVERY`

- `research-intake` — preferably a forum channel for papers, official documentation and source notes.
- `#feature-decisions` — 80/20 feature prioritisation and acceptance decisions.
- `#naming-licensing` — naming collision checks, clean-room decisions and dependency licences.
- `#build-artifacts` — non-sensitive builds, screenshots, reports and artifact manifests.
- `#release-validation` — release gates, checksums, known limitations and sign-off.

If the server already has strong equivalents, map these functions into them and publish the mapping instead of duplicating channels.

## Recommended forum tags

Where forum channels exist, create or reuse tags:

```text
platform
voice
studio
security
research
contract-change
needs-decision
blocked
accepted
rejected
superseded
```

## Role and permission model

Adapt existing roles rather than blindly creating new ones.

- **Owner/operator:** full review and approval authority.
- **Control-plane service:** only the channel/webhook/manage permissions required to maintain this structure and pinned status.
- **Build agents/harnesses:** read relevant context and post through scoped webhooks or bot commands; no role management, server administration or unrelated channel access.
- **Reviewers:** read, thread, comment and approve where assigned.
- **Observers:** read-only where permitted.

Secrets, raw credentials, private transcripts, private source media, model/provider tokens and unrestricted filesystem contents must never be posted to Discord.

## Local repository and worktree discovery

Locate the repository and worktrees by searching these default paths first:

```text
%USERPROFILE%\Documents\Projects\toolshape
%USERPROFILE%\Documents\Projects\toolshape-worktrees\voice-platform
%USERPROFILE%\Documents\Projects\toolshape-worktrees\studio
```

If they are elsewhere, discover them by the repository title and Git worktree metadata. Record paths privately in control-plane configuration; do not expose full sensitive local paths in public Discord messages.

Monitor these structured outboxes:

```text
<voice-worktree>/ops/control-plane/outbox/voice-platform/*.json
<studio-worktree>/ops/control-plane/outbox/studio/*.json
```

Validate each item against:

```text
<repo>/launch/control-plane-event.schema.json
```

Deduplicate using `event_id`. Quarantine invalid or secret-bearing events instead of posting them.

## Event routing

| Event type | Discord destination |
|---|---|
| `started`, `milestone`, `progress` | relevant Voice/Studio build channel and update the ledger |
| `test_result` | relevant eval channel |
| `contract_baseline_ready`, `contract_change`, `contract_proposal` | `#contracts-kernel`, ADR forum and integration queue |
| `integration` | `#integration-queue` plus affected product handoff channel |
| `security` | `#security-privacy` |
| `blocker`, `approval_required` | blockers/approvals forum with operator mention only when truly required |
| `artifact` | `#build-artifacts`, using references rather than private payloads |
| `handover` | relevant handoff channel and ledger update |
| `release` | `#release-validation` |

## Message format

Every automated status post should contain only useful evidence:

```text
Workstream
Event type
Verified summary
Branch and short commit SHA
Commands/tests and pass/fail counts
Contract impact: none / compatible / migration required / blocked
Artifacts or report references
Blocker or requested decision
Next executable action
Trace/event ID
```

Do not post raw chain-of-thought, full Codex JSONL traces, entire prompts, massive diffs, secret-bearing logs or guessed completion percentages.

## Pinned operating documents

Create and pin concise messages for:

1. Toolshape architecture and two-product scope.
2. Workstream ownership and branch/worktree map.
3. Definition of done and merge gates.
4. Contract-change/ADR process.
5. Security/redaction rules.
6. Status, blocker and handoff templates.
7. Research-source quality rules: prefer papers and official documentation; date sources and distinguish established standards from preprints.

Use the content in:

```text
README.md
START-HERE-DUAL-CODEX.md
AGENTS.md
docs/02-chaseos-hierarchy.md
docs/03-reference-architecture.md
docs/11-security-secrets-privacy.md
prompts/05-parallel-orchestrator.md
launch/05-SHARED-WORKSTREAM-PROTOCOL.md
```

## Optional control commands

If the existing control plane supports slash commands or equivalent, implement or map:

```text
/toolshape-status
/toolshape-blockers
/toolshape-contracts
/toolshape-handoffs
/toolshape-tests
/toolshape-releases
```

Commands must read structured state; they must not fabricate status from conversational memory.

## Initial posts

After applying or mapping the structure:

1. post the content of `launch/04-DISCORD-LAUNCH-ANNOUNCEMENT.md` in the overview channel;
2. create initial ledger entries for Session A and Session B;
3. pin the ownership map;
4. report every category/channel created, reused or skipped;
5. report permission changes;
6. report event-watcher/webhook configuration and its redaction tests;
7. list any action requiring operator approval.

The result must be an operational control plane, not a decorative channel list.
