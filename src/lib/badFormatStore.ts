/**
 * Bad Format / Skipped Job Subscription
 *
 * Subscribes to the ingest-queue collection for jobs that the daemon skipped
 * (insufficient text, not a screenplay, PDF parse failure, TMDB already-
 * produced). These never produced an analysis — but the user needs visibility
 * so they can fix the PDF and re-upload, or confirm a TMDB hit was correct.
 */

import {
  collection,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { getProxyAuthHeaders } from './proxyClient';

const INGEST_QUEUE_COLLECTION = 'ingest-queue';

export type SkipReason =
  | 'insufficient_text_extracted'
  | 'not_a_screenplay_format'
  | 'exceeds_token_budget'
  | 'pdf_parse_failed'
  | 'tmdb_already_produced'
  | 'already_complete'
  | 'tmdb_error_proceeding'
  | string;

export interface BadFormatJob {
  id: string;
  filename: string;
  collection_id: string;
  storage_path: string;
  skip_reason: SkipReason;
  status: 'skipped' | 'failed';
  last_error?: string;
  attempt_count?: number;
  queued_at?: { seconds: number } | string | null;
  processing_completed_at?: { seconds: number } | string | null;
  quarantined?: boolean;
  tmdb_status?: {
    is_produced?: boolean;
    detail?: string;
    checked_title?: string;
  };
  content_hash?: string;
  resolution_dismissed?: boolean;
}

export type QueueResolutionAction = 'retry' | 'dismiss' | 'analyze_anyway';

export async function resolveUploadIssues(
  action: QueueResolutionAction,
  jobIds: string[],
  model = 'sonnet',
): Promise<number> {
  const url = import.meta.env.DEV
    ? 'http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/queueManager'
    : '/api/queue';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getProxyAuthHeaders()) },
    body: JSON.stringify({ action, jobIds, model }),
  });
  const result = await response.json().catch(() => ({})) as { updated?: number; error?: string };
  if (!response.ok) throw new Error(result.error || 'The issue could not be updated.');
  return result.updated ?? 0;
}

/**
 * Human-friendly label for each skip reason. Used in the modal.
 */
export const SKIP_REASON_LABELS: Record<SkipReason, string> = {
  insufficient_text_extracted: 'Insufficient text (likely scanned PDF)',
  not_a_screenplay_format: 'No screenplay markers found (INT./EXT./FADE IN)',
  exceeds_token_budget: 'Script too long',
  pdf_parse_failed: 'PDF parser could not read this file',
  tmdb_already_produced: 'TMDB match — already produced',
  already_complete: 'Duplicate content — already analyzed',
  tmdb_error_proceeding: 'TMDB lookup error',
};

/**
 * Bad-format reasons that indicate a PDF problem (vs an admin-skip like
 * TMDB or duplicate). Used to filter "true" bad formats.
 */
export const BAD_FORMAT_REASONS: SkipReason[] = [
  'insufficient_text_extracted',
  'not_a_screenplay_format',
  'exceeds_token_budget',
  'pdf_parse_failed',
];

/**
 * Subscribe to all skipped jobs in the ingest-queue.
 * Returns an Unsubscribe; call it on cleanup.
 */
export function subscribeToUploadIssues(
  onChange: (jobs: BadFormatJob[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, INGEST_QUEUE_COLLECTION),
    where('status', 'in', ['skipped', 'failed']),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const jobs = snapshot.docs.map<BadFormatJob>((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          filename: String(data.filename ?? ''),
          collection_id: String(data.collection_id ?? ''),
          storage_path: String(data.storage_path ?? ''),
          skip_reason: String(data.skip_reason ?? '') as SkipReason,
          status: data.status === 'failed' ? 'failed' : 'skipped',
          last_error: typeof data.last_error === 'string' ? data.last_error : undefined,
          attempt_count: typeof data.attempt_count === 'number' ? data.attempt_count : undefined,
          queued_at: data.queued_at as BadFormatJob['queued_at'],
          processing_completed_at: data.processing_completed_at as BadFormatJob['processing_completed_at'],
          quarantined: Boolean(data.quarantined),
          tmdb_status: data.tmdb_status as BadFormatJob['tmdb_status'],
          content_hash: typeof data.content_hash === 'string' ? data.content_hash : undefined,
          resolution_dismissed: Boolean(data.resolution_dismissed),
        };
      }).filter((job) => !job.resolution_dismissed);
      onChange(jobs);
    },
    (err) => {
      console.warn('[badFormat] subscription error:', err);
    },
  );
}

/** Backward-compatible name for existing consumers. */
export const subscribeToSkippedJobs = subscribeToUploadIssues;
