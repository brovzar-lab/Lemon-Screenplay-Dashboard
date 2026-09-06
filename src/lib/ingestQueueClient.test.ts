import { afterEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  listen: vi.fn(),
  where: vi.fn((...args: unknown[]) => args),
}));

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'ingest-queue'),
  query: vi.fn((...args: unknown[]) => args),
  where: boundary.where,
  limit: vi.fn(),
  onSnapshot: boundary.listen,
}));

import { subscribeToIngestJob } from '@/lib/ingestQueueClient';

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('accepted upload receipts', () => {
  it('observes the accepted generation, not an older upload at the same path', () => {
    boundary.listen.mockReturnValue(vi.fn());
    subscribeToIngestJob('gs://bucket/script.pdf', vi.fn(), vi.fn(), '123456');
    expect(boundary.where).toHaveBeenCalledWith('storage_generation', '==', '123456');
  });

  it('refuses ambiguous legacy receipts instead of reporting an arbitrary completion', () => {
    const update = vi.fn();
    const error = vi.fn();
    boundary.listen.mockReturnValue(vi.fn());
    const stop = subscribeToIngestJob('gs://bucket/script.pdf', update, error);
    boundary.listen.mock.calls.at(-1)?.[1]({
      empty: false,
      docs: [
        { id: 'old', data: () => ({ status: 'complete' }) },
        { id: 'new', data: () => ({ status: 'processing' }) },
      ],
    });
    expect(update).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('more than one'),
    }));
    stop();
  });

  it('reconnects after a listener error and cancels reconnect on unmount', () => {
    vi.useFakeTimers();
    boundary.listen.mockReturnValue(vi.fn());
    const stop = subscribeToIngestJob('gs://bucket/script.pdf', vi.fn(), vi.fn(), '123');
    boundary.listen.mock.calls.at(-1)?.[2](new Error('offline'));
    vi.advanceTimersByTime(5_000);
    expect(boundary.listen).toHaveBeenCalledTimes(2);
    boundary.listen.mock.calls.at(-1)?.[2](new Error('offline again'));
    stop();
    vi.advanceTimersByTime(5_000);
    expect(boundary.listen).toHaveBeenCalledTimes(2);
  });
});
