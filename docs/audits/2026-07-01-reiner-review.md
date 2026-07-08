# Development-Executive Review of the V9 Pipeline Audit

**Reviewer persona:** Marcus Reiner — veteran screenwriter, former studio head of development (22 yrs, LATAM co-production experience), CS background.
**Reviewing:** `2026-07-01-analysis-pipeline-audit.md` + the V9 engine code (verified independently against `execution/ingest_v9.py`, `src/lib/promptClient.v9.ts`, `src/lib/multiPassAnalysis.ts`, `src/lib/pdfParser.ts`, `daemon.py`).
**Post-review note:** the `critical_failure_penalty` bug claimed in Part 1 #2 was independently re-verified in code by the main session (prompt instructs penalty at `ingest_v9.py:1328`; schema field at `:1469`; pure-sum override at `:2024–2060` discards it). CONFIRMED.

---

## Opening take

This is the most serious automated coverage system I've seen, and I've seen a lot of vibes-with-a-rubric dressed up as "AI analysis." The frameworks are real, the scope discipline between readers is real, and the anti-self-deception machinery (the traps, the Story-vs-Situation gate, cross-reader contradiction checks) is genuinely how a good story department thinks. But it has one disqualifying problem for a greenlight tool: **the verdict is written by the model, not computed by the code.** You verify the arithmetic and then let the AI hand-wave the thing that actually matters — PASS/CONSIDER/RECOMMEND/FILM_NOW. And the whole apparatus has never once been shown a script that *Billy* scored, so it's calibrated to Claude's memory of Parasite, not to Lemon's slate. Would I trust a FILM_NOW from this today? No. Would I trust it to sort 1,000 scripts into "read this weekend" vs "skip"? With three specific fixes, yes — and that triage sort is where the actual money is.

---

## PART 1 — METHODOLOGY AUDIT (ranked by what matters)

### 1. The weights are defensible, but the 30/30 split flatters Claude's blind spot
`READER_WEIGHTS` (promptClient.v9.ts:44-50, ingest_v9.py mirror): Structure 30 / Character 30 / Craft 15 / Concept 15 / Emotion 10.

Moving Structure down from 40 to 30 was the right call and the comment even says why — it was acting as a proxy for "overall quality." Good instinct. Character at 30 is correct; audiences remember people, not act breaks. My problem is **Emotion at 10.** For a comedy-heavy Mexican theatrical slate, the thing you're actually buying is whether an audience in a Cinépolis on a Friday night *feels* something — laughs, cries, leans in. You've weighted the one reader closest to box-office reality the lowest, and you've weighted Structure — the thing an LLM finds easiest to fake-detect by pattern-matching beat sheets — the highest. That's backwards for *your* market. I'd run Emotion at 15 and Craft at 10 for comedies specifically.

Also: **there is no comedy signal anywhere in the five readers.** Not one sub-criterion measures the comic engine, escalation of a comic premise, runner/callback construction, or whether jokes are on the page vs. in the margins. You are scoring *Nosotros los Nobles* and *No Manches Frida* on Weiland's Lie-vs-Need arena and Story Grid obligatory scenes. A broad comedy can hit a 5 on "crisis_quality (Best Bad Choice dilemma)" and still be the biggest opening of the year. This is the single largest methodology gap for Lemon, and the prior audit (T8) undersells it — it treats genre as a "one rubric" comparability nit. It's not a nit. It's the reason a great comedy script could PASS.

### 2. The verdict is unenforced — this is the real defect
The code recomputes `weighted_score` in Python (ingest_v9.py:2024-2060) and TS (multiPassAnalysis.ts:106-129). Good. But **nothing in code derives the verdict from that score, or enforces the situation cap, or applies the trap downgrade.** Steps 3-6 of the synthesis (ingest_v9.py:1293-1333) are *instructions to the model.* A synthesis pass can return `weighted_score: 5.4` with `verdict: "RECOMMEND"` and the pipeline writes it to Firestore unchallenged. You built a beautiful gate and then asked the fox to confirm he applied it.

**Worse — a bug the prior audit missed.** The synthesis prompt tells the model to apply a `critical_failure_penalty` to the weighted score (ingest_v9.py:1328-1329: MINOR -0.3 … CRITICAL -1.2, capped -3.0; schema field `critical_failure_total_penalty` at line 1469). But `_compute_weighted_score` (line 2024-2031) is a **pure weighted sum** — it recomputes `weighted_score` from pillars and *overwrites* the model's value at line 2060, silently discarding the penalty. So a script with a CRITICAL structural failure that the model correctly docked to 6.8 gets *restored* to 7.5 by your own "safety" arithmetic and tips into RECOMMEND. The determinism fix and the penalty mechanism are in direct conflict, and the determinism fix wins by accident. Either compute the penalty in code too, or stop overwriting. Right now it's the worst of both.

### 3. Page citations are theater
Both parsers strip page structure. Client: pages `.join('\n\n')`, no markers (pdfParser.ts:60). Python: `grep` for `[PAGE`, form-feeds, page markers → **zero hits.** The readers are ordered to "cite page numbers for any score ≥7" (structure system prompt, ingest_v9.py:611), and the UI renders these as evidence. The model is inferring page numbers from whatever printed folios survived OCR, or inventing them. A human reader who cited a page that wasn't there got a talking-to from me. This isn't fatal — the *justifications* can still be sound — but you're presenting hallucinated coordinates as procurement evidence, and someone will eventually check page 47 and find nothing there. That erodes trust in the whole document.

### 4. What a great human reader catches that this structurally cannot
- **Voice as engine.** Comedies and a lot of the best LATAM material live on a *voice* — a specific comic or regional rhythm that a rubric reads as "competent dialogue, distinguishable." The system has `dialogue_voice_distinction` but no way to register "this writer is genuinely funny" as an upward signal. It can penalize badness; it can't reward specialness.
- **The intangible "I'd fight for this."** Every good reader has passed a script that hit every beat and championed one that broke every rule. The trap system is designed to catch the *former* (false RECOMMEND). Nothing is designed to catch the *latter* — the flawed script with a beating heart that scores 6.4 and dies at CONSIDER. Structurally, this system is biased toward the competent and against the alive. For a slate that needs breakouts, that's the expensive error.
- **Cultural specificity.** With `latam` lens off by default (ingest_v9.py:2266 `lenses_enabled: ["commercial"]`), the reader has no instruction to weigh whether a joke, a family dynamic, or a class reading lands *for a Mexican audience.* Claude will default to a US-festival sensibility. That's a systematic mis-read of your actual buyers.

### 5. Thresholds — mostly sane, one soft spot
PASS <5.5 / CONSIDER 5.5-7.4 / RECOMMEND ≥7.5 / FILM_NOW ≥8.5. The band structure is fine and matches real coverage instincts. Two concerns: (a) **the boundaries are unmeasured** — see variance — so a 7.5 RECOMMEND cutoff on a system with unknown ±0.3-0.5 run-to-run noise is a coin flip near the line; (b) **FILM_NOW ≥8.5 is doing a lot of reputational work.** I would make FILM_NOW **advisory only** — never auto-promotable to a human's "yes" — until you have real anchors and variance data. A machine should not be allowed to say FILM_NOW about your money.

### 6. Five readers, one brain — correctly flagged, correctly minor
They're the same base model with different system prompts. Errors correlate. The trap system is a real partial hedge — it's cross-*criterion*, so it catches internal contradictions even within one model. Medium concern, not high. Model diversity is a nice-to-have, not a first move.

### 7. Escalation economics are right
Haiku triage → Sonnet readers → Opus promotion on RECOMMEND/FILM_NOW (run_v9_hybrid, ingest_v9.py:2069-2146). Exactly the cost ladder I'd design. No notes — keep it.

**One correction to the prior audit's framing of the kill switch:** In the daemon's *normal* path, triage is run only as a **cold-read impression handed to synthesis** (ingest_v9.py:2368-2396) — it does **not** kill the script. The `should_deep_analyze >= 6` gate that *irreversibly kills* a script only fires when the daemon runs in `mode == "triage"` (the bulk-backfill mode). So the Haiku-kill-switch risk (T7) is real but **conditional on how you run the 1,000-script backfill**, not a property of every upload.

---

## PART 2 — VERIFICATION OF PRIOR AUDIT

| # | Verdict | Reasoning |
|---|---------|-----------|
| **T1** Placeholder anchors | **AGREE** | Confirmed verbatim: ingest_v9.py:584 `# REPLACE WITH ACTUAL LEMON EVALUATIONS WHEN YOU HAVE THEM.` Highest-leverage finding; 100% accurate. |
| **T2** Calibration never reaches the daemon | **AGREE** | No calibration-prompt injection anywhere in the daemon path. The TS synthesis *does* inject it (promptClient.v9.ts:559-561) but the daemon — which processes real uploads and the backfill — has no code path for it. Placebo confirmed. |
| **T3** Page citations untrustworthy | **AGREE** | No page markers in either parser. Overstated only in tone — justifications remain useful even when the page number is fiction — but the core claim and the UI-as-evidence problem are real. |
| **T4** Verdict enforced by prompt, not code | **AGREE, and understated** | Code overrides `weighted_score` (2060) but never re-derives verdict, never enforces situation cap or trap downgrade. And the `critical_failure_penalty` is silently discarded by the very override meant to add safety. Most important fix on the list. |
| **T5** Two divergent pipelines | **PARTIALLY** | Directionally true but stale framing: the daemon path is now the *rigorous* one; the TS client is the weaker twin and may rarely execute in production. Verify which path fires on a normal upload before spending a day here. |
| **T6** >130pp scripts lose Act 3 silently | **AGREE** | Truncation confirmed; `build_raw_document` (2249-2295) stores **no** truncated flag. Correct and cheap to fix. |
| **T7** Haiku holds the kill switch | **PARTIALLY** | Real but conditional — only in `mode=="triage"` bulk runs; the normal path uses triage as a non-lethal cold-read. Bites only if the backfill runs in triage mode — which is exactly what you'd naturally reach for on 1,000 scripts. |
| **T8** One rubric per genre; LATAM off | **AGREE — and it's bigger than stated** | For a comedy slate this is a top-3 problem, not #8. No comic-engine measurement anywhere means a great broad comedy can structurally underscore. Move it up. |
| **T9** Five readers, one brain | **AGREE (severity: low-medium)** | Right finding, over-prioritized as a fix. Cross-criterion traps are a genuine hedge within a single model. |
| **T10** No variance measurement | **AGREE — do this first** | Temp 0.1, not 0; runs will vary. ~$10 to measure. Cheapest high-value item; prerequisite to any threshold discussion. |

### Fixes 1–10

| Fix | Verdict | Reasoning |
|-----|---------|-----------|
| **1** Real anchors + wire calibration | **AGREE — #1 priority** | Anchors matter far more than the calibration-prompt plumbing. Do the anchors this weekend; wiring can follow. See anchor protocol. |
| **2** Page markers + quote-verify | **PARTIALLY — markers yes, soften verification** | Hard string-match will reject legitimate citations (broken whitespace, ligatures, reflow) and train the model to stop citing. Use fuzzy matching (~85% token overlap, normalized whitespace) and *flag* mismatches rather than dropping them. |
| **3** Verdict computed in code | **AGREE — tied for #1** | Compute verdict from a *penalty-adjusted* weighted score; enforce situation cap + trap downgrade in code. Also fixes the penalty bug — same wound, one ticket. |
| **4** One pipeline | **PARTIALLY** | Verify which path production actually uses first. If the daemon is the only real path, this is a 30-minute delete-dead-code cleanup, not a day of porting. |
| **5** Truncation honesty | **AGREE** | Store flag, badge in UI, and exclude truncated ending scores from the weighted score. A verdict on an unseen Act 3 is malpractice. |
| **6** Backfill safety net | **AGREE, with a comedy tweak** | Sub-4.0 dies silent; 4.0-5.9 second read; weekly kill-list digest with genre + logline. **Add:** anything triaged as comedy gets a lower kill floor or skips triage-kill entirely. |
| **7** Genre-aware reading | **AGREE — but this is #2, not #7** | Comedy sub-criteria near-essential for Lemon. `latam` on by default. "Fragmenting comparability" worry is overblown — you're triaging a slate, not running a festival leaderboard. Keep the 5-pillar spine, swap sub-criteria. |
| **8** Measure variance | **AGREE — do it literally first** | Prerequisite, not parallel. |
| **9** Commit the parser to git | **AGREE — next 10 minutes** | Basic hygiene, not a "fix." |
| **10** Reader model diversity | **DISAGREE as near-term** | Correct in theory, wrong in priority. Park it; revisit when you can measure whether it helps. |

---

## PART 3 — ADDITIONS, SUBTRACTIONS, FIRST MOVES

### Additions
1. **The `critical_failure_penalty` is dead code — a scoring bug.** Fix as part of Fix #3. *(Independently confirmed in code post-review.)*
2. **No comedy reader / comic-engine criterion anywhere.** Biggest *content* gap; absent from the prior audit's findings. Genre sub-rubric under Fix #7.
3. **No "champion signal" — the system can only subtract.** Every gate catches false positives; nothing catches the alive-but-flawed 6.4 script. Add one reader field: "Is there a reason to fight for this despite the score? (specific, or null)." Surface non-nulls in the weekly digest. Costs nothing; recovers breakouts.
4. **Author extraction from a flattened title page** — same class of problem as page citations. Low stakes; expect wrong or missing names.
5. **Truncation should hard-STOP FILM_NOW/RECOMMEND, not just badge.** No machine promotes a script whose ending it didn't read. Wire into Fix #3's code-side verdict logic.

### Subtractions
- Fix #10 (model diversity): park it.
- Fix #4 (one pipeline): downgrade to "verify + delete dead code."
- Hard quote-string verification: cut the strictness; fuzzy + flag, never hard-reject.
- Don't build genre rubrics for every genre. Build **one — comedy** — because it's the slate. Thriller/drama ride the default spine.

### First moves ($300 budget + a producer's weekend)
**This weekend (Billy, ~6–8 hrs):** hand-score anchor scripts per the protocol below. This is the whole ballgame.
**Monday (engineering, ~1.5 days):**
1. Commit the VPS parser to git (10 min).
2. Variance run: 3 known scripts × 3 runs ≈ $10–15. Publish the spread.
3. Code-side verdict + fix the penalty bug (half day).
4. Drop Billy's real anchors into `FEW_SHOT_ANCHORS` (ingest_v9.py:552). Deploy.

Reserve ~$250 for a **calibrated re-scoring of 40–60 scripts Billy knows** *after* anchors are in. **Do NOT run the 1,000-script backfill until the anchored system agrees with Billy on 40 scripts he knows cold.**

### The anchor-scoring protocol
**How many:** 5–6, not 3. Spread *and* redundancy at the decision boundaries.
**The spread — anchor the boundaries, not the extremes:**
- 1 FILM_NOW / clear RECOMMEND — something Lemon made or fought for and was right about.
- 2 near the RECOMMEND/CONSIDER line (~7.5) — one that *just* cleared, one that *just* missed. The most valuable pair; it's where the money decisions live.
- 1 solid CONSIDER (~6.5) — "you finish it, you forget it."
- 1–2 hard PASS — including one with a good logline/flashy first act that falls apart (anchors the traps) and one comedy that's *funny on the page but structurally loose* (anchors the voice-beats-structure case core to the slate).

**Format per anchor (~150–200 words; the existing placeholder format at ingest_v9.py:558-582 is the right shape):**
- Per-pillar scores (all five).
- 2–3 sentences of *specific, page-anchored evidence* for the load-bearing pillars ("The midpoint (~p.52) flips the premise rather than escalating it; that's why Structure is an 8 not a 6.").
- One "why this score and not the adjacent one" line — boundary reasoning calibrates the boundary.
- For comedies: explicitly name the comic engine and the runners/payoffs.
- Billy's gut verdict in plain English, one line ("I'd have greenlit this." / "Pass — no hook I can sell.").

**Useless anchor:** "Structure 7, Character 8. Good script, would consider." — scores without evidence teach nothing; the model regresses to its prior.

---

**Bottom line for Billy:** The bones are excellent — better than most studios' human coverage consistency. But right now it's a brilliant reader who's never met you, whose report card grades itself, and who's never been taught what makes an audience in Guadalajara laugh. Fix three cheap things — code-side verdict (with the penalty bug), variance measurement, and your own anchors — and add a comedy rubric, and this becomes a triage tool I'd trust to protect your weekend. Just don't let it say FILM_NOW about your money until it's proven it agrees with you on 40 scripts you already know cold.
