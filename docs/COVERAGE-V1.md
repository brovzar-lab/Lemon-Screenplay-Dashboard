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
*zero fabricated citations*. Next gate: the 20-script benchmark (≤$25,
requires Billy's authorization). The route remains DISABLED by default in
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

The scorecard prints the automated bars (batch/script caps, ≤3 calls,
zero unverified citations, resume-repaid-nothing, ≤$0.60 settled) and the
human checklist (spine facts correct, development notes actionable, at
least as useful as the V9 report). Send `scorecard.json` and the five
`reports/*.json` back for adjudication.
