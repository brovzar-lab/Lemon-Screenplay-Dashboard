import { getProxyAuthHeaders } from './proxyClient';
import { subscribeToIngestJob, type IngestJobUpdate } from './ingestQueueClient';

const QUEUE_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/queueManager'
  : '/api/queue';

const DEFAULT_REANALYSIS_TIMEOUT_MS = 45 * 60 * 1_000;

export interface QueuedReanalysis {
  screenplayId: string;
  storagePath: string;
}

export interface ReanalysisWaitOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

function cancellationError(): Error {
  const error = new Error('Re-analysis wait was cancelled. The queued VPS job may continue.');
  error.name = 'AbortError';
  return error;
}

function formatTimeout(timeoutMs: number): string {
  if (timeoutMs < 60_000) {
    const seconds = Math.max(1, Math.round(timeoutMs / 1_000));
    return `${seconds} second${seconds === 1 ? '' : 's'}`;
  }
  const minutes = Math.max(1, Math.round(timeoutMs / 60_000));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
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
  options: ReanalysisWaitOptions = {},
): Promise<IngestJobUpdate> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_REANALYSIS_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new Error('Re-analysis timeout must be greater than zero.'));
  }
  if (options.signal?.aborted) return Promise.reject(cancellationError());

  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe = () => {};
    const handleAbort = () => finish(() => reject(cancellationError()));
    const cleanup = () => {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', handleAbort);
      unsubscribe();
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const timeout = setTimeout(() => {
      finish(() => reject(new Error(
        `The VPS analysis engine did not respond within ${formatTimeout(timeoutMs)}. `
          + 'The queued job is safe; check Upload Issues before trying again.',
      )));
    }, timeoutMs);
    options.signal?.addEventListener('abort', handleAbort, { once: true });

    try {
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
    } catch (error) {
      finish(() => reject(error));
    }
  });
}
