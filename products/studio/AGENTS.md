# Toolshape Studio implementation rules

These instructions add to the root `AGENTS.md`.

1. Studio is one product with one canonical project, asset, scene, timeline, style, history, and artifact model.
2. Preserve structured editability. Do not flatten an agent-generated design into a bitmap when its elements can be represented as nodes.
3. Persist no renderer-library objects, DOM nodes, Canvas objects, FFmpeg command strings, or UI coordinates as canonical state.
4. Use stable IDs and rational frame/timebase values.
5. Scene and timeline operations must be deterministic after all model-backed proposals are converted to typed plans.
6. Interactive preview and headless export render from the same semantic project revision.
7. The human editor is not an afterthought. Keyboard shortcuts, inspectors, canvas/timeline performance, and undo must be designed and tested.
8. Every effect declares parameter schema, deterministic/remote status, GPU/CPU needs, licence, and render support.
9. Model-backed image/video/audio generation is a provider capability and may return paid jobs; it never changes local edit semantics.
10. Style learning is profile/evidence based, opt-in, reversible, and separate from project operations.
11. Dynamic agent interfaces use trusted declarative components, never arbitrary generated executable code.
12. Importers are untrusted input boundaries. Validate, sandbox, and preserve originals.
13. Export workers use safe argument arrays and record exact toolchain/build configuration.
14. Add university learning notes for graphs, matrices, interpolation, probability, testing, concurrency, HCI, and media systems.
