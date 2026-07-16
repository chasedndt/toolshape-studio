# Studio fixtures

`golden-project.ts` is a deterministic, generated-media-only fixture for the first Studio vertical slice. It contains no customer media or licensed source asset.

`malicious-import.json` is deliberately invalid and exists to prove that executable source references, mutable assets and raw FFmpeg command strings do not enter persisted Studio state.

`previews/` contains deterministic PNG thumbnail and waveform derivatives generated through the documented FFmpeg media boundary from the synthetic golden video fixture. Their real SHA-256 digests are recorded in `golden-project.ts`; the browser seed resolves only those known content references.
