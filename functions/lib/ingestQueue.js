"use strict";
/**
 * ingestQueue.ts — Shared types for the Lemon ingest pipeline
 *
 * Used by:
 *   - onScreenplayUploaded  (Cloud Function — writes pending docs)
 *   - VPS daemon            (Python — reads/claims/updates docs)
 *   - Watchdog              (Cloud Function — resets stuck docs)
 *   - Dashboard             (React — reads progress)
 *
 * SCHEMA VERSION: 1
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAILY_BUDGET_LIMIT = exports.SYSTEM_COLLECTION = exports.INGEST_QUEUE_COLLECTION = exports.VALID_COLLECTIONS = void 0;
exports.buildPendingJob = buildPendingJob;
const firestore_1 = require("firebase-admin/firestore");
// ── Valid collection IDs ──────────────────────────────────────────────────────
exports.VALID_COLLECTIONS = ['LEMON', 'SUBMISSION', 'BLKLST', 'CONTEST', 'OTHER'];
// ── Factory: new pending job ──────────────────────────────────────────────────
function buildPendingJob(params) {
    return {
        id: params.id,
        collection_id: params.collection_id,
        filename: params.filename,
        storage_path: params.storage_path,
        content_hash: params.content_hash,
        status: 'pending',
        attempt_count: 0,
        max_attempts: 3,
        queued_at: firestore_1.FieldValue.serverTimestamp(),
        processing_started_at: null,
        processing_completed_at: null,
        last_heartbeat_at: null,
        duration_seconds: null,
        worker_id: null,
        requested_model: params.requested_model ?? 'auto',
        prompt_version: null,
        last_error: null,
        skip_reason: null,
        screenplay_doc_id: null,
        input_tokens: null,
        output_tokens: null,
        anthropic_model: null,
        anthropic_finish_reason: null,
        estimated_cost_usd: null,
        priority: params.priority ?? 0,
    };
}
exports.INGEST_QUEUE_COLLECTION = 'ingest-queue';
exports.SYSTEM_COLLECTION = 'system';
exports.DAILY_BUDGET_LIMIT = 200;
//# sourceMappingURL=ingestQueue.js.map