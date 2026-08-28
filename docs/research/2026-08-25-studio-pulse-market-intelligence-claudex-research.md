# Intelligence Briefing Market Research

**Research date:** 2026-08-25  
**Scope:** Mexico-first executive intelligence for Lemon Studios, with US Latino, Latin America, Spain, and global context  
**Status:** Phase 0 research input for Claudex planning. This document does not authorize implementation or publication.

## Executive conclusion

The Intelligence Briefing should become a three-level decision system rather than a collection of market charts:

1. **Decide:** a one-screen executive briefing that says what changed, which decisions need attention, why now, what contradicts the recommendation, and what Lemon should do next.
2. **Understand:** a Zeitgeist and context layer that keeps Reddit, X, and search conversation visibly separate from verified national, trade, buyer, and observed-outcome evidence.
3. **Audit:** evidence health and a decision-and-prediction ledger that expose provenance, staleness, contradictions, knowledge limits, and past forecast performance.

The homepage should recommend a decision and show what could make that recommendation wrong. Creative quality remains Lemon's existing screenplay score. Market timing is a separate, evidence-backed input and must never rewrite the creative score or verdict.

## Intelligence ownership boundary

Audience Ninja is the governing analytical standard for the Intelligence Briefing. It controls how audience demand, market timing, social and search signals, buyer fit, territory differences, uncertainty, alternative explanations, and recommendations are evaluated and presented.

Audience Ninja has no authority over screenplay analysis, formal coverage, creative scoring, PASS decisions, or screenplay rewriting. Those remain in Lemon's existing screenplay-analysis system. The Intelligence Briefing may read approved creative scores for the Portfolio Opportunity Map, but it cannot alter them.

## What the first screen must answer

The first viewport should answer these questions in order:

1. What materially changed since the last brief?
2. What needs Billy's decision?
3. Does the evidence suggest Advance, Watch, Acquire, or Dismiss?
4. What is the strongest support and strongest contradiction?
5. How current, direct, independent, and territory-specific is the evidence?
6. What is the smallest next action or test that could reverse the recommendation?

This supports a simple information architecture:

- Situation bar: territory, as-of date, observation window, freshness, and coverage gaps.
- Three Moves: the highest-value Advance, Investigate or Acquire, and Watch or Dismiss actions.
- Mexico Now and Open Buyer Doors.
- Zeitgeist + News and Trades.
- Portfolio Opportunity Map plus an accessible decision table.
- Evidence Health + Decision and Prediction Ledger.

## Responsible Zeitgeist model

Do not create a single zeitgeist score. Use three visible evidence lanes:

1. **Conversation:** search, X, Reddit where commercially licensed, and other public discussion. This can reveal attention, language, communities, questions, fandom, controversy, or possible unmet demand.
2. **Verified context:** official statistics, regulator data, original reporting, entertainment trades, platform disclosures, campaign or release events, and credible buyer information.
3. **Observed outcomes:** admissions, disclosed viewing, sales, watchlists, survey results, trailer completion, or Lemon first-party tests.

Conversation is a clue, not proof of national sentiment, viewing intent, buyer demand, or commercial value. Google Trends is relative, sampled search interest, not a poll. X public metrics can mix organic and promoted activity. Reddit's current developer terms restrict commercial use without permission, so automated Reddit ingestion must remain **licensing pending** until Lemon has a valid agreement.

Every consequential signal should include:

- the territory and audience scope;
- observation window and last refresh;
- exact source families and query method;
- a signal class such as awareness, controversy, fandom, unmet demand, viewing intent, marketing amplification, or observed consumption;
- what the evidence does not establish;
- at least two alternative explanations;
- contradictions and missing evidence;
- a confidence label: Confirmed, Strong inference, Speculation, or Unknown-Proprietary;
- the next evidence that could confirm or reverse it.

Mexico is the default decision territory. Spanish-language conversation alone must never be labeled Mexican, US Latino, or pan-Latin American. Mexico, US Latino, individual Latin American countries, Spain, Brazil, and global context need explicit geography and separate denominators.

## Portfolio Opportunity Map

Use a two-axis scatterplot as an orientation tool, not an automated verdict:

- **X-axis:** Lemon's existing creative-quality score.
- **Y-axis:** market timing from the reviewed weekly research artifact.
- **Quadrants:** Advance now, Develop patiently, Market-led opportunity, and Low priority.
- **Color and label:** executive disposition, never color alone.
- **Uncertainty:** a restrained range or confidence halo when supported.
- **Selected project:** thesis, strongest contradiction, evidence health, and next action.
- **Acquisition gaps:** a separate list of unfilled portfolio needs, not invented projects or unsupported market-value bubbles.

The map must be paired with a sortable table and a plain-language takeaway. On mobile, the ranked list is primary and the dense map is secondary.

## Evidence health

Do not publish one blended evidence score. Show a small set of inspectable dimensions:

- Directness: does the evidence measure the claim?
- Provenance: who created it and by what method?
- Independence: how many genuinely separate evidence chains support it?
- Coverage: which territory, audience, platform, query, and denominator are represented?
- Freshness: is it current for that source's natural publication cadence?
- Contradiction: what credible evidence disagrees?
- Knowledge limits: what requires private platform, buyer, retention, or economics data?

At summary level, show the weakest dimension, the strongest contradiction, and any stale or missing required channel. The evidence drawer should preserve the trace:

`claim -> source -> date -> geography -> source type -> independence group -> supports or contradicts -> limitation -> analyst note`

## Decision and Prediction Ledger

The user-facing name should emphasize learning, not predictive magic. Every forecast should be timestamped and append-only, with:

- exact statement;
- probability or bounded range where appropriate;
- date issued and evaluation date;
- resolution rule and authoritative outcome source;
- territory, segment, and decision owner;
- frozen evidence snapshot;
- revisions with reasons;
- outcome: correct, incorrect, partially resolved, inconclusive, unresolved, or invalidated;
- scoring only after human-approved resolution.

Binary forecasts can use a Brier score internally. The executive UI should show calibration bands, performance by forecast type and horizon, unresolved forecasts separately, and a minimum-sample warning. It must not claim calibration or predictive accuracy before enough comparable forecasts have resolved.

## Paperclip workflow recommendation

The smallest safe first release is a weekly Paperclip routine that creates one assigned research issue. The research analyst produces:

- `lemon-intelligence-YYYY-Www.candidate.json`
- `lemon-intelligence-YYYY-Www-evidence.md`

The analyst does not receive private screenplay titles, loglines, reports, or scores; does not write application code; and cannot write to Firebase or production. The candidate goes through structural validation and human evidence review. Only the approved JSON is copied into the dashboard repository and released through the normal reviewed application workflow.

Recommended routine behavior:

- Monday morning in `America/Mexico_City`;
- coalesce if a prior weekly run is still active;
- skip historical backfill;
- immutable week ID and artifact SHA-256 for duplicate rejection;
- public or properly licensed sources only;
- aggregate social observations with no usernames, profiles, private messages, or unnecessary raw text;
- bilingual `es-MX` and `en` display copy;
- issue ends in `in_review`, not `done`.

Direct authenticated ingestion is a later option only after several reviewed weekly artifacts prove the contract stable. Research and publication should remain separate even then.

## Minimum candidate contract

The reviewed JSON should use schema version 2 and contain:

- snapshot identity, week, as-of time, timezone, status, generated time, and artifact hash;
- a source ledger with source type, original-language title, URL, publisher, dates, territory, independence group, and expiry;
- bilingual claims with confidence, supporting evidence, and contradicting evidence;
- zeitgeist stories with conversation evidence, verified context, direction, interpretation, two alternative explanations, and recommended action;
- portfolio opportunities with deterministic fit criteria, market-timing range, confidence, acquisition-gap state, and relevant claims;
- decision proposals with evidence and reversal conditions;
- append-only prediction proposals and resolutions.

Contract rules:

- Paperclip supplies market timing and acquisition-gap evidence. Lemon joins creative scores locally.
- Conversation-only items can only be Watch.
- Actionable Zeitgeist items require conversation plus verified industry or national context.
- All evidence references must resolve and syndicated copies share an independence group.
- Missing connectors or evidence produce explicit `connectorUnavailable` or `insufficientEvidence` states, never invented values.
- Forecast accuracy is computed only from human-approved comparable resolutions.

## Evidence freshness

Use source-specific review dates:

- social and search current pulse: observe daily, stale after 72 hours;
- news and trades: refresh daily, preserve correction history;
- weekly platform charts: current until the next expected edition plus a grace period;
- annual INEGI, IFT, and IMCINE data: current until the next scheduled edition plus 90 days;
- rights, executives, buyer mandates, and availability: reverify before every decision.

## Validation gates

1. **Structural:** JSON parse, schema version, unique IDs, valid dates and ranges, all references resolve, bilingual parity, no credentials or private screenplay data.
2. **Evidence:** human review of top claims, contradictions, source independence, translations, alternatives, reversal conditions, privacy, and licensing.
3. **Publication:** record approved snapshot ID and SHA-256, copy only the reviewed artifact, run deterministic parser and UI tests, then use the normal release process.
4. **Ledger:** decision proposals and forecast resolutions become canonical only after explicit human approval.

## Deliberate first-release limits

- No direct Paperclip-to-Firebase bridge.
- No new backend or dependency.
- No numeric evidence-health score.
- No automated creative decision or score mutation.
- No Reddit automation until commercial permission is confirmed.
- No accuracy claim until a sufficiently comparable history exists.
- No editable decision ledger in the first UI release; render the reviewed snapshot data first.

These limits keep the first release reversible and auditable while proving whether the intelligence briefing changes real project decisions.

## Sources

- [Microsoft dashboard design guidance](https://learn.microsoft.com/en-us/power-bi/create-reports/service-dashboards-design-tips)
- [Microsoft accessible report guidance](https://learn.microsoft.com/en-in/power-bi/create-reports/desktop-accessibility-creating-reports)
- [GOV.UK status tags](https://design-system.service.gov.uk/components/tag/)
- [GOV.UK details and progressive disclosure](https://design-system.service.gov.uk/components/details/)
- [W3C PROV overview](https://www.w3.org/TR/prov-overview/)
- [W3C PROV-O](https://www.w3.org/TR/prov-o/)
- [NIST Four Principles of Explainable AI](https://www.nist.gov/publications/four-principles-explainable-artificial-intelligence)
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- [Google Trends FAQ](https://support.google.com/trends/answer/4365533?hl=en)
- [Google Trends term and topic guidance](https://support.google.com/trends/answer/17309543)
- [X metrics documentation](https://docs.x.com/x-api/fundamentals/metrics)
- [X search documentation](https://docs.x.com/x-api/posts/search/introduction)
- [Reddit Developer Terms](https://redditinc.com/policies/developer-terms)
- [INEGI ENDUTIH 2024](https://www.inegi.org.mx/rnm/index.php/catalog/1102)
- [IFT ENCCA 2024](https://www.ift.org.mx/sites/default/files/comunicacion-y-medios/comunicados-ift/comunicado120ift_0.pdf)
- [IMCINE Statistical Yearbook](https://anuario.imcine.gob.mx/anuario)
- [Netflix Top 10 methodology](https://about.netflix.com/en/news/top-10-things-about-netflix-top-10)
- [Journalism Trust Initiative](https://journalismtrustinitiative.org/jti-the-standard/)
- [International Fact-Checking Network principles](https://poynter.org/wp-content/uploads/2025/06/ifcn-cop-june-2025-final.pdf)
- [Media Cloud deduplication method](https://www.mediacloud.org/blog/tech-brief-how-we-deduplicate-content)
- [GDELT DOC 2.0](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)
- [OECD social-media measurement limits](https://www.oecd.org/content/dam/oecd/en/publications/reports/2026/04/towards-measuring-social-capital-for-place-transformation_7f10e416/d5f18ab6-en.pdf)
- [Good Judgment science of superforecasting](https://goodjudgment.com/about/the-science-of-superforecasting/)
- [Proper scoring rules](https://doi.org/10.1198/016214506000001437)
- [Paperclip routines API](https://github.com/paperclipai/paperclip/blob/d866ff374e816730b60960d021fa98b20e80e5d3/docs/api/routines.md)
- [Paperclip issue documents and review interactions](https://github.com/paperclipai/paperclip/blob/d866ff374e816730b60960d021fa98b20e80e5d3/docs/api/issues.md)
