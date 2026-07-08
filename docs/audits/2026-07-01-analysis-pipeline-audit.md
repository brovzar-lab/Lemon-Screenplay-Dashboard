# The Screenwriter's Journey — V9 Analysis Pipeline Audit

**Date:** 2026-07-01
**Perspective:** A screenwriter's script enters the system. What actually happens to it, and how honest is the verdict that comes out?
**Companion to:** `2026-07-01-audit.md` (app/infrastructure audit)

---

## 1. The Journey of One Script

1. **Upload.** PDF lands in Firebase Storage `ingest-queue/`. A Cloud Function creates a job; the VPS daemon claims it.
2. **Extraction.** The daemon shells out to `parse_screenplay_pdf_v2.py` (⚠️ **not in the repo** — exists only on the VPS). Text is flattened to a plain stream, capped at 195,000 characters (~125–130 pages).
3. **Validation.** Sanity gates: ≥500 words, screenplay markers (`INT.`/`EXT.`/`FADE IN`), quarantine to `bad-formats/` if it fails. TMDB pre-screen skips already-produced films. SHA-256 dedup. (`daemon.py:365–460`)
4. **Triage (optional/bulk).** Haiku cold-read → 1–10 score. Below 6.0 → the script **dies here**; no deep read. (`ingest_v9.py:2149`)
5. **Five readers in parallel** (Sonnet 4.6, temp 0.1, 8K thinking budget, tool-use structured output): Structure (30%), Character (30%), Craft/Scene (15%), Concept (15%), Emotional Resonance (10%). Each has a real methodology (Story Grid, Truby, Weiland, Lyons, BMOC), explicit scope boundaries, and score anchors.
6. **Synthesis roundtable** (16K thinking): reconciles disagreements, applies the Story-vs-Situation gate and 11 false-positive traps, produces verdict (PASS < 5.5 ≤ CONSIDER < 7.5 ≤ RECOMMEND, FILM_NOW ≥ 8.5), executive summary, comps, producer intelligence.
7. **Hybrid promotion.** If Sonnet says RECOMMEND/FILM_NOW, the entire analysis **re-runs on Opus** and the Opus result wins, with provenance recorded. (`ingest_v9.py:2080–2146`)
8. **Arithmetic in code.** Pillar scores and weighted score are computed by the app, not trusted from the model. (`multiPassAnalysis.ts:87–129`)
9. **Write to Firestore** → dashboard.

## 2. What's Genuinely Good (credit where due)

- **Real methodology, not vibes.** The rubrics are legitimate craft frameworks with sub-criteria a human reader would recognize. The first-ten-pages procurement gate mirrors how scripts actually die in the real world.
- **Anti-self-deception machinery.** The 11 false-positive traps (character vacuum, ending mirage, dialogue disguise…) and the Story-vs-Situation cap are exactly the failure modes that fool human readers too. Cross-reader contradiction checks ("voice without soul") are sophisticated.
- **Determinism discipline.** Temperature 0.1 on both paths; score arithmetic done in code; readers forbidden from computing their own pillar scores.
- **Escalation economics.** Haiku triage → Sonnet readers → Opus promotion for contenders is the right cost ladder.
- **Operational hygiene.** Idempotent jobs (content hash), heartbeats, exponential backoff with jitter, bad-format quarantine, TMDB pre-screen.

## 3. Where the Verdict Drifts From the Truth

Ranked by how much each undermines "real insights."

### T1. The score anchors are placeholders — the system has never been taught Lemon's taste
`ingest_v9.py:545–585`: the few-shot calibration anchors are canonical films from public knowledge, with a literal note: *"REPLACE WITH ACTUAL LEMON EVALUATIONS WHEN YOU HAVE THEM."* Every score in the database is anchored to Claude's prior notion of Parasite, not to what Billy considers a 6 vs an 8.

### T2. Producer calibration never reaches production — the "train the AI" panel is a placebo
The CalibrationPanel + feedbackStore build a calibration prompt from producer feedback, and the client pipeline injects it at synthesis. But `grep calibration ingest_v9.py daemon.py` → **zero hits**. Every script analyzed by the daemon (i.e., every normal upload) ignores the calibration profile entirely.

### T3. Page citations can't be trusted
Readers must "cite page numbers for any score ≥ 7," but extraction strips page structure (client: pages joined with `\n\n`, no markers — `pdfParser.ts:60`; daemon parser unauditable). The model infers page numbers from whatever printed numbers survive in the text stream — or guesses. The UI presents these citations as evidence.

### T4. Verdicts are enforced by prompt, not code
`weighted_score` is recomputed in code (good), but the verdict thresholds, the Story-vs-Situation cap, and the trap-score downgrades are *instructions to the synthesis model*. Nothing in code verifies the returned verdict matches the computed score and gates. A synthesis can return RECOMMEND on a 5.4 and nobody catches it.

### T5. Two divergent pipelines judge the same script differently
The daemon path has tool-use schemas, extended thinking, few-shot anchors, scope boundaries, prompt caching, hybrid Opus promotion. The TS client path (`promptClient.v9.ts`) has none of those — plain JSON-in-prose prompts, no thinking, no anchors. Same script, different entry point → different quality of read. This is the V6 "kept in sync manually" problem reborn.

### T6. Scripts over ~130 pages lose Act 3 silently
195K-char truncation means a 140-page script is scored on `ending_payoff` and `climax_delivery` for an ending the readers never saw. The daemon logs a warning; the verdict document carries no visible flag.

### T7. Haiku alone holds the kill switch
In triage mode, a sub-6.0 Haiku score means no deep read, ever. The cheapest model makes the only irreversible decision in the pipeline. Slow-burn scripts and comedies whose engine is voice (not premise) are the likely false negatives — relevant for a 1,000-script backfill where triage will gate most of the spend.

### T8. One rubric for every genre — and the LATAM lens is off by default
Save the Cat beat timing and Weiland percentages are applied to everything. A Mexican theatrical comedy is scored against the same structural expectations as a thriller; there is no comedy-specific signal (comic engine, set pieces, laughs-on-the-page). Default lenses are `['commercial']` only — for Lemon's actual market, `latam` should be on by default.

### T9. Five readers, one brain
The "independent" readers are the same base model with different rubrics. Their errors correlate — a script that flatters Claude's biases flatters all five readers at once. The trap system partially compensates; true diversity (a different model family on 1–2 readers) would compensate better.

### T10. Nobody has measured the error bars
No re-run variance data exists. If the same script scores 7.6 / 6.9 / 7.3 on three runs, a RECOMMEND/CONSIDER boundary at 7.5 is noise, not signal. Cheap to measure (3 runs × 3 known scripts ≈ $10).

## 4. "Make It True" — Recommended Fixes, Ranked by Leverage

1. **Real anchors (T1) + wire calibration into the daemon (T2).** Billy hand-scores 3–5 scripts he knows cold — one FILM_NOW, one CONSIDER, one hard PASS — with per-pillar scores and two sentences of why. Drop them into `FEW_SHOT_ANCHORS`; have the daemon read the calibration profile from Firestore at synthesis. This is the single biggest step from "an AI's taste" to "Lemon's taste." *~1 day + a weekend of Billy reading.*
2. **Verifiable evidence (T3).** Inject `[PAGE n]` markers at extraction (both parsers). Require every citation to include a short verbatim quote; verify quotes with a string search in code and drop citations that don't match. Hallucinated evidence becomes structurally impossible. *~1 day.*
3. **Verdict computed in code (T4).** Apply thresholds, the situation cap, and trap downgrades in code from the structured outputs, exactly like `weighted_score`. The model proposes; the code disposes. *~half a day.*
4. **One pipeline (T5).** Make the daemon the only analysis path (the app already queues through it) or port tool-use/thinking/anchors to the TS client. Delete the weaker twin. *~1 day.*
5. **Truncation honesty (T6).** Store `truncated: true` + pages lost in the analysis doc; show a badge in the UI; exclude truncated `ending_payoff` scores from the weighted score or re-run those scripts chunked. *~half a day.*
6. **Backfill safety net (T7).** For the 1,000-script backfill: only sub-4.0 dies silently; 4.0–5.9 gets a second Haiku read with a different seed prompt, and disagreement ≥2 promotes to full analysis. Weekly digest lists everything triage killed, so a human can skim titles/loglines. *~half a day.*
7. **Genre-aware reading (T8).** Genre detected at triage selects rubric adjustments (comedy: comic-engine sub-criteria replace beat timing); `latam` lens on by default. *~1–2 days.*
8. **Measure variance (T10).** Re-run 3 known scripts 3×; publish the spread in the methodology notes; if borderline verdicts wobble, add best-2-of-3 synthesis voting for scores within 0.4 of a threshold. *~half a day.*
9. **Repo-commit the parser (T5/T3).** `parse_screenplay_pdf_v2.py` must live in git. Right now the most important step in the pipeline is unreproducible if the VPS dies. *~minutes.*
10. **Reader model diversity (T9, optional).** Run Concept + Emotion readers on a different model family; disagreements become signal, not noise.

## 5. Cost Impact of Fixes

Negligible. Items 1–7 are prompt/plumbing changes that add no meaningful tokens. The two-Haiku triage net (~$0.01 extra per borderline script) and variance experiment (~$10 one-time) are the only new spend. The hybrid Opus promotion already concentrates spend on contenders — that design is right.
