# Personalisation, analytics, profiles, and achievements

## Personal dictionary learning

A correction event contains:

```text
raw recognised span
final user-approved span
language
application/context scope
surrounding non-sensitive features
provider/model
confidence
repeat count
```

Candidate rules:

- one correction: retain as a local event, no automatic permanent rule;
- repeated consistent correction: propose dictionary entry;
- exact technical term with clear casing: higher proposal confidence;
- ambiguous common-word substitution: require confirmation;
- app-specific correction: prefer app scope;
- rejected proposal: record anti-evidence and avoid repeated prompting;
- unused/contradicted inferred entries decay; manual entries do not.

The user can inspect why a term was learned and revert it.

## Voice profile

A profile summarises observed preferences:

- languages/regional spelling;
- speech rate range;
- typical session length;
- cleanup acceptance;
- correction/backtracking patterns;
- technical vocabulary domains;
- common snippets;
- active app categories;
- preferred dictation times;
- local/cloud provider choices;
- privacy settings.

Do not infer health, ethnicity, religion, politics, sexuality, legal status, or other sensitive traits. Do not claim a profession as fact based on content.

## Analytics model

### Productivity

- words dictated;
- accepted final characters/words;
- estimated typing-equivalent time saved using a disclosed assumption;
- sessions and active days;
- average/median session length;
- streak heatmap;
- top application categories;
- language distribution.

### Speed

- estimated speech WPM;
- hotkey-to-listening;
- first partial latency;
- final latency;
- insertion latency;
- p50/p95 by provider, language, mic, app.

### Quality

- correction rate;
- immediate undo rate;
- raw restore rate;
- protected-token error rate;
- dictionary/snippet hits;
- failed/retried sessions;
- insertion verification rate;
- per-provider benchmark metrics.

### Privacy and cost

- local versus remote sessions;
- data-egress events;
- retained versus ephemeral sessions;
- provider cost;
- x402/paid usage when introduced;
- deletion failures;
- security incidents.

## Insights

An insight must include:

- observation;
- evidence period and count;
- confidence/uncertainty;
- suggested action;
- expected benefit;
- privacy implication;
- dismiss/disable control.

Example:

> “Across 34 VS Code sessions, 71% of immediate corrections were product names. Adding the five repeated names to your technical dictionary is expected to reduce those corrections. Review entries.”

## Milestones

| Words | Unlock |
|---:|---|
| 2,000 | first transparent Voice Profile |
| 5,000 | app and language comparison |
| 10,000 | correction-pattern report |
| 25,000 | advanced workflow and snippet recommendations |
| 50,000 | long-term quality/latency/time-saved report |
| 100,000 | exportable mastery/year-in-review pack |

## Titles/archetypes

Generate from bounded usage features and phrase them as activity patterns.

Good:

- Technical Builder;
- Rapid Ideator;
- Long-Form Narrator;
- Multilingual Operator;
- Precision Editor;
- Workflow Architect.

Bad:

- diagnosing a personality;
- asserting a job title;
- ranking users socially by private content;
- exposing content-derived titles to teams by default.

A title page shows the contributing metrics and can be disabled.

## Coaching

- suggest dictionary/snippet/profile improvements;
- teach spoken correction patterns;
- explain which insertion strategy failed;
- compare provider trade-offs;
- show the effect of cleanup levels;
- recommend microphone/environment improvements based on measured signal;
- teach agent harness users which semantic tools produce the most reliable outcome.

## Data architecture

Use event aggregation rather than scanning raw transcripts repeatedly. Analytics jobs read redacted event fields. Content-derived analysis requiring raw text is local, opt-in, ephemeral by default, and produces a deletable derived profile.
