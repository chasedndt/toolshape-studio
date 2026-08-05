# Pillar feature matrix — category outcome sets

**Date:** 2026-08-05
**Status:** ACTIVE — research input to `products/studio/PRD-V2.md`

## Purpose and clean-room boundary

This document records the **outcome sets** of the three category references Toolshape Studio targets, so that feature planning is grounded in what these categories actually deliver rather than in guesswork.

**What this document is:** a functional capability inventory — what outcomes users get, organised so we can decide what to build, in what order, and how to expose each one as a semantic operation an agent can call.

**What this document is not, and must never become:** a transcription of any competitor's code, UI layout, visual system, wording, iconography, templates, or assets. Per `AGENTS.md`:

> Never copy competitor code, assets, proprietary templates, private prompts, or distinctive branded wording/layout.

Recordly is MIT-licensed and CapCut/Canva are proprietary. **Licence permissiveness does not relax this rule.** Our policy is stricter than MIT: we implement outcomes independently, in our own visual system, with our own naming. If third-party code is ever vendored deliberately, its licence, notices, and attribution must be preserved exactly.

Every row below is expressed as *an outcome a user wants*, deliberately decoupled from how any specific product achieves it.

---

## Pillar A — Capture

Category reference: Recordly / Screen Studio class — screen recorders producing presentation-ready output without a manual editing pass.

| # | Outcome | Studio position | Priority |
|---|---|---|---|
| A1 | Record a full display, a single window, or a region | Core — `studio.capture.start` with declared source | P0 |
| A2 | Record microphone and system audio as separate tracks | Core — separate immutable audio tracks | P0 |
| A3 | Zoom automatically toward where activity is happening | **Differentiator** — derived deterministically from the event track, not from frame vision | P0 |
| A4 | Accept, reject, or author zoom regions manually | Core — zoom plan is authored data, always overridable | P0 |
| A5 | Smooth pan transitions between zoom regions | Core — interpolated from the zoom plan at render | P0 |
| A6 | Smooth cursor motion; make it look animated rather than captured | Core — cursor track is data; smoothing is a render-time transform | P0 |
| A7 | Cursor size control, click-bounce animation, motion blur | Core — cursor styling is a render parameter | P1 |
| A8 | Place the recording in a styled frame — wallpaper, gradient, solid fill, padding, rounded corners, blur, drop shadow | Core — backdrop layer | P0 |
| A9 | Trim on a timeline after recording | Core — capture projects into a timeline scene (`studio.capture.to_scene`) | P0 |
| A10 | Speed-up / slow-down regions | Core — speed as a timeline operation | P1 |
| A11 | Annotations over the recording | Core — reuses the design pillar's layer system | P1 |
| A12 | Clean-loop export — cursor returns to origin for seamless looping | Nice-to-have — derived from cursor track | P2 |
| A13 | MP4 and GIF export with aspect-ratio and quality control | Core — reuses existing render preset system | P0 |
| A14 | Camera overlay (webcam bubble over the screen recording) | Core — not present in the MIT reference; standard in the category | P1 |
| A15 | Save and reopen a recording project | Core — already satisfied by the unified project model | P0 |
| A16 | Redact regions, windows, or keystroke spans | **Differentiator** — required by CAP-3; agent-driven recording makes this mandatory, not optional | P0 |

**Gap we exploit:** every tool in this category is GUI-only. The MIT reference ships **no CLI, no config file, and no API**. An agent's only option today is computer-use. Studio's capture pillar is agent-addressable from the first commit — that is the entire point.

---

## Pillar B — Edit (video)

Category reference: CapCut class — short-form video editing for social output.

| # | Outcome | Studio position | Priority |
|---|---|---|---|
| B1 | Multi-track timeline with video, audio, caption, overlay tracks | Built (Milestone 6) | P0 |
| B2 | Cut, split, trim, ripple delete, reorder, duplicate | Split/trim built; remainder P0 | P0 |
| B3 | Speed adjustment and speed ramping | Planned | P1 |
| B4 | Keyframe animation on transform and effect parameters | Planned | P1 |
| B5 | Transitions — crossfade, motion transitions | Planned | P1 |
| B6 | Filters, colour adjustment, effect stacks | Planned | P1 |
| B7 | Chroma key / background removal on video | Planned — provider-pluggable | P1 |
| B8 | Masking and compositing | Planned | P1 |
| B9 | Auto-captions from speech, styled and timed | Planned — transcript document + caption track | P0 |
| B10 | Caption translation and localisation | Planned | P1 |
| B11 | Transcript-driven editing — cut media by editing text | **Differentiator for agents** — text is the ideal agent editing surface | P0 |
| B12 | Silence and filler-word detection and removal | Planned — deterministic from audio analysis | P1 |
| B13 | Audio: gain, fades, normalisation, loudness target, ducking | Partially built (gain); remainder P1 | P1 |
| B14 | Voice enhancement / denoise | Planned — provider-pluggable | P2 |
| B15 | Text-to-speech voiceover from a script | Planned — provider-pluggable | P2 |
| B16 | Long video → short clip suggestions | Planned — deterministic candidates + model ranking | P1 |
| B17 | "Describe the edit you want, get a polished cut" | **This is the agent surface, not a feature** — see note below | P0 |
| B18 | Large template / transition / effect library | Deliberately **not** matched — see note below | — |
| B19 | 4K export, no watermark, platform presets | Core — render preset system | P0 |

**Note on B17.** The category is converging on natural-language auto-editing embedded as a product feature. Studio's position is structurally different and better: rather than one opaque "AI auto-edit" button, *every* edit is a typed semantic operation, and any harness can compose them into an auto-edit of arbitrary sophistication — previewable, diffable, verifiable, and undoable step by step. We do not need to ship the button; we ship the substrate that makes the button trivial and auditable.

**Note on B18.** Competing on template-library volume (tens of thousands of effects/templates) is a content-acquisition and licensing race, not an engineering one. It is explicitly a non-goal for the current phase (`docs/19-non-goals.md`). We compete on *structural editability and agent operability*, not asset count.

---

## Pillar C — Design (visual)

Category reference: Canva class — template-driven visual design for non-designers.

| # | Outcome | Studio position | Priority |
|---|---|---|---|
| C1 | Layered canvas with frames, groups, ordering, lock, transforms | Planned (families 1–3) | P0 |
| C2 | Typography with styles, hierarchy, overflow diagnostics | Planned (family 4) | P0 |
| C3 | Shapes, vectors, pen/path, masks, boolean ops | Planned (family 5) | P0 |
| C4 | Image editing — crop, adjust, filter, blur, blend modes | Planned (family 6) | P0 |
| C5 | Background removal | Planned — provider-pluggable | P1 |
| C6 | Object removal / eraser | Planned — provider-pluggable | P1 |
| C7 | Generative fill / image extension | Planned — provider-pluggable | P2 |
| C8 | Flat image → editable layers | Planned — high agent value, model-assisted | P2 |
| C9 | Text-to-image generation | Planned — provider-pluggable | P2 |
| C10 | AI copywriting in-canvas | Planned — harness-supplied, not a built-in model | P2 |
| C11 | Layout generation from a brief | Planned — typed plan + preview + diff | P1 |
| C12 | **Resize one design to every platform format** | **Flagship agent workflow** — promoted to top priority in PRD v2 §4 | P0 |
| C13 | Brand kit — colours, fonts, logos, applied automatically | Planned (family 8) — hard/soft rule enforcement | P0 |
| C14 | Template system with editable instances | Planned (family 8) | P0 |
| C15 | Bulk create — bind CSV/JSON rows to a template | **Flagship agent workflow** — pure repetitive precision work | P0 |
| C16 | Charts and data visualisation | Planned | P2 |
| C17 | Approval workflows and brand governance | Planned (family 20) | P1 |
| C18 | Multi-format export — PNG/JPEG/WebP/PDF/SVG | Planned (family 19) | P0 |

**Note on C12 and C15.** These two are where an agent most obviously beats a human, and where verification is fully deterministic (did every variant preserve hierarchy, safe areas, contrast, and text fit? — checkable in code, no model judgement required). They are the strongest early demonstrations of the whole thesis.

---

## Where Studio's differentiation actually lives

Feature-matching all three categories is a losing framing — each has years of accumulated surface area and, in two cases, enormous content libraries. The defensible position is structural:

1. **One project model across all three pillars.** A capture, a video, and a design are the same object type with different populated fields. No competitor spans all three in one semantic model, so no competitor can offer capture → edit → design → variants as a single transaction with a single history.
2. **Semantic operations instead of a GUI.** Every capability is a typed, versioned, schema-validated operation with preview, diff, verification, and undo. Competitors expose pixels and buttons; an agent driving them is screen-scraping.
3. **A real network transport.** None of the three category references exposes an agent-addressable API for its core editing surface. Studio does (Milestone 7).
4. **Deterministic verification.** "The render succeeded" is proven by probing the output, not by a model asserting it. "The variants are correct" is proven by checking hierarchy and safe areas, not by vibes.
5. **Structured capture data.** Cursor, click, window, and keystroke tracks survive as data instead of being flattened into pixels — which makes intelligent, verifiable auto-editing possible at all.

The one-line version: **competitors let a human make content; Studio lets an agent make content, and lets a human take over at any point without losing anything.**

---

## Sources

- [Recordly — recordly.dev](https://recordly.dev/)
- [Recordly repository (DougNix/recordly)](https://github.com/DougNix/recordly)
- [Recordly hands-on review — SHUO Blog](https://blog.shuochen.me/en/articles/recordly/)
- [Recordly — abduzeedo](https://abduzeedo.com/recordly-free-open-source-screen-recorder-auto-zoom)
- [CapCut PC professional video editor](https://www.capcut.com/resource/pc-professional-video-editor)
- [CapCut Desktop review 2026 — BIGVU](https://bigvu.tv/blog/capcut-online-desktop-editor-review/)
- [CapCut PC review 2026 — Atomi Systems](https://atomisystems.com/screencasting/capcut-pc-review-2026-is-free-video-editing-really-worth-your-time/)
- [Best Canva features in 2026 — Jotform](https://www.jotform.com/blog/canva-features/)
- [Canva AI review 2026 — Fastio](https://fast.io/resources/canva-ai-review-2026/)
- [Canva Magic Studio review — AIFlow](https://aiflowreview.com/canva-magic-studio-review/)
