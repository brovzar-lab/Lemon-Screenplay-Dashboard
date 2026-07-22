import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetProxyAuthHeaders, mockSubscribeToIngestJob } = vi.hoisted(() => ({
  mockGetProxyAuthHeaders: vi.fn(),
  mockSubscribeToIngestJob: vi.fn(),
}));

vi.mock('./proxyClient', () => ({ getProxyAuthHeaders: mockGetProxyAuthHeaders }));
vi.mock('./ingestQueueClient', () => ({
  subscribeToIngestJob: mockSubscribeToIngestJob,
}));

import { queueScreenplayReanalysis, waitForQueuedReanalysis } from './reanalysisQueue';

describe('queueScreenplayReanalysis', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSubscribeToIngestJob.mockReset();
    mockGetProxyAuthHeaders.mockResolvedValue({ Authorization: 'Bearer test' });
  });

  it('asks the server to requeue the stable project through the VPS', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      queued: [{
        screenplayId: 'Original_Draft.pdf',
        storagePath: 'gs://bucket/ingest-queue/LEMON/upload-id/Draft.pdf',
      }],
      failed: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const queued = await queueScreenplayReanalysis('Original_Draft.pdf', 'opus');

    expect(queued.storagePath).toContain('/ingest-queue/');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/queue'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test' }),
        body: JSON.stringify({
          action: 'reanalyze',
          screenplayIds: ['Original_Draft.pdf'],
          model: 'opus',
        }),
      }),
    );
  });

  it('surfaces the server reason when no immutable PDF is available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      queued: [],
      failed: [{ screenplayId: 'Legacy.pdf', error: 'No archived PDF is available.' }],
    }), { status: 400, headers: { 'Content-Type': 'application/json' } }));

    await expect(queueScreenplayReanalysis('Legacy.pdf', 'sonnet'))
      .rejects.toThrow(/no archived PDF/i);
  });
});

describe('waitForQueuedReanalysis', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSubscribeToIngestJob.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('times out and unsubscribes when the daemon never advances the job', async () => {
    const unsubscribe = vi.fn();
    mockSubscribeToIngestJob.mockReturnValue(unsubscribe);

    const waiting = waitForQueuedReanalysis('gs://bucket/job.pdf', undefined, {
      timeoutMs: 1_000,
    });
    const rejection = expect(waiting).rejects.toThrow(/did not respond within 1 second/i);

    await vi.advanceTimersByTimeAsync(1_000);
    await rejection;
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('supports cancellation and removes the live subscription', async () => {
    const unsubscribe = vi.fn();
    mockSubscribeToIngestJob.mockReturnValue(unsubscribe);
    const controller = new AbortController();

    const waiting = waitForQueuedReanalysis('gs://bucket/job.pdf', undefined, {
      timeoutMs: 10_000,
      signal: controller.signal,
    });
    const rejection = expect(waiting).rejects.toMatchObject({
      name: 'AbortError',
      message: expect.stringMatching(/cancelled/i),
    });

    controller.abort();
    await rejection;
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('resolves once, clears the timeout, and ignores later updates', async () => {
    const unsubscribe = vi.fn();
    let emit: ((update: {
      status: 'complete';
      jobId: string;
      analysisVersion: string;
    }) => void) | undefined;
    mockSubscribeToIngestJob.mockImplementation((_path, onUpdate) => {
      emit = onUpdate;
      return unsubscribe;
    });

    const waiting = waitForQueuedReanalysis('gs://bucket/job.pdf', undefined, {
      timeoutMs: 1_000,
    });
    emit?.({ status: 'complete', jobId: 'job-1', analysisVersion: 'v9_archaeology' });

    await expect(waiting).resolves.toMatchObject({ status: 'complete', jobId: 'job-1' });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
