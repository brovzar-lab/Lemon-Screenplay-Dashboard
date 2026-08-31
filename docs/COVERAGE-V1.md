# Coverage V1 — the lean two-call coverage engine

**Status: built and fully offline-tested. DISABLED by default. No paid call has been made through it.**

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
| `execution/test_coverage_v1.py` | 27 offline tests (fake transport; no network) |
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
  cannot invent citations that pass).
- Contradicted central facts (wrong ending/protagonist) → `needs_review`,
  never an automatic rerun.
- Budget cap fails closed and preserves paid, validated work.
- Spanish text and Unicode titles survive end to end.
- Schemas stay within a strict compiler budget (60 properties, no unions) —
  the JSON-string envelope workaround is structurally unavailable.

## Next step: the canary (requires Billy's explicit authorization)

Five screenplays, sequential, `max_cost_usd` $1.50 hard cap each, **$10 total**:
Matadero, Oro de Acapulco, Hermanos (known scripts with sealed V9 reports for
direct comparison), one scanned/OCR PDF, one Spanish-language comedy. One
induced mid-run kill must prove resume repays nothing. Continue only if:
5/5 correct protagonist/relationships/ending, zero verbatim-citation failures,
development notes rated actionable on ≥3 of 5, settled cost ≤$0.60/script.
The first coverage call also validates that the schema compiles natively —
if the provider rejects it, trim the contract; never re-adopt the string
envelope.
