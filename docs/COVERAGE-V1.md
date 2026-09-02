# Coverage V1.2 — qualitative screenplay coverage

**Current status, 2026-09-02:** Coverage V1.2 P0 reliability changes are
implemented locally and covered by no-spend tests. The implementation is based
on Billy's approved audits of all 20 V1.1 benchmark reports, preserved under
`benchmark-artifacts/coverage-v1-audit-packages/`. The audit upheld all 20
qualitative verdicts, rated 19 reports mostly proper with corrections, and
found El Arbol Negro materially unreliable because its ending mechanics were
misread. V1.2 has not been run against the 20 PDFs, promoted, deployed, or used
to write production data. V9 remains the production analyzer. Reports remain
qualitative and unrankable with `analysis_version: "coverage_v1"` and
`scoreSource: "coverage_unscored"` at the frontend normalization boundary.
No-spend verification passed on 2026-09-02: 72 focused V1.2 engine tests, 503
Python execution tests, 1,085 frontend tests across 146 files, and the full
TypeScript/Vite production build.

**Historical V1.1 canary: PASSED 2026-08-31 — two rounds, $5.02 of the authorized
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
The V1.1 20-script run and its human audit are now complete. That prior spending
authorization does not authorize a V1.2 rerun. The route remains disabled by
default in production.

Coverage V1 is the replacement for V9's paid analysis machinery recommended by
[`SCREENPLAY-DASHBOARD-REASSESSMENT.md`](SCREENPLAY-DASHBOARD-REASSESSMENT.md).
V9 remains untouched as the forensic record of already-sealed analyses and as
the default engine until Coverage is deliberately promoted.

## What it does

The normal path is two paid calls per screenplay, with bounded repair calls and
a hard local cost cap:

```
PDF → [code] parse + typed PDF/printed-page/scene map + hashes                 ($0)
    → SENIOR COVERAGE   methodology lenses, qualitative native schema          (call 1)
    → [code] validate + normalize citations + build evidence checks/registry   ($0)
    → FACT AUDIT        claims + five reliability guards + ordered ending pass (call 2)
    → [code] adjudicate + bounded repair/re-audit when eligible                (bounded)
    → coverage_v1_reports staging collection, only when separately enabled     ($0)
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
- **Page identities stay separate**: each physical PDF page records an optional
  printed-page label, the one valid citation coordinate, and any scene numbers.
  Impossible pages and scene numbers masquerading as pages are rejected.
- **Existing evidence is checked before absence claims**: every development
  priority and every high-risk absolute claim gets a complete-script search
  record. The auditor must inspect setup, action, payoff, and aftermath before
  accepting it.
- **Central facts have one registry**: protagonist, want, need, opposition,
  stakes, turns, climax, ending, and material causal claims are reconciled
  across the synopsis, lenses, concerns, priorities, uncertainties, and verdict
  cases. An eligible repair returns and re-audits the complete report.
- **Climax and ending order is explicit**: the audit records actor, action,
  result, character knowledge, audience knowledge, page, final scene, tag, and
  aftermath. Missing tags remain `NOT PRESENT`; multi-stage climaxes stay
  multi-stage.
- **Citation checks are independent**: text existence, page correctness, and
  relevance to the attached claim must all pass. Normalization handles layout
  line breaks, line-end hyphens, revision marks, whitespace, curly quotes,
  punctuation, and ellipses without accepting a wrong page.
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

## V1.1 human-audit benchmark

Billy personally approved an independent full-screenplay audit for each of the
20 V1.1 reports. The immutable source set is:

- `benchmark-artifacts/coverage-v1-audit-packages/00-CALIBRATION-SYNTHESIS/Coverage-V1.1-Human-Audit-Synthesis.md`
- `benchmark-artifacts/coverage-v1-audit-packages/00-CALIBRATION-SYNTHESIS/Coverage-V1.1-Human-Audit-Ledger.json`
- each screenplay package's `DROP-BILLY-APPROVED-AUDIT-HERE/Billy_Audit.md`

The verdicts were directionally strong: all 20 were upheld. Reliability was
not yet sufficient to promote the engine: 19 reports were mostly proper with
corrections and El Arbol Negro was materially unreliable. The two critical
reading failures were W.I.L.L., where the decisive climax order and Angela's
agency were reversed, and El Arbol Negro, where the final sacrifice mechanism
was misdescribed. Recurring P0 failures affected existing-evidence handling
(18 reports), citation verification (14), cross-field propagation (12), page
identity (11), and literal climax/ending reconstruction (5). Those five
patterns define the V1.2 implementation and regression suite.

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
V1.2 benchmark and human review), on purpose.

Optional job fields: `format: "tv_pilot"`, `genre_hint: "horror"|"comedy"`,
`lenses: [ids]`, `max_cost_usd` (≤ the $1 default unless raised deliberately).

## Files

| File | What |
|---|---|
| `execution/coverage_v1.py` | Engine: schemas, prompts, page map, evidence gates, canonical facts, sequence audit, checkpoints, citation verification, cost split |
| `execution/test_coverage_v1.py` | 72 offline engine tests (fake transport; no network) |
| `execution/coverage_v1_citation_diag.py` | Offline near-miss vs fabrication diagnostic for unverified citations ($0) |
| `execution/test_daemon_coverage_route.py` | 8 offline tests for the daemon route |
| `execution/lenses/` | registry.json, cards/ (15 distilled), skills/ (30 imported sources) |
| `daemon.py` → `run_coverage_v1_job` | The gated daemon branch |
| `src/lib/normalizers/normalizeCoverageV1.ts` | Dashboard normalizer (development notes populated) |

## Offline guarantees proven by tests

- Normal completion is exactly 2 calls. Structural correction uses at most one
  shared retry and never resends the screenplay; an eligible factual repair
  must return the complete report and pass a fresh audit.
- Invalid coverage cannot seal; incomplete audits cannot seal.
- A failure after coverage resumes at the audit **without repaying coverage**;
  a full replay makes **zero** calls.
- Prompt/schema/model/lens/source drift invalidates checkpoints; tampered
  checkpoints are rejected.
- Fabricated quotations are flagged by verbatim page verification (models
  cannot invent citations that pass). Text, page, and claim relevance are
  verified separately. Known transcription artifacts are normalized, and a
  verbatim quote on exactly one other page is relocated rather than accepted
  at the wrong location.
- PDF indexes, printed-page labels, citation coordinates, and scene numbers
  are typed separately. Structured and prose page references outside the
  citable set fail validation.
- Every development priority and high-risk absolute claim produces a complete-
  screenplay evidence check; the audit cannot pass a conflicting aggregate
  guard over failed detail rows.
- Each live audit tool is bound to the exact claim IDs, evidence paths, citation
  owners, and row counts for that report. Generic strings cannot be substituted
  across audit sections, and omitted rows fail at the schema boundary.
- The canonical fact registry is checked across the complete report. Eligible
  repairs return the full coverage and are re-audited, preventing a corrected
  spine from coexisting with stale synopsis or lens claims.
- The ordered sequence ledger must cover climax, final scene, tag, and
  aftermath with consecutive steps, knowledge state, and valid pages. W.I.L.L.
  beat reversal and El Arbol Negro ending inconsistency fixtures cannot seal.
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

## Next gate

The V1.1 benchmark and its 20 human-approved audits are complete. V1.2 is only
implemented and tested locally. The next meaningful experiment is a separately
authorized paid V1.2 rerun of the same 20 PDFs, followed by a blind comparison
against the approved audit ledger. Production promotion, daemon activation,
and production-data writes remain separate decisions after that result.
