# Toolshape Voice architecture

## Process model

```text
Tauri UI process
  ↕ authenticated local IPC
Voice daemon
  ├─ session coordinator
  ├─ hotkey/target monitor
  ├─ audio capture
  ├─ ASR/VAD provider clients
  ├─ transformation pipeline
  ├─ insertion coordinator
  ├─ learning/analytics events
  ├─ operation/job kernel adapter
  └─ local MCP/CLI/SDK server

Isolated workers
  ├─ local ASR model
  ├─ optional cloud provider client
  └─ file-transcription worker
```

The daemon owns live microphone sessions so UI and harness clients cannot race for the same capture stream.

## Recommended stack

- Tauri desktop shell;
- Rust for Windows hotkeys, audio, target inspection, insertion, secure worker boundaries, and daemon services;
- TypeScript/React for Hub and overlay UI, application orchestration, schemas, MCP, and SDK;
- SQLite for settings, profile revisions, history metadata, operations, jobs, and analytics events;
- content-addressed local storage for retained audio/transcript artifacts;
- local ASR provider selected through benchmarks, initially evaluating `whisper.cpp`, `faster-whisper` through a worker, and `sherpa-onnx` where its streaming/platform support is advantageous;
- VAD provider interface, with Silero VAD as one candidate.

Do not hard-wire one provider into the domain model.

## Domain objects

```text
VoiceSession
AudioStream
AudioArtifact
Transcript
TranscriptSegment
TransformationPlan
ProtectedSpan
InsertionTarget
InsertionAttempt
DictionaryEntry
Snippet
VoiceProfile
AppProfile
LanguageProfile
CorrectionEvent
InsightSnapshot
Achievement
ProviderBenchmark
```

## Session state

```text
idle
→ armed
→ recording
→ finalising
→ transforming
→ awaiting_preview (optional)
→ inserting
→ completed

any active state
→ cancelled
→ recoverable_failure
→ terminal_failure
```

Transitions are explicit and persisted sufficiently to recover after a crash without retaining prohibited content.

## Transformation pipeline

Prefer pure functions for deterministic stages:

```rust
fn normalize(input: Transcript) -> NormalizedTranscript
fn detect_protected_spans(input: &NormalizedTranscript, context: &TargetContext) -> Vec<ProtectedSpan>
fn apply_dictionary(input: NormalizedTranscript, dictionary: &Dictionary) -> TransformResult
fn resolve_backtracking(input: TransformResult) -> TransformResult
fn format_spoken_commands(input: TransformResult, profile: &VoiceProfile) -> TransformResult
```

A model-backed transform receives protected placeholders and returns a proposal. The validator restores protected values and rejects structural mismatch.

## Provider interfaces

```text
AudioCaptureProvider
VoiceActivityProvider
StreamingTranscriptionProvider
BatchTranscriptionProvider
LanguageDetectionProvider
TextRewriteProvider
TargetInspectionProvider
InsertionProvider
SecureStorageProvider
```

Each provider declares:

- local/remote;
- data retention;
- languages/features;
- streaming/cancellation;
- cost estimator;
- model/version;
- health/benchmark evidence.

## Agent tool surface

Product-specific MCP/SDK capabilities:

1. `voice.capabilities.get`
2. `voice.session.start`
3. `voice.session.stop`
4. `voice.session.cancel`
5. `voice.transcribe.asset`
6. `voice.transcript.get`
7. `voice.transform.preview`
8. `voice.transform.apply`
9. `voice.insertion.inspect_target`
10. `voice.insertion.preview`
11. `voice.insertion.commit`
12. `voice.dictionary.upsert`
13. `voice.snippet.upsert`
14. `voice.profile.select`
15. `voice.analytics.get`

Shared platform tools provide job get/cancel, artifact retrieval, project/profile revisions, approvals, and undo.

Live session start requires microphone permission and a lease. A harness cannot secretly activate recording outside the effective user policy and visible state.

## Resources

```text
toolshape-voice://capabilities
toolshape-voice://sessions/{id}/summary
toolshape-voice://transcripts/{id}/diff
toolshape-voice://profiles/{id}
toolshape-voice://analytics/current
toolshape-voice://diagnostics/target
toolshape-voice://jobs/{id}
```

Project content is not exposed through broad unbounded resources.

## CLI examples

```bash
toolshape voice doctor --json
toolshape voice capabilities --json
toolshape voice session start --mode hold --profile technical --json
toolshape voice transcribe asset interview.wav --language auto --json
toolshape voice transform preview --transcript-id t1 --profile balanced --json
toolshape voice target inspect --json
toolshape voice insert commit --transcript-id t1 --expected-target-digest ... --json
toolshape voice analytics show --period 30d --json
```

## Insertion idempotency

Blind retries can duplicate text. Commit binds to:

- transcript/final-text digest;
- target process/control/window identity;
- target snapshot/focus token where available;
- insertion strategy;
- time window;
- idempotency key.

If confirmation is uncertain, return `verification_limited` and do not auto-retry.
