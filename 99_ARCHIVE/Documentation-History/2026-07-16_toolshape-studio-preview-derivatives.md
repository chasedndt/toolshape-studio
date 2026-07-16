# Documentation history: Toolshape Studio preview derivatives

- **Date:** 2026-07-16
- **Runtime:** Codex
- **Session:** `2026-07-16_toolshape-studio-preview-derivatives`
- **Pass type:** implementation, project-schema migration, media worker, product UI, verification, and operating writeback
- **Status:** COMPLETE / VERIFIED PREVIEW-DERIVATIVE SLICE; overall Studio remains PARTIAL

## Historical change

This pass changed Studio preview media from visual simulation into verified source-derived evidence. MP4 ingestion now produces content-addressed thumbnail and waveform PNGs beside the existing editing proxy, records truthful schema-v3 derivative metadata, and exposes the same evidence to the Media, Audio, and timeline experiences through a host resolver.

It also formalized the boundary between canonical content identity and ephemeral UI location. Local paths and browser URLs remain outside project truth, while agents/adapters can inspect derivative kind, digest, dimensions, duration, lineage, toolchain, and readiness.

## Why it mattered

- Operators now see previews that correspond to actual processed media rather than CSS or arithmetic stand-ins.
- Agent-facing asset evidence is bounded and path-safe.
- Silent video behavior is honest and deterministic.
- Project schema migration fixes the prior false assumption that every derivative has an audio/video probe.
- Product-facing UI progress and media/runtime progress land in one verified milestone.

## Surfaces affected

- Studio domain model and migrations;
- FFmpeg media plan, runner, verification, ingestion, content store usage, and SQLite recovery;
- synthetic fixtures and preview resolution;
- Media, Audio, and timeline UI/QA;
- root/app/product architecture/UX/video/plan truth;
- learning, build, activity, daily, and index records.

## Limits retained

This milestone does not claim native desktop content resolution, hostile codec isolation, waveform tile pyramids, deep timeline interaction, accessible media-description conformance, MCP/IPC, signing, publishing, collaboration, or full category parity.

## Links

- [Build log](../../07_LOGS/Build-Logs/2026-07-16-ChaseOS-toolshape-studio-preview-derivatives.md)
- [Daily note](../../07_LOGS/Daily/2026-07-16.md)
- [Agent activity](../../07_LOGS/Agent-Activity/2026-07-16-codex-toolshape-studio-preview-derivatives.md)
- [Milestone plan](../../docs/plans/TOOLSHAPE-STUDIO-PREVIEW-DERIVATIVES.md)
- [ADR 0010](../../docs/adr/0010-content-addressed-preview-derivatives.md)
- [Studio architecture](../../products/studio/ARCHITECTURE.md)
- [Studio UX](../../products/studio/UX.md)

