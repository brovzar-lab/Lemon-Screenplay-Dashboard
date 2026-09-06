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
  onSnapshot,
  query,
  where,
  type Unsubscribe,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isLocalE2E } from '@/lib/runtimeMode';

const INGEST_QUEUE_COLLECTION = 'ingest-queue';

export type IngestStatus =
  | 'pending'
  | 'processing'
  | 'waiting_for_budget'
  | 'waiting_for_engine'
  | 'complete'
  | 'failed'
  | 'skipped'
  | 'needs_review';

export interface IngestJobUpdate {
  status: IngestStatus;
  jobId: string;
  /** Set when status is a terminal issue state. */
  error?: string;
  /** Set when complete; points at the engine's stable screenplay project. */
  screenplayDocId?: string;
  /** Daemon's reported attempt count (useful for stuck-job UI) */
  attemptCount?: number;
  /** Engine contract reported by the daemon. */
  analysisVersion?: string;
  reportId?: string;
  engine?: 'coverage_v1' | 'v9';
  versionId?: string;
}

export interface IngestQueueJob extends IngestJobUpdate {
  storagePath: string;
  storageGeneration?: string;
  uploadId?: string;
  filename: string;
  category: string;
  queuedAt: string;
}

function readJob(jobId: string, data: Record<string, unknown>): IngestQueueJob {
  const string = (key: string) => typeof data[key] === 'string' ? data[key] as string : undefined;
  const timestamp = data.queued_at;
  const queuedAt = timestamp && typeof timestamp === 'object' && 'toDate' in timestamp
    && typeof timestamp.toDate === 'function'
    ? (timestamp.toDate() as Date).toISOString()
    : string('queued_at') ?? '';
  return {
    jobId,
    status: ['pending', 'processing', 'waiting_for_budget', 'waiting_for_engine', 'complete', 'failed', 'skipped', 'needs_review'].includes(String(data.status))
      ? data.status as IngestStatus : 'needs_review',
    engine: data.engine === 'coverage_v1' ? 'coverage_v1' : 'v9',
    error: string('review_reason') ?? string('last_error') ?? string('skip_reason'),
    screenplayDocId: string('screenplay_doc_id'),
    reportId: string('coverage_v1_report_id'),
    versionId: string('version_id'),
    attemptCount: typeof data.attempt_count === 'number' ? data.attempt_count : undefined,
    analysisVersion: string('analysis_version'),
    storagePath: string('storage_path') ?? '',
    storageGeneration: string('storage_generation'),
    uploadId: string('upload_id'),
    filename: string('original_filename') ?? string('filename') ?? jobId,
    category: string('collection_id') ?? 'OTHER',
    queuedAt,
  };
}

function listenToQueue(
  queue: Query,
  onUpdate: (snapshot: QuerySnapshot) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  let active = true;
  let stop: Unsubscribe = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const connect = () => {
    if (!active) return;
    stop();
    stop = onSnapshot(queue, (snapshot) => {
      if (active) onUpdate(snapshot);
    }, (error) => {
      if (!active) return;
      onError?.(error);
      clearTimeout(timer);
      timer = setTimeout(connect, 5_000);
    });
  };
  connect();
  return () => { active = false; clearTimeout(timer); stop(); };
}

/** One authoritative docket shared by browser and desktop uploads. Admin-only UI. */
export function subscribeToIngestQueue(
  onUpdate: (jobs: IngestQueueJob[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (isLocalE2E()) return () => {};
  // ponytail: private queue fits one snapshot; paginate terminal history if it outgrows the docket.
  return listenToQueue(query(collection(db, INGEST_QUEUE_COLLECTION)), (snapshot) => {
    onUpdate(snapshot.docs.map((document) => readJob(document.id, document.data())));
  }, onError);
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
  storageGeneration?: string,
): Unsubscribe {
  const q = query(
    collection(db, INGEST_QUEUE_COLLECTION),
    where('storage_path', '==', storagePath),
    ...(storageGeneration ? [where('storage_generation', '==', storageGeneration)] : []),
  );

  return listenToQueue(
    q,
    (snap) => {
      if (snap.empty) return; // Trigger hasn't created the doc yet
      if (snap.docs.length !== 1) {
        onError?.(new Error('This path has more than one upload receipt. Open Intake to select the exact job.'));
        return;
      }
      const document = snap.docs[0];
      onUpdate(readJob(document.id, document.data()));
    },
    (err) => {
      onError?.(err);
    },
  );
}

/**
 * Terminal statuses — once a job reaches one of these, no further updates
 * are expected and the caller should unsubscribe.
 */
export function isTerminalStatus(status: IngestStatus): boolean {
  return status === 'complete'
    || status === 'failed'
    || status === 'skipped'
    || status === 'needs_review';
}
