# Toolshape Voice evaluation plan

## Test categories

### Audio and recognition

- quiet/normal/noisy environments;
- microphone failover;
- whisper/quiet speech;
- accents and regional variants in supported languages;
- long and short sessions;
- interruption and cancellation;
- provider/model regression.

Metrics include WER/CER where reference text exists, named-entity/technical-token accuracy, latency, and failure recovery.

### Transformations

Protected set:

```text
names
phone/account/order numbers
money and percentages
URLs and emails
Windows/Unix paths
CLI commands and flags
camelCase/PascalCase/snake_case/kebab-case
code snippets
model/package/company names
quoted exact text
```

Measure unsupported substitutions, punctuation/list quality, backtracking resolution, and raw restore.

### Windows target matrix

For each target/app/control:

- start/stop hotkey;
- focus retention;
- single/multiline insertion;
- Unicode and emoji;
- 10/100/1,000-word insertion;
- selection replacement where supported;
- undo;
- duplicate retry;
- elevated target;
- password target;
- clipboard manager present;
- application closes mid-session.

### Privacy/security

- local worker egress denied;
- canary secret never persisted;
- password field blocks capture/insertion;
- prompt-injected nearby text cannot invoke a capability;
- context scope cannot expand itself;
- cross-profile/project isolation;
- retention TTL and deletion report;
- crash dump/log redaction.

### Agent/harness

- tool discovery and correct selection;
- no computer use when semantic insertion/transcription tools exist;
- ambiguity resolution for targets/profiles;
- exact approval for sensitive remote provider;
- stale target/focus recovery;
- pass^8 golden workflow through at least two harness adapters;
- same final transcript/diff semantics across CLI/MCP/SDK.

### Human UX

- hotkey setup success;
- state awareness without opening Hub;
- correction and dictionary flow;
- recovery from a failed dictation;
- understanding local versus cloud path;
- accessibility testing;
- approval burden.

## Golden cases

1. Dictate a technical prompt into a browser chat field with product names and camelCase.
2. Dictate a numbered plan into Notepad.
3. Dictate a long paragraph into Word and recover after target loses focus.
4. Use a snippet in a message app.
5. Refuse a password field.
6. Handle an elevated target with copy fallback.
7. Switch microphone mid-session.
8. Run offline with network blocked.
9. Apply and undo a balanced cleanup.
10. Harness transcribes an audio file and returns a timestamped artifact job.

## Release report

Publish the support matrix and measured results. Do not convert internal tests into universal claims such as “works in every app” or “100+ languages” until each support level is defined and tested.
