# ADR 0004: Shared preview and headless projection

- **Status:** ACCEPTED
- **Date:** 2026-07-15

## Context

A separate preview implementation and export implementation would drift visually. The first slice needs interactive browser QA and deterministic PNG/video evidence before native packaging is available.

## Decision

Define a renderer-neutral scene projection from canonical state. The React editor and a controlled headless Chromium capture path consume that same projection. Video export compiles a typed render plan from the same state and resolved asset set. Golden tests compare projection/state digests and verify decoded artifacts; they do not rely only on screenshot pixel equality.

## Consequences

- The running editor is the primary visual QA surface.
- Headless rendering can be exercised on the current Node/Chromium host.
- Tauri is a packaging and native-boundary layer, not a second domain or renderer.

