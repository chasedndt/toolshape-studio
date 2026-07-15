# Toolshape Voice privacy modes

## Local-only mode — default target

- audio processed by local worker;
- transcript/transform local;
- content worker network denied;
- no cloud sync;
- local analytics;
- user selects history/audio retention;
- model downloads occur through a separate verified updater path, not during private dictation.

The UI displays a persistent local indicator and a test that proves the worker cannot reach the network.

## Hybrid mode

The user may allow selected remote providers per capability/language/project/app.

Before first use show:

- provider;
- data sent;
- reason;
- retention/training terms available to the product;
- location/processor disclosure where known;
- cost;
- alternative local option;
- whether raw audio or only transformed text leaves the device.

## Sync mode

Separate controls:

- sync dictionary/snippets/settings;
- sync transcript history;
- sync audio;
- allow use for personalisation;
- allow use for shared-model improvement.

Do not bundle storage and training consent.

## Default retention proposal

```text
raw streaming buffers      R0, process lifetime
failed-session temp audio  R1, short recovery TTL
raw audio history          off by default
raw transcript history     configurable, local
final transcript history   configurable, local
operations/provenance      redacted R4
correction/profile data    R3, visible and deletable
aggregate analytics        local; shared only with consent
```

## Sensitive applications

Allow denylist/allowlist by process, window class, workspace, and project. In excluded applications:

- hotkey can show “blocked by privacy rule”;
- no context read;
- no recording;
- no history;
- no agent session.

Password fields are blocked regardless of app profile in V1.

## Delete/export

Provide:

- delete one session;
- delete by date/app/language;
- delete raw audio only;
- delete all history;
- reset personal profile/dictionary;
- export project/profile/settings/audit summaries;
- account/cloud deletion request when hosted;
- deletion report with known remote boundaries.

## Telemetry

Operational telemetry defaults to content-free fields:

```text
event type
version/platform
stage duration
provider/model ID
language code
success/error category
insertion strategy
payload size bucket
privacy mode
```

No transcript snippets, window titles, paths, usernames, or clipboard content in default telemetry.
