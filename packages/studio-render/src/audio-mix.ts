import type { AudioTrack, Clip } from "@toolshape/studio-domain";
import { toSeconds } from "@toolshape/studio-engine";

/**
 * Builds the audio side of a render.
 *
 * The render used to take the first clip of the first audio track and drop
 * everything else without saying so. A second music bed, a second voice take,
 * anything on a second track — all authored, all silently discarded. That is
 * the worst shape a render bug can take: the output plays, so nothing looks
 * broken, and the missing content is only noticed by whoever recorded it.
 *
 * So every clip is placed at its own start time and mixed. On top of that sit
 * the three things a person hears immediately and a timeline cannot express on
 * its own: fades, a consistent loudness, and music that gets out of the way of
 * speech.
 */

export interface AudioMixOptions {
  /**
   * Integrated loudness target in LUFS, or null to leave levels alone.
   *
   * -14 is where the streaming platforms land, so a video mastered to it is
   * not turned down on arrival. Null exists for the caller who has already
   * mastered elsewhere and would be having it done twice.
   */
  targetLoudnessLufs?: number | null;
  /** True peak ceiling in dBTP. Below zero, because sample peak is not true peak. */
  truePeakDb?: number;
  /** How far music drops under speech. 0 disables ducking. */
  duckingDb?: number;
}

export interface AudioGraph {
  filters: string[];
  /** The label to map, always present — silence still needs a stream. */
  label: string;
  clipCount: number;
  ducked: boolean;
  normalised: boolean;
}

export class AudioMixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AudioMixError";
  }
}

function seconds(value: number): string {
  return value.toFixed(3);
}

/**
 * One clip, trimmed from its source and placed where the timeline puts it.
 *
 * Placement is `adelay` rather than a silent pad, because the delay is applied
 * after the trim resets timestamps — padding first would move the clip by the
 * length of whatever came before it in the source file rather than by its
 * position on the timeline.
 */
function clipChain(clip: Clip, inputIndex: number, label: string): string {
  const start = toSeconds(clip.start);
  const duration = toSeconds(clip.duration);
  const sourceIn = toSeconds(clip.sourceIn);
  if (duration <= 0) throw new AudioMixError(`Audio clip ${clip.id} has no duration.`);
  if (start < 0) throw new AudioMixError(`Audio clip ${clip.id} starts before the timeline.`);

  const stages = [
    `atrim=start=${seconds(sourceIn)}:end=${seconds(sourceIn + duration)}`,
    "asetpts=PTS-STARTPTS",
    "aresample=48000",
    "aformat=sample_fmts=fltp:channel_layouts=stereo",
  ];

  const settings = clip.audio;
  if (settings?.muted) {
    // Kept in the graph rather than dropped. A muted clip still occupies its
    // span, and removing it would let a later clip mix into that silence
    // differently from the way the timeline shows it.
    stages.push("volume=0");
  } else if (settings && settings.gainDb !== 0) {
    stages.push(`volume=${settings.gainDb}dB`);
  }

  if (settings && !settings.muted) {
    const fadeIn = toSeconds(settings.fadeIn);
    const fadeOut = toSeconds(settings.fadeOut);
    if (fadeIn > 0) {
      if (fadeIn > duration) {
        throw new AudioMixError(`Fade in on clip ${clip.id} is longer than the clip.`);
      }
      stages.push(`afade=t=in:st=0:d=${seconds(fadeIn)}`);
    }
    if (fadeOut > 0) {
      if (fadeOut > duration) {
        throw new AudioMixError(`Fade out on clip ${clip.id} is longer than the clip.`);
      }
      // Measured from the clip's own end, which is why the trim has to have
      // reset the timestamps first.
      stages.push(`afade=t=out:st=${seconds(duration - fadeOut)}:d=${seconds(fadeOut)}`);
    }
  }

  if (start > 0) {
    const ms = Math.round(start * 1000);
    stages.push(`adelay=${ms}|${ms}`);
  }

  return `[${inputIndex}:a]${stages.join(",")}[${label}]`;
}

/**
 * Mixes a set of prepared clip labels down to one.
 *
 * `normalize=0` is the whole point. FFmpeg's amix divides by the number of
 * inputs by default, so adding a quiet music bed under a voice halves the
 * voice — the mix gets quieter the more is added to it, which is the opposite
 * of what anyone laying down a second track expects.
 */
function mix(labels: string[], out: string, filters: string[]): string {
  if (labels.length === 0) return out;
  if (labels.length === 1) {
    filters.push(`[${labels[0]}]anull[${out}]`);
    return out;
  }
  filters.push(
    `${labels.map((label) => `[${label}]`).join("")}amix=inputs=${labels.length}:duration=longest:normalize=0:dropout_transition=0[${out}]`,
  );
  return out;
}

export interface BuildAudioGraphInput {
  tracks: readonly AudioTrack[];
  /** Resolves an asset to its ffmpeg input index, adding an input if needed. */
  inputIndexFor: (assetId: string) => number;
  durationSeconds: number;
  options?: AudioMixOptions;
}

export function buildAudioGraph(input: BuildAudioGraphInput): AudioGraph {
  const filters: string[] = [];
  const options = input.options ?? {};
  const duckingDb = options.duckingDb ?? 0;

  // Grouped by role so music can be treated differently from speech. A track
  // with no declared role is treated as speech, because leaving it unducked is
  // the safe mistake: quiet dialogue is a defect, unducked music is a taste.
  const voiceLabels: string[] = [];
  const musicLabels: string[] = [];
  let clipCount = 0;

  for (const [trackIndex, track] of input.tracks.entries()) {
    for (const [clipIndex, clip] of track.clips.entries()) {
      const label = `a${trackIndex}_${clipIndex}`;
      filters.push(clipChain(clip, input.inputIndexFor(clip.assetId), label));
      (track.role === "music" ? musicLabels : voiceLabels).push(label);
      clipCount += 1;
    }
  }

  if (clipCount === 0) {
    // Silence, not a tone. A generated sound would be content nobody authored.
    filters.push("anullsrc=channel_layout=stereo:sample_rate=48000[aout]");
    return { filters, label: "[aout]", clipCount: 0, ducked: false, normalised: false };
  }

  let current: string;
  let ducked = false;

  if (musicLabels.length > 0 && voiceLabels.length > 0 && duckingDb > 0) {
    const voice = mix(voiceLabels, "avoice", filters);
    const music = mix(musicLabels, "amusic", filters);
    // The voice is needed twice: once as the sidechain key and once in the
    // final mix. Splitting is the only way to read a stream twice.
    filters.push(`[${voice}]asplit=2[avoicemix][avoicekeyraw]`);
    // The key is padded to the full render length. sidechaincompress stops
    // producing output as soon as either input ends, so an unpadded key would
    // cut the music dead at the end of the last line of speech — the music
    // would duck correctly and then simply disappear.
    filters.push(
      `[avoicekeyraw]apad=whole_dur=${seconds(input.durationSeconds)},atrim=start=0:end=${seconds(input.durationSeconds)}[avoicekey]`,
    );
    // Ratio derived from the requested attenuation rather than fixed, so
    // "duck by 12 dB" means that, instead of meaning whatever a hardcoded
    // ratio happened to produce against this material.
    //
    // The threshold sits low, around -40 dBFS. A compressor only attenuates by
    // (key level - threshold) x (1 - 1/ratio), so a threshold near the key
    // level leaves the ratio nothing to work with and the music barely moves.
    // Attenuation still depends on how loud the speech is, which is inherent
    // to ducking with a compressor; the low threshold is what keeps quiet
    // narration from failing to duck at all.
    const ratio = Math.min(20, Math.max(1.5, duckingDb / 2));
    filters.push(
      `[${music}][avoicekey]sidechaincompress=threshold=0.01:ratio=${ratio.toFixed(2)}:attack=20:release=400:makeup=1[aducked]`,
    );
    filters.push(`[avoicemix][aducked]amix=inputs=2:duration=longest:normalize=0:dropout_transition=0[amixed]`);
    current = "amixed";
    ducked = true;
  } else {
    current = mix([...voiceLabels, ...musicLabels], "amixed", filters);
  }

  // Trimmed and padded to the render's own length. Without the pad a mix that
  // ends early leaves the last frames of video with no audio stream at all,
  // which some players report as a corrupt file rather than as silence.
  //
  // The pad is given an explicit length rather than left to run until the trim
  // stops it: an unbounded apad downstream of amix never yields, and the render
  // hangs instead of failing. The trim stays as the ceiling for a mix that runs
  // past the video.
  filters.push(
    `[${current}]apad=whole_dur=${seconds(input.durationSeconds)},atrim=start=0:end=${seconds(input.durationSeconds)},asetpts=PTS-STARTPTS[apadded]`,
  );
  current = "apadded";

  const target = options.targetLoudnessLufs;
  let normalised = false;
  if (target !== null && target !== undefined) {
    if (target > -5 || target < -40) {
      throw new AudioMixError("Loudness target must be between -40 and -5 LUFS.");
    }
    const truePeak = options.truePeakDb ?? -1.5;
    if (truePeak > 0) throw new AudioMixError("True peak ceiling must not exceed 0 dBTP.");
    // Single pass, so the measurement and the correction happen together. Two
    // passes would be more accurate, but would mean decoding the whole mix
    // before the render could start, and the render is the thing being waited
    // on.
    filters.push(`[${current}]loudnorm=I=${target}:TP=${truePeak}:LRA=11[aout]`);
    normalised = true;
  } else {
    filters.push(`[${current}]anull[aout]`);
  }

  return { filters, label: "[aout]", clipCount, ducked, normalised };
}
