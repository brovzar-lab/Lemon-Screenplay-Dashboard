import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useToastStore } from '@/stores/toastStore';
import { useLiveScreenplaySync } from '@/hooks/useScreenplays';
import { useSyncStatusStore } from '@/stores/syncStatusStore';
import { subscribeToCoverageV1Reports } from '@/lib/analysisStore';

const liveMocks = vi.hoisted(() => ({
  normalizeAnalyses: vi.fn(),
  onData: undefined as ((records: Array<Record<string, unknown>>) => void) | undefined,
  onError: undefined as (() => void) | undefined,
  onCoverage: undefined as ((records: Array<Record<string, unknown>>) => void) | undefined,
  onCoverageError: undefined as (() => void) | undefined,
}));

vi.mock('@/lib/api', () => ({
  canonicalizeGenre: vi.fn(),
  getScreenplayStats: vi.fn(),
  loadAllScreenplaysVite: vi.fn(),
  normalizeAnalyses: liveMocks.normalizeAnalyses,
}));

vi.mock('@/lib/analysisStore', () => ({
  flushPendingWrites: vi.fn().mockResolvedValue(undefined),
  getDeletedAnalyses: vi.fn(),
  removeAnalysis: vi.fn(),
  removeMultipleAnalyses: vi.fn(),
  restoreAnalysis: vi.fn(),
  subscribeToAnalyses: vi.fn((onData, onError) => {
    liveMocks.onData = onData;
    liveMocks.onError = onError;
    return vi.fn();
  }),
  subscribeToCoverageV1Reports: vi.fn((onData, onError) => {
    liveMocks.onCoverage = onData;
    liveMocks.onCoverageError = onError;
    return vi.fn();
  }),
}));

vi.mock('@/lib/shareService', () => ({
  getExistingShareToken: vi.fn(),
  revokeShareToken: vi.fn(),
}));

function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('useLiveScreenplaySync localized failures', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
    useToastStore.getState().clearToasts();
    liveMocks.normalizeAnalyses.mockReset();
    liveMocks.onData = undefined;
    liveMocks.onError = undefined;
  });

  afterEach(async () => {
    vi.useRealTimers();
    useToastStore.getState().clearToasts();
    await i18n.changeLanguage('en');
  });

  it('reconnects Coverage independently and cannot show healthy while that feed is down', async () => {
    vi.useFakeTimers();
    vi.mocked(subscribeToCoverageV1Reports).mockClear();
    liveMocks.normalizeAnalyses.mockResolvedValue([]);
    const { unmount } = renderHook(() => useLiveScreenplaySync(), { wrapper });
    await act(async () => { liveMocks.onData?.([]); liveMocks.onCoverage?.([]); });
    expect(useSyncStatusStore.getState().isLiveConnected).toBe(true);
    await act(async () => { liveMocks.onCoverageError?.(); liveMocks.onData?.([]); });
    expect(useSyncStatusStore.getState().isLiveConnected).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(subscribeToCoverageV1Reports).toHaveBeenCalledTimes(2);
    await act(async () => { liveMocks.onCoverage?.([]); });
    expect(useSyncStatusStore.getState().isLiveConnected).toBe(true);
    unmount();
    await vi.advanceTimersByTimeAsync(10000);
    expect(subscribeToCoverageV1Reports).toHaveBeenCalledTimes(2);
  });

  it('localizes a disconnected live-sync warning', async () => {
    const { unmount } = renderHook(() => useLiveScreenplaySync(), { wrapper });

    liveMocks.onError?.();

    expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
      'Se perdió la sincronización en vivo. La conexión se restablecerá automáticamente.',
    );
    unmount();
  });

  it('localizes a failed live snapshot without replacing good data', async () => {
    liveMocks.normalizeAnalyses.mockRejectedValue(new Error('bad snapshot'));
    const { unmount } = renderHook(() => useLiveScreenplaySync(), { wrapper });

    liveMocks.onData?.([]);

    await waitFor(() => {
      expect(useToastStore.getState().toasts.at(-1)?.message).toBe(
        'No se pudo actualizar la lista de guiones. Conservamos los últimos datos correctos.',
      );
    });
    unmount();
  });
});
