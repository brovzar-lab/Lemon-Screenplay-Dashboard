import { getProxyAuthHeaders } from './proxyClient';
import { subscribeToIngestJob, type IngestJobUpdate } from './ingestQueueClient';

const QUEUE_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/queueManager'
  : '/api/queue';

export interface QueuedReanalysis {
  screenplayId: string;
  storagePath: string;
}

export async function queueScreenplayReanalysis(
  screenplayId: string,
  model: 'sonnet' | 'opus',
): Promise<QueuedReanalysis> {
  const response = await fetch(QUEUE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getProxyAuthHeaders()) },
    body: JSON.stringify({ action: 'reanalyze', screenplayIds: [screenplayId], model }),
  });
  const result = await response.json().catch(() => ({})) as {
    queued?: QueuedReanalysis[];
    failed?: Array<{ screenplayId: string; error: string }>;
    error?: string;
  };
  const queued = result.queued?.find((item) => item.screenplayId === screenplayId);
  if (!response.ok || !queued) {
    const failure = result.failed?.find((item) => item.screenplayId === screenplayId);
    throw new Error(failure?.error || result.error || 'Re-analysis could not be queued.');
  }
  return queued;
}

export function waitForQueuedReanalysis(
  storagePath: string,
  onUpdate?: (update: IngestJobUpdate) => void,
): Promise<IngestJobUpdate> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe = () => {};
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      callback();
    };
    unsubscribe = subscribeToIngestJob(
      storagePath,
      (update) => {
        onUpdate?.(update);
        if (update.status === 'complete') finish(() => resolve(update));
        if (update.status === 'failed' || update.status === 'skipped') {
          finish(() => reject(new Error(update.error || 'VPS re-analysis did not complete.')));
        }
      },
      (error) => finish(() => reject(error)),
    );
  });
}
