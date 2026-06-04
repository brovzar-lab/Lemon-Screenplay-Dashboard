"use strict";
/**
 * onScreenplayUploaded — Firebase Storage trigger
 *
 * Fires when a PDF is uploaded to:
 *   gs://{bucket}/ingest-queue/{collection_id}/{filename}.pdf
 *
 * What it does:
 *   1. Validates the path structure (collection_id must be in VALID_COLLECTIONS)
 *   2. Idempotency check: if a complete job with the same storage path exists, skip
 *   3. Writes a pending IngestJob document to Firestore: ingest-queue/{auto-id}
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.onScreenplayUploaded = void 0;
const storage_1 = require("firebase-functions/v2/storage");
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
const ingestQueue_1 = require("./ingestQueue");
// Init Firebase Admin once
if (!(0, app_1.getApps)().length)
    (0, app_1.initializeApp)();
// ── Path helpers ──────────────────────────────────────────────────────────────
/**
 * Parses a Storage object path of the form:
 *   ingest-queue/{collection_id}/{filename}.pdf
 *
 * Returns null if the path doesn't match this structure.
 */
function parseIngestPath(objectName) {
    // Normalize: strip leading slash if present
    const name = objectName.startsWith('/') ? objectName.slice(1) : objectName;
    const parts = name.split('/');
    // Must be exactly: ingest-queue / {collection_id} / {filename}
    if (parts.length !== 3 || parts[0] !== 'ingest-queue')
        return null;
    const rawCollection = parts[1].toUpperCase();
    const filename = parts[2];
    if (!filename.toLowerCase().endsWith('.pdf'))
        return null;
    if (!ingestQueue_1.VALID_COLLECTIONS.includes(rawCollection))
        return null;
    return { collection_id: rawCollection, filename };
}
// ── Cloud Function ────────────────────────────────────────────────────────────
exports.onScreenplayUploaded = (0, storage_1.onObjectFinalized)({
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
}, async (event) => {
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
    const { collection_id, filename } = parsed;
    // ── Content-type guard ─────────────────────────────────────────────────
    if (!contentType.includes('pdf')) {
        console.warn(`[onScreenplayUploaded] Ignoring non-PDF content type: ${contentType} (${objectName})`);
        return;
    }
    // ── Size guard (warn only — worker will handle actual validation) ──────
    if (sizeMb > 50) {
        console.warn(`[onScreenplayUploaded] Large PDF (${sizeMb.toFixed(1)} MB): ${filename}. ` +
            `Worker will validate token budget before calling Anthropic.`);
    }
    const storage_path = `gs://${bucket}/${objectName}`;
    const db = (0, firestore_1.getFirestore)();
    // ── Idempotency: check if a job for this path already exists ───────────
    // Prevents duplicate pending docs if the file is re-uploaded.
    const existing = await db
        .collection(ingestQueue_1.INGEST_QUEUE_COLLECTION)
        .where('storage_path', '==', storage_path)
        .where('status', 'in', ['pending', 'processing', 'complete'])
        .limit(1)
        .get();
    if (!existing.empty) {
        const existingDoc = existing.docs[0];
        const existingStatus = existingDoc.data().status;
        console.log(`[onScreenplayUploaded] Skipping — job already exists ` +
            `(id=${existingDoc.id}, status=${existingStatus}) for: ${objectName}`);
        return;
    }
    // ── Read model preference from Storage metadata (optional) ────────────
    // Upload with: gsutil -h "x-goog-meta-model:haiku" cp ...
    // Or set via Firebase Console / SDK custom metadata
    const customMeta = event.data.metadata ?? {};
    const requestedModel = customMeta['model'] ?? 'auto';
    const priority = customMeta['priority'] ? Number(customMeta['priority']) : 0;
    // ── Write pending job to Firestore ─────────────────────────────────────
    const docRef = db.collection(ingestQueue_1.INGEST_QUEUE_COLLECTION).doc(); // auto-id
    const jobDoc = (0, ingestQueue_1.buildPendingJob)({
        id: docRef.id,
        collection_id,
        filename,
        storage_path,
        // content_hash computed by worker (avoids downloading PDF here)
        content_hash: 'pending', // placeholder; worker updates with real SHA-256
        requested_model: requestedModel,
        priority,
    });
    await docRef.set(jobDoc);
    console.log(`[onScreenplayUploaded] ✅ Pending job created: ${docRef.id} ` +
        `| collection=${collection_id} | file=${filename} | model=${requestedModel}`);
});
//# sourceMappingURL=onScreenplayUploaded.js.map