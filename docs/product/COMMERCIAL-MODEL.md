# Commercial model

**Strategy material, not legal advice.** Take counsel before publishing terms, billing anyone, or shipping a bundled encoder.

Toolshape Studio is source-available under the [Elastic License 2.0](../../LICENSE), sold as a subscription to a hosted product. This records what that means, where the money comes from, and what has to be built for it to be collectable.

---

## 1. Why not Apache 2.0

The project was initially going to be Apache 2.0. It is not, because Apache 2.0 grants exactly the rights the business depends on withholding: anyone may fork the repository and sell a competing hosted Toolshape, and that grant is irrevocable for every version published under it. Relicensing later would only affect future commits — an Apache-2.0 snapshot stays forkable forever.

Business Source License 1.1 was the other candidate. Its defining feature is the Change Date, on which each release converts to an open-source licence. That conversion is what buys BSL its credibility with developers, and it is the one property this project does not want. BSL also has no licence-key protection, which is the clause that makes a subscription enforceable against a self-hosted copy.

ELv2 gives three limitations, and all three are load-bearing here:

| Limitation | What it protects |
|---|---|
| No hosted or managed service providing a substantial set of the features to third parties | The subscription business. Somebody can run Toolshape; they cannot resell it. |
| No moving, changing, disabling or circumventing licence-key functionality, and no removing or obscuring features it protects | Paid tiers. Without this, entitlement checks are a suggestion. |
| No altering, removing or obscuring licensing and copyright notices | Provenance and attribution. |

### What is deliberately still permitted

ELv2 permits **internal production use, free of charge, without limit**. A team may run Toolshape Studio on their own machines and their own servers, point their agent harnesses at it, and ship real work with it, paying nothing.

That is not a loophole to close later. It is the distribution strategy. Toolshape's claim is that an agent harness can operate it as competently as a person, and a harness developer who cannot run it will build against something else. The revenue comes from the things a self-hosted copy does not get — see §3.

### Why source-available at all

Because harnesses execute it. An operator running an autonomous agent against a media tool has a legitimate need to read what that tool will do when instructed, and a defensible record of having been able to. A closed binary asking to be trusted with someone's screen recordings, credentials and output is a harder sell than a readable one, and the audit argument only works if the source is genuinely there to audit.

---

## 2. The enforcement problem, stated plainly

A licence is a legal instrument, not a technical one. It tells you who to sue; it does not stop anybody. Three things follow.

**The licence key must actually gate something.** ELv2's anti-circumvention clause protects "functionality in the software that is protected by the license key". If nothing is protected by a key, the clause protects nothing. The entitlement seam in §4 is what gives that sentence something to bite on.

**The hosted product has to be worth paying for on its merits.** The limitation stops resale, not self-hosting. Anyone determined to avoid the subscription can run it themselves for free and legally. So the paid tier cannot be "the same thing but permitted" — it has to be the things §3 lists, which are genuinely hard to self-provide.

**Enforcement is a business cost.** Detecting a violating hosted service and doing something about it takes attention and money. Price that in rather than assuming the licence works by itself.

---

## 3. What people actually pay for

Ordered by how hard each is for a self-hosted copy to replicate — which is the same as how defensible each is.

### Tier: Free (self-hosted)

Everything in this repository. Local capture, edit, design, render, export. Agent access over MCP, CLI and SDK. No account, no telemetry, no key.

This tier exists to be adopted, not to convert. Treat it as distribution spend.

### Tier: Studio — individual subscription

| What | Why it cannot be self-hosted cheaply |
|---|---|
| Managed project storage and sync | Somebody has to run and back up the store |
| Hosted agent endpoint | A harness reaching Toolshape over the network without the user operating a server |
| Cloud rendering queue | Rendering a long timeline on a laptop competes with the laptop |
| **Media upscaling and definition recovery** | Model weights plus GPU minutes |
| **Resize and reframe at scale** | Cheap locally for one design; the value is a hundred at once against a deadline |
| Transcription and captioning | Provider cost per minute, and the provider decision is still open |
| Template and brand-kit library | Licensed and curated content, not code |

### Tier: Team

Everything above, plus real-time collaboration, shared brand kits, role-based grants over the capability surface, an org-wide activity history, and retention policy. Multi-user coordination is the classic thing nobody wants to operate themselves.

### Tier: Enterprise

Audit export, SSO, policy engine integration, private deployment with a commercial licence that waives the hosted-service limitation, and support terms.

### Consumption, not subscription

GPU-priced work — upscaling, generation, long renders, transcription minutes — sits badly inside a flat subscription, because one heavy user can cost more than a hundred light ones. Meter it. `docs/14-x402-monetization.md` already places these at a paid HTTP resource boundary, which is the right shape; the tiers above should include an allowance and bill overage.

---

## 4. What has to be built

### 4.1 The entitlement seam

Capabilities are already the unit of operation, the unit of authorization and the unit of audit. They should be the unit of entitlement too. An operation envelope already carries `authorization.grant_ids`; a plan is the same idea sourced from billing rather than from a session.

The check belongs in the kernel, beside the existing grant check, for the same reason the grant check lives there: **no adapter may get a looser path.** An entitlement enforced in the UI is enforced for the UI only, and the MCP surface would hand the paid features to anyone with a token.

Refusals must name the tier and be distinguishable from an authorization failure. An agent that cannot tell "you are not allowed" from "this plan does not include it" cannot do anything useful with either.

### 4.2 Accounts and identity

The kernel already separates principal, agent and harness, and already refuses to let a caller assert its own identity — the credential decides. Accounts extend that rather than replacing it: a principal gains an organisation, a plan and a billing state. The existing `SessionRegistry` is the seam.

### 4.3 Licence keys

Signed, offline-verifiable, carrying plan and expiry. Offline-verifiable because a media tool that stops working when the network does is a media tool nobody trusts with a deadline.

### 4.4 The feature roadmap the tiers are selling

Named here because a pricing page describing features that do not exist is the fastest way to lose the first hundred customers.

- **Media resizing** — image and video, aspect-aware, batch. The design pillar's variant reframing already does this for scenes; it does not exist for imported media.
- **Definition upgrade (upscaling)** — model-based super-resolution. Needs a model choice, GPU hosting and an honest quality claim. Nothing in the repo does this today.
- **Photoshop-class image editing** — masking, layer compositing, curves, background removal.
- **CapCut-class editing** — speed ramps, keyframed motion, auto-captions, beat detection.
- **Canva-class design** — templates, brand kits, typography controls, vector drawing.

Each needs the same treatment the export path got: build it, then prove it against the artefact rather than the code.

---

## 5. Two risks worth acting on now

### 5.1 Codec licensing will bite before the licence does

The render path shells out to `ffmpeg` and encodes with **libx264**, which is GPL. Today that is comparatively safe: Toolshape invokes an ffmpeg the user already installed, at arm's length, and does not distribute it.

That changes the moment the Tauri shell bundles an encoder (Milestone 11). Shipping a commercial product with a GPL ffmpeg build is a real problem, and it arrives on a scheduled milestone rather than by surprise. Options, all of which need deciding before bundling rather than after:

- bundle an **LGPL** ffmpeg build with no GPL components, and encode H.264 through hardware encoders or openh264 instead of x264;
- keep requiring a user-installed ffmpeg and never bundle;
- license x264 commercially.

Separately, **H.264 and HEVC patent pools** may want royalties for a commercial encoder regardless of the software licence. That is a different question from the GPL one and is not answered by choosing an LGPL build.

### 5.2 Contributions change who owns this

Accepting outside pull requests without a contributor licence agreement means the project no longer owns all of its code, and cannot relicense, dual-license or sell it without tracking down every contributor. For a project intended to be sold under commercial terms, a CLA or DCO-plus-assignment should be in place **before** the first external contribution is merged, not after.

---

## 6. Where this contradicts older documents

`docs/15-open-source-licensing.md` recommends an Apache-2.0 interoperability layer and staged opening. That recommendation is superseded by this document for the Studio repository. It is kept because its reasoning about irrevocability and contributor strategy is still correct, and correct reasoning that reached a different conclusion is worth being able to re-read.
