# Toolshape Studio evaluation plan

## Evaluation layers

### Project and operation correctness

- schema round-trip;
- stable IDs;
- expected revision;
- atomic batches;
- idempotency;
- undo/redo and snapshot restore;
- import migration;
- no orphan references;
- no missing provenance.

### Scene/layout

- transform matrix properties;
- group/reparent invariants;
- auto-layout/constraints;
- text measurement/overflow;
- font fallback diagnostics;
- crop/mask bounds;
- responsive variants;
- deterministic headless render;
- pixel/structural regression under pinned toolchain.

### Timeline/media

- split/trim/ripple arithmetic;
- linked audio/video;
- frame/timebase conversion;
- keyframe interpolation/easing;
- transition/effect boundaries;
- caption timing;
- transcript mapping;
- audio fade/ducking/mute;
- render cancellation;
- output probe and corruption checks.

### Creative/style quality

- hard brand/accessibility rules;
- personalised pairwise preference accuracy;
- brief fidelity;
- post-generation edit distance;
- operator selection/rejection rate;
- diversity and duplicate-layout detection;
- typography/hierarchy/colour/motion/caption/audio review by specialists where needed.

### Agent/harness

- semantic capability selection versus GUI fallback;
- plan/diff accuracy;
- correct 12–20 tool surface use;
- stale revision recovery after operator master touches;
- ambiguity resolution;
- pass^k across at least two harness adapters;
- cost/provider policy;
- exact approval for publishing/paid actions;
- final state and collateral damage.

### Security/privacy

- malicious media metadata and archives;
- prompt injection in imported text/captions/templates;
- malicious MCP/effect manifest;
- path traversal/decompression bomb/resource exhaustion;
- secret/provider/publish token leakage;
- cross-project asset access;
- memory/style poisoning;
- denial of wallet;
- deletion and retention report.

### Human UX

- time to perform common direct edits;
- keyboard coverage;
- understanding of agent plan and diff;
- approval burden;
- transition from agent output to manual edit;
- dynamic-interface accessibility;
- recoverability and trust.

## Golden workflows

### A. Social campaign variants

Brief + product assets + style profile → editable 1:1, 4:5, 9:16 designs → quality checks → exports.

### B. Talking-head short

Video → transcript → selected highlights → silence/filler review → captions → music ducking/fades → keyframed reframe → 9:16 render.

### C. E-commerce batch

Template + product data rows + image assets → row validation → generated design variants → failures isolated → export bundle.

### D. Technical lesson

Screen recording + narration → transcript/chapters → callout graphics → captions → audio cleanup → lesson and short derivative.

### E. Human master touch

Agent creates result → operator changes layout/timing/style → revision conflict detected → harness re-inspects → continues without overwriting manual work.

## Metrics

- goal success and collateral mutation;
- `pass^8`;
- operation/tool count;
- semantic tool selection and GUI fallback;
- render success/cancellation/recovery;
- project/render reproducibility;
- hard quality-rule failure;
- edit distance/time after agent result;
- style preference win rate;
- approval correctness;
- cost/latency;
- secret/security incidents.

## Visual regression caveat

Pixel equality can be brittle across GPU/font/platform versions. Pin the production environment and combine perceptual image diffs with structural scene assertions and domain diagnostics.

## Release support matrix

Publish supported:

- import/export formats;
- nodes/effects;
- codecs/hardware paths;
- project sizes;
- platforms;
- local/remote providers;
- known fidelity limitations.

Do not claim full competitor parity based on a feature checklist.
