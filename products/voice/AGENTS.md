# Toolshape Voice implementation rules

These instructions add to the root `AGENTS.md`.

1. The primary V1 is live system-wide dictation, not file transcription.
2. Preserve raw audio only under explicit retention; preserve raw transcript according to the selected history mode.
3. Every text transformation emits a token-level or span-level diff.
4. Names, numbers, URLs, emails, paths, commands, code identifiers, casing, and user-marked spans are protected by default.
5. Never insert into a detected password/secret field.
6. Never assume `SendInput` worked; verify where possible and return the exact insertion strategy/result.
7. Keep Windows platform code behind a Rust trait with fake adapters for tests.
8. Keep ASR, VAD, rewrite, and language detection behind provider interfaces.
9. Local-only mode must block content network egress at the worker boundary, not only through a setting flag.
10. Analytics derive from redacted events and do not require retaining raw audio.
11. Correction learning is scoped, confidence-bounded, inspectable, and reversible.
12. The overlay must never obscure critical UI without being movable or hideable.
13. Hotkey conflicts, missing permissions, microphone loss, elevated targets, and unsupported controls must produce actionable diagnostics.
14. Add learning notes for Rust ownership/concurrency, Windows APIs, probability/error analysis, and test design.
