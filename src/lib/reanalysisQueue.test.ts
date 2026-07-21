import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetProxyAuthHeaders } = vi.hoisted(() => ({
  mockGetProxyAuthHeaders: vi.fn(),
}));

vi.mock('./proxyClient', () => ({ getProxyAuthHeaders: mockGetProxyAuthHeaders }));
vi.mock('./ingestQueueClient', () => ({ subscribeToIngestJob: vi.fn() }));

import { queueScreenplayReanalysis } from './reanalysisQueue';

describe('queueScreenplayReanalysis', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
