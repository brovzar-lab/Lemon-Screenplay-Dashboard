# One bounded private-upload rollout proposal

Prepared 2026-09-07. **Billy authorized this complete bounded rollout on
2026-09-07. Implementation and release verification are in progress, not SHIP.**
The hashing repair accompanying this document is a no-spend change based on
`60794d55d3cbf59bc3753c7ea1fb861a7ef76853`. Freeze the later reviewed release SHA
after the rollout safeguards below are implemented. Do not deploy a dirty build.

## Completed no-spend repair

The shared hash normalizer now treats tuples like JSON lists, including nested
float normalization. A synthetic disk round-trip and the exact private paid
response both failed before the change and pass after it. Two additional checks
preserve JSON-only fingerprints and reject altered usage or binding. The
historically invalid transport wrapper remains invalid; no original is rewritten.
The private real-response test runs locally but explicitly skips in clean CI
where confidential fixtures are absent; the public synthetic regression always
runs. No screenplay prose is committed as a fixture.

Verification: 852 Python tests, 1,112 frontend tests and the TypeScript/Vite build
pass. Existing chunk-size and Python resource/deprecation warnings remain.
All seven saved review file hashes, source, original response, locked budget and
ledger match. The frozen request and manifest identities are unchanged, and
receipt-only replay performs zero HTTP calls and zero checkpoint writes.
This proves persistence behavior, not a newly successful model review or release.

## Existing twenty: retained evidence and free browser replay

The private `benchmark-artifacts/coverage-v1-audit-packages/01-*` through
`20-*` packages contain twenty PDFs, twenty saved JSON reports and twenty
`Billy_Audit.md` files. The JSONs identify themselves as **Coverage V1.1**,
not the current bounded V1.2 reader. The approved synthesis and comparison
ledger remain the calibration reference, not discarded work or model training.
Ledger SHA-256:
`1e4cdb8e37b8a0ab02c51f3f2d5a0d2a016283461cc65c45d95a0b041b96f04d`.

The opt-in `e2e/coverage-private-replay.spec.ts` loads all twenty through the
existing local analysis cache, normalizer and Coverage workspace. It checks
each report in light and dark themes, before and after reload: full saved
synopsis, spine/lens/strength/concern/priority sections, Needs Review status,
disabled favorites/decision PDFs and absence of V9's Not verified label.
The cache is seeded once, not reseeded on reload. Original report prose and
engine version are retained; only disposable display copies receive provisional
status and an explicit historical-report warning. Hashes of all sixty source,
report and audit files plus the ledger are unchanged after each test.

This is **local cached-report display/reload proof**, not a JSON-import UI,
Storage upload, server persistence, PDF delivery or fresh model accuracy proof.
There is no JSON-import control in the current Settings data-management screen.
No production report is created or reclassified by this test. All non-loopback
browser requests are blocked; screenshots, video, traces and private error DOM
attachments are suppressed. Private fixtures stay Git-ignored and opt-in.

Verified 2026-09-07: four browser tests passed (private twenty-report replay
and synthetic review checks in both themes), all 1,112 frontend tests passed,
the production build and standalone strict TypeScript check of the new browser
test passed. Independent Specification and Standards reviews both passed.
No Python behavior changed; the 852-test Python result above belongs to the
preceding hashing repair, not a newly rerun Python suite in this replay task.

Reproduce locally with the fixed port 3000 free:

```sh
cd /Users/quantumcode/CODE/LEMON-SCREENPLAY-DASHBOARD
LEMON_PRIVATE_AUDIT_REPLAY=1 npx playwright test e2e/coverage-private-replay.spec.ts --workers=1 --retries=0 --reporter=line
```

Reusing these known examples gives regression evidence. It does not establish
generalization to unseen scripts. New material can come from the later backlog;
Billy does not need to assemble another calibration set before the private pilot.

## Product decision

Use the simplified `coverage-v1.2-bounded-1` reader, not the former 17-call proof
loop. One full reading, at most one structural correction and one advisory model
review, maximum three provider attempts per source. Do not add narrative repair
loops. Every new published Coverage report stays **Needs Review**, even if a
model calls it correct. Human judgment is the approval, not a model checkbox.

Billy can read useful coverage with uncertainties and original PDF access.
Favorites, rankings and decision-ready PDFs remain blocked for these reports.
There is no new in-app human promotion-to-Ready workflow in this release.
Coverage stays qualitative, unscored and unrankable. Existing reports and V9
are preserved. This is a private reading desk, not certified automated selection.

The completed Cosquillitas review cost $0.086491 and failed both key accuracy
checks. That evaluation is finished. No further Cosquillitas calibration,
replacement reading, paid judge or twenty-screenplay benchmark is part of this
proposal. Private evidence remains in the ignored review package.

## Authorized bounded envelope

- **Five existing calibration PDFs maximum**, one canary followed by four only
  after the canary passes. Proposed order: La Ciguena (canary), Terapia,
  W.I.L.L., El Arbol Negro and Diablo. These reuse the existing approved audits
  for setup, page, chronology and factual checks. No new screenplay is required.
  Cosquillitas remains offline-only; its completed evaluation and locked paid
  checkpoint are not reopened. This does not unlock a paid twenty-script run.
  Freeze exact PDF hashes, filenames, existing report/audit hashes and eventual
  queue IDs before processing.
- Replaying saved V1.1 JSON is free but does not test the current V1.2 reader.
  A fresh bounded V1.2 evaluation of the same PDF is NEW paid work, permitted
  only inside this five-script envelope. Keep the prior report as a distinct
  historical analysis, not a fresh result. Use the existing explicit reanalysis
  route with truthful source/engine/release identity; never change source bytes,
  invent identities or clear checkpoints to evade duplicate protection. If that
  route cannot represent the new evaluation safely, stop before dispatch.
- **$50 maximum NEW exposure total, $10 per PDF**, including successful charges
  and uncertain server accounting. These are hard maximum allowances, not a
  prediction of token cost or a claim that five reports must complete for $50.
- The allowance is **nonrenewing**, survives process restarts and UTC midnight,
  and includes the canary. Existing settled spending remains recorded separately.
  The existing daily ceiling is an additional guard, not a replacement for the
  fixed rollout limit. Do not increase it to fit the pilot.
- Maximum three provider attempts per PDF, fifteen for the entire batch. One
  transport attempt per stage. Receipt replay is free and preferred; no retry
  after an uncertain bill or provider rejection. A cap may prevent all stages
  from running; preserve any useful paid draft instead of buying more work.
- Billy's approval covers scoped safeguards, tests, independent review,
  commits/pushes, reviewed merge if required by the deployment workflow, staging,
  rollback-safe production installation, the five named PDFs, live verification
  and rollback. No micro-approval between those steps. A changed privacy/security
  boundary, exhausted allowance or material invariant mismatch still stops work.

The approved source/report/audit hashes and rollback identities are recorded in
the private ignored `benchmark-artifacts/private-rollout-20260907/manifest.json`.
No provider dispatch is permitted until release/job/worker bindings also match.
Before each stage, calculate the exact serialized request's conservative server
reservation using deployed pricing, including its all-model uncertainty reserve.
Reject it before dispatch if it does not fit both remaining limits. Do not
silently substitute the smaller successful-usage estimate.

## Implemented safeguards, not another analysis engine

The release changes close these two deployment hazards before activation:

1. `daemon.py:claim_pending_job` calls `resume_waiting_for_engine_jobs`, which
   releases up to 50 waiting Coverage jobs when the global flag is enabled.
   A pilot job allowlist applies at claim/release boundaries, rechecked in the claim
   transaction. The candidate worker must not claim unrelated V9 or Coverage
   jobs, and non-pilot workers must not claim pilot jobs. Preserve unrelated
   work; park the batch until exclusive routing ownership is proved. Use one
   worker and concurrency one for the pilot, not a new scheduler.
2. `functions/src/budgetCounter.ts:reserveLlmBudget` enforces a daily allowance
   and checks that a queue job is processing, but not a fixed rollout/per-job
   allowance. Reuse this existing atomic reservation/settlement transaction to
   enforce the server-owned $50/$10 ceilings, including uncertain charges and
   active reservations. Attach the immutable rollout identity and caps through
   admin-controlled queue metadata, never trust a client-supplied dollar limit.
   Checkpoint `max_cost_usd` alone is insufficient for the proxy's larger reserve.

The implemented lifetime guard is deliberately stricter than refundable
reservation accounting: each admitted request permanently consumes its maximum
server reservation from this rollout allowance, even if actual usage is smaller
or the provider rejects it. It counts admission attempts at the same time,
at most three per source and fifteen total. It never refunds, expires or resets
at midnight. This quantity is called **admitted exposure**, never actual spend;
existing daily receipts remain the exact billing authority. It may park early.
An unresolved marker or uncertain bill anywhere in the bound batch stops new
admission. Missing or malformed configuration never initializes fresh counters.

The fixed five-source whitelist can bind one real uploaded job first, then the
remaining four after the canary gate. Each source may have only one bound job.
Admin-written `rollout_enabled` and the worker's explicit job list jointly
control eligibility. UI retry cannot reset these jobs, and stale UI mutations
require an unchanged snapshot timestamp. Pre-claim dispositions, claim, waiter
release and orphan recovery recheck ownership transactionally. The worker
verifies its clean Git SHA and concurrency one before claiming pilot work.
Initial provider rejection now stops in Needs Review without a queue retry.

Scope changes to the existing daemon, typed ingest job and budget transaction,
their focused tests, and necessary release configuration. No new agent framework,
general orchestration service, provider, semantic validator or approval product.
Missing engine metadata must continue to mean V9. Do not change existing pricing
or billing semantics merely to make the pilot fit its allowance.

## Execution sequence under the existing approval

1. **No-spend preparation.** Verify current Hosting, Functions, VPS unit/working
   directory/revision, non-secret flags, pending jobs and daily ledger read-only.
   Record exact current rollback targets. Source tests do not prove deployed
   alignment. Implement the two bounded safeguards above, preserving dirty live
   checkouts and old checkpoints. Freeze the batch and final reviewed release.
2. **Local/emulator gate.** Run Python and receipt regressions, frontend/Functions
   builds and suites, Storage/Firestore rule tests and focused browser checks.
   Prove metadata-to-queue routing, allowlist isolation, sealed-to-Needs Review,
   duplicate/replay behavior, independent folder uploads, reload reconnection,
   interrupted-work recovery and cap exhaustion. Prove an excluded job never
   dispatches and crossing midnight cannot renew the rollout allowance.
3. **Rollback-safe install.** Deploy the updated trigger/budget Function first
   without enabling pilot processing. Install the exact reviewed daemon SHA in
   a new immutable VPS directory, preserving the old unit, environment and V9
   revision. Deploy the frontend only after routing is verified. Enable only the
   frozen batch on the isolated worker. No bulk release of historical waiters.
4. **One real canary.** Sign in through the private production UI, upload the
   first PDF and observe Storage generation, queue identity, source hash, worker
   revision, provider receipt and persisted `coverage_v1_reports` record. Confirm
   zero Coverage writes to `uploaded_analyses`, correct source/report pairing,
   complete readable sections, visible review findings and Needs Review status.
   Reload and reconnect to the same record. Verify no duplicated inference and
   no unsettled new reservation. Compare locally with the existing Billy audit,
   recording caught, missed and newly introduced factual issues separately from
   taste. Do not give the model the audit answers. Never certify facts solely
   from model flags or describe success on these known cases as an unseen test.
5. **Four-file folder batch.** Only if the canary passes, upload the remaining
   four through the actual folder UI. Prove uploads do not wait for analysis.
   Close the browser after Storage acknowledges receipt and show processing
   continues; reopening restores the same jobs. Closing before acknowledgment
   cannot be promised to finish the browser's upload. No sixth PDF is analyzed.
6. **Terminal handover.** Every accepted file must have a durable disposition:
   readable provisional report, visible budget hold, or explicit parse/provider
   failure with preserved evidence. For a successful pilot, at least four of
   five, including the canary, must yield readable reports; a fifth that is only
   queued is not falsely counted as completed. Provide screenshots, report links,
   exact deployed revisions, reconciled allowance/receipts and rollback proof.
   Then park further paid processing. This does not unlock the entire library.

## Acceptance, failure and rollback

Known factual errors keep the report provisional and visible. They do not cause
another model purchase or a tuning loop. A minor wrong interpretation does not
equal a broken ingestion system; an unreadable, source-mismatched, grossly
misleading report, or one presented as factually approved is a pilot failure.
Billy's judgment of usefulness remains necessary and cannot be fabricated by an
automated test. Obvious material problems must be disclosed in the handover.

Stop new calls immediately for a source/revision mismatch, accounting ambiguity,
out-of-scope claim, security/privacy issue or exhausted allowance. Do not kill
an already-dispatched call merely to clear a reservation; capture settlement or
retain uncertainty. No restart of a paid stage without a verified receipt.

If the canary fails the live chain, do not run the other four. Restore the prior
Hosting release, Function revision and daemon target as applicable; park pilot
Coverage jobs and preserve all new PDFs, reports and receipts. Test rollback
routing without purchasing a V9 analysis or silently converting Coverage jobs.
Do not clean or reset `/opt/lemon-ingest`.

On passing the private pilot, the next milestone is a separately bounded backlog
batch based on measured cost and Billy's usefulness feedback, not another
twenty-script qualification. The next batch may reuse the same infrastructure
and limits mechanism. Do not promise that automatic factual approval is coming.

## Timing and next decision

Estimate: one focused engineering day for the missing isolation/budget safeguards,
release checks and rollback-ready installation, followed by roughly one hour
of pilot processing/observation if provider and deployment access cooperate.
This is not a delivery guarantee; no timer overrides failed integrity checks.

No further routine approval is needed for this five-existing-PDF operation.
Continue through the checks, exact-release installation, canary comparison and
four-file batch inside the $50/$10 limits. A genuine failed release gate or
integrity boundary still stops processing. Do not expand to another screenplay
or replenish the allowance automatically.
