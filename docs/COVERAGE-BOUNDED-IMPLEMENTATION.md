# Bounded Coverage implementation, 2026-09-06

## Outcome and boundary

The approved no-spend implementation is complete locally on
`claude/lemon-dashboard-v9-review-w3nuz0`, based on
`d3ef81d75235edc0dc499150dab9600d065f3835`.
It is not a production release or evidence of fresh model quality.
No paid inference, deployment, worker activation, requeue, or production-data
write was performed. Earlier spending envelopes are not active authorization.

The intended new reader is **Coverage V1.2 bounded**, identified in every report
as `coverage-v1.2-bounded-1`. It is not V9 and it is not the former 17-call
V1.2 semantic-proof loop. V9 analyses and the old engine/checkpoints remain
untouched. The daemon's Coverage route now calls `execution/coverage_reader.py`
in source; installing or enabling that route is a separate release gate.

## What changed

- One complete reading, then one independent review. At most one structural
  correction before that review, for a hard maximum of three calls.
- The old page map, quote matcher, lens cards, transport, receipt store and
  budget guard are reused. The semantic fact/sequence proof loops are bypassed.
  This does not mean their large source module has been deleted.
- Citation coordinates are normalized before review; the review checkpoint is
  bound to the exact candidate shown to the reviewer. Impossible pages, blank
  substantive content, missing review checks and factual issues cannot seal.
- Useful drafts survive a failed review as Needs Review. Factual corrections,
  uncertainty and human taste are displayed separately. Taste alone does not
  change a verdict or block a report.
- Durable source-level checkpoint identity prevents a code/parser change from
  hiding earlier reservations in a new namespace. Receipt settlement can
  recover after a lost write acknowledgment without repurchasing a response.
  Malformed or uncertain bills retain the reservation and stop spending.
- Coverage remains `coverage_unscored`, unrankable and qualitative. Unknown
  model fields, including numeric scores, are removed from published coverage.
  Genuinely irrelevant lenses remain `not_applicable`.
- Intake follows the persisted queue across reloads and reconnects. Storage
  generations prevent old completion messages from attaching to a new upload.
  Late upload acknowledgments cannot overwrite queue truth, and an Open action
  waits for the matching report version to reach the dashboard.
- Coverage Needs Review reports are no longer filtered out of the live report
  feed. They are readable but excluded from favorites and decision-ready PDF
  actions. Stored favorite IDs are preserved for future checked revisions.
- Replacement uploads keep their receipt identity and original engine/parent
  choices. Failed dismissal cannot cause another upload. Uncertain receipt
  recovery is read-only, and replacement retries return to Upload Issues.
- New desktop batches explicitly select Coverage; old saved manifests without
  engine metadata retain V9. Browser legacy upload entry points remain explicit
  V9 paths, while Intake defaults to Coverage. No silent engine conversion.
- Existing bounded concurrent/folder uploading is retained, not replaced with
  another uploader. Unsupported custom categories are excluded from Intake.
- Coverage is blocked from the V9-only archived reanalysis action. New or
  changed PDFs use Intake's revision route. A new Coverage archived-rerun API
  has deliberately not been added.

## Verified local evidence

| Gate | Result |
| --- | --- |
| `npm run build` | PASS, TypeScript and Vite |
| `npm run lint` | PASS |
| `npm run test:run` | 1,112 passing, 148 files |
| `npm run test:python` | 840 passing, including 16 new bounded-reader checks |
| `PYTHONPATH=ingest .venv/bin/python -m unittest discover -s ingest -p 'test_*.py'` | 21 passing |
| `npm --prefix functions test` | 145 passing, includes Functions build |
| `npm run test:rules` | 26 passing against local Firestore/Storage emulators |
| `npm run test:e2e -- --workers=2` | 60 passing, synthetic local data |
| Independent engine and intake reviews | PASS for local no-spend scope |

Browser tests block non-local requests. External font CSS is replaced with an
empty local test response, so screenshots use system fonts. Emulator/browser
tests required sandbox elevation to bind their normal local ports; no ports or
production services were changed. Existing build chunk-size and Python
resource/deprecation warnings remain non-fatal.

The new browser regression proves that a saved review report renders its factual
and taste notes, survives reload, disables favorites and decision PDFs, and
retains visible file/folder Intake controls. Screenshots are local, Git-ignored:
`test-results/coverage-review-chromium-light.png` and
`test-results/intake-chromium-light.png` (also dark variants).
This is not proof of a real Storage-to-provider-to-Firestore transaction.

## What the 20-PDF offline simulation proves

`execution/simulate_coverage_reader.py` validates every PDF against the source
hash in its private saved report, parses all 20 locally, replays their existing
coverage, and supplies an explicitly synthetic reviewer that declines factual
sign-off. It cannot submit a model request. All 20 preserve a Needs Review
report and replay it without another simulated transport call when given
hypothetical reservation headroom of $5 per source. Thirteen use two simulated
calls, seven use three. Real calls and real cost are both zero.

This proves source parsing, bounded control flow, useful-draft preservation and
checkpoint replay for those inputs. It does not count as 20 new analyses, audit
ledger agreement, a factual accuracy benchmark, or 20 sealed reports.

### Important reservation blocker

The unchanged default is **$1 per screenplay**. With that default, the current
conservative request reservation rejects **15 of the 20 PDFs before dispatch**.
The guard uses a deliberately large serialized-request byte bound, not a quote
for likely provider usage. This was not fixed by quietly increasing a cap.

Measured first-request ceilings in this replay range from $0.751773 to
$1.216306. Cosquillitas reserves $1.094012 for the initial reading and $0.317001
for the reviewer when reviewing the saved coverage. These are individual
request reserves for these exact inputs, not a fixed all-path quote. A fresh
draft and optional correction change subsequent request sizes. The simulator's
zero usage also means its run is not proof of cumulative real-cost headroom.

## Remaining limits and next gate

1. Request **one private Cosquillitas pilot with a $5 total hard ceiling and
   at most three calls**, bound to this reviewed candidate and the already
   approved PDF hash. This is a proposed limit, not spending permission. Use
   the existing approved proxy, not a new service. Stop on uncertain accounting,
   source/binding mismatch, exhausted cap or the terminal report. Do not alter
   production's $1 default or unlock the 20-script paid benchmark.
2. Compare that fresh report and independent-review notes with Billy's approved
   audit, particularly existing evidence and literal climax order. Require a
   readable result, no hidden reservation, bounded cost, zero-call replay, and
   honest handling of unresolved facts. A Needs Review report is useful but
   does not establish unattended selection readiness.
3. Only after that pilot decide the varied five-script qualification and a
   bounded release. A real end-to-end upload, queue persistence, rendered
   sealed Coverage PDF, version alignment and rollback still need live proof.

Do not use `execution.coverage_v1_canary` or old V1.2 scorecards to claim the new
bounded reader is qualified: they still exercise the archived architecture.
No further semantic validator or agent framework is needed for this pilot.

Known deliberate ceilings: one approved engine binding per source/checkpoint
store (a future requalification requires an explicit, accounted migration);
one daemon writer; a whole-queue listener suited to this private queue; and no
new archived Coverage rerun API. The desktop GUI may require selecting an old
batch's original engine/model before resuming it. The server remains the
authority for accepted jobs; an unaccepted local file must be selected again
after closing the browser.

**Ready means checked, not infallible.** A second model review reduces risk but
cannot prove complete narrative truth. The useful product is candid coverage
with visible uncertainty and dependable delivery, not a claim of perfect AI.
