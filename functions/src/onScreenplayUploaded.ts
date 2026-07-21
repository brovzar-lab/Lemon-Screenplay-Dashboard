/**
 * onScreenplayUploaded — Firebase Storage trigger
 *
 * Fires when a PDF is uploaded to:
 *   gs://{bucket}/ingest-queue/{collection_id}/{upload_id}/{filename}.pdf
 *
 * What it does:
 *   1. Validates the path structure (collection_id must be in VALID_COLLECTIONS)
 *   2. Uses path + object generation for event idempotency
 *   3. Writes a pending IngestJob document to Firestore
 *
 * What it does NOT do:
 *   - Parse the PDF (that's the worker's job)
 *   - Call Anthropic (that's the worker's job)
 *   - Block or rate-limit the upload (the worker enforces the budget)
 *
 * The content_hash field is populated by the worker (not here), because
 * reading a large PDF binary in a Storage trigger adds latency and
 * the hash is only needed at processing time.
 *
 * Worker discovery:
 *   Workers query Firestore for:  status == 'pending'  ORDER BY priority DESC, queued_at ASC
 *   They do NOT poll Storage directly.
 */

import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import {
  INGEST_QUEUE_COLLECTION,
  buildPendingJob,
  type IngestModel,
} from './ingestQueue';
import {
  buildIngestJobId,
  parseIngestPath,
  readSeparateProject,
  readTargetProjectId,
} from './ingestUploadIdentity';

// Init Firebase Admin once
if (!getApps().length) initializeApp();

// ── Cloud Function ────────────────────────────────────────────────────────────

export const onScreenplayUploaded = onObjectFinalized(
  {
    /**
     * Only trigger on the ingest-queue/ prefix.
     * Avoids firing for Posters/, screenplays/, or any other bucket path.
     */
    // Note: bucket-level triggers don't support path filtering natively in v2;
    // we filter inside the handler and return early for non-matching paths.
    timeoutSeconds: 30,
    memory: '256MiB',
    // Must match the Storage bucket region (us-west1)
    region: 'us-west1',
    // Explicitly name the bucket — Eventarc needs this to create the trigger
    bucket: 'lemon-screenplay-dashboard.firebasestorage.app',
  },
  async (event) => {
    const objectName = event.data.name ?? '';
    const bucket = event.data.bucket;
    const contentType = event.data.contentType ?? '';
    const sizeMb = Number(event.data.size ?? 0) / (1024 * 1024);

    console.log(`[onScreenplayUploaded] Object finalized: gs://${bucket}/${objectName}`);

    // ── Path guard ─────────────────────────────────────────────────────────
    const parsed = parseIngestPath(objectName);
    if (!parsed) {
      console.log(`[onScreenplayUploaded] Ignoring — not an ingest-queue PDF: ${objectName}`);
      return;
    }

    const { collection_id, filename, upload_id } = parsed;

    // ── Content-type guard ─────────────────────────────────────────────────
    if (!contentType.includes('pdf')) {
      console.warn(
        `[onScreenplayUploaded] Ignoring non-PDF content type: ${contentType} (${objectName})`,
      );
      return;
    }

    // ── Size guard (warn only — worker will handle actual validation) ──────
    if (sizeMb > 50) {
      console.warn(
        `[onScreenplayUploaded] Large PDF (${sizeMb.toFixed(1)} MB): ${filename}. ` +
        `Worker will validate token budget before calling Anthropic.`,
      );
    }

    const storage_path = `gs://${bucket}/${objectName}`;
    const storage_generation = String(event.data.generation ?? event.id);
    const db = getFirestore();

    // ── Read model preference from Storage metadata (optional) ────────────
    // Upload with: gsutil -h "x-goog-meta-model:haiku" cp ...
    // Or set via Firebase Console / SDK custom metadata
    const customMeta = event.data.metadata ?? {};
    const requestedModel = (customMeta['model'] as IngestModel | undefined) ?? 'auto';
    const priority = customMeta['priority'] ? Number(customMeta['priority']) : 0;
    const target_project_id = readTargetProjectId(customMeta);
    const separate_project = readSeparateProject(customMeta);
    if (target_project_id && separate_project) {
      throw new Error('Upload metadata cannot target a revision and request a separate project.');
    }

    // ── Write pending job to Firestore ─────────────────────────────────────
    const jobId = buildIngestJobId(objectName, storage_generation);
    const docRef = db.collection(INGEST_QUEUE_COLLECTION).doc(jobId);
    const jobDoc = buildPendingJob({
      id: jobId,
      collection_id,
      filename,
      storage_path,
      storage_generation,
      upload_id,
      target_project_id,
      separate_project,
      // content_hash computed by worker (avoids downloading PDF here)
      content_hash: 'pending', // placeholder; worker updates with real SHA-256
      requested_model: requestedModel,
      priority,
    });

    const created = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(docRef);
      if (existing.exists) return false;
      transaction.create(docRef, jobDoc);
      return true;
    });

    if (!created) {
      console.log(
        `[onScreenplayUploaded] Skipping duplicate event for ${objectName} ` +
        `(generation=${storage_generation})`,
      );
      return;
    }

    console.log(
      `[onScreenplayUploaded] ✅ Pending job created: ${jobId} ` +
      `| collection=${collection_id} | file=${filename} | model=${requestedModel}`,
    );
  },
);
