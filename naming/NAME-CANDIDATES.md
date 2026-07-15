# Naming candidates and decision rubric

## Current working model

Use the following names only inside the private implementation programme:

- **Toolshape** — shared platform and contract workspace;
- **Toolshape Voice** — system-wide voice product;
- **Toolshape Studio** — unified design/video content product.

They are provisional. Product architecture must not depend on them.

## What the final names need to communicate

### Umbrella/platform

The name should suggest semantic tools, creation, control, orchestration or craft without implying that ChaseOS is required.

### Voice product

The name should work for dictation, transformation, personal language learning and system-wide insertion. Avoid names that sound limited to meeting transcription or note-taking.

### Studio product

The name should cover design, video, motion, audio, brand systems, publishing assets and future content formats. Avoid names that imply only static graphics or only reels.

## Scoring rubric

Score every candidate from 0–5 on each dimension:

| Dimension | Question |
|---|---|
| Distinctiveness | Is it memorable and legally more defensible than a generic description? |
| Category range | Can it stretch across the intended product without becoming misleading? |
| Pronunciation | Can users say and dictate it reliably? |
| Searchability | Will exact-name searches produce a clean result set? |
| Developer fit | Does it work as a repository, package scope, CLI and MCP server name? |
| International fit | Does it avoid harmful or absurd meanings in target languages? |
| Visual identity | Can it support an original wordmark and icon system? |
| Availability | Are legal, domain, package and app-store checks promising? |
| Portfolio fit | Does the family naming remain coherent? |
| Longevity | Will it still fit when the product expands? |

A candidate must score at least 40/50 and receive legal clearance before adoption.

## Candidate-generation directions

Generate names from these territories rather than minor misspellings of competitors:

1. **Craft + control** — the operator directs high-quality output while agents do the labour.
2. **Structured creation** — editable scenes, timelines and semantic operations.
3. **Flow + precision** — fast execution without surrendering control.
4. **Studio intelligence** — personal style, learning and reusable workflows.
5. **Voice as authorship** — speech transformed into deliberate written expression.

Do not use a candidate merely because an exact GitHub repository is absent. Run the clearance workflow in `COLLISION-SCAN.md`.

## Rejected working names

- **Voquill** — exact active GitHub collision.
- **SceneWeave / SceneWeaver** — crowded exact and near-exact GitHub usage.
- **Glyphloom** — no longer maps to a unified design/video product.
- **Reelwright** — no longer maps to the combined Studio architecture.

## Rename-safe implementation rule

Use stable internal identifiers such as:

```text
com.toolshape.voice          # temporary reverse-DNS namespace
voice.session.start          # durable capability ID
studio.timeline.split_clip   # durable capability ID
@toolshape/contracts         # temporary private package scope
```

Before public release, migrate display names and package scopes through one reviewed mapping. Do not encode public brand strings into project file formats, database primary keys or cryptographic identifiers.
