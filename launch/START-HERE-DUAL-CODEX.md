# Start here — dual Codex build launch

**Launch model:** two isolated Codex sessions working in parallel against one shared contract.

| Session | Branch/worktree | Ownership |
|---|---|---|
| **A — Platform + Voice** | `work/voice-platform` | shared contracts/kernel/policy/adapters baseline, then Toolshape Voice |
| **B — Studio** | `work/studio` | Toolshape Studio domain, editor, scene/timeline engines, style/quality surface |

The original product categories remain system-wide voice dictation, Canva-class visual creation, and CapCut-class video editing. Toolshape Studio combines the latter two in one editable content super app.

## Recommended folder layout

```text
%USERPROFILE%\Documents\Projects\toolshape-harness-native-handover-v2.1-launch-ready
%USERPROFILE%\Documents\Projects\toolshape
%USERPROFILE%\Documents\Projects\toolshape-worktrees\voice-platform
%USERPROFILE%\Documents\Projects\toolshape-worktrees\studio
```

The Projects folder holds the source handover, working repository, and isolated Git worktrees in separate directories.

## One-time bootstrap on Windows

Open PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
cd "$HOME\Documents\Projects\toolshape-harness-native-handover-v2.1-launch-ready\launch"
.\bootstrap-toolshape.ps1
```

The script:

1. copies the handover into `%USERPROFILE%\Documents\Projects\toolshape`;
2. initializes a Git repository and baseline commit;
3. creates `work/voice-platform` and `work/studio` branches;
4. creates one worktree for each Codex session;
5. installs coordination/outbox files used by the Discord control plane;
6. prints the exact paths and next commands.

It does **not** delete an existing repository unless `-Force` is explicitly supplied.

## Start the two sessions

### Codex desktop / IDE

Open these as two separate local projects or sessions:

```text
%USERPROFILE%\Documents\Projects\toolshape-worktrees\voice-platform
%USERPROFILE%\Documents\Projects\toolshape-worktrees\studio
```

Paste:

- `launch/01-CODEX-SESSION-A-PLATFORM-VOICE.md` into the Voice/Platform session;
- `launch/02-CODEX-SESSION-B-STUDIO.md` into the Studio session.

Keep both running. They have non-overlapping write scopes and a contract-integration protocol.

### Codex CLI

To open two PowerShell windows and start both runs with JSONL traces:

```powershell
cd "$HOME\Documents\Projects\toolshape\launch"
.\start-two-codex-sessions.ps1 -Mode cli
```

The script grants `workspace-write`, not unrestricted host access. Traces are written inside each worktree under `.codex-runs/`.

## Start the Discord control-plane expansion

Paste `launch/03-DISCORD-CONTROL-PLANE-PROMPT.md` into the agent or service that manages the development Discord server. It will inspect existing structure, add or reuse the required Toolshape categories/channels, wire structured event routing, pin operating templates, and post the launch announcement.

The human-ready announcement is also available at `launch/04-DISCORD-LAUNCH-ANNOUNCEMENT.md`.

## Integration rule

Session A publishes the tested shared baseline as the Git tag:

```text
platform-v0.1.0
```

Session B never waits idly for it. It proceeds inside Studio-owned paths using the frozen handover schemas. When the tag appears, Session B integrates it in a dedicated commit, runs adapter/state tests, and reports any contract mismatch through `coordination/proposals/studio/`.

## Control-plane event rule

Each session writes small JSON events to its own outbox:

```text
ops/control-plane/outbox/voice-platform/
ops/control-plane/outbox/studio/
```

Events contain verified outcomes, commits, tests, contract impact, blockers, and artifact references. They must never contain credentials, secret values, private transcripts, private media, raw prompts, or unrestricted local filesystem dumps.
