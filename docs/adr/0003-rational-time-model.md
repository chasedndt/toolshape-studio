# ADR 0003: Rational scene and timeline time

- **Status:** ACCEPTED
- **Date:** 2026-07-15

## Context

Floating-point seconds accumulate drift and cannot precisely represent common video frame rates. UI frame rates and media time bases may differ.

## Decision

Represent canonical time as integer `{ numerator, denominator }` values. Require positive denominators, reduce fractions for comparison and hashing, and perform addition/comparison through integer-safe helpers. Store project display frame rate through the same rational type. Seconds and frame labels are derived UI projections only.

## Consequences

- Timeline edits and keyframes are deterministic.
- Importers must translate source time bases at the boundary.
- Render compilers explicitly convert canonical rational time to FFmpeg-compatible values.
