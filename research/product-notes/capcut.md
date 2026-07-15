# Public outcome baseline — CapCut

**Sources accessed:** 14 July 2026  
**Primary pages:** `capcut-online-editor`, `capcut-auto-captions`, `capcut-keyframes`

## Publicly documented outcomes

The current editor page describes a timeline workflow with media upload, trim, crop, split, reverse, mirror, audio, text, stickers, effects, transitions, filters, resize, background removal, captions, and configurable export resolution/quality/frame rate/format.

The broader feature navigation includes speech-to-text, text-to-speech, custom voices, voice enhancement, noise reduction, background/image/video tools, and AI generation/editing categories.

The keyframe page describes animation of position, scale, rotation, opacity, shape/colour and speed-curve/graph-editor control in a multitrack editor. Auto-caption documentation supports synchronized, styled captions and language workflows.

## Toolshape implications

1. Studio needs a real multitrack timeline; transcript-only automation is not enough.
2. Split/trim/ripple, keyframes/easing, effects/blur, audio gain/mute/fades/ducking, captions, and export are in the first 21 feature families.
3. The agent interface should manipulate semantic clips/curves/effects rather than timeline coordinates.
4. Model-backed operations must remain provider plugins; core editing must work locally.
5. Export verification and render cancellation are first-class because media work is long-running and failure-prone.
6. Direct human timeline editing remains essential for timing and master touches.

## Clean-room boundary

Do not copy CapCut effects, templates, stock libraries, sounds, UI layout, icons, or product wording. Define original effect schemas, presets, and interaction design.

## Questions to test independently

- What effect/keyframe subset delivers most creator value with deterministic rendering?
- How should transcript edits preserve mappings through ripple operations?
- What local hardware/codec support is viable and licensable?
- Which platform export presets should be built from documented platform requirements rather than competitor defaults?
