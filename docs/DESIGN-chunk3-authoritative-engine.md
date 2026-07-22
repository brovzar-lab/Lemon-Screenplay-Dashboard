# Chunk 3 Design: Authoritative Engine and Calibration

Status: Implemented on `codex/pipeline-authority-chunk-3`; not merged or deployed.

Date: 2026-07-21

Base: `main` at `80dbeba`, containing Pipeline Safety Chunks 1 and 2.

## Purpose

Make the VPS V9 pipeline the authority for every permanent screenplay analysis while preserving the browser's
fast comparison tools. Producer calibration now affects that authoritative path, and queue failures are made
recoverable without silently analyzing the wrong file or repeating deterministic failures.

## Permanent Analysis Boundary

The browser can still run temporary analysis for Model Comparison. It cannot use that result to replace a
screenplay's permanent coverage.

A permanent upload or reanalysis follows one path:

1. An authenticated admin queues a uniquely addressed PDF in Firebase Storage.
2. The Storage trigger creates an ingest job with the exact bucket, object path, generation, request kind, and
   target project identity.
3. The VPS downloads that exact object generation, recomputes its SHA-256, validates it, and runs the V9 engine.
4. The VPS atomically writes the immutable version and advances the project's latest parent document.
5. The browser watches the queue and reports completion; it does not save a second copy of the result.

Reanalysis copies the already archived PDF by its pinned Storage generation. The copied object's metadata sets
`target_project_id`, `bypass_duplicate`, `bypass_tmdb`, and `request_kind=reanalysis`, so it returns to the same
project without being mistaken for a new upload or an already-produced title.

## Calibration Contract

The VPS reads the enabled profile at `producer_profiles/admin` before analysis. It validates the profile and
applies its instructions only to the final synthesis step. The five independent readers remain uncalibrated,
which preserves their evidence while allowing the final verdict and recommendation to learn from Billy's
recorded decisions.

Saved analyses contain calibration provenance, not the private prompt text:

- whether calibration was applied;
- profile ID;
- prompt SHA-256;
- calibration date; and
- number of reviewed decisions.

The same synthesis-only behavior applies to standard, hybrid, and boundary-rerun analysis paths.

## Queue Safety

- Downloads use the bucket encoded in the `gs://` path and require `storage_generation`, so retries cannot read a
  newer object with the same name.
- A missing or invalid target project is terminal after one attempt. The dashboard explains that the PDF must be
  uploaded again instead of offering a paid retry that cannot succeed.
- The watchdog rechecks job status and heartbeat in a Firestore transaction. It does not reclaim a job that is
  active in this process or whose heartbeat became fresh during the sweep.
- Worker IDs include the process ID, and heartbeat updates require ownership.
- Bad-format quarantine first records the skipped result, then performs an idempotent generation-pinned move to
  a deterministic destination. A retry can reuse an already moved destination instead of failing forever on a
  missing source object.

## Preserved Invariants

- Triage-only output cannot replace permanent V9 coverage.
- A permanent browser reanalysis result must be `v9_archaeology` before completion is accepted.
- Every permanent result requires verified content identity.
- Parent advancement and immutable-version creation remain one atomic write.
- Version IDs remain `{sha256}_{fixed queued-at milliseconds}` and retries address the same version.
- The browser offline queue still replays the atomic parent-plus-version write.
- Byte-identical uploads deduplicate on the daemon before paid AI work unless an admin explicitly requests a new
  analysis.
- Renamed revisions attach to one project card; unrelated same-title projects remain separate.
- Existing V8 and V9 read compatibility remains intact.

## Verification Added

Chunk 3 includes behavioral coverage for:

- queue-only permanent reanalysis and exact-generation archive copying;
- calibration validation, synthesis placement, and stored provenance;
- terminal target failures, retry eligibility, heartbeat races, and idempotent quarantine;
- real Firestore-query behavior in `is_already_complete`;
- browser creation of version 2 and the existing-version idempotency no-op; and
- renamed revisions rendering as one project card.

The known full-suite timeout in `ScreenplayGrid.test.tsx` is isolated with a larger timeout for that batching test.
The deprecated naive UTC timestamp in `execution/ingest_v9.py` was replaced with timezone-aware UTC.

## Deployment Boundary

Chunk 3 is not deployed by this branch. Its eventual release is one coordinated unit:

1. deploy the dashboard hosting build;
2. deploy the queue and Storage-trigger Cloud Functions; and
3. pull this commit on the VPS, run its Python tests, and restart the daemon.

Do not deploy only one layer: the browser, trigger, queue function, and VPS share one metadata contract.
Firestore rules did not change in Chunk 3. The 20 rules tests still must pass before any future rules deployment.

## Chunk 4 Release Blocker: Never Bill a Completed Version Twice

The current daemon computes `version_id`, archives the PDF, increments the daily budget, and calls the AI before
`write_to_firestore` discovers that the immutable version already exists. If Firestore committed successfully but
the daemon lost the acknowledgement, a retry can therefore pay for the entire analysis again before the final
transaction becomes a no-op.

Chunk 4 must add this preflight before archive work, budget increment, calibration loading, or any AI call:

1. Compute the verified content hash, resolved project ID, fixed queue timestamp, and deterministic `version_id`.
2. Read `uploaded_analyses/{projectId}/versions/{versionId}`.
3. If it exists, mark the ingest job complete from the existing parent/version metadata and return without
   incrementing budget or calling AI.
4. If it does not exist, continue through the normal paid path.

Required test: simulate a retry whose exact immutable version already exists and prove that archive copy, budget
increment, calibration load, parser, and AI entry points are never called. Existing transactional job ownership and
the hardened heartbeat sweep remain the protection against simultaneous workers.

This is a hard gate before any large ingest or backfill.

## Clean-Slate Boundary

No migration, wipe script, or production deletion is part of Chunk 3. The one-time deletion of legacy
`uploaded_analyses`, completed queue records, related shares, and caches remains a final, explicitly approved step
after Chunks 2 through 5 are deployed and proven. Billy must approve that irreversible action separately.
