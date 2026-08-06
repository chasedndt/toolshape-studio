/**
 * Proves the rendered audio is what the timeline says it is.
 *
 * A filter graph that parses is not a mix that works, and the failure this
 * exists to catch is silent by construction: the render used to drop every
 * audio clip after the first, and the output still played. So this renders real
 * material and measures it — how loud, and when.
 */
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { buildAudioGraph } from "@toolshape/studio-render";
import { rational } from "@toolshape/studio-engine";
import type { AudioTrack } from "@toolshape/studio-domain";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAILED: ${message}`);
}

/** Mean volume in dBFS over one window of a file, via ffmpeg's own meter. */
function levelAt(file: string, from: number, to: number): number {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-nostats",
      "-i", file,
      "-af", `atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},volumedetect`,
      "-f", "null", "-",
    ],
    { encoding: "utf8" },
  );
  const match = /mean_volume:\s*(-?[\d.]+) dB/.exec(result.stderr ?? "");
  assert(match, `could not measure ${path.basename(file)} between ${from}s and ${to}s`);
  return Number(match[1]);
}

/**
 * Level of one frequency band, so the music can be measured inside a mix that
 * also contains speech.
 *
 * Measuring the mixed file directly cannot answer "did the music duck", because
 * the voice that caused the ducking is in the same measurement — the mix gets
 * louder while the music gets quieter. The two tones are an octave apart, so a
 * band around the music isolates it.
 */
function bandLevelAt(file: string, from: number, to: number, frequency: number): number {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-nostats",
      "-i", file,
      "-af",
      `atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},bandpass=f=${frequency}:width_type=h:w=40,volumedetect`,
      "-f", "null", "-",
    ],
    { encoding: "utf8" },
  );
  const match = /mean_volume:\s*(-?[\d.]+) dB/.exec(result.stderr ?? "");
  assert(match, `could not measure the ${frequency} Hz band of ${path.basename(file)}`);
  return Number(match[1]);
}

/** Integrated loudness in LUFS, which is what a platform actually reads. */
function loudness(file: string): number {
  const result = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", file, "-af", "ebur128=framelog=quiet", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const match = /I:\s*(-?[\d.]+) LUFS/.exec(result.stderr ?? "");
  assert(match, "could not measure integrated loudness");
  return Number(match[1]);
}

function makeTone(file: string, frequency: number, seconds: number, amplitude: number): void {
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi",
      "-i", `sine=frequency=${frequency}:duration=${seconds}:sample_rate=48000`,
      "-af", `volume=${amplitude}`,
      "-c:a", "pcm_s16le",
      file,
    ],
    { encoding: "utf8" },
  );
  assert(result.status === 0, `could not build test tone: ${result.stderr}`);
}

function render(inputs: string[], graph: { filters: string[]; label: string }, output: string): void {
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  for (const input of inputs) args.push("-i", input);
  args.push("-filter_complex", graph.filters.join(";"), "-map", graph.label, "-c:a", "pcm_s16le", output);
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  assert(result.status === 0, `audio render failed: ${result.stderr?.slice(-700)}`);
}

function track(id: string, clips: AudioTrack["clips"], role?: AudioTrack["role"]): AudioTrack {
  return { id, name: id, kind: "audio", locked: false, clips, ...(role ? { role } : {}) };
}

async function main(): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), "toolshape-audio-mix-"));
  const checks: string[] = [];

  try {
    const voicePath = path.join(root, "voice.wav");
    const musicPath = path.join(root, "music.wav");
    makeTone(voicePath, 440, 12, 0.5);
    makeTone(musicPath, 220, 12, 0.5);

    const indexOf = (assetId: string) => (assetId === "asset-voice" ? 0 : 1);
    const clip = (id: string, start: number, duration: number, assetId: string, audio?: unknown) => ({
      id,
      name: id,
      assetId,
      start: rational(start),
      sourceIn: rational(0),
      duration: rational(duration),
      revision: 0,
      effectIds: [],
      ...(audio ? { audio } : {}),
    });

    // 1. Three clips with a gap between the second and third. If only the first
    //    survived — the old behaviour — the later windows would be silent.
    const spaced = buildAudioGraph({
      tracks: [
        track("track-voice", [
          clip("a", 0, 2, "asset-voice"),
          clip("b", 4, 2, "asset-voice"),
          clip("c", 8, 2, "asset-voice"),
        ] as never),
      ],
      inputIndexFor: indexOf,
      durationSeconds: 10,
    });
    const spacedFile = path.join(root, "spaced.wav");
    render([voicePath, musicPath], spaced, spacedFile);

    assert(spaced.clipCount === 3, `expected three clips in the mix, got ${spaced.clipCount}`);
    // Compared against the source rather than an absolute figure, so the checks
    // describe what the mix did to the material instead of encoding what this
    // particular tone happens to measure.
    const reference = levelAt(voicePath, 0.5, 1.5);
    const first = levelAt(spacedFile, 0.5, 1.5);
    const third = levelAt(spacedFile, 8.5, 9.5);
    assert(first > reference - 6, `first clip should be audible, measured ${first} dB against ${reference} dB`);
    assert(
      third > reference - 6,
      `third clip was dropped: measured ${third} dB where audio was authored, source is ${reference} dB`,
    );
    checks.push("every-clip-reaches-the-mix");

    // 2. And the gap between them really is a gap, so the clips are placed
    //    rather than merely all present at the start.
    const gap = levelAt(spacedFile, 2.5, 3.5);
    assert(gap < reference - 40, `the gap between clips should be silent, measured ${gap} dB`);
    checks.push("clips-land-at-their-start-times");

    // 3. Two clips together are louder than one, which is only true if amix is
    //    not dividing by its input count.
    const single = buildAudioGraph({
      tracks: [track("t", [clip("a", 0, 4, "asset-voice")] as never)],
      inputIndexFor: indexOf,
      durationSeconds: 4,
    });
    const doubled = buildAudioGraph({
      tracks: [
        track("t1", [clip("a", 0, 4, "asset-voice")] as never),
        track("t2", [clip("b", 0, 4, "asset-voice")] as never),
      ],
      inputIndexFor: indexOf,
      durationSeconds: 4,
    });
    const singleFile = path.join(root, "single.wav");
    const doubledFile = path.join(root, "doubled.wav");
    render([voicePath, musicPath], single, singleFile);
    render([voicePath, musicPath], doubled, doubledFile);
    const singleLevel = levelAt(singleFile, 0.5, 3.5);
    const doubledLevel = levelAt(doubledFile, 0.5, 3.5);
    assert(
      doubledLevel > singleLevel + 3,
      `two copies should be louder than one, measured ${singleLevel} dB then ${doubledLevel} dB`,
    );
    checks.push("mix-does-not-divide-by-input-count");

    // 4. A fade out really descends. Comparing the start of the fade with its
    //    end, because a fade that never applied would measure flat.
    const faded = buildAudioGraph({
      tracks: [
        track("t", [
          clip("a", 0, 8, "asset-voice", {
            gainDb: 0,
            muted: false,
            fadeIn: rational(0),
            fadeOut: rational(4),
          }),
        ] as never),
      ],
      inputIndexFor: indexOf,
      durationSeconds: 8,
    });
    const fadedFile = path.join(root, "faded.wav");
    render([voicePath, musicPath], faded, fadedFile);
    const beforeFade = levelAt(fadedFile, 1, 2);
    const insideFade = levelAt(fadedFile, 7, 7.9);
    assert(
      insideFade < beforeFade - 10,
      `fade out should descend, measured ${beforeFade} dB then ${insideFade} dB`,
    );
    checks.push("fades-apply");

    // 5. Loudness normalisation lands near the target it was given. A tolerance
    //    of 2 LU, because single-pass loudnorm predicts rather than measures.
    const normalised = buildAudioGraph({
      tracks: [track("t", [clip("a", 0, 8, "asset-voice")] as never)],
      inputIndexFor: indexOf,
      durationSeconds: 8,
      options: { targetLoudnessLufs: -14 },
    });
    const normalisedFile = path.join(root, "normalised.wav");
    render([voicePath, musicPath], normalised, normalisedFile);
    const measured = loudness(normalisedFile);
    assert(
      Math.abs(measured - -14) <= 2,
      `normalised audio should land near -14 LUFS, measured ${measured}`,
    );
    checks.push("loudness-hits-its-target");

    // 6. Ducking pulls the music down while speech is present and lets it back
    //    up afterwards. The second half matters most: music that never came
    //    back would pass a check that only looked at the ducked window.
    const ducked = buildAudioGraph({
      tracks: [
        track("track-voice", [clip("v", 0, 4, "asset-voice")] as never, "voice"),
        track("track-music", [clip("m", 0, 10, "asset-music")] as never, "music"),
      ],
      inputIndexFor: indexOf,
      durationSeconds: 10,
      options: { duckingDb: 12 },
    });
    assert(ducked.ducked, "graph should report that it ducked");
    const duckedFile = path.join(root, "ducked.wav");
    render([voicePath, musicPath], ducked, duckedFile);

    // Measured on a music-only render, so the comparison isolates the music.
    const musicOnly = buildAudioGraph({
      tracks: [track("track-music", [clip("m", 0, 10, "asset-music")] as never, "music")],
      inputIndexFor: indexOf,
      durationSeconds: 10,
    });
    const musicOnlyFile = path.join(root, "music-only.wav");
    render([voicePath, musicPath], musicOnly, musicOnlyFile);

    const musicAfter = bandLevelAt(duckedFile, 6, 9, 220);
    const musicAloneAfter = bandLevelAt(musicOnlyFile, 6, 9, 220);
    assert(
      Math.abs(musicAfter - musicAloneAfter) < 4,
      `music should return to level once speech stops, measured ${musicAfter} dB against ${musicAloneAfter} dB`,
    );
    checks.push("ducking-releases-after-speech");

    // 7. And it ducked in the first place. Check 6 alone would pass on a graph
    //    that never attenuated anything, which is the more likely failure.
    const musicDuring = bandLevelAt(duckedFile, 1, 3, 220);
    const musicAloneDuring = bandLevelAt(musicOnlyFile, 1, 3, 220);
    assert(
      musicDuring < musicAloneDuring - 3,
      `music should drop under speech, measured ${musicDuring} dB against ${musicAloneDuring} dB unducked`,
    );
    checks.push("ducking-attenuates-under-speech");

    process.stdout.write(`${JSON.stringify({ status: "completed", checks: checks.length, verified: checks })}\n`);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${JSON.stringify({ status: "failed", error: String(error) })}\n`);
  process.exitCode = 1;
});
