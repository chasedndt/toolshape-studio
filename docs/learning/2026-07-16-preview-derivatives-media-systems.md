# Learning note: preview derivatives as media-system evidence

**Date:** 2026-07-16
**Runtime:** Codex
**Milestone:** Toolshape Studio preview derivatives

## Why previews belong to the media system

A thumbnail or waveform looks like presentation, but it is evidence produced from source media. If React invents it, the operator can see a preview that does not correspond to the imported bytes. Generating it behind the same trusted media boundary as the proxy gives the application one lineage:

```text
immutable source digest
  -> validated FFmpeg plan
  -> bounded worker output
  -> deterministic verification
  -> content digest
  -> derivative record
  -> host-specific URL resolution
```

The UI owns placement and interaction. It does not own decoding, media execution, or derivative identity.

## Canonical identity versus runtime location

Content hashes are stable across machines; paths and blob URLs are not. Canonical state therefore stores `content://sha256/...` while the current host resolves that reference into something the renderer can load. This preserves:

- portable project hashes;
- path privacy in CLI/SDK/agent projections;
- browser/native adapter independence;
- deduplication and cache identity;
- honest provenance and verification.

The resolved URL is disposable. Losing it does not lose the derivative; changing it does not create a project revision.

## Waveform sampling trade-off

The alpha waveform is one fixed-size PNG for the full source duration. It is inexpensive and useful at overview zoom, but it cannot retain detail at every timeline scale. A production timeline should eventually use a multiresolution pyramid:

```text
level 0: whole source overview
level 1: medium buckets
level 2+: fine buckets or tiles loaded near the viewport
```

Each level should declare the time interval represented by each pixel/bucket. Timeline trimming and zoom then select tiles; they do not stretch one image indefinitely.

## Verification limits

Milestone 5 checks that worker PNGs have the PNG signature, IHDR, positive bounded dimensions, expected waveform size, content digest, source lineage, and persisted recovery. This is proportionate for trusted FFmpeg output, but not a hostile image decoder boundary. Future import isolation should add decode sampling, resource budgets, timeout/memory limits, malformed/polyglot fixtures, and sandbox evidence.

## Human and agent value

For humans, the preview improves recognition, timing, and confidence. For agents, the derivative record adds bounded inspectable facts: kind, digest, dimensions, duration, lineage, and readiness. An agent can decide whether preview evidence exists without receiving a private filesystem path or asking computer vision to infer state from timeline pixels.

## HCI observation

Preview fidelity alone is not enough. The interface also needs legible readiness state and honest absence state. Milestone 5 therefore pairs the raster with `DERIVED`, `THUMB`, `WAVE`, sample-rate/channel facts, and icon-only fallbacks for assets with no preview. The UI avoids drawing simulated content that could be mistaken for verified media.

