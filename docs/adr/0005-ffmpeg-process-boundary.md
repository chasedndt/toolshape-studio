# ADR 0005: FFmpeg process boundary

- **Status:** ACCEPTED
- **Date:** 2026-07-15

## Context

FFmpeg is powerful but accepts complex filter syntax and filesystem paths. Shell interpolation would create injection and quoting hazards, and process success alone does not prove a valid artifact.

## Decision

Represent renders as validated typed plans. A single runner maps a plan to an executable and argument array and spawns FFmpeg without a shell. Inputs must be resolved under approved roots or content-addressed storage. Probe required codecs and filters, capture bounded diagnostics, support idempotent cancellation, and verify output through `ffprobe` or image decoding before marking the job complete.

## Consequences

- Raw FFmpeg command strings are forbidden in canonical state and adapter inputs.
- Platform quoting is delegated to the process API.
- Unsupported host capabilities fail early with structured errors.

