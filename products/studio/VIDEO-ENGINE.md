# Video, motion, captions, and audio engine

## Time model

Use integer ticks or rational frame/time values:

```text
Time(value: int64, rate_num: int32, rate_den: int32)
```

Conversions are explicit. Rounding policy is declared per operation. Test NTSC-like rates, variable-frame-rate sources, audio sample rates, and mixed media.

## Core timeline operations

```text
asset.probe
clip.insert
clip.move
clip.split
clip.trim_in / clip.trim_out
clip.remove
clip.ripple_remove
clip.duplicate
clip.set_speed
clip.reverse
clip.freeze_frame
audio.detach
track.create / track.update
transition.set
effect.add / effect.update / effect.remove
keyframe.upsert / keyframe.remove
caption.cue_upsert
timeline.reframe
```

Every operation declares how it affects duration, linked tracks, captions, transcript mapping, markers, keyframes, and transitions.

## Split and trim

A split at time `t` creates two clip identities with lineage to the original, partitions keyframes/effects/caption links, and preserves source ranges.

A trim adjusts source/timeline boundaries without destroying the source asset. Ripple variants explicitly shift downstream clips. Preview returns affected clip count and duration change.

## Speed and time remapping

V1:

- constant speed;
- reverse;
- freeze frame;
- audio policy: preserve pitch where supported or detach/mute with disclosure.

Later:

- variable speed curves;
- optical-flow interpolation providers;
- time remapping with explicit quality/cost.

## Keyframes and easing

Animatable properties:

- position;
- scale;
- rotation;
- opacity;
- crop/focal point;
- mask/effect parameters;
- blur strength;
- text/graphic properties;
- audio gain/pan;
- camera/reframe values.

Interpolation:

- hold/step;
- linear;
- ease in/out/in-out;
- cubic Bézier with bounded handles;
- spring/preset only when deterministic parameters are recorded.

The graph editor manipulates the same curves an agent operation creates. Agents may apply motion presets, but the operator can inspect every keyframe and easing curve.

## Effects, transitions, and blur

P0/P1 effects:

- opacity/fade;
- transform;
- crop/reframe;
- Gaussian/background/region blur;
- colour/basic adjustments;
- shadow/glow where renderer supports consistency;
- blend modes;
- simple masks;
- text/caption animation presets;
- crossfade/dissolve;
- push/slide/zoom transitions;
- speed-ramp support later.

Blur must be explicit about target region and temporal tracking. Provider-backed subject tracking creates a versioned mask track; failure does not silently blur the whole frame.

## Audio

Canonical audio operations:

- gain and mute;
- fade in/out and crossfade curves;
- normalisation/loudness target;
- duck music under speech using detected speech regions;
- denoise/voice enhancement provider;
- detach/replace audio;
- channel mapping;
- clipping/peak and silence diagnostics.

Store automation curves and processing chain. Avoid destructive waveform edits.

Target loudness is a preset/policy, not one universal value; platform and content requirements differ.

## Transcripts and captions

Keep distinct:

- raw transcript;
- edited transcript;
- caption document;
- timeline mapping;
- translation variants.

Caption cue fields:

```text
start/end
text and token timings where available
speaker
language
style reference
emphasis spans
position/safe area
animation preset
confidence and source
```

Editing a caption does not necessarily edit media. Transcript-based media edits are explicit operations with preview.

## Transcript-based editing

Workflow:

```text
transcribe
→ align words/segments to source
→ identify silence/filler/highlights
→ user/agent selects spans
→ preview media removals and ripple impact
→ apply timeline operations
→ update mappings
→ regenerate caption cues
→ verify continuity/duration
```

The agent must show uncertainty around low-confidence alignments. Protected names/quotes can be locked.

## FFmpeg boundary

The media worker receives a validated render plan and builds argument arrays/filter graphs without a shell. It records:

- FFmpeg version;
- build configuration/licence flags;
- hardware encoder/decoder;
- input probe digests;
- filter graph digest;
- output preset;
- logs after redaction.

On cancellation, terminate the process tree, remove incomplete outputs, and never register a success artifact.

## Output verification

Probe output and compare:

- duration tolerance;
- dimensions/aspect;
- frame rate/timebase;
- codec/container;
- audio stream presence/rate/channels;
- subtitle/caption output when requested;
- non-zero frames/audio;
- corruption/decode sample;
- safe-area and caption render checks.
