# Public outcome baseline — Wispr Flow

**Sources accessed:** 14 July 2026  
**Primary pages:** `wispr-features`, `wispr-whats-new`, `wispr-privacy` in `../SOURCES.json`

## Publicly documented outcomes

The current feature page describes:

- voice-to-text in any application or website with a text field;
- context-aware spelling for uncommon names;
- 100+ languages and quiet/whisper speech;
- filler removal, punctuation, list formatting, and spoken course corrections;
- a personal dictionary that can learn from corrected spellings;
- voice-triggered snippets;
- app/context-dependent writing styles;
- team dictionaries/snippets and usage dashboards;
- developer-oriented recognition of filenames, syntax, CLI commands, casing, acronyms, and jargon.

Current release notes add useful product lessons:

- reliability and latency need visible, measured attention;
- microphone ranking/failover is a core workflow feature;
- format/cleanup settings can become over-aggressive and need stronger evals;
- recovery/history prevents lost dictation;
- cloud storage/sync and training controls should be separate;
- a movable overlay matters because it can block host-application controls;
- personalisation depends on history and therefore creates an explicit privacy trade-off.

## Toolshape implications

1. System-wide insertion is the primary product loop; file transcription is secondary.
2. Reliability, recovery, microphone routing, and target support are product features, not infrastructure polish.
3. Developer/technical protected tokens deserve a dedicated evaluator.
4. Raw transcript restore and cleanup-level comparison are mandatory.
5. Personal learning needs explicit retention and user control.
6. Insights/achievements can improve motivation, but must be evidence-based and non-sensitive.
7. Toolshape should improve on the category with a genuinely local/offline path and semantic harness capabilities.

## Clean-room boundary

Do not reproduce Flow branding, copy, layout, proprietary prompts/models, animations, or assets. Create original Voice Bar/Hub interaction, schemas, transformations, and analytics.

## Questions to test independently

- Which Windows targets work with each insertion strategy?
- Which local ASR provider gives the best latency/accuracy/hardware trade-off?
- How much context improves names without creating privacy risk?
- What correction threshold improves dictionary accuracy without annoying prompts?
- Which analytics users actually find motivating rather than invasive?
