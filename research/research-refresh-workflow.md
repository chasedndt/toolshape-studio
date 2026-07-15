# ChaseOS research-refresh workflow

## Purpose

Continuously monitor changes in protocols, Windows APIs, products, papers, dependencies, licences, and security guidance without letting a research agent rewrite production architecture automatically.

## Schedule

- weekly: product release notes, MCP/A2A/OpenAI/Anthropic docs, key dependencies;
- monthly: benchmark/security/design papers, OWASP/NIST guidance, licence/dependency audit;
- before milestone/release: complete source re-verification and decision review.

## Workflow

```text
1. search official/primary sources
2. capture title, URL, date, access time, source type
3. compare with last source digest/note
4. summarise direct changes
5. identify affected decisions, schemas, tests, docs
6. assign confidence and urgency
7. propose—not apply—changes
8. run experiment/evals in isolated branch
9. architecture/security/product review
10. accept, reject, or defer with rationale
```

## Proposal schema

```yaml
proposal_id: research-2026-07-14-mcp-change
source_ids: []
observed_change: ""
direct_evidence: []
affected_components: []
risk: low|medium|high
recommended_action: ""
experiment: ""
eval_gate: ""
privacy_impact: ""
licensing_impact: ""
status: proposed|testing|accepted|rejected|deferred
```

## Guardrails

- no automatic dependency upgrade on a research finding;
- no production schema change without version/migration tests;
- no new remote provider without privacy/security/licence review;
- no source summary treated as authority over the source;
- no copyrighted full-book/paper ingestion into shared archives without rights;
- no hidden use of private user projects for research.

## Archive output

Store dated notes, proposal decisions, experiment code, eval reports, and source links. This becomes evidence for future handovers and the harness-native software book.
