# Toolshape dual Codex launch packet

This folder contains the exact files needed to start the two implementation sessions and expand the Discord development control plane.

## Files

| File | Purpose |
|---|---|
| `01-CODEX-SESSION-A-PLATFORM-VOICE.md` | Paste into the Platform + Voice Codex session |
| `02-CODEX-SESSION-B-STUDIO.md` | Paste into the Studio Codex session |
| `03-DISCORD-CONTROL-PLANE-PROMPT.md` | Paste into the Discord control-plane management agent |
| `04-DISCORD-LAUNCH-ANNOUNCEMENT.md` | Human-readable launch message |
| `05-SHARED-WORKSTREAM-PROTOCOL.md` | Ownership, integration and event rules |
| `control-plane-event.schema.json` | Structured event contract for Discord routing |
| `control-plane-event.example.json` | Valid example event |
| `bootstrap-toolshape.ps1` | Copies the handover into a dev repo and creates two worktrees |
| `start-two-codex-sessions.ps1` | Prints paths or starts two Codex CLI windows |
| `run-codex-session.ps1` | Single-session runner used by the launcher |

The full launch-ready handover also contains `START-HERE-DUAL-CODEX.md` at repository root.
