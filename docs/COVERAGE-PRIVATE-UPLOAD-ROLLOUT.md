# One bounded private-upload rollout proposal

Prepared 2026-09-07. **Proposal only, not deployment or spending authority.**
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

## One proposed authorization envelope

- **Five new intake PDFs maximum**, one canary followed by the remaining four
  only after the canary passes. Billy supplies/selects this small batch when
  approving the rollout. Exclude Cosquillitas and the locked twenty-script
  calibration set. Freeze exact PDF hashes, filenames and eventual queue IDs
  before processing. No paid reruns of already-analyzed duplicate bytes.
- **$50 maximum NEW exposure total, $10 per PDF**, including successful charges
  and uncertain server accounting. These are proposed hard allowances, not a
  prediction of token cost or a claim that five reports must complete for $50.
- The allowance is **nonrenewing**, survives process restarts and UTC midnight,
  and includes the canary. Existing settled spending remains recorded separately.
  The existing daily ceiling is an additional guard, not a replacement for the
  fixed rollout limit. Do not increase it to fit the pilot.
- Maximum three provider attempts per PDF, fifteen for the entire batch. One
  transport attempt per stage. Receipt replay is free and preferred; no retry
  after an uncertain bill or provider rejection. A cap may prevent all stages
  from running; preserve any useful paid draft instead of buying more work.
- One approval would cover scoped safeguards, tests, independent review,
  commits/pushes, reviewed merge if required by the deployment workflow, staging,
  rollback-safe production installation, the five named PDFs, live verification
  and rollback. No micro-approval between those steps. A changed privacy/security
  boundary, exhausted allowance or material invariant mismatch still stops work.

This task does **not** activate that envelope. The specific batch and its source
hashes are not yet selected, so there is no frozen model-request quote for it.
Before each stage, calculate the exact serialized request's conservative server
reservation using deployed pricing, including its all-model uncertainty reserve.
Reject it before dispatch if it does not fit both remaining limits. Do not
silently substitute the smaller successful-usage estimate.

## Small prerequisites, not another analysis engine

Current source shows two deployment hazards that must be closed before activation:

1. `daemon.py:claim_pending_job` calls `resume_waiting_for_engine_jobs`, which
   releases up to 50 waiting Coverage jobs when the global flag is enabled.
   Add a pilot job allowlist at claim/release boundaries, rechecked in the claim
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

Scope changes to the existing daemon, typed ingest job and budget transaction,
their focused tests, and necessary release configuration. No new agent framework,
general orchestration service, provider, semantic validator or approval product.
Missing engine metadata must continue to mean V9. Do not change existing pricing
or billing semantics merely to make the pilot fit its allowance.

## Execution sequence under the future single approval

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
   no unsettled new reservation. Never certify facts solely from model flags.
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

Billy's next decision is one complete envelope: approve the five-PDF private
rollout with $50/$10 hard exposure limits and supply the five new PDFs. All
ordinary implementation, test, release and verification steps then continue
inside that authority. Until then, no deployment, activation or inference.
