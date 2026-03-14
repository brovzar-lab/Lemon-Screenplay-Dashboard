/**
 * useSyncRetry.test.ts
 *
 * Tests for the retry hook that wraps flushPendingWrites
 * with loading/error state management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSyncStatusStore } from '@/stores/syncStatusStore';

// Mock analysisStore
const mockFlushPendingWrites = vi.fn(() => Promise.resolve());
const mockGetPendingWriteCount = vi.fn(() => 0);

vi.mock('@/lib/analysisStore', () => ({
    flushPendingWrites: () => mockFlushPendingWrites(),
    getPendingWriteCount: () => mockGetPendingWriteCount(),
}));

// Must import after mocks
import { useSyncRetry } from './useSyncRetry';

describe('useSyncRetry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useSyncStatusStore.setState({
            pendingCount: 3,
            isRetrying: false,
            lastRetryError: null,
        });
        mockFlushPendingWrites.mockResolvedValue(undefined);
        mockGetPendingWriteCount.mockReturnValue(0);
    });

    it('retryAll calls flushPendingWrites', async () => {
        const { result } = renderHook(() => useSyncRetry());

        await act(async () => {
            await result.current.retryAll();
        });

        expect(mockFlushPendingWrites).toHaveBeenCalledOnce();
    });

    it('retryAll sets isRetrying true then false', async () => {
        const retryingStates: boolean[] = [];

        mockFlushPendingWrites.mockImplementation(async () => {
            retryingStates.push(useSyncStatusStore.getState().isRetrying);
        });

        const { result } = renderHook(() => useSyncRetry());

        await act(async () => {
            await result.current.retryAll();
        });

        // During flush, isRetrying should have been true
        expect(retryingStates).toContain(true);
        // After completion, isRetrying should be false
        expect(useSyncStatusStore.getState().isRetrying).toBe(false);
    });

    it('retryAll refreshes pendingCount after flush', async () => {
        mockGetPendingWriteCount.mockReturnValue(1);

        const { result } = renderHook(() => useSyncRetry());

        await act(async () => {
            await result.current.retryAll();
        });

        expect(useSyncStatusStore.getState().pendingCount).toBe(1);
        expect(mockGetPendingWriteCount).toHaveBeenCalled();
    });

    it('retryAll sets lastRetryError on failure', async () => {
        mockFlushPendingWrites.mockRejectedValue(new Error('Network down'));

        const { result } = renderHook(() => useSyncRetry());

        await act(async () => {
            await result.current.retryAll();
        });

        expect(useSyncStatusStore.getState().lastRetryError).toBe('Network down');
        expect(useSyncStatusStore.getState().isRetrying).toBe(false);
    });

    it('retryAll clears lastRetryError on start', async () => {
        useSyncStatusStore.setState({ lastRetryError: 'Previous error' });

        const { result } = renderHook(() => useSyncRetry());

        await act(async () => {
            await result.current.retryAll();
        });

        expect(useSyncStatusStore.getState().lastRetryError).toBe(null);
    });

    it('retryAll no-ops when already retrying', async () => {
        useSyncStatusStore.setState({ isRetrying: true });

        const { result } = renderHook(() => useSyncRetry());

        await act(async () => {
            await result.current.retryAll();
        });

        expect(mockFlushPendingWrites).not.toHaveBeenCalled();
    });
});
