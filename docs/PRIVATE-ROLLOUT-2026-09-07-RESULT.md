# Private rollout result: BLOCK, rollback completed

## What actually ran

The clean, pushed candidate `a89cfb3e5a66aa0717b3641bf72cb38d86783d9b`
was deployed on 2026-09-07 after 857 Python tests, 1,112 frontend tests,
149 Functions tests, 60 browser tests, 26 rules tests, the real rollout
transaction emulator, builds and independent reviews passed.

One real signed-in production Intake upload, La Ciguena, reached Storage,
the trigger, the queue, the isolated worker, PDF parsing, two model calls,
checkpoints and a persisted `coverage_v1_reports` report. Browser reload
restored the same processing job. The resulting report remains Needs Review,
unscored and unrankable. This is not a passing release or factual approval.

The remaining four PDFs were not submitted or processed. The twenty-script
benchmark and all old Cosquillitas checkpoints remain untouched.

## Exact money result

| Item | USD |
|---|---:|
| First reading, settled | 0.390576 |
| Structural correction, settled | 0.355722 |
| Total NEW settled inference | 0.746298 |
| Prior daily spending, not charged again | 0.086491 |
| Daily settled total after canary | 0.832789 |
| Server outstanding reservations | 0 |
| Server uncertain spending | 0 |
| Nonrefundable admitted maximum exposure | 8.893324 |
| Reader's retained local review reservation | 0.283527 |

The last row is NOT an additional settled provider charge. The third request
was rejected before provider dispatch. At `2026-09-07T20:52:14.413090Z`, the
proxy logged `ROLLOUT_LIMIT_REACHED` while reserving budget, and returned HTTP
503. Only two admissions and two provider receipts exist. No third receipt is
created, and the original local checkpoint is not cleared or rewritten.

The fixed $10 source exposure guard worked. However, the error contract and
reader made its refusal look like uncertain paid work. This is a real release
boundary, not permission to raise the cap or buy another reading.

## Earliest avoidable failure and downstream effects

1. `execution/coverage_reader.py:_coverage_problems` found exactly one defect
   in the first saved draft: `lens_notes[3].analysis is empty`. That lens was
   already `comedy-contract`, `not_applicable`, page zero. A missing explanation
   for an irrelevant lens triggered a full second reading/correction, costing
   $0.355722 and consuming $4.608186 of admission allowance. It should remain
   visible as missing explanatory prose, not force a complete model rewrite.
2. The third request could not fit the remaining conservative allowance.
   `functions/src/llmProxy.ts` returned `PRE_CALL_ACCOUNTING_UNAVAILABLE` for
   the reservation exception. The real adapter identified this as
   `LlmPreCallRetryableError` with `proven_zero_spend_pre_generation`, but its
   outer `LlmCallFailedError` dropped `proven_no_spend`. The reader consequently
   locked a local $0.283527 reservation and published incomplete-review warnings.
3. `/intake` redirects to `SettingsPage`, which does not mount
   `useLiveScreenplaySync`. `UploadPanel` waits for an exact project/version in
   the cached screenplay query before exposing Open. The real saved wrapper
   normalizes correctly, but the actual route never receives its new Coverage
   record. The unused `IntakePage` does mount the hook, explaining why tests of
   that page did not prove the production route.

The report was not lost. Its wrapper, complete transport results and two
settled receipts are preserved. Independent verification validated all eight
checkpoint wrappers and the published report hash. All three defects above
remain unfixed; this document records evidence, not another implementation.

## Human-audit comparison

The existing Billy-approved audit was used locally after inference, never
included in the model request. Printed-page usage improved; the irrelevant
comedy lens and a valid continuity concern were retained. However, framework
chronology remained contradictory, important existing evidence was omitted,
development recommendations overlooked existing setup, and the synopsis
introduced an ending-order inconsistency. Taste disagreements were separated
from factual errors. The draft is readable provisional material, not approved
coverage or writer-ready development notes. Detailed private comparison remains
with the existing audit package and execution evidence.

## Rollback proof and limitation discovered

Hosting was restored to `ef810a505c62f604aaea815f1f80a815a2eac21d`.
The unchanged original daemon unit and `/opt/lemon-ingest` checkout at
`51fca8cf05eb79d041c4589dcd736a04a54da02b` were restored, after verifying no
pending jobs. The isolated pilot worker is stopped; its rollout is paused and
its job disabled. No historical file or checkpoint was deleted.

Direct rollback to the old Function revision IDs failed because their container
images were unavailable. Original pinned source archives had been preserved
before deployment. Their compiled original code was rebuilt into these healthy
replacement revisions, each with verified 100% traffic and Ready true:

- Proxy: `llmproxy-00025-nef`.
- Queue API: `queuemanager-00010-kob`.
- Upload trigger: `onscreenplayuploaded-00010-xab`.

These are rebuilt ORIGINAL sources, not the failed candidate. The actual Firebase
packager was run locally to prove environment/key files were excluded from the
rollback upload archives. Original private archives were preserved unchanged.
The new rollback revision IDs differ from the original IDs; do not claim an
identical container rollback. Future release preparation must prove the old
container can start, not merely record its revision name or source archive.

## Next bounded repair, no spend first

- Reuse the existing live hook on the actual Settings/Intake route. Regress
  delayed Coverage arrival after upload and reload with the exact saved wrapper.
- Preserve typed, proven pre-dispatch no-spend evidence through the real HTTP
  adapter. Give fixed rollout exhaustion a distinct terminal budget result,
  not a generic retryable infrastructure response. Keep uncertain bills locked.
- Do not purchase a rewrite solely for a missing explanation on an irrelevant
  lens. Preserve `not_applicable`; show the omission honestly.
- Exercise these paths through HTTP-only mocks and the already-paid artifact.
  Do not repurchase the reading or modify its original locked checkpoint.
- Correct the Intake confirmation's stale sealed-to-Ready wording. Every new
  private report remains Needs Review, including those a model calls complete.

W.I.L.L. also has a genuine exact-hash V9 parent in production. Ordinary folder
Intake correctly blocks it as a duplicate, while the current reanalysis action
still queues V9. Do not falsify parent/source identity to force a five-file run.
Resolve an explicit Coverage reanalysis route or leave that file visibly blocked.

No new calibration loop, numeric scores, paid judge, sixth PDF, renewed allowance
or benchmark unlocking follows from this failed run. A subsequent spending or
release decision must account for the preserved history and failed gate.

## Private evidence

Git-ignored directory: `benchmark-artifacts/private-rollout-20260907/`.
It contains frozen five-source/audit hashes, service/binding scripts, original
rollback archives and the full saved canary response/receipt/checkpoint evidence.
Terminal capture: `evidence-20260907T205326992282Z.json`.
VPS originals: `/opt/lemon-v12-results/private-five-20260907`.
Do not publish screenplay text or private artifacts in Git.
