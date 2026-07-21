# Chunk 2 Design: Script Identity and Revisions

Status: Approved on 2026-07-21, with the clean-slate scope change recorded below.

Date: 2026-07-21

Branch: `codex/pipeline-safety-chunk-2`

Base: `main` at `9f537d9`, containing legacy cleanup and Pipeline Safety Chunk 1.

## Purpose

Stop four classes of silent data loss without re-keying the application:

1. A revised PDF uploaded under the same filename must create a new analysis job.
2. A different PDF with the same filename must never reuse stale parsed text.
3. A new analysis must preserve the previous analysis as immutable history.
4. A byte-for-byte duplicate must be recognized without blocking a genuine revision.

## Safety Invariants

- Existing V8 and V9 analyses must continue to render while the current production data remains in place.
- Existing public share links must continue to resolve until the separately approved clean-slate step.
- Existing share management keys, notes, favorites, feedback, and verdicts must not be re-keyed.
- The parent `uploaded_analyses` document remains the backward-compatible latest projection.
- Every permanent write creates an immutable version before advancing the latest projection.
- The daemon's raw-byte SHA-256 remains the authoritative fingerprint.
- The Storage trigger does not download screenplay PDFs.
- Chunk 1 remains intact: triage cannot be used for permanent reanalysis, and only
  `v9_archaeology` results can pass the browser reanalysis save guard.
- Chunk 2 does not migrate or backfill the 23 current production screenplays.
- No wipe tool is built or run in Chunk 2. A clean slate requires a separate approval after Chunks 2 through 5
  are built, deployed, and proven.

## Measured Production State (Diagnostic Only)

The extended census was run read-only on 2026-07-21. It printed aggregate counts only.

```text
total docs: 23  (soft-deleted: 0, quarantined: 0)

analysis_version:
  v8_archaeology       16
  v9_archaeology        7

meta fields:
  v9_meta only:          0
  v7_meta only:          0
  both:                  0
  neither:              23

content identity:
  valid SHA-256:         0
  null:                  0
  missing:              23
  invalid/other:         0
```

### Census conclusion

The current 23 records predate the identity contract and will not be migrated or used as an identity source.
The census remains a read-only diagnostic that confirms the 16 V8 / 7 V9 / 0 unlabeled split while the old
data is still present. No Chunk 2 behavior, test, or release gate depends on recovering identity from these
records. Billy will separately approve a clean slate only after the replacement pipeline has been proven.

## Decision 1: Identity Model

### Option A: Re-key parent documents to content or project IDs

Benefits:

- Clean long-term identity independent of filenames.
- Natural separation between project identity and analysis identity.

Costs and risks:

- Breaks every feature currently keyed by `screenplayId`, `source_file`, or the filename-derived
  Firestore ID, including share management, notes, favorites, feedback, verdicts, posters, and PDF status.
- Requires rewriting `shared_views.screenplayId` and changing share lookup and revoke behavior.
- Creates a large, difficult-to-reverse data rewrite before the redesign.

### Option B: Keep the filename-derived parent as the project/latest pointer

Benefits:

- Existing listeners continue reading the same top-level collection.
- Existing public share snapshots and management keys remain valid.
- Current cards, notes, feedback, favorites, and verdicts retain their identities.
- Immutable history can be added without forcing the entire application to understand it at once.

Costs:

- The parent remains a mutable latest projection and duplicates the latest version's analysis data.
- Historical versions require a subcollection query when a project is opened.
- Filename-derived IDs remain a legacy convention.

### Recommendation: Option B

Use the existing parent document as a stable project/latest pointer and add immutable versions below it.
This is the lowest-blast-radius design that prevents overwrites and preserves existing links.

For existing projects, `source_file` remains the stable canonical key even when a revision has a different
filename. The actual filename for each revision lives in its version document. For a genuinely separate new
project whose filename collides with an existing parent, create a collision-safe canonical source key by
adding an upload-ID suffix. Store the untouched user filename as `original_filename`.

## Proposed Data Shape

### Backward-compatible parent

Path: `uploaded_analyses/{projectDocId}`

The parent keeps the complete latest analysis so all current readers continue to work. New identity fields:

```text
project_id              stable parent document ID
source_file             stable canonical legacy/share key; never changed by a revision
latest_source_file      actual filename of the latest version
content_hash            verified SHA-256 of the latest PDF
identity_status         verified for every new permanent write
latest_version_id       immutable version document ID
version_count           integer
_storagePath            verified Storage path for the latest PDF when available
storage_generation      Storage object generation when available
```

### Immutable version

Path: `uploaded_analyses/{projectDocId}/versions/{versionId}`

Each version is a full analysis snapshot plus provenance:

```text
project_id
version_id
version_number
content_hash
identity_status
source_file             actual filename for this version
original_filename
storage_path
storage_generation
ingest_job_id
analysis_version
analysis_model
analysis
usage or v9_meta        preserved exactly as written by its engine
created_at              real Firestore Timestamp, never an ISO string
```

`version_number` is always a Firestore integer greater than zero. New permanent writes fail closed when the
authoritative hash is unavailable. The application read boundary still tolerates missing or null
`content_hash` and a non-verified `identity_status` so malformed or transitional data produces a visible
error instead of crashing or being mistaken for a duplicate. This defensive tolerance is not a backfill path.

`versionId` is `{full SHA-256}_{fixed queued-at milliseconds}`. The queue timestamp is fixed, so a daemon
retry addresses the same version rather than creating another. An explicitly requested new analysis of the
same PDF gets a new queue timestamp and therefore a separate immutable version.

Parent advancement and version creation must use one atomic Firestore batch or transaction. The version is
never editable through the browser. The parent can advance only as part of a successful version write.

## Decision 2: Where Fingerprint Deduplication Lives

### Trigger-time fingerprinting

Benefit: rejects duplicates before creating a queue job.

Trade-off: forces the Cloud Function to download every PDF, increases function duration and memory, duplicates
the daemon's hashing responsibility, and reverses the deliberate no-download trigger design.

### Daemon-layer fingerprinting

Benefit: reuses the trusted raw-byte SHA-256 already computed by the worker, keeps the trigger cheap, and rejects
duplicates before parsing or AI spending.

Trade-off: every upload reaches Storage and the queue before a byte-for-byte duplicate is rejected.

### Recommendation: daemon-layer only is authoritative

The browser may compute the same lowercase raw-byte SHA-256 for an early warning, but the daemon decides. It
must recompute and verify the hash. No client hash can bypass daemon verification.

To stop the same-filename trigger trap without trigger-time hashing:

- Upload to `ingest-queue/{collection}/{uploadId}/{sanitizedFilename}.pdf`.
- Accept the old three-segment path temporarily for compatibility.
- Record `storage_generation` and make trigger idempotency use path plus generation.
- Each upload gets a unique path, so a new draft with the same filename creates a new queue job.
- Event retries for the same object generation remain idempotent.

## Decision 3: Version Storage

### Flat `version_number` on the parent only

Benefit: smallest schema change.

Fatal limitation: every write still destroys the previous analysis. A number is not history.

### Immutable `versions` subcollection

Benefit: preserves every prior analysis, supports revision comparison, and keeps the parent compatible.

Trade-off: requires explicit Firestore rules and a query when opening version history.

### Recommendation: immutable subcollection

Add this exact rules block before the catch-all deny:

```text
match /uploaded_analyses/{docId}/versions/{versionId} {
  allow read: if isTeamMember();

  allow create: if isAdmin()
                && request.resource.data.project_id == docId
                && request.resource.data.version_id == versionId
                && request.resource.data.source_file is string
                && request.resource.data.source_file.size() <= 500
                && request.resource.data.version_number is int
                && request.resource.data.version_number > 0
                && request.resource.data.created_at is timestamp
                && request.resource.data.identity_status == 'verified'
                && request.resource.data.content_hash is string
                && request.resource.data.content_hash.matches('^[a-f0-9]{64}$');

  allow update, delete: if false;
}
```

Admin SDK daemon and CLI writes bypass rules, but they must enforce the same Timestamp, integer, identity, and
immutability invariants in code and tests.

## Decision 4: Grid and Version Presentation

The current title-based collapse must be removed. Two unrelated scripts can share a title, and a title is not an ID.

Recommendation:

- Add `Screenplay.projectId` for the stable parent document ID while leaving the existing
  `Screenplay.id` and `sourceFile` behavior unchanged for notes, favorites, feedback, and shares.
- Deduplicate top-level cards by `projectId`, falling back to the existing `id` for older records without that field.
  Never deduplicate by lowercase title.
- Keep one card per screenplay project in the default grid, showing the latest analysis and a version-count badge.
- Open a version list in the project detail panel. Selecting a version loads that immutable snapshot.
- Same-title projects with different project IDs both remain visible.
- Revisions under one project are grouped, not discarded. The original remains available in version history.

This matches the product requirement to group revised drafts without turning the discovery grid into duplicate cards.

## Decision 5: Storage Bucket

### Recommendation: `lemon-screenplay-dashboard.firebasestorage.app`

This is already the browser configuration, Storage-trigger bucket, daemon default, and deployment example.
Change CLI initialization to read `FIREBASE_STORAGE_BUCKET`
and default to the same `firebasestorage.app` bucket. Do not rely on Firebase Admin singleton initialization order.

Trade-off: any operator intentionally using the old `appspot.com` bucket must set an explicit environment override
during the transition. The production default becomes consistent and deterministic.

## Upload and Revision Flow

### New upload

1. Browser computes an advisory raw-byte SHA-256 and assigns an `uploadId`.
2. Browser uploads to the unique upload-ID path.
3. Trigger creates one queue document for the object generation without downloading it.
4. Daemon downloads once, computes the authoritative SHA-256, and checks completed queue jobs.
5. Daemon creates immutable version 1 and atomically advances the parent.

### Possible revision

1. A title match is a suggestion, not a duplicate verdict.
2. UI records the selected parent as `target_project_id` and asks whether this is a revision or a separate project.
3. `target_project_id` flows through the upload job, Storage metadata, queue document, daemon claim, and atomic
   writer. The daemon validates that the target parent exists before attaching the revision.
4. Different bytes queue normally as a new version under the selected parent, even when the uploaded revision
   has a different filename or title.
5. The parent's canonical `source_file` and share key do not change.

### Exact duplicate

1. Browser warns when its advisory SHA-256 matches a known analysis.
2. Daemon independently confirms the SHA-256.
3. Default behavior skips the duplicate with no AI call.
4. A future explicit, version-safe “Analyze same PDF again” action sets `bypass_duplicate` and creates a new
   analysis version. It never overwrites history.

## Writer Consistency

Both Python raw-document builders and the browser path must emit the identity fields.

- Daemon builder: `daemon.py` `raw_doc`.
- CLI builder: `execution/ingest_v9.py` `build_raw_document`.
- Shared Python persistence: `execution/ingest_v9.py` `write_to_firestore` performs the atomic version and parent write.
- Browser builder: `src/lib/analysisService.ts` includes the computed fingerprint and provenance.
- Browser persistence: `src/lib/analysisStore.ts` writes the immutable version and parent atomically.
- Browser offline retry: the retry item preserves the fixed version ID, Firestore Timestamp value,
  integer `version_number`, target project, immutable version payload, and latest-parent payload. A retry replays
  the same atomic parent-plus-version write rather than saving only the parent or creating another version.

No writer may update the parent without also creating or confirming the immutable version.

## Future Clean-Slate Step (Outside Chunk 2)

The 23 current production screenplays will not be migrated or backfilled. Billy intends to delete the old data
and start fresh only after the complete replacement pipeline is trusted.

No wipe script is created in Chunk 2. The clean-slate operation runs last and only when all of these gates are met:

1. Chunks 2 through 5 are built, reviewed, merged, deployed, and proven with controlled uploads.
2. A count-only dry run identifies the exact `uploaded_analyses`, completed ingest-queue jobs, related
   `shared_views`, and analysis cache records in scope without printing screenplay contents.
3. Billy gives a separate approval after seeing those counts.
4. The destructive command requires an explicit commit flag and project confirmation; default execution is read-only.
5. Pending or processing jobs are never deleted, and the tool aborts if active jobs exist.
6. The dashboard cache version is advanced so browsers cannot repopulate the clean archive from stale local data.

The exact cleanup inventory and tool belong to that future final step, not to this branch. Nothing in Chunk 2
builds, runs, or quietly prepares a production wipe.

## Exact Files and Functions Planned

### Step 0 only

- `scripts/census-analysis-versions.mjs`: extended count-only census.
- `docs/DESIGN-chunk2-identity.md`: this approval document.

### Parse identity and cache

- New `execution/content_identity.py`: the daemon's existing raw-byte SHA-256 moved into a shared helper unchanged.
- `daemon.py`: import the shared `compute_content_hash`; pass hash into `parse_pdf`.
- `execution/ingest_v9.py`: `parse_pdf`, new `PARSER_VERSION`, and bounded cache cleanup.
- New `execution/test_parse_cache.py`: SHA-256, parser-version, same-name/different-content, and cleanup tests.

### Writers and immutable versions

- `daemon.py`: `raw_doc` identity/provenance fields and target-project handling.
- `execution/ingest_v9.py`: `build_raw_document` and `write_to_firestore` identity fields plus atomic version write.
- `src/lib/analysisService.ts`: browser raw identity fields while preserving both Chunk 1 guards.
- `src/lib/analysisStore.ts`: version creation plus atomic parent advancement.
- `src/types/screenplay.ts`: add separate project and version metadata without re-keying `Screenplay.id`.
- `src/lib/normalizers/normalizeV9.ts`: preserve V8/V9 rendering, retain the existing `id`, and normalize
  `projectId` plus version metadata separately.
- New `src/lib/analysisIdentity.ts` and tests: version IDs, parent identity, and safe latest projection helpers.

### Trigger, queue, and upload UX

- `src/lib/firebase.ts`: unique upload-ID Storage paths and metadata.
- `functions/src/onScreenplayUploaded.ts`: four-segment path support, path-plus-generation idempotency, metadata plumbing.
- `functions/src/ingestQueue.ts`: `upload_id`, `storage_generation`, `target_project_id`, and `bypass_duplicate` fields.
- New Functions identity helper and Node tests: path parsing and idempotency key behavior.
- `src/stores/uploadStore.ts`: advisory hash, match type, matched project ID, and bypass state.
- `src/components/settings/UploadPanel.tsx`: exact duplicate versus possible revision logic.
- `src/components/settings/upload/JobItem.tsx`: version-safe choices.
- `src/components/settings/upload/UploadQueue.tsx`: revised callbacks and counts.
- `src/lib/ingestQueueClient.ts`: consume the unique upload job identity if required by the final trigger implementation.

### Grid and version access

- `src/lib/api.ts`: replace title collapse with project-ID deduplication.
- New `src/lib/versionService.ts`: read immutable versions for a selected project.
- New version-history UI under `src/components/screenplay/modal/`, plus focused tests.

### Storage bucket reconciliation

- `execution/ingest_v9.py`: make `init_firebase` read `FIREBASE_STORAGE_BUCKET` and use the approved default.
- `daemon.py`: retain the same environment override and approved default explicitly.

### Rules

- `firestore.rules`: explicit immutable versions subcollection block.
- `tests/firestore.rules.test.ts`: team read, admin create, malformed create rejection, update/delete rejection.

### Explicitly unchanged under the recommended model

- `src/lib/shareService.ts`: no ID or behavior change.
- Existing `shared_views` documents: no rewrite.
- Public token resolution: unchanged and self-contained.
- `storage.rules`: the existing recursive `ingest-queue/{allPaths=**}` rule already permits the unique nested path.

## Test and Release Gates

Tests must be green after each `chunk2:` commit:

- Current browser baseline: 585 tests.
- New same-filename/different-bytes test.
- New same-bytes/different-filename test.
- New parser cache content-addressing and cleanup tests.
- New trigger path and generation idempotency tests.
- New writer parity tests covering daemon, CLI, and browser identity fields.
- New renamed-revision test proving `target_project_id` attaches a differently named PDF to the selected parent.
- New immutable version rule tests.
- New writer tests proving `created_at` is a Firestore Timestamp and `version_number` is an integer.
- New browser offline-retry test proving the immutable version and parent projection replay atomically.
- New grid same-title/different-project and grouped-revision tests.
- Functions build, Python tests, lint, TypeScript build, and production Vite build.

No clean-slate write, merge, Function deployment, dashboard deployment, or VPS restart occurs without later approval.

## Approved Implementation Sequence

Billy approved this design with the no-migration scope change. Implementation proceeds one tested commit at a time,
beginning with the parser-cache fix. This branch is not merged or deployed during implementation.
