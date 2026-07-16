# Toolshape Studio architecture

## Unified project model

```text
Project
├─ metadata and revision
├─ assets
│  ├─ original immutable blobs
│  ├─ proxies/thumbnails/waveforms
│  └─ licence/provenance
├─ style profile references
├─ documents/pages/scenes
│  └─ SceneGraph
├─ timelines
│  └─ TimelineGraph
├─ components/templates/data bindings
├─ transcript/caption documents
├─ comments/approvals
├─ export presets
└─ jobs/artifacts/history
```

## Scene graph

Node families:

```text
Group
Frame/Artboard
Text
Image
VideoSurface
AudioVisualiser
Shape
VectorPath
Mask
ComponentInstance
Guide/Grid/SafeArea (non-exporting)
```

Common properties:

- stable ID;
- parent/order;
- local transform matrix;
- size/constraints;
- opacity/blend;
- fills/strokes/effects;
- visibility/lock;
- style/token references;
- accessibility metadata;
- optional temporal/keyframe bindings.

## Timeline graph

```text
Timeline(timebase, duration)
Tracks(video, audio, caption, effect, marker)
Clips(source asset/range, timeline range, speed map)
Transitions
Keyframe curves
Effect instances
Audio automation
Caption cues
Markers and transcript links
```

Use rational time or integer frames/ticks with a declared timebase. Avoid unconstrained floating-point seconds for canonical edit positions.

## Relationship between scene and timeline

A timeline clip can reference a scene/artboard or media asset. A scene node can expose animatable properties bound to timeline keyframe curves. One source of truth owns each property at a given time:

```text
static property
or token/component value
or timeline/keyframe expression
```

The inspector displays the source and override chain.

## Process model

```text
Tauri UI
  ↕ authenticated local IPC
Studio daemon/application services
  ├─ project/revision kernel
  ├─ asset manager
  ├─ scene/layout engine
  ├─ timeline engine
  ├─ style/quality engine
  ├─ job/artifact manager
  ├─ agent adapters
  └─ preview coordinator

Workers
  ├─ image/document headless renderer
  ├─ FFmpeg media worker
  ├─ proxy/waveform worker
  ├─ local AI/model worker
  └─ isolated remote-provider client
```

## Recommended stack

- Tauri + React/TypeScript for desktop UI;
- Rust core for project engine boundaries, geometry/media jobs, native acceleration, and worker supervision;
- renderer abstraction with interactive WebGPU/WebGL/canvas implementation and deterministic headless export implementation;
- Skia or another mature deterministic 2D renderer candidate for raster/PDF-like output, evaluated through fidelity tests;
- FFmpeg as a media probe/render backend behind validated render plans and safe argument arrays;
- OpenTimelineIO as an interchange adapter, not canonical state or render engine;
- SQLite for local metadata/operations/jobs;
- content-addressed asset/proxy/artifact storage;
- optional PostgreSQL/object storage for hosted collaboration.

Do not select a rendering library solely because its UI API is convenient. Persist Studio schemas and use adapters.

## Render pipeline

```text
project revision
→ dependency resolution
→ missing asset/font/effect checks
→ layout and timeline evaluation
→ render plan
→ preview or production worker
→ progress/cancellation
→ output probe
→ quality verification
→ artifact/provenance
```

A render plan is typed data. The worker compiles it to library calls/FFmpeg arguments. Raw shell strings are prohibited.

## Effect system

An effect definition declares:

- ID/version;
- supported node/clip types;
- parameter schema and ranges;
- animatable parameters;
- preview implementation;
- production implementation;
- deterministic status;
- hardware requirements;
- fallback;
- licence and distribution status;
- security/trust level.

V1 effects are built-in and signed. Arbitrary third-party native effect binaries are deferred.

## Importers

Import is a hostile boundary:

- parse in sandboxed worker;
- limit file size, recursion, dimensions, duration, and resource use;
- inspect archives before extraction;
- preserve original immutable asset;
- normalise metadata;
- strip or quarantine active content;
- produce import diagnostics and unsupported-feature list;
- never execute macros/scripts.

**Implementation checkpoint (2026-07-16):** the local MP4 path now checks source size before reading, matches declared `video/mp4` to the byte signature, stores the immutable original by SHA-256, normalizes selected FFprobe fields, generates a bounded H.264/AAC proxy with a fixed shell-free plan, verifies it with a second probe, stores it by digest, and persists path-free schema-v2 asset metadata. Quarantine, codec sandboxing, waveform/thumbnail workers, and broader format coverage remain planned.

## Agent tool surface

Product-specific capabilities:

1. `studio.capabilities.get`
2. `studio.project.create`
3. `studio.project.inspect`
4. `studio.project.plan`
5. `studio.project.preview`
6. `studio.project.apply_operations`
7. `studio.asset.import`
8. `studio.asset.search`
9. `studio.design.create_variants`
10. `studio.style.apply_profile`
11. `studio.video.edit_from_transcript`
12. `studio.caption.generate`
13. `studio.audio.process`
14. `studio.quality.validate`
15. `studio.render.quote`
16. `studio.render.start`
17. `studio.artifact.export`
18. `studio.project.undo`

Shared jobs, resources, approvals, artifacts, and provenance are provided by the platform.

## Tool versus feature count

The 21 user feature families do not map one-to-one to tools. `studio.project.apply_operations` can atomically apply several validated layer, timeline, keyframe, effect, or audio operations. Goal workflows compose these primitives.

## File/package direction

```text
apps/studio-desktop
services/studio-daemon
workers/render-image
workers/render-media
packages/studio-domain
packages/studio-operations
packages/studio-scene
packages/studio-timeline
packages/studio-style
packages/studio-quality
packages/studio-importers
packages/studio-ui
packages/studio-agent
```
