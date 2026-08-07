# Open-source and licensing strategy

> **Superseded for Toolshape Studio.** Studio ships under the Elastic License 2.0;
> see [`product/COMMERCIAL-MODEL.md`](product/COMMERCIAL-MODEL.md) for the decision
> and its reasoning. This document is kept because its analysis of irrevocability
> and contributor strategy still holds, and reasoning that reached a different
> conclusion is worth being able to re-read. Its Apache-2.0 recommendation does not
> apply to this repository.

**This is strategy material, not legal advice.** Obtain counsel before publishing or relicensing.

## The key fact

Publishing code under an open-source licence grants recipients rights under that licence. Releasing a later version under a different licence does not retroactively remove the rights attached to the earlier release.

A project can change the licence of future versions only when it owns or has sufficient rights to relicense all relevant contributions and dependencies. External contributions make this materially harder without an appropriate contributor agreement or ownership structure.

Do not plan “open source now, close it later” as though the first grant can be recalled.

## Recommended staged approach

### Phase 0 — private contract formation

Keep the first implementation private while schemas, product boundaries, security controls, and dependency choices are changing rapidly.

This is not open source and should not be marketed as such.

### Phase 1 — open interoperability layer

After ANAC stabilises, publish under Apache-2.0:

- schemas;
- capability manifests;
- SDK interfaces;
- CLI protocol;
- MCP adapters;
- conformance fixtures;
- example workflows;
- non-sensitive reference kernel.

This encourages ecosystem adoption and provides explicit patent terms.

### Phase 2 — intentional local-core decision

Choose one of these routes:

| Route | Local client/engine | Hosted services | Trade-off |
|---|---|---|---|
| Open-core | MPL-2.0 | Proprietary | File-level improvements remain open while hosted differentiation remains commercial |
| Fully permissive | Apache-2.0 | Proprietary services | Maximum adoption, easiest competitor reuse |
| Dual commercial/copyleft | AGPL/commercial | Proprietary/commercial | Stronger hosted-service reciprocity, higher adoption friction and legal complexity |
| Proprietary initially | Proprietary | Proprietary | Maximum early control, least open-source adoption |

For the current goals, the strongest default is:

> Apache-2.0 interoperability layer; private products during rapid formation; later evaluate MPL-2.0 for the local core; keep hosted sync, collaboration, managed compute, licensed content, and enterprise control proprietary.

## Why MPL-2.0 is a candidate

MPL applies copyleft at the file level. Modified MPL-covered files remain covered when distributed, while larger combined works can contain proprietary files. It does not automatically force a hosted service to publish server modifications merely because users access it over a network.

This may fit a local creative tool better than a fully permissive licence if the goal is to preserve improvements to core files without imposing whole-program copyleft.

## Contributor strategy

Before accepting external code:

- choose DCO, CLA, assignment, or no-contribution policy with counsel;
- document copyright ownership;
- require sign-off and licence compatibility;
- track third-party notices and generated-code provenance;
- prevent model-generated code from silently importing incompatible text;
- keep clean-room records for competitor-category research.

## Dependency and media obligations

Track separately:

- source-code licences;
- model weights and model licences;
- datasets;
- fonts;
- templates;
- icons;
- music and sound effects;
- stock media;
- codecs;
- FFmpeg build configuration;
- platform SDK terms;
- AI provider terms.

A permissive application licence does not make third-party media or model weights permissive.

## Trust rule

Do not make vague “we will unmonetize/open it later” promises. Publish a concrete, reviewable policy only when the team can honour it: scope, licence, release delay, exclusions, and governance.
