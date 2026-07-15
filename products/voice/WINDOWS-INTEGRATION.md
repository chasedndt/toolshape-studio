# Windows system-wide dictation and insertion

## Requirement

The user focuses a text-entry control in a normal Windows application, activates a global hotkey, speaks, and Toolshape Voice inserts the final text into that target.

No single Windows API works perfectly across Win32, WinUI, WPF, Electron, Chromium, Java, terminals, games, elevated processes, remote desktops, and custom-drawn controls. The correct design is a target inspector plus ordered strategies and an explicit support matrix.

## Global hotkeys

Use the Windows global hotkey mechanism for configured combinations and receive the system hotkey event. Requirements:

- detect registration conflicts;
- support hold and toggle semantics;
- suppress repeat where appropriate;
- maintain per-device/profile mappings;
- provide an in-app test;
- never intercept secure attention sequences or reserved shortcuts;
- allow a low-level hook only when a capability cannot be met by registered hotkeys, with strict review and minimal scope.

## Target descriptor

At session start and before insertion capture:

```text
foreground process ID and executable identity
window handle and title after redaction
control handle/automation element when available
control role and editable/read-only state
password/secure-field flags
process integrity level
supported accessibility patterns
selected-text metadata where approved
focus generation/token
```

Revalidate before commit. If focus changed, request confirmation or use the new configured policy; never type into a new target silently after a long transform.

## Strategy order

### 1. Native text-service path — long-term, deepest integration

Investigate a signed Text Services Framework text service/input processor for TSF-aware applications. This can provide a first-class input-method path and language integration but is a substantial Windows component with signing, lifecycle, compatibility, and accessibility implications. Build it after the simpler golden loop proves value unless tests show it is essential for key targets.

### 2. UI Automation semantic set — supported simple controls

For editable controls that expose a writable value pattern, set or replace text through the semantic accessibility interface under policy. Preserve selection behaviour only where the control exposes a safe, tested method.

Limitations:

- many rich editors do not expose a writable value;
- setting the full value can disrupt undo or selection;
- elevated/higher-integrity targets can be inaccessible;
- custom controls vary.

### 3. Unicode keyboard synthesis

Use Unicode keyboard input events against the foreground target for normal controls. This approximates user typing and often preserves native editor behaviour.

Limitations:

- User Interface Privilege Isolation blocks injection into higher-integrity processes;
- focus races can direct text incorrectly;
- some apps intercept or transform input;
- verification may be limited;
- large text should be chunked carefully.

### 4. Clipboard paste fallback

Place text on the clipboard, trigger paste, and restore prior clipboard state only when it can be done safely and predictably.

Risks:

- clipboard managers and other processes may observe content;
- restoring complex clipboard formats is difficult;
- application paste rules may alter content;
- secret-bearing text should use a stricter policy or copy-only mode.

Show a privacy warning and provide “copy only” when insertion cannot be trusted.

### 5. Scratchpad/copy-only

Always preserve the result in Toolshape Scratchpad/history according to retention and offer copy/manual placement.

## Password and secure fields

- refuse recording-context capture and insertion by default;
- do not store transcript/history;
- never offer model rewrite;
- display a clear blocked state;
- optional user override should be treated as a future high-risk feature and is not part of V1.

## Elevated targets

A normal process cannot inject reliably into higher-integrity applications due to UIPI. Do not silently elevate the entire application.

Options:

- return an actionable error and copy fallback;
- offer a separately signed, minimal elevated helper only after threat review;
- require explicit per-use/user setting;
- strictly scope IPC, target process, text digest, expiry, and audit;
- never grant the helper broad secret or filesystem access.

## Terminals and code editors

Technical mode must preserve:

- camelCase, PascalCase, snake_case, kebab-case;
- file paths;
- CLI flags;
- punctuation and operators;
- line breaks and indentation commands;
- acronyms and product names;
- code fences in prompt/chat fields.

Do not claim full code dictation until language/editor-specific evals exist.

## Initial target matrix

Test at minimum:

- Windows Notepad;
- a Chromium browser text input and rich editor;
- VS Code/Cursor-style Electron editor and chat field;
- Microsoft Word or comparable rich editor;
- Slack/Discord-style Electron message field;
- Windows Terminal/PowerShell;
- one Java application;
- one elevated application negative case;
- password field negative case;
- remote desktop documented limitation.

For each record supported strategy, selection behaviour, undo behaviour, Unicode, multiline, large text, focus race, verification, and known limitations.

## Verification

Preferred:

- re-read value/selection through accessibility when allowed;
- compare expected text digest or inserted span;
- observe native text-change event;
- otherwise return `verification_limited`.

Never infer success solely because the input API returned without an error.
