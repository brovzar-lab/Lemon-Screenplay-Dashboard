# Lemon Screenplay Dashboard — Reassessment

**Date:** 2026-08-31
**Scope:** Read-only audit of `main` at `c18d35a`, plus evaluation of the attached V9 discussion.
**Method:** Code inspection, git-history reconstruction, full local test/build/lint runs. No paid model calls. No application changes.

Every important claim below is labeled:

- **VERIFIED** — directly supported by code, tests, git history, or configuration in this repository, with citations.
- **REPORTED** — asserted by Billy or the attached discussion, not independently verifiable from this repository.
- **INFERRED** — a reasoned conclusion from verified evidence.
- **UNKNOWN** — cannot currently be established.

---

## 1. Executive verdict

**V9's reliability foundation is genuinely good. Its analysis machine should be retired from paid service.**

The system that ingests, deduplicates, archives, hashes, budgets, and seals screenplay analyses is careful, well-tested engineering (VERIFIED — see §21, Evidence E1–E9; 1,036 dashboard unit tests, 231+ Python tests, build and lint all pass on this clone). The system that *produces* the analysis is an over-elaborated pipeline that can spend between ~14 and ~145 paid model calls on a single screenplay (VERIFIED, §3), re-sends the full screenplay on nearly every one of them with a prompt cache that is architecturally incapable of firing (VERIFIED, §4.3), reruns the entire pipeline up to three times for the scores most screenplays actually get (VERIFIED, §4.4), promotes every promising script to a second full run on the most expensive model (VERIFIED, §4.5), then asks a same-family model to certify 86+ claims — 48 of which are subjective taste scores — as verified fact, and **discards the entire paid analysis if it declines** (VERIFIED, §4.6). No validated intermediate output is ever persisted, so every late failure repays everything (VERIFIED, §4.7).

The deepest problem is conceptual, not mechanical: **V9 tries to manufacture objectivity out of subjective judgment.** The repo's own variance study (`docs/audits/2026-07-02-variance-results.md`, VERIFIED) shows identical runs move scores by up to 0.80 points and flipped the verdict tier on **all three** test screenplays — yet the scoring anchors are still self-declared placeholders (`ingest_v9.py:7297`: "placeholder; REPLACE WITH ACTUAL LEMON EVALUATIONS"), the calibration system built for Billy's taste has never been activated (`docs/trust-hardening/Q5`: "Nothing in this contract is deployed or active yet"), and the one artifact a producer most wants — development notes — is hardcoded to an empty array in the dashboard (`src/lib/normalizers/normalizeV9.ts:462`). The machine audits noise to two decimal places and does not ship the notes.

**Recommendation in one line:** keep V9's infrastructure and its sealed history; replace the paid engine with a two-call coverage path (one senior read, one fact-only audit) built as a thin route through the existing daemon, proxy, budget, and citation systems; prove it on five screenplays for under $10 before spending anything more.

---

## 2. What the dashboard currently does

### In plain language

The Lemon Screenplay Dashboard is a private web app for Lemon Studios (primary user: Billy Rovzar; team access restricted to verified `@lemonfilms.com` accounts — VERIFIED, `functions/src/llmProxy.ts:121-129`). Its promise, per `PRODUCT.md:11`: "put 5,000 screenplays into Lemon and surface the one-in-a-million project."

**The screenplay journey (VERIFIED end to end):**

1. A PDF is uploaded from Settings → Intake. The browser SHA-256 hashes it, checks Firestore for an existing analysis with the same content hash, and warns on duplicates (`UploadPanel.tsx:104-157`).
2. The file lands in Firebase Storage; a Cloud Function writes a `pending` job to an `ingest-queue` Firestore collection (`functions/src/onScreenplayUploaded.ts:120-143`).
3. A Python daemon on a VPS polls the queue, claims the job transactionally, re-hashes, re-checks for duplicates, parses the PDF (with page-level evidence and OCR fallback), archives the PDF immutably, and runs the V9 engine (`daemon.py:1439-1888`).
4. V9 produces a sealed, immutable analysis version: 5 specialist reader reports (Structure, Character, Craft & Scene, Concept, Emotional Resonance) scoring 48 criteria, a synthesis roundtable, code-computed weighted/adjusted scores, a PASS / CONSIDER / RECOMMEND / FILM_NOW verdict, and a trust manifest binding everything to hashes.
5. The dashboard (React) shows the results: a Discover page with search, filters, one "Featured" project with reasons, a "Producer Look" shortlist capped at 3, analytics charts, and a full per-project workspace with score lineage, reader disagreements, verdict gates, PDF export, share links, and a per-reader "Private Reader Chat."

**Where human judgment enters:** at the very end. The engine fully decides verdict and score; Billy's judgment is applied only when reading results. The calibration loop designed to inject his taste (Q5, `docs/trust-hardening/Q5-PRODUCER-CALIBRATION.md`) was built and never activated (VERIFIED).

**What Billy sees at the end:** verdict badge, one-decimal score, score lineage (raw → penalty → adjusted), verdict gates, reader disagreements, trust status, strengths/weaknesses, comparable films, characters, commercial-viability score — and, notably, *empty* development notes, `marketability: 'medium'` and `budgetCategory: 'unknown'` as hardcoded constants (VERIFIED, `normalizeV9.ts:462-465`).

### What works well (VERIFIED)

- **Ingestion & idempotency.** Three layers of duplicate protection: content-hash lookup in the browser, exact version-ID replay in the daemon (zero repaid work — `daemon.py:1512-1533`), and content-hash duplicate detection that re-validates the archived PDF before trusting it (`daemon.py:792-816`). The CLAUDE.md note that a re-run of an unchanged screenplay "cost nothing" is consistent with this code.
- **PDF parsing & page evidence.** Physical `[PAGE N]` markers, blank-vs-unreadable page classification, OCR corroboration, parse cache keyed on `sha256 + PARSER_VERSION` (`execution/source_evidence.py`, `ingest_v9.py:930`).
- **Citation verification.** Every evidence-bearing claim must carry a ≥3-word verbatim excerpt that actually appears on the cited physical page; unique quotes on wrong pages are silently relocated to the right page (`source_evidence.py:816-1300`).
- **Money handling.** Reserve-then-settle budget transactions, a $100/day server-side hard gate, jobs that park (not fail) on budget exhaustion, a watchdog that refuses to blindly requeue any job showing evidence of paid calls (`functions/src/budgetCounter.ts`, `daemon.py:392-419, 1118`).
- **Verdict math in code, not prompts.** `execution/verdict_contract.py` (166 pure lines) computes pillar/weighted/adjusted scores and the verdict; model-supplied numbers are overridden and logged.
- **Immutable sealing.** Write-once PDF archive, atomic version transactions, server trust attestation, 900KB size guard (`ingest_v9.py:600-806`).

### What is fragile, incomplete, or dead (VERIFIED)

- **The analysis engine itself** — see §3–§4. It is the fragile part.
- **The browser V9 pipeline is dead code.** `analyzeScreenplay()` unconditionally throws (`src/lib/analysisService.ts:61-84`, disabled in the trust-remediation commit `2481750`), which also breaks the Settings → Model Comparison panel (986 lines whose only action calls the throw). ~3,500 lines of client V9 code are inert but still tested, giving false coverage confidence.
- **Orphaned UI.** `src/App.tsx` (the entire classic dashboard) is imported by nothing; it drags ScreenplayModal + 12 sub-panels, comparison components, DevExecChat, FilterBar, and Header with it. `/intake` redirects past `IntakePage.tsx`. `BudgetChart.tsx` is exported and rendered nowhere. Three parallel Discover shells are maintained; production hard-forces one (`DiscoverPage.tsx:44`).
- **The landing page is static.** `/` renders an "Intelligence Briefing" driven entirely by a checked-in 31KB JSON snapshot dated 2026-08-19 — no live data (`src/data/studio-pulse-market-snapshot.json`, `studioPulse.ts:1`).
- **Hardcoded empties.** `developmentNotes: []`, plus fabricated dimension values in the 5→7 mapping (`originality` is actually the emotion score; `supportingCast` is `characterScore * 0.9` — `normalizeV9.ts:252-261`). Dead downstream UI: the "Development priority" block, `DevelopmentNotesSection`, PDF development sections, a CSV column, and the `'high'` fixability branch are all unreachable (`ScreenplayFileWorkspace.tsx:363`, `developmentOpportunity.ts:141-148`).
- **Reader Chat is the most expensive surface in the app** — live in production (`.env.production` sets `VITE_READER_CHAT_LIVE=true`), default model `claude-opus-5` with `claude-fable-5` escalation at high effort, re-sending the entire screenplay PDF plus the sealed report plus history every turn, with a possible silent second call per turn (`functions/src/modelRegistry.ts:9-21`, `readerChat.ts:661-672`, `readerChatRouting.ts:120-175`).

### Does the interface help Billy decide, or just display analysis?

Partially decides (INFERRED from VERIFIED structure). There *is* a shortlist concept: one Featured project with "why featured" reasoning and a Producer Look capped at 3 (`developmentOpportunity.ts:335-359`). Uncertainty and disagreement are shown well (warning system, score lineage, boundary-stability flags, reader disagreement cards). But below the top ~4 items the product is a filterable grid of everything, 50 per page — closer to "another dashboard" than "a manageable shortlist" — and the Producer Look's own gating depends on `developmentNotes`-derived fixability, which is dead. The decision surface exists in outline; the pipeline doesn't feed it the two things a producer most needs (development notes and a calibrated reason to trust the ranking).

---

## 3. Current pipeline map

All stages VERIFIED against `execution/ingest_v9.py` (13,759 lines), `daemon.py` (2,062 lines), and `execution/trust_manifest.py` (5,837 lines). "Full script?" = whether the entire screenplay text is transmitted on each call.

### Free (deterministic) stages

| Stage | Where | Purpose | Failure behavior |
|---|---|---|---|
| Claim job | `daemon.py:521` | Transactional queue claim | Contention → next candidate |
| Download + hash | `daemon.py:633, 1476` | SHA-256 content identity | Retryable |
| Version replay check | `daemon.py:1512-1533` | If this exact version exists → complete, **zero paid work** | — |
| Duplicate check | `daemon.py:792` | Content-hash match, re-validated | Skip unless bypassed |
| Parse PDF | `ingest_v9.py:930` | Page-marked text, OCR fallback, cache keyed `sha256+PARSER_VERSION` | Skip/needs_review |
| Validation, TMDB, budget preflight, calibration load, immutable archive | `daemon.py:1573-1627` | Gatekeeping | Fail-closed |

### Paid stages (per screenplay)

| # | Stage | Model | Full script? | Seq/Par | Calls (min–max) | Affects final decision? | Evidence it improves selection |
|---|---|---|---|---|---|---|---|
| 1 | Cold read / triage | Haiku (Sonnet if >150k tok) | **Yes, uncached** (`:13009-13024`) | single | 1 | **No** — non-binding by policy ("Haiku never decides whether the complete Sonnet panel runs," `docs/ANTHROPIC-MODEL-CATALOG.md:19`); injected into synthesis as a "data point" (`:8981-8986`) | None found |
| 2 | Genre detection | Haiku | Yes, cached block | single | 1–2 | Yes — genre card conditions 4 readers | Plausible (Story Grid obligatory scenes); untested |
| 3 | 5 specialist readers | Sonnet 4.6 / Opus 4.7 | Yes ×5 | **Sequential** (`:11733`; comments falsely claim parallel) | 5–15 (3 attempts each: 1 + 1 structural retry + 1 targeted correction, `:330-335`) | Yes — 48 criteria → pillar scores | Rank order stable across runs (variance study); *five-reader independence* unevidenced (same model, §5) |
| 4 | Synthesis roundtable | same | **No** — reader JSONs only | single | 1–3 | Yes — verdict inputs, critical failures | Untested vs. single-call |
| 5 | Code recompute | none | — | — | 0 | Yes — authoritative math | VERIFIED good |
| 6 | Boundary stability reruns | same | Yes ×N | sequential | ×1 or ×3 **whole pipeline** (`:12578, 12698`) | Yes — majority-verdict selection | Treats symptom of variance; window covers most real scores (§4.4) |
| 7 | Hybrid Opus promotion | Opus 4.7 | Yes ×N | sequential | 0 or another full stable run (`:12891-12979`) | Yes — replaces the analysis | None found; assumes more expensive = better |
| 8 | Claim verification | **same tier as scoring** (`:13503-13521`) | **Yes, per batch** (`:10581`) | sequential batches | B–2B, B = ceil(targets/25); 86+ targets ⇒ B≈4–12 | Yes — can **destroy** the run (`:10345-10386`) | Negative: certifies scores the variance study shows are noise |

**Call bounds per screenplay (VERIFIED arithmetic):** one `run_v9_full` pass = 7–20 calls; `run_v9_stable` = ×1 or ×3 passes; hybrid promotion doubles that; plus cold read and claim batches:

- **Minimum:** 1 + 7 + B ≈ **12–20 calls**
- **Maximum:** 1 + 120 + 2B ≈ **up to ~145 calls**
- The discussion's reported "44 dispatches, full screenplay transmitted 40 times" for two attempts (REPORTED) sits comfortably inside these verified bounds.

### The specific defects the map exposes (all VERIFIED)

- **Duplicate analysis:** the hybrid path runs the complete pipeline twice for every RECOMMEND/FILM_NOW; boundary reruns run it up to three times per pass. A promising borderline script can legitimately trigger 6 full passes.
- **Repeated screenplay context:** stages 1, 2, 3(×5), 6, 7, and 8(×B) each transmit the full text. The cache that was supposed to make this cheap cannot fire (§4.3).
- **A paid stage that cannot affect the decision:** the cold read (stage 1) is non-binding by design — a "triage" that cannot triage. Pure cost.
- **Overlapping evaluator roles:** 48 criteria with verified duplication (three separate scores on the opening pages; `lie` vs `moral_blind_spot`; `controlling_idea` vs `thematic_resonance` vs `truth` split across two readers — `promptClient.v9.ts:64-123`). Because pillars are unweighted means, duplicated criteria silently re-weight the final score.
- **Excessive prompt size:** the full JSON schema is appended as *prompt text* to every reader/synthesis/claim call, after the last cache breakpoint — always-uncached input (`:2745, 5951-5955`).
- **Bounded retries but multiplicative:** each bound is individually sane (2–3), but they nest: attempts × readers × boundary passes × hybrid × claim batches.
- **Work repeated after failure:** no validated stage output is ever persisted mid-run (§4.7). Missing idempotency *within* a run (idempotency *across* runs — content hash / version replay — is excellent).
- **Stages that fail the whole pipeline unnecessarily:** reader 5 failing discards readers 1–4 (`:11719-11726`); one failed boundary rerun discards all completed passes (`:12852`); claim batch 7 failing discards batches 1–6 and the entire analysis (`:10820`, `daemon.py:1836-1851`).
- **Results stored only in memory:** everything until the single final Firestore transaction.
- **Ordinary code already replaced AI where it should** (score math, verdict, trap evaluation, citation checking) — that part is done right.

---

## 4. Verified V9 diagnosis

### 4.1 What V9 attempted

V9 ("Archaeology Engine," born 2026-06-06, commit `4009584` — VERIFIED via GitHub API; this clone is shallow to 2026-08-17) replaced V3–V8 with: 5 persona readers × 48 criteria + synthesis, code-derived verdicts, false-positive traps, genre cards, page-evidence citations, immutable versioning, and — after a July audit wave — a trust manifest and independent claim verification. Each addition answered a real defect (the July audits documented citation theater, prompt-enforced verdicts, silent Act-3 truncation — `docs/audits/2026-07-01-analysis-pipeline-audit.md`). The system accreted trust machinery faster than it validated judgment quality.

### 4.2 The remediation death spiral (VERIFIED from git)

- PR #38 (08-27) "Harden V9 evidence and provenance contracts": +6,786 lines.
- Then **34 consecutive PRs (#43–#76) off one branch in ~46 hours** (08-28 18:41 → 08-30 16:47), one merge every 50–60 minutes including 00:15–04:35 local. Aggregate: 196 files, **+46,465 / −3,321**.
- `ingest_v9.py` grew **2.9× in 13 days** (4,737 → 13,759 lines); 8,822 lines added in the final 48 hours.
- `run_v9_full` was touched by 17 of 31 wave commits; the targeted-correction subsystem was "hardened" five times in 30 hours under near-identical commit titles; one 1,207-line addition was reverted 40 minutes later; one assertion was added and then deleted 24 hours later.
- **The remediation loop consumed its own budget:** PR #69 (`633b6e9`) doubled the audited benchmark ceiling from $40 to $80 because repeated re-benchmarking had exhausted the authorized spend (VERIFIED).

### 4.3 The cache that cannot fire (VERIFIED)

Intent (`:7076-7081`): "ONE cached screenplay block — shared across the 5 readers + synthesis. First reader call writes the cache; subsequent calls read at 10% input cost." Reality: Anthropic's cache is a strict prefix over `tools → system → messages`. Every reader has a different tool schema (`READER_TOOLS`, `:8046`) and a different system prompt (`:8054-8060`), both of which precede the screenplay block — so each reader is a **separate cache write at 1.25× price**, never a read. Claim verification rebuilds the screenplay block *inside the batch loop* with a batch-specific tool enum (`:10581`, `:8893-8905`) — a fresh full-screenplay cache write per batch. Corrections introduce new `repair_*` tools — another miss. The genre call has no `cache_control` on its system block at all. The boundary-rerun comment justifying reruns as "cheap when they run within the cache TTL" (`:12571-12577`) is therefore wrong twice: no cache reuse, and the sequential 5-reader pass routinely exceeds the 5-minute TTL anyway. The discussion's reported "2,333,190 cache-write tokens, zero cache reads" (REPORTED) is exactly what this architecture predicts (INFERRED).

### 4.4 Boundary reruns triple the common case (VERIFIED)

`BOUNDARY_WINDOW = 0.5` around boundaries `(5.5, 7.5, 8.5)` (`verdict_contract.py:22-23`) means any adjusted score in **(5.0–6.0) ∪ (7.0–9.0)** triggers two more complete pipeline passes. Production scores on record: 7.38, 6.76, 6.25, 5.22→4.72, 5.21→3.91 (Q4 census) — i.e., interesting screenplays live in the rerun band. The mechanism exists because the July variance study measured ±0.74–0.80 run-to-run spread with **verdict flips on 3 of 3 scripts** (VERIFIED, `2026-07-02-variance-results.md`). Rank order was perfectly stable; only the boundaries are noise. The system chose to buy three runs to stabilize a noisy number rather than widen the boundaries or report uncertainty.

### 4.5 The best scripts cost the most and fail latest (VERIFIED)

`run_v9_hybrid` (`:12891`): Sonnet full stable run; verdict RECOMMEND/FILM_NOW → a **fresh full Opus stable run** (itself boundary-rerunnable). An Opus failure fails the whole job (`:12975-12979`). The discussion's report that "Santa's third pass failed, so the two earlier passes became unusable" (REPORTED) matches this code path exactly.

### 4.6 Taste audited as fact (VERIFIED — the sharpest finding)

`claim_verification_targets` was executed against the canonical fixture during this audit: **exactly 86 targets**, of which **48 are the reader sub-scores themselves**, wrapped as claims like *"Reader structure scored criterion beat_timing 4/10. Justification: …"* (`trust_manifest.py:724-752`). All 48 carry `score_alignment_required=True` and are verdict-driving. If the auditing model does not classify a subjective score as Supported/Partially-supported, the run raises and **nothing is persisted** (`ingest_v9.py:10345-10348, 13519-13524`); below a 95% support rate the analysis aborts (`:10329-10332, 10382-10386`). The 86 is a floor — real screenplays (with supporting characters, disagreements, red flags, goosebumps scenes) generate more. And the "independent" auditor is the **same model family as the scorer** (`:13503-13521`, prompt-cast as "an adversarial screenplay fact checker independent of the readers" at `:10576-10579`). The trust system certifies numbers whose own measured run-to-run noise is ±0.4–0.8, using the same brain that produced them, and destroys paid work when the certification fails. This is the engine's deepest design error.

### 4.7 No stage-level recovery (VERIFIED)

`usage_sink` is an in-process dict; benchmark checkpoints store **call receipts only** and explicitly ban payload data (`model_benchmark.py:3250-3279`); a benchmark run in `failed`/`running` state makes resume **abort entirely** (`:3435-3448`). In the daemon, the only durable write is the single final transaction. Reader/synthesis/verification outputs that validated successfully are never saved mid-run.

### 4.8 Structured output workaround (VERIFIED)

`_strict_json_envelope_definition` (`:2705`): "Anthropic's grammar compiler rejects the complete nested V9 reader and synthesis schemas as too complex," so the whole report travels as a model-authored **JSON string in one field**, validated only after payment — the root cause of the 3-attempt retry ladders. This is the primary path for readers, synthesis, and claim verification, not a fallback (`:11216, 11907, 10656`). The schemas are too big for the provider because the *contract* is too big, not because the provider is deficient.

### 4.9 Where the money went

- VERIFIED (in-repo): an audited cumulative snapshot of **$37.511973 across 203 calls, including two uncertain calls totaling $7.627776** (`docs/ANTHROPIC-MODEL-CATALOG.md:65`, `docs/BENCHMARK-CANDIDATE-ROLLOUT.md:12`); a settled "Santa pilot" of $0.106425 across 2 calls hardcoded as a mandatory prior-spend floor (`model_benchmark.py:130-131, 1732-1735`); the ceiling raised $40→$80 mid-remediation.
- REPORTED (discussion; artifacts live only in the gitignored, locally-held `benchmark-artifacts/`, absent from this clone): $7.063020 settled across two Santa attempts, $9.893488 uncertain exposure, $16.956508 authorization consumed, cumulative ledger $69.361695, 44 dispatches, 40 full-screenplay transmissions, 16 correction/retry calls, zero cache reads, **zero completed reports**. These specific figures do not appear anywhere in this repository; they are consistent with the verified architecture and pricing but cannot be independently confirmed here.
- VERIFIED: the discussion's cost-semantics complaint is real in one specific place — uncertain reservation caps are written into `actual_cost_microusd` fields and merged into the same top-level counter the daemon reports as exact settled cost (`ingest_v9.py:5234-5236, 5361-5362`, `daemon.py:1902-1911`), even though the per-call ledger correctly distinguishes `exact_settled_provider_usage` from `cap_charge_placeholder_provider_usage_unavailable` (`:5455-5462`).

### 4.10 Did V9's complexity improve evaluation quality?

UNKNOWN — and that is itself the finding. There is no committed evidence that any of the expensive mechanisms (five readers vs. one, synthesis vs. direct, boundary reruns vs. wider bands, hybrid Opus vs. Sonnet-only, claim verification vs. citation checking) improves agreement with trusted human judgment. The only quality measurements in the repo are the variance study (which showed the *scores* are noisy) and the reiner development-exec review (which found the coverage methodologically strong but judged: "Would I trust a FILM_NOW from this today? No" — for calibration reasons, not machinery reasons). The calibration that would answer the question (Q5) was never activated. **V9's problem is a combination of architecture (nested multipliers, no checkpoints, broken cache), workflow design (auditing taste as fact, non-binding triage), and product design (score theater over development notes) — not model choice, and not any single prompt.**

### 4.11 Does V9 deserve to exist?

As the normal paid engine: **no.** As a read-only forensic record of the analyses already sealed under it, and as a parts library: **yes.** Its deterministic components (§2, "what works well") are exactly what the replacement needs and should not be rewritten.

---

## 5. Cost and failure analysis

### Per-screenplay cost structure (INFERRED from VERIFIED pricing and token structure)

Using the committed pricing table (`functions/src/anthropicPricing.json`) and a ~110-page feature (~40k tokens):

| Path | Approx. calls | Approx. cost |
|---|---|---|
| Single Sonnet 4.6 pass, no retries | 8–9 | ~$1.50–2.50 |
| + boundary reruns (the common band) | ×3 passes | ~$4.50–7.50 |
| + hybrid Opus promotion (any RECOMMEND) | + full Opus stable | +$4–12 |
| + claim verification (4–12 batches, up to 24k output tokens each) | +4–24 | +$1.50–5 |
| **Realistic RECOMMEND-grade script** | 40–100+ | **~$10–20** |

The in-app upload estimates ($1.60–12.00 per script for hybrid, self-described as unmeasured guesses — `upload/upload.constants.ts:15-20`) and the CLI dry-run estimator (hardcodes a 6-call model, understating by ~3–10× — `ingest_v9.py:13571-13588`, VERIFIED) both confirm nobody's cost model matches the actual pipeline. At 1,000 screenplays this architecture projects **$10,000–20,000+**, against ~$250–500 for the lean design (§12).

### Failure economics (VERIFIED)

Failure probability compounds with call count: at ~40–145 calls per script, each with post-hoc (not grammar-level) validation, some run failure is near-certain at batch scale — and every late failure discards all prior paid work in that run (§4.7). The two reported Santa attempts producing **zero completed reports** despite ~$7–17 consumed (REPORTED) is the expected behavior of this architecture, not bad luck (INFERRED).

What is *not* broken: transport retries never double-bill (`:6956-6998`); daily budget enforcement is transactional and hard; jobs park rather than silently retry after paid failures. V9 loses work, not money-accounting.

---

## 6. Evaluation of the original proposal (first agent reply)

*Mapping note: the attached discussion contains Billy's two messages and two long agent replies. There is no separate standalone screenwriter document; §8 evaluates the screenwriter-lens content embedded across both replies. §6 covers the first reply; §7–§9 cover the second.*

**Central idea:** Freeze paid V9; keep its trust/provenance foundation; replace the creative engine with two calls (Senior Coverage + Trust Auditor), one targeted correction max, no full reruns; add a "Billy mode" via Claude Max locally and API batch for scale.

**Verification of its factual claims against this repo:**

| Claim | Status |
|---|---|
| Five readers, 48 overlapping criteria, up to 3 paid attempts each | **VERIFIED** (`promptClient.v9.ts:64-123`, `ingest_v9.py:330-335`) |
| Schema too complex for native grammar; giant report inside a JSON string (`ingest_v9.py:2705`) | **VERIFIED** — docstring says exactly this |
| Cache broken by per-reader tools/system; huge writes, zero reads | **VERIFIED architecturally**; the specific token counts are REPORTED |
| Borderline score repeats everything; third-pass failure strands earlier passes | **VERIFIED** (`:12698, 12852`) |
| Call receipts saved, but no resumable validated stage outputs | **VERIFIED** (`model_benchmark.py:3250-3448`; daemon has none at all) |
| Fact checker creates ~86 targets incl. subjective judgments | **VERIFIED** — exactly 86 on the canonical fixture, and it's a floor |
| Development notes prohibited/hardcoded empty (`normalizeV9.ts:459`) | **VERIFIED** (line 462 in current code) |
| Placeholder calibration → false-precision scores | **VERIFIED** (`:7292-7336`) |
| Specific dollar figures ($7.06 / $9.89 / $16.96 / $69.36) | **REPORTED** — absent from this repository; consistent with verified architecture |
| "V9 labels worst-case exposure as actual cost" | **VERIFIED** at the roll-up level (`:5234-5236`, `daemon.py:1902-1911`) |

**Strongest insight:** separating what V9 got right (deterministic trust infrastructure) from what it got wrong (paid opinion-auditing machinery), and refusing to treat model choice as the problem.

**Weakest points:** (a) it inherits some false precision of its own — "$0.50 per screenplay," "1,000 scripts around $250–500" are stated confidently before any measurement; (b) the Claude Max path is presented more prominently than its reliability merits for a production backlog; (c) its embedded "Complete Prompt to Copy Paste" mandates a big offline build with an extensive test matrix, adversarial review, and CI-gated merge — the same maximalist instinct that produced the 34-PR remediation wave. **Keep the diagnosis and the two-call shape; reject the delivery style.**

---

## 7. Evaluation of the agent's response (the "GPT-5.6 Sol Ultra" audit)

**Central idea:** independently confirms "don't repair the five-reader pipeline; build a simpler path beside it," and corrects the first reply's cost semantics (settled ≠ invoice; uncertain ≠ spent; authorization ≠ cash).

**What it got right (checked here):** the cost-terminology corrections match how the code actually distinguishes ledger states (VERIFIED, `usage_accounting_state`); the "corrections weren't all semantic — some were structural retries" refinement matches the retry taxonomy (`MAX_FRESH_STRUCTURAL_RETRIES` vs `MAX_TARGETED_CORRECTIONS`, VERIFIED); privacy amplification through 40 full-text transmissions is a fair inference.

**What it got wrong or overstated:**
- **The evidence-ID mechanism it describes does not exist.** No `evidence_id`/span-ID system is anywhere in this repo (VERIFIED by exhaustive search). Models self-report page + quote; local code verifies verbatim excerpts and even relocates uniquely-matching quotes to the correct page (`source_evidence.py:816-1064`). The reply presents evidence IDs as the natural mechanism without acknowledging it's a net-new build competing against an existing, working, *simpler* verification approach.
- "Model agreement across two audits" is presented as decisive. Two models agreeing is weak evidence (both were reading the same artifacts and the same framing) — the task's own warning applies.
- Its non-negotiable standards partially reintroduce false precision (100% central-citation accuracy, ≥95% two-call first-pass completion) before any baseline exists to know if those numbers are achievable or even the right ones.

**Keep:** cost-semantics discipline; two-wave batch idea; "fact-only" audit scope; the stop conditions as *aspirations*. **Reject:** the assumption that evidence IDs are the required citation mechanism (make them a postponed experiment; the existing excerpt-verification already structurally blocks fabricated quotes). **Simplify:** the five-phase program into two phases (§18–§19).

---

## 8. Evaluation of the screenwriter's response (the craft lens across both replies)

The screenwriting judgment embedded in the discussion makes three claims worth separating:

1. **"Five invocations of the same model are not five independent readers."** VERIFIED as a real defect — same model family throughout, including the "adversarial" fact checker (`:13503-13521`); the repo's own July audit named it "five readers, one brain" (T9) and the trust wave made it worse, not better. The synthesis prompt even hardcodes four cross-reader contradiction patterns to look for (`promptClient.v9.ts:664-669`) — an admission the readers aren't independent.
2. **"The five lenses are valuable and should survive as sections of one senior read."** Sound craft judgment, and consistent with the evidence: the variance study shows the *content* of the analysis is directionally stable; it's the fragmentation into 48 pseudo-independent numbers that creates noise and cost. The repo's own development-exec review (`docs/audits/2026-07-01-reiner-review.md` — the closest thing to a professional screenwriter voice *inside* the repo) independently reached matching conclusions: cut hard-reject strictness ("fuzzy + flag, never hard-reject" — V9 did the opposite); emotion at 10% weight is backwards for a Mexican theatrical comedy slate; there is **no comedy craft signal anywhere in the 48 criteria** ("the single largest methodology gap for Lemon" — still true, VERIFIED); nothing rescues the alive-but-flawed script ("no champion signal").
3. **"The most useful part of professional coverage is development guidance, and V9 doesn't produce it."** VERIFIED (`normalizeV9.ts:462`). This is the single clearest product failure: professional coverage without development notes is a scorecard, not coverage.

**Weakest assumption in the craft lens:** that PASS/CONSIDER/RECOMMEND plus prose is sufficient *comparative* machinery for 1,000 scripts. Billy still needs to rank and slice a large archive; the answer is calibrated-later scores or explicit tiers with confidence, not the removal of all comparative structure. The recommendation in §13 keeps a small number of section-level impressions (labeled as impressions) for sorting, without resurrecting 48-criterion false precision.

---

## 9. Evaluation of the revised proposal (coverage_v1, phases 1–5)

**Central idea:** a `coverage_v1` route beside V9 — local source prep with stable evidence IDs → Senior Coverage call → durable checkpoint → fact-only Trust Audit call → local correction/labels/seal → dashboard; one shared recovery slot; trust labels (SOURCE_EXACT … UNRESOLVED); stage-level checkpoints bound to content/prompt/schema/model hashes; five phases ending in Billy calibration; explicit no-go standards.

**Assessment:**

| Element | Verdict | Reason |
|---|---|---|
| Two-call normal path | **Adopt** | Directly attacks the verified cost/failure multipliers; nothing in the repo requires more calls for a first read |
| Stage checkpoints keyed to hashes | **Adopt** | The single highest-value reliability fix; the repo already has all the hashing primitives (`_canonical_json_hash`, content identity, parse cache) |
| One shared recovery slot, never full reruns | **Adopt** | Replaces three nested rerun mechanisms with one bounded one |
| Fact-only audit (never scores-as-facts) | **Adopt** | Directly reverses the §4.6 defect |
| Trust labels distinguishing fact/interpretation/judgment | **Adopt, trimmed** | Strong idea; four labels suffice (VERIFIED-QUOTE, FACT-AUDITED, INTERPRETATION, JUDGMENT); six invites taxonomy theater |
| Borderline → "human review" state, not reruns | **Adopt** | Cheaper and more honest than majority-of-three |
| Stable evidence IDs (SMA-P042-L018…) | **Postpone** | Net-new build; the existing verbatim-excerpt verification already blocks invented quotes and fixes wrong page numbers. Add IDs only if the canary shows citation failures the current system can't catch |
| Haiku as auditor | **Test, don't assume** | Plausible economics; zero in-repo evidence on Haiku's fact-extraction reliability for long screenplays |
| Cross-provider (Gemini/GPT) comparison | **Postpone** | Model choice is explicitly not the problem; adds surface area now |
| Claude Max "Billy mode" | **Accept as manual companion only** | REPORTED policy claims (subscription use via official Claude Code / `claude -p`) are consistent with Anthropic's current public guidance but are policy, not contract; unattended 1,000-script processing belongs on the API with the existing budget machinery. Never extract or store consumer OAuth credentials |
| Five-phase program w/ full offline matrix, adversarial review, staged canaries | **Simplify to two phases** | The plan is directionally right but sized like another V9. The offline foundation should be a small PR, not a program |
| Cost estimates ($0.315–0.41/script; $200–500 per 1,000) | **Adopt as planning targets** | Arithmetic checks out against the committed pricing table; treat as targets to verify, not facts |
| "Catalog understates Sonnet 4.6 / Opus 4.7 context" | **Plausible, minor** | Catalog pins 200k (`anthropic-model-catalog.json`); irrelevant to the recommendation since typical screenplays fit comfortably |

**What would prove/disprove the proposal:** the §19 canary — five screenplays, two calls each, factual-accuracy and usefulness checks against known scripts, hard cost cap. Nothing else needs to be built to find out.

---

## 10. Assumptions that should be challenged

| Assumption | Verdict | Evidence |
|---|---|---|
| More coverage produces better selection | **Reject** | 48 criteria + synthesis + verification produced verdict flips on 3/3 variance scripts; no committed evidence any layer improved agreement with human judgment |
| More agents produce better judgment | **Reject** | Same model, five hats (T9, VERIFIED); the synthesis must be told what contradictions to look for |
| More dimensions produce accuracy | **Reject** | Overlapping criteria silently re-weight the score (VERIFIED, §3); pillar noise is the variance driver |
| A numerical score is more trustworthy than a clear recommendation | **Reject until calibrated** | Anchors are placeholders (VERIFIED); 7.36 vs 7.29 is noise by the repo's own measurement. Keep tiers + confidence now; earn numbers back via Q5-style calibration |
| Every screenplay deserves the same analysis depth | **Reject** | Inverted today: weak scripts get ~8 calls, strong ones up to ~145. Depth should follow *uncertainty and promise*, cheaply |
| One model can judge all genres/voices | **Test** | Genre cards exist (good); no comedy signal exists (bad, for a comedy studio); Spanish-language handling exists in parsing but is untested in judgment quality |
| Model agreement indicates truth | **Reject** | Same-family "independent" verification is correlation, not confirmation (VERIFIED §4.6) |
| Disagreement must be resolved into one answer | **Reject** | The UI already displays disagreement well; boundary reruns exist to *erase* it expensively. Report it instead |
| Dashboard should expose every intermediate result | **Mostly reject** | The warning/lineage system is genuinely useful; 48 sub-scores are not decision inputs |
| The system should fully automate final selection | **Reject** | `PRODUCT.md` principle 7 already says humans decide; the engine's hard-fail perfectionism contradicts the product's own charter |
| The most expensive model should read every page | **Reject** | Hybrid auto-Opus doubles cost precisely on the scripts already flagged good, with no measured quality gain |
| Every screenplay must pass through every stage | **Reject** | A confident PASS needs one call, not verification batches |
| **Keep:** deterministic validation before any paid call; immutable versioning; content-hash idempotency; code-owned verdict math; fail-closed money handling | **Keep** | All VERIFIED as working |

---

## 11. Recommended product direction

**The product is a funnel, not a lab.** Its job: never lose a gem, kill weak material cheaply, give contenders a real professional read, and hand Billy a shortlist with reasons. Concretely:

1. **One trustworthy read per screenplay** (senior coverage: story spine, the five lenses as sections, verdict + confidence, strengths/concerns, development notes) — not five pseudo-readers.
2. **Facts checked, taste labeled.** Verify names, relationships, events, ending, quotes. Never "verify" an 8/10.
3. **Uncertainty is a first-class outcome.** Borderline or low-confidence → flagged for human review; never auto-rerun.
4. **Depth on demand, with a reason.** Opus deep-reads, specialist passes (comedy, ending, Mexican dialogue), and Reader Chat stay available as *explicit, logged, per-script* escalations — never automatic.
5. **The shortlist is the home page.** Contenders with "why it advanced / biggest concern / what to fix," linked to page evidence. The grid stays as the archive behind it.
6. **Scores return only after calibration.** Activate the existing Q5 producer-assessment contract once Billy has judged machine output on scripts he knows; until then, tiers + confidence.

---

## 12. Recommended minimal architecture

Reuse the existing skeleton: **Storage → ingest-queue → daemon → llmProxy → Firestore versions → dashboard.** Replace only the middle of `process_job`. New model-facing code should be on the order of hundreds of lines, not thousands.

```
PDF → [existing] parse + page markers + hashes + dedupe + archive     ($0)
    → COVERAGE call (Sonnet 5): senior read, small native schema      (1 call)
    → [code] validate, verify citations, derive tier, CHECKPOINT      ($0, durable)
    → if verdict ≥ CONSIDER or low-confidence PASS:
        AUDIT call (Haiku 4.5, Sonnet fallback): facts only           (1 call)
    → [code] apply audit labels; one shared REPAIR slot if needed     (0–1 call)
    → [existing] seal immutable version → dashboard                   ($0)
```

Per-stage contract (Part 6 requirements):

| Stage | Why it exists | In → Out | Performer | Max calls | Max retries | Checkpoint | Failure recovery | Promotion rule | Rejection rule | Human-review rule | Cost ceiling | Evidence needed before adding complexity |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **0. Ingest/validate** | Readability, dedupe, identity | PDF → page-marked text + hashes | Existing code (`parse_screenplay_pdf_v2`, `source_evidence`, `content_identity`) | 0 | n/a | Parse cache (exists) | Re-parse | Parses ≥80% readable | Unreadable/dupe → skip/needs_review | Extraction disagreement ≥35% → needs_review (exists) | $0 | — |
| **1. Coverage** | The read | Text → coverage JSON | Sonnet 5 via existing `llmProxy` | 1 | 0 fresh retries (repair slot covers malformed output) | **Validated coverage persisted to Firestore** keyed `(content_hash, prompt_sha, schema_sha, model)` | Resume from checkpoint; never re-pay | — | — | `confidence: low` → flag | $0.50 hard per-call cap | Any second-call proposal must beat 1-call coverage on the §16 benchmark |
| **2. Fact audit** | Catch wrong ending/protagonist/fabrications | Text + coverage's factual claims (10–25) → per-claim verdicts | Haiku 4.5 (Sonnet fallback if Haiku fails the canary) | 1 | 0 | Audit result persisted | Resume; coverage never re-paid | All central facts supported → seal | Central fact contradicted → repair slot | Repair fails → `needs_review`, coverage shown with UNVERIFIED banner | $0.15 | Only escalate auditor model if Haiku misses canary facts |
| **3. Repair (shared)** | Fix one malformed section or one failed fact | Broken fragment + page windows → patch | Same model as broken stage | **1 per screenplay total** | 0 | Patch persisted | Fails → `needs_review` (existing state) | — | — | Always logged | $0.20 | — |
| **4. Shortlist assembly** | Billy's decision surface | Sealed coverages → ranked contenders | Code only | 0 | n/a | Firestore | n/a | RECOMMEND + audited → contender list | PASS → archive | Borderline/`needs_review` → review queue | $0 | — |

**Hard invariants:** max 3 model calls per screenplay on the normal path; the screenplay is transmitted at most twice (coverage + audit — structure both calls with identical `tools`/`system` prefix if within cache TTL, else accept two plain sends; do not build cache machinery until measured); no automatic rerun of anything; every paid stage output that validates is durable before the next paid call.

**What existing code performs each part:** daemon queue/claim/watchdog/budget (`daemon.py`), parsing and citation verification (`source_evidence.py`, `parse_screenplay_pdf_v2.py`), identity (`content_identity.py`), tier math if wanted (`verdict_contract.py`, minus boundary logic), sealing (`write_analysis_transaction`), proxy + budget (`llmProxy.ts`, `budgetCounter.ts`), display (`normalizeV9.ts` extended, `producerProjection.ts`, existing warning system).

---

## 13. Coverage format

One coverage document per screenplay, ~2–4 pages rendered. Structure (small enough for native structured output — this is a hard requirement, learned from §4.8):

1. **Identity:** title, author if stated, page count, language, genre + tone (Story Grid clover — reuse `story_grid.py` card *inside* the coverage prompt, not as a separate paid call).
2. **Logline** (one sentence) and **story spine** (protagonist, want/need, opposition, stakes, major turns, climax, ending — stated as *facts*, these feed the audit).
3. **Synopsis** (300–500 words).
4. **Craft assessment — the five lenses as prose sections** (structure, character, craft/dialogue, concept, emotional effect), each with 1–3 page-cited observations, each observation labeled fact vs. interpretation.
5. **Genre intent check:** what the script is trying to be; whether unconventional choices read as intentional — with an explicit instruction not to penalize intentional unconventionality (Part 7 requirement; also closes the "no comedy signal" gap by asking *is it funny on the page, where, why* when genre = comedy).
6. **Three strengths, three concerns** — cited.
7. **Three ranked development priorities** — the field V9 never shipped; required, non-empty.
8. **Verdict:** PASS / CONSIDER / RECOMMEND (FILM_NOW stays a protected human-confirmed label per `PRODUCT.md:31`), **confidence** (high/medium/low), strongest reason to champion, strongest reason to pass, explicit uncertainties.
9. **Commercial notes** labeled as hypothesis (audience, comp titles, budget impression).
10. **Trust block (code-generated):** citation verification results, audit outcomes, labels — VERIFIED-QUOTE / FACT-AUDITED / INTERPRETATION / JUDGMENT.

Section-level impressions (e.g., strong/solid/weak per lens) are allowed for filtering; a single decimal score is not displayed until calibration exists. "Amazing coverage" is testable: accurate spine (audit-checked), real page citations (code-checked), non-empty ranked development notes, explicit uncertainty, and a professional reader judging it as useful as human coverage (§16).

---

## 14. Selection and promotion rules

- **PASS + high confidence:** archived after 1 call. Sample-audited at ~10% for benchmark QA (protects against systematic false rejection at near-zero cost).
- **PASS + low confidence, or any parse/genre anomaly flag:** fact audit runs; if audit is clean but confidence stays low → human review queue, never auto-rerun. *The most important error is losing a gem — low-confidence rejections are never silent.*
- **CONSIDER:** audit always runs; sealed with full coverage; visible in archive + filters.
- **RECOMMEND:** audit always runs; enters the contender shortlist with champion/concern reasons. Optional human-triggered deep read (Opus) — logged with a recorded reason, never automatic.
- **FILM_NOW:** machine may nominate; only a human confirms the label.
- **Borderline (within 0.5 tier-equivalent of a threshold, or audit partially supported):** labeled "borderline — human review recommended," shown with both readings. This *replaces* boundary reruns.
- **Disagreement preservation:** if a second opinion is ever requested (human-triggered), both reads are stored and displayed side-by-side; the system never averages them away.

---

## 15. Cost and reliability guardrails

Most of these already exist and should simply be kept (marked ✓):

- **Max cost per screenplay:** $1.00 hard cap enforced at reservation time (new; the per-call reserve/settle machinery ✓ exists in `budgetCounter.ts`).
- **Max batch cost:** operator-set per batch with a printed pre-run estimate from *measured* per-script cost (replace the broken `estimate_cost`); daily $100 server gate ✓.
- **Max calls per stage / retries:** table in §12; enforced in code, not prompts.
- **Cancellation/pause/resume:** queue statuses ✓ (`pending/processing/waiting_for_budget/needs_review`); add `paused`. Resume = re-run job; checkpoints make it free through completed stages (new).
- **Durable checkpoints:** validated coverage/audit persisted before the next paid call, keyed to `content_hash + prompt_sha256 + schema_sha256 + model + parser_version` (new; hashing primitives ✓).
- **Duplicate detection / stable IDs:** content hash + version-ID replay ✓ — keep exactly as is.
- **Prompt/model version tracking:** manifest hashing ✓ — reuse a trimmed manifest (drop the 86-target claim ledger).
- **Partial-result preservation:** a failed audit never discards coverage (new — the central reversal of V9's behavior).
- **Provider failure / rate limits / timeouts:** proxy taxonomy ✓, including proof-of-zero-spend retry discipline (`ingest_v9.py:6956-6998`).
- **Invalid model output:** native small schema first; one repair slot; then `needs_review` ✓ path.
- **Uncertain-cost semantics:** keep the per-call ledger ✓; fix the roll-up so `actual_cost_*` never includes cap charges (rename to `charged_cost_*`; report settled / uncertain / authorized separately — the discussion is right about this).
- **Audit history:** call receipts + response IDs ✓.
- **Dry-run mode:** manifest-only dry run ✓ (`model_benchmark.py` default); add per-batch pre-flight cost print.
- **No silent escalation:** any Opus/deep-read requires a recorded reason string on the job (new, trivial).

---

## 16. Evaluation benchmark

**Composition (10–20 scripts, no large benchmark initially):** the 3 production-analyzed scripts Billy knows (Matadero, Oro de Acapulco, Hermanos Márquez Castillo — sealed V9 reports exist for direct comparison); 3–5 scripts Billy or trusted readers have already judged, including ≥2 he'd champion and ≥2 clear passes; 1 scanned/OCR PDF; ≥2 Spanish-language; 1 unconventional-structure script; ≥2 comedies (the slate priority); 1 script with an easily-misread ending (the discussion's suggestion — good).

**Metrics:**

| Metric | Target (initial) | How measured |
|---|---|---|
| Recall of strong scripts (champion set reaching ≥ CONSIDER) | 100% — this is the metric that matters most | vs. Billy's labels |
| False rejection rate (known-good → PASS high-confidence) | 0 tolerated | vs. labels |
| Verdict agreement with trusted readers | ≥70% exact tier; no two-tier misses | vs. labels |
| Central factual accuracy (protagonist, relationships, ending, major turns) | 100% | audit + spot-read |
| Hallucination rate (fabricated scenes/quotes) | 0 verbatim-quote failures (code-checked); manual spot-check of events | citation verifier + human |
| Coverage usefulness | Billy/reader rates ≥ human coverage on ≥half the set, never "useless" | blind-ish review |
| Development-note quality | Billy rates ≥2 of 3 notes actionable per script | review |
| Cost per screenplay (settled) | ≤$0.50 p95; ≤$1.00 hard | ledger |
| Completion rate (≤3 calls) | ≥95% first-pass, ≥99% with repair | ledger |
| Resume success | 100%: kill a run after coverage; resume must not re-pay coverage | induced-failure test |
| Duplicate-call rate | 0 | ledger vs. checkpoint keys |
| Time to shortlist | hours, not days, for a 50-script batch | wall clock |

Distinctive-strengths check: for the champion scripts, does the coverage name the thing Billy actually loves about them? (Qualitative, but it is the real product question.)

---

## 17. Keep / simplify / remove / postpone

**KEEP (as is):**
- Daemon queue, claiming, heartbeat, money-aware watchdog, budget parking (`daemon.py`)
- Content identity, version replay, duplicate verification (`content_identity.py`, `daemon.py:792-854, 1512-1533`)
- PDF parsing, page evidence, OCR corroboration, parse cache (`parse_screenplay_pdf_v2.py`, `source_evidence.py`)
- Citation excerpt verification + unique-quote page repair (`source_evidence.py:816-1064`)
- `llmProxy` + reserve/settle budget counter + provenance enforcement (`functions/src/`)
- Immutable version sealing, trust attestation, transaction guards (`ingest_v9.py:600-806`)
- `verdict_contract.py` tier math and penalty derivation (minus boundary-rerun usage)
- Dashboard warning/lineage/disagreement surfaces; Discover + Producer Look structure
- Sealed V9 analyses in Firestore — read-only forensic record; do not migrate or re-run
- Injection isolation and canonical hashing utilities

**SIMPLIFY:**
- Cost roll-up semantics (separate settled / uncertain / authorized at the top level)
- `normalizeV9.ts` — extend for the coverage_v1 shape; populate development notes; delete fabricated dimension mappings
- Trust manifest — keep hash-binding provenance; drop the 86-target claim ledger for new analyses
- CLAUDE.md WWW block — 20 days stale (VERIFIED); rewrite after decisions land

**REMOVE or BYPASS (from the paid path; V9 code may remain as a disabled forensic mode initially):**
- Five-reader fan-out, synthesis roundtable, 48-criterion scoring (as the *paid* pipeline)
- Boundary stability reruns (`run_v9_stable` rerun branch)
- Hybrid auto-Opus promotion (`run_v9_hybrid`)
- Non-binding cold read (a paid stage that cannot affect decisions)
- Claim verification of subjective scores; the 95% support-rate analysis-destroyer
- JSON-string envelope transport (schema must fit native structured output)
- Dead client code: `analysisService.ts` throw path + `multiPassAnalysis.ts` + `promptClient.v9.ts` + `ModelComparisonPanel` (and their tests), orphaned `App.tsx` constellation, `IntakePage.tsx`, `BudgetChart.tsx`, dev-only Discover shells — deletion candidates once Billy confirms nothing sentimental lives there
- The stale `estimate_cost` dry-run estimator (replace with measured figures)

**POSTPONE:**
- Stable evidence-ID system (only if canary shows citation failures the excerpt system misses)
- Cross-provider model comparison (Gemini/GPT)
- Claude Max "Billy mode" local runner (manual companion later; never the batch backbone)
- Numeric score restoration + Q5 calibration activation (after Billy labels the benchmark)
- Genre-conditional reader weights, comedy-specialist pass (test the coverage prompt's genre section first)
- Reader Chat cost review (flag: Opus/Fable at high effort per turn deserves its own look, but it's out of scope here)

---

## 18. Incremental implementation plan

Each phase leaves the app working; nothing deploys without the existing human approval gate.

**Phase 1 — Truth in accounting + freeze (no user-visible change except honest numbers).**
Scope: label V9 routes non-default in daemon config; fix cost roll-up naming (settled vs. charged vs. authorized); update CLAUDE.md WWW. Reuses: ledger machinery. Removes: nothing. Risk: minimal (rename + config). Verification: existing 231+ Python tests + new roll-up tests. Cost: $0. Stop if: any test regression.

**Phase 2 — coverage_v1 offline (feature-flagged off).**
User-visible: nothing yet (fixture-backed preview behind a dev flag). Scope: one coverage prompt + small native schema; one audit prompt + schema; two-stage state machine in the daemon with durable checkpoints; `normalizeV9`-style normalizer populating development notes; repair slot; hard $1/script reservation cap. **Scope guard: target ≤ ~1,500 new lines including tests; if it grows past that, stop and re-scope — that smell is how V9 happened.** Reuses: everything in KEEP. Bypasses: run_v9_full path for the new route. Risk: schema too large for grammar compiler → trim the contract, never re-adopt the string envelope. Verification: fixture replay, induced-failure resume test, citation-verifier pass on mocked outputs, full existing test suite. Cost: $0. Stop if: the contract can't fit native structured output after trimming (then the design is wrong, not the provider).

**Phase 3 — the canary (§19).** Cost ≤ $10.

**Phase 4 — benchmark batch (only after canary passes).**
User-visible: 10–20 real coverages in the dashboard (staging collection). Scope: run §16 set; Billy labels/rates. Cost boundary: ≤ $25 total, batch API where possible. Stop if: any §16 red line (false rejection, wrong ending, "useless" rating, p95 > $0.60).

**Phase 5 — promote + prune.**
User-visible: coverage_v1 is the default for new uploads; shortlist view fed by real development notes; V9 marked forensic. Scope: flip default, delete dead client code, remove V9 from the paid path. Risk: normalizer edge cases on legacy docs — mitigated because sealed V9 docs are untouched and already render. Verification: full suite + Playwright + the existing deploy approval gate. Cost: $0 beyond ongoing per-script. Stop if: legacy rendering regressions.

**Phase 6 (later) — calibration.** Activate the existing Q5 producer-assessment contract with Billy's real verdicts; only then discuss restoring numeric scores.

---

## 19. First experiment

**Phase 2 is the true first experiment and costs $0:** prove the two-call contract, checkpoints, resume, and dashboard display entirely on fixtures. The first *paid* experiment (Phase 3, requires Billy's explicit authorization):

- **5 screenplays:** Matadero, Oro de Acapulco, Hermanos (known + already analyzed → direct comparison against sealed V9 reports at a total prior cost of $6.92 per CLAUDE.md), + 1 scanned/OCR, + 1 Spanish-language comedy.
- **2 calls each** (coverage + audit), repair slot armed, checkpoints on. Sequential. One induced mid-run kill on script #2 to prove resume doesn't re-pay.
- **Maximum cost: $10 total, $1.50/script hard reservation cap** (headroom over the $1 target so the cap itself isn't the failure).
- **Evidence to continue:** 5/5 correct protagonist/relationships/ending; 0 verbatim-citation failures; development notes Billy rates actionable on ≥3 of 5; settled cost ≤$0.60/script p95; resume test passes with 0 duplicate paid calls.
- **Evidence to stop:** any wrong ending/protagonist in a sealed report; Billy rates the coverage less useful than the V9 report on a majority; cost >$1/script; resume re-pays anything. Stopping means the *contract* is wrong — fix the prompt/schema and re-canary (another ≤$10), or revisit the architecture; it does not mean reverting to V9.

---

## 20. Open questions and unknowns

1. **UNKNOWN: actual Santa-run telemetry.** The manifests live only in the local, gitignored `benchmark-artifacts/` on the Mac. The discussion's figures are plausible but unverified. If Billy wants them confirmed, the two manifest JSONs can be shared read-only.
2. **UNKNOWN: Haiku's fact-audit reliability on long screenplays.** The canary decides Haiku vs. Sonnet as auditor.
3. **UNKNOWN: whether Claude Max / Agent SDK subscription terms will continue to permit local `claude -p` workloads.** REPORTED as currently allowed for individual use; treat as a convenience, never a dependency.
4. **UNKNOWN: composition of the 1,000-script backlog** (language mix, scan quality, genre mix) — materially affects benchmark design and OCR priorities.
5. **UNKNOWN: what Billy needs from comparative ranking** — tiers + confidence, or eventual calibrated numbers. Determines how much of the scoring apparatus ever comes back.
6. **INFERRED, unquantified: Reader Chat unit economics** (Opus 5/Fable 5, high effort, full PDF per turn). Deserves its own small review; not part of this decision.

---

## 21. Evidence appendix

### Runtime verification performed on this clone (2026-08-31)

| Check | Result |
|---|---|
| `npm run build` (tsc + Vite) | ✅ built in 19.03s |
| `npm run lint` | ✅ clean |
| `npm run test:run` | ✅ 141 files, **1,036 tests passed** |
| `python3 -m execution.test_cost_accounting` | ✅ 129 tests OK |
| `python3 -m execution.test_trust_manifest` | ✅ 78 tests OK |
| `python3 execution/test_verdict.py` | ✅ 24 tests OK |
| `claim_verification_targets(complete_analysis())` executed | **86 targets**: 70 mixed / 12 evaluative / 4 factual; 48 = reader sub-scores; floor not ceiling |
| `model_benchmark --help` (no-spend) | Dry-run default confirmed; paid mode requires per-PDF SHA-256 approval + explicit flags |
| App run | Not attempted against production Firebase from this environment; static landing-page data path verified by code |
| Paid model calls | **None made** |

### Key citations (file:line, all verified in this clone)

**Engine:** JSON-string envelope `execution/ingest_v9.py:2705-2745`; retry constants `:330-336`; reader registry/system blocks `:8046-8090`; sequential reader loop `:11733`; panel hard-fail `:11719-11809`; synthesis `:8920-8944, 11856-12422`; boundary reruns `:12578, 12664-12852` + `execution/verdict_contract.py:22-23`; hybrid promotion `:12891-12979`; claim verification `:10505-10896`, destruction on unsupported scores `:10329-10386`; same-model auditor `:13503-13521`; placeholder anchors `:7292-7336`; cold read `:13195, 13009-13024`; non-binding policy `docs/ANTHROPIC-MODEL-CATALOG.md:19`; uncertain-cost roll-up `:5234-5236, 5361-5362`, `daemon.py:1902-1911`; stale estimator `:13571-13588`; call bounds §3 arithmetic from the above.

**Trust:** 86-target generation `execution/trust_manifest.py:376-800`, scores-as-claims `:724-752`; batch size `:306`; no evidence-ID system (exhaustive negative search of `source_evidence.py`, `ingest_v9.py`, `trust_manifest.py`); excerpt verification `source_evidence.py:816-832, 876, 1058-1300`.

**Benchmark:** receipts-only checkpoints `execution/model_benchmark.py:3250-3279`; unresumable failed runs `:3435-3448`; $80 ceiling `:129`; Santa pilot floor `:130-131, 1732-1735`; $40→$80 raise `633b6e9` (PR #69); audited snapshot "$37.511973 / 203 calls / $7.627776 uncertain" `docs/ANTHROPIC-MODEL-CATALOG.md:65`, `docs/BENCHMARK-CANDIDATE-ROLLOUT.md:12`.

**Client/product:** dead browser pipeline `src/lib/analysisService.ts:61-84`; empty development notes `src/lib/normalizers/normalizeV9.ts:462-465` (+ dead UI `ScreenplayFileWorkspace.tsx:363-368`, `developmentOpportunity.ts:141-148`); 48 criteria `src/lib/promptClient.v9.ts:64-123` (cross-checked against daemon schemas; character = 11 scored criteria + a 5-boolean story-vs-situation checklist, `ingest_v9.py:7545-7655`); verdict thresholds `multiPassAnalysis.ts:956-961`; orphaned `App.tsx` (no importers); static landing data `src/data/studio-pulse-market-snapshot.json`; upload cost guesses `src/components/settings/upload/upload.constants.ts:15-20`; Reader Chat models `functions/src/modelRegistry.ts:9-21`, full-PDF-per-turn `functions/src/readerChat.ts:661-672`; daily budget `functions/src/llmProxy.ts:54-56`, `functions/src/budgetCounter.ts`.

**Reliability (keep):** duplicate/replay `daemon.py:792-854, 1512-1533`; money-aware watchdog `daemon.py:392-419`; paid-failure discipline `daemon.py:1118`; immutable sealing `ingest_v9.py:600-806`; zero-double-bill transport `ingest_v9.py:6956-6998`; parse cache `ingest_v9.py:930, 293-297`.

**History:** V9 birth `4009584` (2026-06-06, via GitHub API — shallow clone grafts at 2026-08-17); remediation wave `295ad63..c18d35a` = 73 commits / 36 PRs / +46,465 lines in ~46h; `ingest_v9.py` growth 4,737→13,759 lines (08-17→08-30); add-revert loop `cc17ae4`→`f88a56f` (40 minutes); assertion reversal `2481750`→`e97d9ea`.

**Studies:** variance `docs/audits/2026-07-02-variance-results.md` (spreads 0.74/0.78/0.80; 3/3 verdict flips; ~$12); pipeline audit T1–T10 `docs/audits/2026-07-01-analysis-pipeline-audit.md`; development-exec review `docs/audits/2026-07-01-reiner-review.md`; trust-hardening arc `docs/trust-hardening/Q0–Q5` (Q5: "Nothing in this contract is deployed or active yet").

---

## 22. Addendum — Billy's decisions (2026-08-31)

Billy answered the three open questions after reviewing this report. These decisions refine §11–§19 and are now the plan of record.

### 22.1 Calibration by reaction, not pre-labeled scripts

Billy will not pre-label a benchmark set. Instead: the engine judges first on objective craft — structure, genre conventions, screenplay best practices — and Billy reads and records **agree/disagree verdicts on scripts the engine surfaces as RECOMMEND or FILM NOW**. This matches the existing Q5 producer-assessment design (machine output locked first, producer verdict recorded after) and the variance evidence that craft ranking is stable even where decimal scores are noisy.

**Blind-spot guard (required):** reviewing only winners can never detect a falsely rejected gem. The review queue must therefore also include every **low-confidence PASS** and a **~5% random sample of ordinary PASSes**. Disagreements are recorded, versioned, and only then folded into prompt updates (never recalibrated from one example).

Consequence for §16: the initial benchmark measures factual accuracy, citation integrity, cost, and completion — the taste-agreement metrics accrue progressively from Billy's reaction verdicts rather than from a pre-labeled set.

### 22.2 Coverage format confirmed; methodology grounding

Verdict + confidence + story spine + strengths + concerns + development notes confirmed. Numeric per-dimension scores are **dropped** in favor of **per-lens grades (strong / solid / weak)** used for sorting and filtering; decimals return only if reaction-verdict history later proves a calibrated score predicts Billy's decisions.

Methodology grounding: **Story Grid is already embedded** (`execution/story_grid.py` + `story_grid.json` genre cards feed reader prompts today — VERIFIED) and carries forward into the coverage prompt. **Save the Cat and McKee are not in the repo**; they will be distilled into compact prompt cards in the same style as `story_grid.json` (BS2 beats; McKee principles) as a one-time authoring task in Phase 2. Session-level skills cannot be invoked by the production daemon; only repo-committed prompt assets count.

### 22.3 Interaction with scripts is retained

Billy wants to keep talking to whoever read the script. Decision: **Private Reader Chat survives unchanged in concept** — it is on-demand (cost only when used), which fits the depth-on-request principle. The five reader personas remain available as *prompt framing* grounded in the sealed coverage + full screenplay text; they do not require five separate paid analyses to exist.

Cost fix flagged for a follow-up: current chat defaults to Opus 5 with Fable 5 escalation at high effort and re-sends the entire PDF every turn (`functions/src/modelRegistry.ts:9-21`, `readerChat.ts:661-672`). Recommended: Sonnet 5 default, per-conversation prompt caching (a stable prefix within one conversation *can* cache, unlike the V9 reader fan-out), escalation only on explicit request — an estimated 5–10× per-turn reduction.

### 22.4 Genre priorities and the genre-contract section

Theatrical priorities: **horror and comedy, high-concept**. Streaming TV: any genre. Minimum bars: horror must be genuinely scary; comedy must be genuinely funny — *on the page*.

Consequences:
- The §13 coverage contract gains a hard **genre-contract section**: for horror — dread escalation and scares located by scene, cited; for comedy — laughs on the page, set pieces, escalation, cited. Structurally competent scripts that fail their genre's minimum bar are capped at CONSIDER with the failure stated as the reason. This closes the "no comedy signal" gap (reiner review's "single largest methodology gap for Lemon").
- §16 benchmark and §19 canary composition become horror/comedy-heavy.
- **TV pilots are a separate, later contract** (series engine, goal/dilemma framing); the current parsing/engine stack is feature-oriented (`story_grid.py` TV layer deliberately unwired). Features first.
