/**
 * ingestQueue.ts — Shared types for the Lemon ingest pipeline
 *
 * Used by:
 *   - onScreenplayUploaded  (Cloud Function — writes pending docs)
 *   - VPS daemon            (Python — reads/claims/updates docs)
 *   - Watchdog              (Cloud Function — resets stuck docs)
 *   - Dashboard             (React — reads progress)
 *
 * SCHEMA VERSION: 3
 */

import { Timestamp, FieldValue } from 'firebase-admin/firestore';

// ── Status machine ────────────────────────────────────────────────────────────

export type IngestStatus =
  | 'pending'     // Waiting to be claimed by a worker
  | 'processing'  // Claimed — worker is actively running
  | 'waiting_for_budget' // Paused outside the queue until the next UTC budget window
  | 'complete'    // Analysis written to Firestore screenplays collection
  | 'failed'      // Exhausted max_attempts — needs manual review
  | 'skipped';    // Pre-flight validation failed (scanned PDF, too short, etc.)

// ── Valid collection IDs ──────────────────────────────────────────────────────

export const VALID_COLLECTIONS = ['LEMON', 'SUBMISSION', 'BLKLST', 'CONTEST', 'OTHER'] as const;
export type CollectionId = typeof VALID_COLLECTIONS[number];

// ── Skip reasons (pre-flight validation failures) ─────────────────────────────

export type SkipReason =
  | 'insufficient_text_extracted'   // < 500 chars — likely scanned PDF
  | 'exceeds_token_budget'          // > 150 000 chars
  | 'not_a_screenplay_format'       // No INT./EXT./FADE IN markers
  | 'password_protected'            // PDF parse threw auth error
  | 'corrupt_pdf'                   // PDF parse threw on byte-level errors
  | 'already_complete';             // content_hash already exists as complete job

// ── Model selection ───────────────────────────────────────────────────────────

export type IngestModel = 'haiku' | 'sonnet' | 'opus' | 'hybrid' | 'auto';

// ── Full IngestJob document (Firestore: ingest-queue/{auto-id}) ───────────────

export interface IngestJob {
  // ── Identity ──────────────────────────────────────────────────────────────
  /** Same as the Firestore document ID */
  id: string;
  /** Which screenplay collection this belongs to (e.g., 'BLKLST') */
  collection_id: CollectionId;
  /** Original filename (e.g., 'Dune_Part_Three.pdf') */
  filename: string;
  /** Full gs:// path in Firebase Storage */
  storage_path: string;
  /** Firebase Storage generation used to make trigger retries idempotent. */
  storage_generation: string;
  /** Unique upload path component; null only for legacy three-segment paths. */
  upload_id: string | null;
  /** Existing uploaded_analyses parent when this upload is a revision. */
  target_project_id: string | null;
  /** User explicitly chose a distinct project despite a title/filename match. */
  separate_project: boolean;
  /** Explicit paid re-analysis may analyze bytes that already completed once. */
  bypass_duplicate: boolean;
  /** Explicit re-analysis is not re-screened as a newly submitted produced film. */
  bypass_tmdb: boolean;
  /** Distinguishes ordinary intake from an explicitly requested re-analysis. */
  request_kind: 'upload' | 'reanalysis';
  /**
   * SHA-256 of the PDF bytes — enables true idempotency.
   * If a job with this hash already has status=complete, skip re-processing.
   */
  content_hash: string;

  // ── State machine ─────────────────────────────────────────────────────────
  status: IngestStatus;
  /** How many processing attempts have been made (0 = not yet started) */
  attempt_count: number;
  /** Stop retrying after this many attempts */
  max_attempts: number;

  // ── Timing ────────────────────────────────────────────────────────────────
  /** When the Storage trigger created this doc */
  queued_at: Timestamp;
  processing_started_at: Timestamp | null;
  processing_completed_at: Timestamp | null;
  /**
   * Updated every ~60s by the worker while processing.
   * Watchdog resets to 'pending' if this is stale by > 5 min.
   */
  last_heartbeat_at: Timestamp | null;
  /** Wall-clock seconds from processing_started_at to processing_completed_at */
  duration_seconds: number | null;

  // ── Worker identity ───────────────────────────────────────────────────────
  /**
   * Which process claimed this job.
   * E.g., 'hostinger-vps-1', 'cloud-function-abc123'
   * Useful if multiple workers are ever added.
   */
  worker_id: string | null;

  // ── Analysis config ───────────────────────────────────────────────────────
  requested_model: IngestModel;
  /**
   * Short hash of the prompt template in use (first 8 chars of SHA-256).
   * Stored so analyses across different prompt versions can be compared.
   */
  prompt_version: string | null;

  // ── Error tracking ────────────────────────────────────────────────────────
  last_error: string | null;
  skip_reason: SkipReason | null;

  // ── Output ────────────────────────────────────────────────────────────────
  /**
   * Firestore document ID in the main 'uploaded_analyses' collection.
   * Null until processing completes successfully.
   */
  screenplay_doc_id: string | null;

  // ── Cost + quality telemetry ──────────────────────────────────────────────
  input_tokens: number | null;
  output_tokens: number | null;
  /** E.g., 'claude-sonnet-4-6' */
  anthropic_model: string | null;
  /**
   * 'end_turn' = clean completion.
   * 'max_tokens' = JSON truncated — DO NOT parse, mark failed.
   */
  anthropic_finish_reason: string | null;
  estimated_cost_usd: number | null;

  // ── Priority (v2 — not used in v1) ───────────────────────────────────────
  /** 0 = normal, 1 = high. Workers order by priority DESC, queued_at ASC */
  priority: number;
}

// ── Factory: new pending job ──────────────────────────────────────────────────

export function buildPendingJob(params: {
  id: string;
  collection_id: CollectionId;
  filename: string;
  storage_path: string;
  storage_generation: string;
  upload_id?: string | null;
  target_project_id?: string | null;
  separate_project?: boolean;
  bypass_duplicate?: boolean;
  bypass_tmdb?: boolean;
  request_kind?: 'upload' | 'reanalysis';
  content_hash: string;
  requested_model?: IngestModel;
  priority?: number;
}): Omit<IngestJob, 'queued_at'> & { queued_at: FieldValue } {
  return {
    id: params.id,
    collection_id: params.collection_id,
    filename: params.filename,
    storage_path: params.storage_path,
    storage_generation: params.storage_generation,
    upload_id: params.upload_id ?? null,
    target_project_id: params.target_project_id ?? null,
    separate_project: params.separate_project ?? false,
    bypass_duplicate: params.bypass_duplicate ?? false,
    bypass_tmdb: params.bypass_tmdb ?? false,
    request_kind: params.request_kind ?? 'upload',
    content_hash: params.content_hash,
    status: 'pending',
    attempt_count: 0,
    max_attempts: 3,
    queued_at: FieldValue.serverTimestamp(),
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

// ── Budget counter document (Firestore: system/api-budget-{YYYY-MM-DD}) ───────

export interface DailyBudget {
  date: string;    // YYYY-MM-DD (UTC)
  count: number;   // Incremented transactionally
  limit: number;   // Default 200
}

export const INGEST_QUEUE_COLLECTION = 'ingest-queue' as const;
export const SYSTEM_COLLECTION = 'system' as const;
export const DAILY_BUDGET_LIMIT = 200 as const;
