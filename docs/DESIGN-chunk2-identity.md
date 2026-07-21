# Chunk 2 Design: Script Identity and Revisions

Status: Proposed. No feature implementation is authorized until Billy approves this document.

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

- Existing V8 and V9 analyses must continue to render.
- Existing public share links must continue to resolve without migration.
- Existing share management keys, notes, favorites, feedback, and verdicts must not be re-keyed.
- The parent `uploaded_analyses` document remains the backward-compatible latest projection.
- Every permanent write creates an immutable version before advancing the latest projection.
- The daemon's raw-byte SHA-256 remains the authoritative fingerprint.
- The Storage trigger does not download screenplay PDFs.
- Chunk 1 remains intact: triage cannot be used for permanent reanalysis, and only
  `v9_archaeology` results can pass the browser reanalysis save guard.
- Migration is read-only unless both `--commit` is supplied and Billy separately approves the write.

## Measured Production State

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
  unavailable_legacy:    0
  missing:              23
  invalid/other:         0

storage provenance:
  _storagePath set:      0
  _storagePath absent:  23
  _ingest_job_id set:   23
  _ingest_job_id absent: 0

linked ingest-queue recovery:
  queue docs found:     23
  queue docs missing:    0
  valid SHA-256:        23
  missing/invalid hash:  0
  storage_path set:     23
  storage_path absent:   0
  Storage object found: 23
  Storage object missing: 0
  object check failed:   0
```

### Census conclusion

The analysis documents cannot identify their PDFs on their own, but all 23 have a valid
`_ingest_job_id`. Every linked queue document contains the daemon-generated SHA-256 and a
Storage path, and every referenced PDF still exists. Therefore the current 23 records can
be migrated with verified identities. No hash will be fabricated or recomputed from analysis text.

## Decision 1: Identity Model

### Option A: Re-key parent documents to content or project IDs

Benefits:

- Clean long-term identity independent of filenames.
- Natural separation between project identity and analysis identity.

Costs and risks:

- Breaks every feature currently keyed by `screenplayId`, `source_file`, or the filename-derived
  Firestore ID, including share management, notes, favorites, feedback, verdicts, posters, and PDF status.
- Requires migrating `shared_views.screenplayId` and changing share lookup and revoke behavior.
- Creates a large, difficult-to-reverse migration before the redesign.

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
content_hash            SHA-256 of the latest PDF, or null only when truly unavailable
identity_status         verified | legacy_unavailable
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
created_at
```

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
                && (
                     (request.resource.data.identity_status == 'verified'
                      && request.resource.data.content_hash is string
                      && request.resource.data.content_hash.matches('^[a-f0-9]{64}$'))
                     ||
                     (request.resource.data.identity_status == 'legacy_unavailable'
                      && request.resource.data.content_hash == null)
                   );

  allow update, delete: if false;
}
```

Admin SDK migration and daemon writes bypass rules, but they must enforce the same invariants in code and tests.

## Decision 4: Legacy Identity

### String sentinel: `unavailable_legacy`

Benefit: easy to see in a string-only export.

Risk: code can accidentally treat the sentinel as a real fingerprint because both are strings.

### Null plus explicit status

Benefit: cannot be confused with a hash and makes missing identity explicit.

Trade-off: queries must check both `content_hash == null` and `identity_status`.

### Recommendation: `content_hash: null` plus `identity_status: legacy_unavailable`

This is the fallback only when neither the parent, linked queue record, nor verified Storage PDF can provide
identity. The measured 23 production documents do not need this fallback: all 23 have recoverable daemon hashes
and live PDFs.

## Decision 5: Grid and Version Presentation

The current title-based collapse must be removed. Two unrelated scripts can share a title, and a title is not an ID.

Recommendation:

- Add `Screenplay.projectId` for the stable parent document ID while leaving the existing
  `Screenplay.id` and `sourceFile` behavior unchanged for notes, favorites, feedback, and shares.
- Deduplicate top-level cards by `projectId`, falling back to the existing `id` only for unmigrated data.
  Never deduplicate by lowercase title.
- Keep one card per screenplay project in the default grid, showing the latest analysis and a version-count badge.
- Open a version list in the project detail panel. Selecting a version loads that immutable snapshot.
- Same-title projects with different project IDs both remain visible.
- Revisions under one project are grouped, not discarded. The original remains available in version history.

This matches the product requirement to group revised drafts without turning the discovery grid into duplicate cards.

## Decision 6: Storage Bucket

### Recommendation: `lemon-screenplay-dashboard.firebasestorage.app`

This is already the browser configuration, Storage-trigger bucket, daemon default, deployment example, and the
bucket that contains all 23 verified legacy PDFs. Change CLI initialization to read `FIREBASE_STORAGE_BUCKET`
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
2. UI records `matchedProjectId` and asks whether this is a revision or a separate project.
3. Different bytes queue normally as a new version under the selected parent.
4. The parent's canonical `source_file` and share key do not change.

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

No writer may update the parent without also creating or confirming the immutable version.

## Conservative Migration

New script: `scripts/migrate-analysis-versions.mjs`.

Default behavior is read-only and prints counts only:

- parent documents scanned
- recoverable top-level hashes
- recoverable linked-queue hashes
- verified Storage objects
- unavailable identities
- version documents that would be created
- parent documents that would be annotated
- conflicts or records that would be skipped

The write path requires `--commit` and a separate Billy approval after the dry-run report. It will:

1. Preserve each document's exact `analysis_version` and analysis body.
2. Copy the verified queue SHA-256 and Storage path for the measured 23 documents.
3. Create one immutable initial version per parent.
4. Add parent identity and latest-version fields without changing the parent document ID or canonical `source_file`.
5. Perform no `shared_views` migration under Option B.

Migration is idempotent: a second dry-run or commit must report existing version records rather than duplicating them.

## Exact Files and Functions Planned

### Step 0 only

- `scripts/census-analysis-versions.mjs`: extended count-only census.
- `docs/DESIGN-chunk2-identity.md`: this approval document.

### Parse identity and cache

- New `execution/content_identity.py`: the daemon's existing raw-byte SHA-256 moved into a shared helper unchanged.
- `daemon.py`: import the shared `compute_content_hash`; pass hash into `parse_pdf`.
- `execution/ingest_v9.py`: `parse_pdf`, new `PARSER_VERSION`, cache cleanup, `init_firebase` bucket configuration.
- New `execution/test_content_identity.py`: SHA-256 and same-name/different-content cache regression tests.

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

### Rules and migration

- `firestore.rules`: explicit immutable versions subcollection block.
- `tests/firestore.rules.test.ts`: team read, admin create, malformed create rejection, update/delete rejection.
- New `scripts/migrate-analysis-versions.mjs`: dry-run by default, `--commit` gated.
- New migration helper tests using fixtures only, never production writes.

### Explicitly unchanged under the recommended model

- `src/lib/shareService.ts`: no ID migration or behavior change.
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
- New immutable version rule tests.
- New migration idempotency and V8/V9 preservation fixtures.
- New grid same-title/different-project and grouped-revision tests.
- Functions build, Python tests, lint, TypeScript build, and production Vite build.

No migration write, merge, Function deployment, dashboard deployment, or VPS restart occurs without later approval.

## Approval Requested

Approve the six recommendations above and the proposed parent-plus-immutable-versions schema. After approval,
implementation proceeds in the requested commit order, beginning with the parser-cache fix. The migration remains
read-only until its own later approval.
