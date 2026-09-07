# Human-reviewed Coverage private-release candidate

2026-09-07. No-spend implementation on
`claude/lemon-dashboard-v9-review-w3nuz0`, based on
`aae1ac6e6f776f9a9aaa19104e503d0b727955fe`.

## What changed

The existing daemon publication boundary now saves every new Coverage report
as `needs_review`, even if the model calls its own result `sealed`. The stored
copy keeps `automated_status`, adds `publication_policy: human_review_required`,
and preserves all existing factual warnings. Its canonical hash is calculated
after the change. The queue receives the same Needs Review state.

The original engine result/checkpoint is not changed. Existing saved reports
replay without another model call; old Coverage reports and V9 are untouched.
Coverage remains qualitative, unscored and unrankable. The existing report
screen displays the provisional result, separates factual findings from taste,
and blocks favorites and decision-ready PDFs. No new approval system, validator,
model request or retry loop was introduced.

Intake explains this policy in English and Spanish. The actual route redirects
to Settings; its stage label now says Human review rather than Slate ready.

## Proof and limits

- `execution.test_daemon_coverage_route`: 14 tests, including the real bounded
  reader, real `call_llm` adapter and real Firestore checkpoint wrapper, with
  only HTTP and Firestore simulated. Two synthetic calls settle 140 micro-USD
  in the fake ledger, preserve the engine's sealed checkpoint, publish a readable
  Needs Review copy and replay without another HTTP request. No real spend.
- Lost-write-acknowledgement, existing-report replay, budget pause, invalid
  reports and mismatched persisted identity checks remain covered.
- Complete Python suite: 848 tests. Complete frontend suite: 1,112 tests.
- TypeScript/Vite production build passes. Existing large-chunk warning remains.
- Changed frontend files pass ESLint.
- `e2e/coverage-review.spec.ts`: both light and dark browser cases pass on port
  3000 with synthetic data and external requests blocked. They prove visible
  warnings, disabled decision actions, reload persistence and the real Intake
  controls. Screenshots remain under ignored `test-results/`.
- Independent read-only specification and standards reviews passed this scope.

These are local checks, not a live upload or factual-accuracy qualification.
The tests do not prove real Storage triggers, production version alignment,
provider completion or real account persistence. A human cannot yet promote a
report to Ready through a new approval action: this deliberately small release
keeps new reports provisional. No deployment or worker activation occurred.

## Remaining review and release boundary

The saved Cosquillitas draft remains Needs Review and has not passed its approved
audit. Its original locked checkpoint is untouched; no missing receipt has been
fabricated and no reading has been repurchased.

The one review-only package still binds the original `aae1ac6` release and its
unchanged request. A separate, clean VPS checkout was prepared at that release;
the paid output directory was absent. No inference was invoked. Private source,
draft and audit files are not committed.

The initial $0.306348 quote bounded successful Haiku usage, but omitted the live
proxy's worst-priced-model internal reservation of $4.150719. An uncertain
failure can consume that reservation. This is internal budget exposure, not
proof of a $4.15 provider invoice. Execution remains held until the changed
exposure is explicitly covered. See the private package's `EXECUTION-RESULT.md`.

Next: finish at most that single authorized review and compare it locally with
the held-out audit, without a rewrite or tuning loop. Then use one separately
bounded private-release operation to align deployed revisions and prove an
actual upload, settled cost, saved Needs Review report and browser reload.
Do not unlock the twenty-script benchmark or an uncapped library run. Do not
call this candidate deployed or production-proven based on the local tests.
