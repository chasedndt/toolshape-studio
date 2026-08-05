# Positioning

**Date:** 2026-08-05
**Status:** ACTIVE — canonical product language

The words we use publicly, and the reasoning behind them. Anything written for a README, a landing page, a repo description, or a demo should be consistent with this document.

---

## The one-liner

> **Studio-quality content, produced by agents, finished by you.**

Supporting line:

> Screen recording, video editing and visual design in one project — the first content studio an AI agent can operate as competently as a person.

---

## Who this is for

**Content creators and marketers who work in screen capture.** Concretely: people shipping product demos, feature announcements, tutorials, onboarding walkthroughs, launch videos, social clips, and the platform variants of all of the above.

The defining trait of this audience is not that they lack skill. It is that **the work is repetitive and the volume is relentless.** Record the demo. Cut the dead air. Zoom in on the click. Add captions. Apply the brand. Export for four platforms at three aspect ratios. Do it again next week for the next feature.

Every step there is precise, rule-governed, and verifiable — which is exactly the shape of work an agent should be doing, and exactly the work these tools currently force a human to do by hand.

---

## The three pillars

One project model. A recording, a video and a design are the same object with different fields populated, which is why an agent that can operate one can operate all three.

### Capture — record a demo that stays editable

Record a display, a window, a region, or a camera. What comes out is **not a flat video file** — it is a document that still knows what happened:

- **Automatic zoom** that follows the action, derived from where you actually clicked
- **Smooth cursor motion** with click emphasis and motion blur, so the pointer looks animated rather than captured
- **Styled backdrops** — gradients, solid fills, wallpapers, padding, rounded corners, drop shadows
- **Crop and reframe** to any aspect ratio, with the zoom plan reflowing to match
- **Camera overlay** as a bubble that follows the activity
- **Speed regions** to accelerate the boring parts and slow the important ones
- **Redaction** to mask a window, a region, or a span of keystrokes
- **Annotations** drawn from the same layer system the design pillar uses

Every one of those is adjustable *after* recording, because none of it was ever baked into the pixels. Change the zoom next week without re-recording.

### Edit — cut it like a real editor

A multi-track timeline with frame-accurate control: split, trim, move, reorder, ripple delete, duplicate, speed ramp. Transitions and a keyframable effect stack. Auto-captions with styling and timing. Audio with gain, fades, normalisation and ducking. **Transcript-driven editing** — delete a sentence in the text and the video cuts with it.

### Design — brand it and ship it everywhere

Layered canvas, typography, shapes and masks, image adjustment. Brand kits that apply colours, fonts and logos with hard and soft rules. Templates and reusable components. And the payoff: **one source becomes every platform format**, with hierarchy, safe areas, contrast and text fit preserved — and *checked*, not hoped for.

---

## What makes it different

Four claims, in descending order of how hard they are to copy.

**1. An agent can actually operate it.**
Not "it has AI features." Every capability is a typed operation an agent calls directly over a standard protocol — no screenshots, no clicking, no guessing. A harness discovers the whole surface at runtime and drives it. Competitors expose buttons; driving them means screen-scraping.

**2. Recordings stay semantic.**
Cursor paths, clicks, window focus and keystrokes survive as structured data instead of being flattened into a raster. An agent asked to *"zoom on every click in the settings panel"* answers that by reading the event log. Against a flat video the same request needs frame-by-frame vision inference and cannot be verified.

**3. Three tools, one project, one history.**
Capture, edit and design share a single model, so a recording becomes a video becomes a design becomes twelve platform variants — one transaction, one revision history, one undo stack. No exporting between apps and losing everything on the way.

**4. It tells you the truth.**
A finished render means the output file was probed and matched. Correct variants means hierarchy and safe areas were checked in code. Never a model asserting that something looks right.

---

## What we deliberately do not claim

Credibility is the asset. These stay out of the copy:

- **Not the biggest template library.** Tens of thousands of templates is a content-licensing race, not an engineering one. We compete on structural editability and agent operability.
- **Not a one-click "AI auto-edit" button.** We ship the substrate that makes such a button trivial *and auditable* — every step previewable, diffable, undoable. That is a better product and an honest one.
- **Not a replacement for a professional NLE, DAW or Illustrator.** Different job.
- **Not autonomous publishing.** No egress path exists, deliberately.
- **Nothing about capabilities that are not built.** The [threat model](../security/THREAT-MODEL.md) lists unbuilt surfaces as explicit non-claims. Marketing copy inherits that discipline.

---

## Language guide

| Prefer | Avoid | Why |
|---|---|---|
| studio-quality, production-grade, presentation-ready, polished | *beautiful*, *stunning*, *magical* | Subjective adjectives read as filler; the concrete ones make a checkable promise |
| an agent can operate it | AI-powered, AI-driven | Everything claims AI. Ours is a structural claim, so say the structure |
| verified, probed, checked | seamless, effortless, intelligent | We can prove the first set |
| stays editable | non-destructive | Plainer, and the benefit is immediate |
| the recording knows what happened | semantic capture document | Internal precision, external clarity |
| one project, one history | unified workflow | Concrete beats abstract |

**On the word "beautiful":** it is the category's default word and it says nothing a competitor could not also say. *"Raw capture in, polished demo out"* makes the same promise and describes an actual transformation. When a stronger word is needed, reach for **production-grade** or **presentation-ready** — both imply a standard rather than a taste.

---

## Elevator versions

**Five seconds**
> Studio-quality content, produced by agents, finished by you.

**Thirty seconds**
> Toolshape Studio is a content studio for creators and marketers who work in screen capture. Record a product demo and it stays editable — automatic zoom that follows your clicks, smooth cursor motion, styled backdrops, crop to any format. Cut it on a real timeline, brand it, and ship every platform variant. And because every capability is a typed operation rather than a button, an AI agent can do all of it for you and hand you something to review.

**Two minutes**
> Making content is repetitive precision work. Record the demo, cut the dead air, zoom on the click, add captions, apply the brand, export for four platforms. Every step is rule-governed and verifiable — exactly what an agent should do, and exactly what today's tools force a person to do by hand, because they are built for a mouse.
>
> Toolshape Studio inverts that. The semantic operation surface *is* the product; the interface is one way to reach it. A human dragging a trim handle and an agent making an API call submit the identical operation, through the identical validation, into the identical history. So an agent can capture, cut, caption, brand and export end to end — and you can take over at any point without losing anything.
>
> Recordings stay semantic: cursor paths, clicks and window focus survive as data, not pixels, so "zoom on every click in the settings panel" is a query rather than a guess. Capture, video and design share one project, so a recording becomes twelve platform variants in one history with one undo stack. And when it says a render finished, the file was probed — not vibes.
