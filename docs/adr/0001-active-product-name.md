# ADR 0001: Active product name

- **Status:** ACCEPTED
- **Date:** 2026-07-15

## Context

The newer master archive uses `Tool Shape Studio` and `tool-shape-studio`. The direct deep-build prompt for this repository explicitly selects `Toolshape Studio` and `toolshape-studio`, while allowing Canva and CapCut names only in research citations and outcome comparisons.

## Decision

Use **Toolshape Studio** in active product UI and repository implementation, `toolshape-studio` for package/CLI identifiers, and `toolshape-studio://` for future resource URIs. Treat the master archive as historical/reference material and retain its exact names only when quoting or linking its source documents.

## Consequences

- New code and active implementation docs use the direct-prompt name.
- Existing handover documents are not broadly rewritten in this pass.
- Public trademark, package, domain, and app-store clearance remains required.

