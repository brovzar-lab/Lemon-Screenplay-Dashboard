# V9 Variance Experiment — Results

**Date:** 2026-07-02
**Setup:** 3 produced scripts × 3 full V9 runs each (Sonnet, temp 0.1, tool-use + thinking), via the production llmProxy, using the new code-side verdict derivation (`pipeline-truth-fixes` branch). Raw data: 9 runs, ~$12 spend.
**Scripts:** 310 to Yuma, The Bucket List, The Men Who Stare at Goats (all in the existing library; cached VPS extractions reused so all runs saw identical text).

## Results

| Script | Adjusted scores (3 runs) | Spread | Verdicts |
|---|---|---|---|
| 310 to Yuma | 8.42 / 8.58 / 7.84 | **0.74** | RECOMMEND / FILM_NOW / RECOMMEND |
| The Bucket List | 6.10 / 5.32 / 6.06 | **0.78** | CONSIDER / PASS / CONSIDER |
| The Men Who Stare at Goats | 4.93 / 5.59 / 5.73 | **0.80** | PASS / CONSIDER / CONSIDER |

## Findings

1. **Run-to-run spread is ~0.75–0.80 points on a 10-point scale.** Treat every single-run score as ±0.4 at best. **All three scripts flipped verdict tiers across runs.** A single-run verdict for any script scoring within ~0.5 of a boundary (5.5, 7.5, 8.5) is close to a coin flip.
2. **Rank order was perfectly stable.** Yuma > Bucket List ≈ Goats in every run — and that ordering matches critical reality. The engine is directionally sound; the *boundaries* are noisy, not the *ranking*.
3. **Pillar-level noise is the driver.** e.g., Yuma's structure pillar came back 6.0 / 8.5 / 8.23 across runs; Bucket List's character 5.5 / 7.0 / 7.36. Synthesis dampens but can't eliminate it.
4. **Critical-failure detection itself varies.** Bucket List's penalty was 0.6 / 1.3 / 0.8 across runs — the model doesn't consistently agree with itself on what counts as a critical failure.
5. **The new code-side verdict derivation earned its keep immediately.** In 9 runs it corrected the model's verdict 3 times, in *both* directions (model said FILM_NOW on an 8.42 → RECOMMEND; model said RECOMMEND on an 8.58 → FILM_NOW; model said CONSIDER on a penalty-adjusted 5.32 → PASS). Model-vs-code weighted-score mismatches ran as high as **1.12 points**. Before this fix, all of those inconsistencies shipped to Firestore unchallenged.

## Recommendations

- **Boundary re-runs:** when the adjusted score lands within 0.5 of a verdict boundary, automatically run 2 more full passes and take the median score + majority verdict. At observed spreads this stabilizes exactly the scripts where it matters, at ~3× cost for only the ~20–30% of scripts near a line.
- **Report score bands, not points, in the UI** (e.g., "7.8 ±0.4") once median-of-3 is in place for boundary cases.
- **Re-measure after real anchors land.** Better-defined scale anchors should reduce pillar variance; this experiment is the baseline (repeat with the same 3 scripts).
- FILM_NOW stays advisory (per the Reiner review) — this data is the proof.
