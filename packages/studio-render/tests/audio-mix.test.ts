import { describe, expect, it } from "vitest";
import type { AudioTrack, Clip } from "@toolshape/studio-domain";
import { rational } from "@toolshape/studio-engine";
import { buildAudioGraph } from "../src";

/**
 * The render used to take the first clip of the first audio track and drop
 * everything else without saying so — the worst shape a render bug can take,
 * because the output plays and only whoever recorded the missing part notices.
 * These lean hardest on that: how many clips reach the mix, and where.
 */

function clip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: "clip-a",
    name: "Clip",
    assetId: "asset-audio",
    start: rational(0),
    sourceIn: rational(0),
    duration: rational(4),
    revision: 0,
    effectIds: [],
    ...overrides,
  };
}

function track(clips: Clip[], overrides: Partial<AudioTrack> = {}): AudioTrack {
  return { id: "track-audio", name: "Audio", kind: "audio", locked: false, clips, ...overrides };
}

function graph(tracks: AudioTrack[], options?: Parameters<typeof buildAudioGraph>[0]["options"]) {
  let next = 0;
  const indices = new Map<string, number>();
  return buildAudioGraph({
    tracks,
    inputIndexFor: (assetId) => {
      if (!indices.has(assetId)) indices.set(assetId, next++);
      return indices.get(assetId)!;
    },
    durationSeconds: 10,
    options,
  });
}

describe("buildAudioGraph", () => {
  it("mixes every clip, not just the first", () => {
    const result = graph([
      track([
        clip({ id: "clip-a" }),
        clip({ id: "clip-b", start: rational(4) }),
        clip({ id: "clip-c", start: rational(8) }),
      ]),
    ]);
    expect(result.clipCount).toBe(3);
    expect(result.filters.join(";")).toContain("amix=inputs=3");
  });

  it("mixes clips from every audio track", () => {
    const result = graph([
      track([clip()], { id: "track-voice" }),
      track([clip({ assetId: "asset-music" })], { id: "track-music", role: "music" }),
    ]);
    expect(result.clipCount).toBe(2);
  });

  it("places a clip at its timeline start, not at zero", () => {
    // The delay comes after the trim resets timestamps; padding first would
    // move the clip by whatever preceded it in the source file instead.
    const result = graph([track([clip({ start: rational(3) })])]);
    const chain = result.filters.find((filter) => filter.includes("atrim"))!;
    expect(chain).toContain("adelay=3000|3000");
    expect(chain.indexOf("asetpts")).toBeLessThan(chain.indexOf("adelay"));
  });

  it("does not divide the mix by its input count", () => {
    // FFmpeg's amix normalises by default, so adding a quiet music bed under a
    // voice halves the voice — the mix gets quieter the more is added to it.
    const result = graph([track([clip({ id: "a" }), clip({ id: "b", start: rational(4) })])]);
    expect(result.filters.join(";")).toContain("normalize=0");
  });

  it("reads the source range the clip asked for", () => {
    const result = graph([track([clip({ sourceIn: rational(5), duration: rational(2) })])]);
    expect(result.filters[0]).toContain("atrim=start=5.000:end=7.000");
  });
});

describe("buildAudioGraph levels", () => {
  it("applies clip gain", () => {
    const result = graph([
      track([clip({ audio: { gainDb: -6, muted: false, fadeIn: rational(0), fadeOut: rational(0) } })]),
    ]);
    expect(result.filters[0]).toContain("volume=-6dB");
  });

  it("silences a muted clip while keeping it in the graph", () => {
    // A muted clip still occupies its span; removing it would let a later clip
    // mix into that silence differently from the way the timeline shows it.
    const result = graph([
      track([clip({ audio: { gainDb: 3, muted: true, fadeIn: rational(0), fadeOut: rational(0) } })]),
    ]);
    expect(result.filters[0]).toContain("volume=0");
    expect(result.filters[0]).not.toContain("volume=3dB");
    expect(result.clipCount).toBe(1);
  });

  it("fades in from the clip start and out to the clip end", () => {
    const result = graph([
      track([
        clip({
          duration: rational(4),
          audio: { gainDb: 0, muted: false, fadeIn: rational(1), fadeOut: rational(2) },
        }),
      ]),
    ]);
    expect(result.filters[0]).toContain("afade=t=in:st=0:d=1.000");
    // 4 - 2 = 2, measured from the clip's own end.
    expect(result.filters[0]).toContain("afade=t=out:st=2.000:d=2.000");
  });

  it("refuses a fade longer than the clip it is on", () => {
    expect(() =>
      graph([
        track([
          clip({ duration: rational(1), audio: { gainDb: 0, muted: false, fadeIn: rational(3), fadeOut: rational(0) } }),
        ]),
      ]),
    ).toThrow(/longer than the clip/i);
  });
});

describe("buildAudioGraph loudness", () => {
  it("normalises to the requested target", () => {
    const result = graph([track([clip()])], { targetLoudnessLufs: -14 });
    expect(result.normalised).toBe(true);
    expect(result.filters.join(";")).toContain("loudnorm=I=-14:TP=-1.5");
  });

  it("leaves levels alone when no target is given", () => {
    const result = graph([track([clip()])]);
    expect(result.normalised).toBe(false);
    expect(result.filters.join(";")).not.toContain("loudnorm");
  });

  it("refuses an implausible target", () => {
    expect(() => graph([track([clip()])], { targetLoudnessLufs: -60 })).toThrow(/between -40 and -5/i);
  });

  it("refuses a true peak ceiling above zero", () => {
    expect(() => graph([track([clip()])], { targetLoudnessLufs: -14, truePeakDb: 3 })).toThrow(
      /true peak/i,
    );
  });
});

describe("buildAudioGraph ducking", () => {
  const both = () => [
    track([clip()], { id: "track-voice", role: "voice" }),
    track([clip({ assetId: "asset-music" })], { id: "track-music", role: "music" }),
  ];

  it("ducks music under speech when asked", () => {
    const result = graph(both(), { duckingDb: 12 });
    expect(result.ducked).toBe(true);
    expect(result.filters.join(";")).toContain("sidechaincompress");
  });

  it("splits the voice so it can key the compressor and still be heard", () => {
    const result = graph(both(), { duckingDb: 12 });
    expect(result.filters.join(";")).toContain("asplit=2");
  });

  it("does not duck without a music track", () => {
    const result = graph([track([clip()], { role: "voice" })], { duckingDb: 12 });
    expect(result.ducked).toBe(false);
  });

  it("does not duck when the amount is zero", () => {
    const result = graph(both(), { duckingDb: 0 });
    expect(result.ducked).toBe(false);
  });

  it("treats an undeclared track as speech", () => {
    // Quiet dialogue is a defect; unducked music is a matter of taste. So the
    // safe default is to leave an unlabelled track alone.
    const result = graph(
      [track([clip()], { id: "track-unlabelled" }), track([clip({ assetId: "m" })], { id: "track-music", role: "music" })],
      { duckingDb: 12 },
    );
    expect(result.ducked).toBe(true);
    expect(result.filters.join(";")).toContain("[avoicekey]");
  });
});

describe("buildAudioGraph with nothing to mix", () => {
  it("produces silence rather than a tone", () => {
    // A generated sound would be content nobody authored.
    const result = graph([]);
    expect(result.clipCount).toBe(0);
    expect(result.filters.join(";")).toContain("anullsrc");
    expect(result.label).toBe("[aout]");
  });

  it("still produces a stream to map", () => {
    // Video with no audio stream at all is reported as corrupt by some players
    // rather than as silent.
    expect(graph([]).label).toBe("[aout]");
  });
});
