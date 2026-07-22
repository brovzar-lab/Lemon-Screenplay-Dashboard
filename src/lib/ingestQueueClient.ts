/**
 * Ingest Queue Client (browser-side)
 *
 * Subscribes to the Firestore `ingest-queue` collection to watch a job's
 * lifecycle after the PDF has been uploaded to Storage.
 *
 * Flow:
 *   1. Browser uploads PDF to ingest-queue/{collection}/{file}.pdf (Storage).
 *   2. onScreenplayUploaded Cloud Function (server) creates a pending IngestJob
 *      doc in the Firestore `ingest-queue` collection, keyed by the unique upload path.
 *   3. VPS daemon claims the job (pending -> processing -> complete/failed).
 *   4. This client subscribes to the job doc by `storage_path` and emits
 *      status updates to the caller.
 */

import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

const INGEST_QUEUE_COLLECTION = 'ingest-queue';

export type IngestStatus =
  | 'pending'
  | 'processing'
  | 'waiting_for_budget'
  | 'complete'
  | 'failed'
  | 'skipped';

export interface IngestJobUpdate {
  status: IngestStatus;
  jobId: string;
  /** Set when status === 'failed' or 'skipped' */
  error?: string;
  /** Set when status === 'complete'; points at the uploaded_analyses doc */
  screenplayDocId?: string;
  /** Daemon's reported attempt count (useful for stuck-job UI) */
  attemptCount?: number;
  /** Permanent analyses must be complete V9 coverage. */
  analysisVersion?: string;
}

/**
 * Subscribe to an ingest job by its Storage path. Emits whenever the matching
 * Firestore doc is created or updated. Returns an unsubscribe function.
 *
 * The trigger has ~1-3s latency between Storage upload and Firestore write,
 * so the first emission may not arrive immediately.
 */
export function subscribeToIngestJob(
  storagePath: string,
  onUpdate: (update: IngestJobUpdate) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, INGEST_QUEUE_COLLECTION),
    where('storage_path', '==', storagePath),
    limit(1),
  );

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) return; // Trigger hasn't created the doc yet
      const doc = snap.docs[0];
      const data = doc.data();
      onUpdate({
        status: data.status as IngestStatus,
        jobId: doc.id,
        error: (data.last_error as string | undefined) ?? (data.skip_reason as string | undefined),
        screenplayDocId: data.screenplay_doc_id as string | undefined,
        attemptCount: data.attempt_count as number | undefined,
        analysisVersion: data.analysis_version as string | undefined,
      });
    },
    (err) => {
      console.error('[ingestQueue] subscription error', err);
      onError?.(err);
    },
  );
}

/**
 * Terminal statuses — once a job reaches one of these, no further updates
 * are expected and the caller should unsubscribe.
 */
export function isTerminalStatus(status: IngestStatus): boolean {
  return status === 'complete' || status === 'failed' || status === 'skipped';
}
