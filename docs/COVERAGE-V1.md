# Coverage V1 — the lean two-call coverage engine

**Status: CANARY PASSED 2026-08-31 — two rounds, $5.02 of the authorized
$10.** Round 1 ($3.09): human bars passed — Billy confirmed correct story
spines/endings and rated the development notes pay-worthy; the corrupted
scanned fixture was diagnosed and PASSed instead of hallucinated; three
mechanical findings were fixed the same day (citation page-relocation ported
from V9; lens-id/verbatim-quote prompt rules; a Sonnet retry via the shared
repair slot for incomplete Haiku audits, which had failed-closed Oro de
Acapulco). Round 2 ($1.93): all five sealed — Matadero RECOMMEND,
Oro/Hermanos/Slasher CONSIDER (Oro's spine/ending Billy-confirmed), fixture
PASS — with zero repairs on real scripts, worst settled cost $0.53/script
(bar: $0.60), the resume drill recorded `repaid_nothing: true`, and 51/55
citations verified. The 4 unverified were each proven real passages by
`coverage_v1_citation_diag` (zero fabrications); both near-miss patterns
(a "/" marking a screenplay line break; one normalized leading word) are now
matched deterministically by the verifier, so the citation bar is met as
*zero fabricated citations*.
Calibration re-run 2026-09-01 (Matadero + Hermanos, $1.43, both sealed,
verdicts unchanged): both briefs' fixes validated on the page — Matadero's
ending carries the cut to the living Carnicero, the climax is multi-stage
with the HERMANA freeze, the photo note reframed to "sharpen the existing
plant"; Hermanos' false loophole claim replaced by the real scoring-rules
incoherence; genre-contract lenses grade not_applicable across genres;
printed-page numbering detected from headers on both; the continuity sweep
caught the Rosa/Esperanza name overlap, the rules contradiction, a
previously unknown 2-vs-3-point scoring error, and Matadero's Supervisor
age jump; the audit contradicted three overstated Matadero concerns
(including a free-written page count) and the seal review-flagged both
reports honestly. Two unverified citations were near-misses (edge
punctuation — now normalized; a quote stitched across a dialogue
interruption — correctly stays flagged). Known residual: Fausto's
birth-order contradiction (p.13 "tercer hermano" vs p.121 "el mayor")
propagated into the spine unflagged; watch in the benchmark. Costs rose to
$0.68/$0.75 per script — one repair each (major_turns count now stated in
the prompt; the Sonnet audit retry working as designed) plus the 16-claim
audit; the $0.60 target predates the audit teeth and the working cap is
now ~$0.75. **Engine v1.1 VALIDATED LIVE 2026-09-01** (Slasher, sealed,
$0.599 settled — under the original $0.60 target with the governance
stage): the fact-repair stage fired for the first time (coverage + audit +
fact repair + re-audit, 4 calls), rewrote the audit-flagged central claims
and re-audited them, sealing with one honest interpretive partial and a
weighted support_rate of 0.8889; the CHARACTER PAGE INDEX is cited by name
in the development notes (Emiliano note reframed per rule 15), no absence
claims, no family inversion, 11/11 citations verified. Two live failures
on the way were absorbed into the infrastructure: a persistently missing
audit verdict now seals as an explicit 'unclassified' with review teeth
instead of destroying the run; the canary checkpoint store is shared
across invocations (a per-run store had silently re-bought paid coverage);
the structure-repair output ceiling is 16k; and any exception becomes a
failed_closed scorecard row instead of aborting the batch. Canary grant
closed at ~$9.20 of $10.
**BENCHMARK AUTHORIZED 2026-09-01: Billy approved $25 for the 20-script
benchmark** (its own grant). The route remains DISABLED by default in
production.**

Coverage V1 is the replacement for V9's paid analysis machinery recommended by
[`SCREENPLAY-DASHBOARD-REASSESSMENT.md`](SCREENPLAY-DASHBOARD-REASSESSMENT.md).
V9 remains untouched as the forensic record of already-sealed analyses and as
the default engine until the canary passes and the route is deliberately
promoted.

## What it does

Two paid calls per screenplay, one optional repair, hard $1 cap:

```
PDF → [existing] parse + page markers + hashes + dedupe + immutable archive   ($0)
    → SENIOR COVERAGE   one Sonnet call, methodology lenses, native schema    (call 1)
    → [code] validate + verify citations verbatim + durable CHECKPOINT       ($0)
    → FACT AUDIT        one Haiku call, story-spine facts only                (call 2)
    → [code] adjudicate + verdict caps + labels + optional 1 repair          (0–1 call)
    → coverage_v1_reports staging collection                                  ($0)
```

- **No boundary reruns. No hybrid Opus promotion. No verification of taste.**
  Borderline or low-confidence results are labeled `human_review_recommended`
  instead of being re-bought.
- **Checkpoints**: validated coverage and audit outputs are durably stored
  (locally or in `coverage_v1_checkpoints`) before the next paid call, keyed
  to content + parser + prompt + schema + lens + model hashes. A retry after
  any failure resumes free through every stage that already validated; any
  drift produces a new key so stale work is never reused; tampered
  checkpoints are rejected.
- **Verdict rules in code**: model FILM_NOW becomes a *nomination* on a
  RECOMMEND (a human confirms the protected label); a failed genre contract
  caps RECOMMEND at CONSIDER.
- **Genre contracts are hard bars**: horror must be scary on the page, comedy
  must be funny on the page, with cited scenes either way.
- **Development priorities are mandatory** — three ranked moves with why/how,
  normalized into the dashboard (the field V9 always left empty).
- **Cost is reported as settled / uncertain / charged, never conflated**, and
  a local per-screenplay cap (default $1.00) fails closed while keeping
  checkpoints. The existing server-side $100/day gate still applies to every
  call.

## Calibration briefs

Billy's line-by-line human audits of sealed coverage against the actual
screenplay are the engine's calibration mechanism. Each brief is stored
verbatim under `docs/calibration/` and distilled into permanent HOUSE
READING RULES in `COVERAGE_CHARTER` (`execution/coverage_v1.py`); the
verbatim brief is the source of record. Absorbed so far:

- **2026-08-31 Matadero** (`docs/calibration/2026-08-31-matadero-calibration-brief.md`):
  ten reading rules — dialogue is a claim, never collapse a multi-stage
  climax, never invent a structural beat ("NOT LOCATED:" instead), search
  for the plant before prescribing one, classify violence by function,
  count from a ledger, reconcile fields before sealing, `not_applicable`
  lens grades (schema + dashboard support added), one page-number
  convention stated per report (`page_convention`), and supporting-cast
  theme tells. The audit charter also gained the dialogue-vs-staging rule.
- **2026-09-01 Slasher** (`docs/calibration/2026-09-01-slasher-calibration-brief.md`,
  the generalization test — a fresh run on a script that contributed no
  rules): Part Zero confirmed the brief #1/#2 fixes all landed. New, as
  **engine coverage-v1.1**: a code-generated CHARACTER PAGE INDEX in both
  prompts kills the now-proven-systematic false-absence bias at the source;
  house rules 14–16 (relationship graph, behavior ledger, scene function
  before condemnation); a **fact-repair stage** — central claims the audit
  marks partially supported are rewritten per the auditor's notes and
  re-audited before sealing (call ceiling 3 → 5, contradictions still go
  straight to human review); and `support_rate` weighted so partials count
  0.5 (a review-flagged report can no longer read 1.0).
- **2026-09-01 Hermanos** (`docs/calibration/2026-09-01-hermanos-calibration-brief.md`):
  three new reading rules (unseeded/deus-ex-machina claims require an
  exact-string backward search; read to the sequence end plus one page for
  third-party buttons; pacing-claim limits with one page range per
  sequence) plus four structural changes — a required `continuity_flags`
  field (the continuity sweep), concerns and `pass_reason` added to the
  audited claims with an absence-claim search rule (a contradicted one
  flags human review), any nonzero unverified-citation count now forces
  `human_review_recommended`, and printed-page numbering: the physical→
  printed offset is detected from page headers in code and the [PAGE N]
  markers are renumbered before the model reads the text, so every page
  reference in the report is a printed page (fallback to physical, stated,
  when no headers are detectable).

Note: a distilled prompt change alters `prompt_sha256`, which deliberately
invalidates existing checkpoints — the next run of any script re-pays both
calls under the new rules.

## Methodology lenses

Billy's 30 screenwriting skills are imported verbatim under
`execution/lenses/skills/`. Fifteen of them are distilled into compact
evaluation-only prompt cards (`execution/lenses/cards/*.md`, ≤4,500 bytes
each) registered in `execution/lenses/registry.json`:

| Stack | Lenses |
|---|---|
| `feature_default` | lemon-coverage, save-the-cat, story-grid |
| `tv_pilot_default` | grisanti-pilot, grisanti-series, lemon-coverage |
| genre contracts | horror-contract (horror), comedy-contract (comedy) — matching contract added by `genre_hint`; both included when the genre is unknown |
| optional | truby, bmoc, enneagram, story-stakes, arndt-endings, km-weiland, women-in-story, pluma-mexicana |

Lenses are switchable per job (`lenses: [...]` on the ingest-queue doc), max
6 per run. Each lens appears as its own graded (strong/solid/weak), page-cited
section of the single senior read — the five-readers-in-one-report design.

## How to enable (deliberately, later)

The route is double-gated and OFF by default:

1. The daemon must run with `LEMON_ENGINE_COVERAGE_V1=1`.
2. The ingest-queue job doc must carry `engine: "coverage_v1"`.

Anything else runs V9 exactly as before. When enabled, results are written to
the **staging collections** `coverage_v1_reports` / `coverage_v1_checkpoints`;
the immutable `uploaded_analyses` store is never written by this route.
Promotion into the main store is a separate, later decision (after the
canary), on purpose.

Optional job fields: `format: "tv_pilot"`, `genre_hint: "horror"|"comedy"`,
`lenses: [ids]`, `max_cost_usd` (≤ the $1 default unless raised deliberately).

## Files

| File | What |
|---|---|
| `execution/coverage_v1.py` | Engine: schemas, prompts, lens loader, checkpoints, two-call state machine, citation verification, cost split |
| `execution/test_coverage_v1.py` | 34 offline tests (fake transport; no network) |
| `execution/coverage_v1_citation_diag.py` | Offline near-miss vs fabrication diagnostic for unverified citations ($0) |
| `execution/test_daemon_coverage_route.py` | 8 offline tests for the daemon route |
| `execution/lenses/` | registry.json, cards/ (15 distilled), skills/ (30 imported sources) |
| `daemon.py` → `run_coverage_v1_job` | The gated daemon branch |
| `src/lib/normalizers/normalizeCoverageV1.ts` | Dashboard normalizer (development notes populated) |

## Offline guarantees proven by tests

- Normal completion = exactly 2 calls; at most 1 repair; repair never resends
  the screenplay.
- Invalid coverage cannot seal; incomplete audits cannot seal.
- A failure after coverage resumes at the audit **without repaying coverage**;
  a full replay makes **zero** calls.
- Prompt/schema/model/lens/source drift invalidates checkpoints; tampered
  checkpoints are rejected.
- Fabricated quotations are flagged by verbatim page verification (models
  cannot invent citations that pass). Known transcription-format artifacts —
  a "/" marking a screenplay line break, one normalized leading word on a
  long quote — verify deterministically instead of false-flagging, and a
  verbatim quote on exactly one other page is relocated, not rejected.
- Contradicted central facts (wrong ending/protagonist) → `needs_review`,
  never an automatic rerun.
- Budget cap fails closed and preserves paid, validated work.
- Spanish text and Unicode titles survive end to end.
- Schemas stay within a strict compiler budget (60 properties, no unions) —
  the JSON-string envelope workaround is structurally unavailable.

## The canary (authorized by Billy 2026-08-31, $10 total)

Five screenplays, sequential, `max_cost_usd` $1.50 hard cap each, **$10 total**:
Matadero, Oro de Acapulco, Hermanos (known scripts with sealed V9 reports for
direct comparison), one scanned/OCR PDF, one Spanish-language comedy. An
induced mid-run kill on script #2 proves resume repays nothing. Continue only
if: 5/5 correct protagonist/relationships/ending, zero fabricated citations
(an unverified citation must be proven a real passage via
`coverage_v1_citation_diag`, and its transcription pattern added to the
deterministic verifier), development notes rated actionable on ≥3 of 5,
settled cost ≤$0.60/script. The first coverage call also validates that the schema
compiles natively — if the provider rejects it, trim the contract; never
re-adopt the string envelope.

### How to run it

The runner is `execution/coverage_v1_canary.py`. It needs two things this
repo does not carry: the five PDFs on local disk and `PROXY_SERVICE_KEY`
(the daemon's key for llmProxy) — so run it **on the VPS** (or any machine
with both). It makes NO Firestore writes; artifacts go to the gitignored
`benchmark-artifacts/coverage-v1-canary-<timestamp>/`.

```bash
ssh root@<vps>
cd /opt/lemon-ingest && git pull origin main   # or check out the branch
mkdir -p canary   # put the five PDFs here
cp execution/canary-manifest.example.json canary.json   # edit the pdf paths

# 1. Free dry run — hashes, parses, lens stacks, cost plan; zero calls:
python3 -m execution.coverage_v1_canary --manifest canary.json

# 2. The paid run (double-gated; $10 batch cap and $1.50/script enforced):
PROXY_SERVICE_KEY=$LEMON_PROXY_KEY \
python3 -m execution.coverage_v1_canary --manifest canary.json \
  --execute --i-authorize-paid-inference
```

The scorecard prints the automated bars (batch/script caps, ≤5 calls,
zero unverified citations, resume-repaid-nothing, settled cost) and the
human checklist (spine facts correct, development notes actionable, at
least as useful as the V9 report). Send `scorecard.json` and the
`reports/*.json` back for adjudication.

## The 20-script benchmark (authorized by Billy 2026-09-01, $25 total)

Runs on the same runner with a 20-entry manifest once Billy provides or
approves the titles:

```bash
venv/bin/python -m execution.coverage_v1_canary --manifest benchmark.json \
  --execute --i-authorize-paid-inference --max-total-usd 25
```

Slate design (what makes the result informative): scripts Billy knows well
enough to react to every verdict — roughly 5 strong / 10 middling / 5 weak
by his own prior judgment, spread across horror, comedy, and high-concept,
plus 2–3 TV pilots with `"format": "tv_pilot"` to exercise the Grisanti
stack for the first time. Expected cost ≈ $0.60–0.90/script under engine
v1.1 (fact repair fires only when the audit finds central imprecision).

What the benchmark establishes that the canary could not:
1. **Verdict calibration** — Billy reacts agree/disagree to every verdict;
   the distribution against his prior strong/middling/weak ranking is the
   headline metric (RECOMMEND should surface his strong picks; PASS/
   CONSIDER should not swallow one).
2. **Genre contracts at scale** — do horror/comedy bars cap the right
   scripts and never the wrong ones.
3. **Rule generalization rates** — frequency of review flags, fact-repair
   firings, continuity findings, unverified citations, and any recurrence
   of the calibrated-away failure modes across 20 unseen-by-the-rules
   scripts.

Promotion into production (enabling the daemon route + dashboard read)
remains a separate decision after Billy reviews the benchmark results.
