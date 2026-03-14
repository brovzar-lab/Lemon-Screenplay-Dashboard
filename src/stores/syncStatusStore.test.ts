/**
 * syncStatusStore.test.ts
 *
 * Tests for the sync status Zustand store that tracks pending
 * Firestore writes and retry state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock analysisStore's getPendingWriteCount
const mockGetPendingWriteCount = vi.fn(() => 0);
vi.mock('@/lib/analysisStore', () => ({
    getPendingWriteCount: () => mockGetPendingWriteCount(),
}));

import { useSyncStatusStore, startSyncStatusPolling } from './syncStatusStore';

describe('syncStatusStore', () => {
    beforeEach(() => {
        // Reset store state between tests
        useSyncStatusStore.setState({
            pendingCount: 0,
            isRetrying: false,
            lastRetryError: null,
        });
        mockGetPendingWriteCount.mockReturnValue(0);
    });

    describe('initial state', () => {
        it('pendingCount initializes to 0', () => {
            expect(useSyncStatusStore.getState().pendingCount).toBe(0);
        });

        it('isRetrying initializes to false', () => {
            expect(useSyncStatusStore.getState().isRetrying).toBe(false);
        });

        it('lastRetryError initializes to null', () => {
            expect(useSyncStatusStore.getState().lastRetryError).toBe(null);
        });
    });

    describe('actions', () => {
        it('setPendingCount updates pendingCount', () => {
            useSyncStatusStore.getState().setPendingCount(5);
            expect(useSyncStatusStore.getState().pendingCount).toBe(5);
        });

        it('setRetrying updates isRetrying', () => {
            useSyncStatusStore.getState().setRetrying(true);
            expect(useSyncStatusStore.getState().isRetrying).toBe(true);
        });

        it('setLastRetryError updates lastRetryError', () => {
            useSyncStatusStore.getState().setLastRetryError('Network error');
            expect(useSyncStatusStore.getState().lastRetryError).toBe('Network error');
        });
    });

    describe('startSyncStatusPolling', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('reads pending count immediately and sets pendingCount', () => {
            mockGetPendingWriteCount.mockReturnValue(3);
            const cleanup = startSyncStatusPolling();

            expect(useSyncStatusStore.getState().pendingCount).toBe(3);
            cleanup();
        });

        it('polls and updates pendingCount on interval', () => {
            mockGetPendingWriteCount.mockReturnValue(0);
            const cleanup = startSyncStatusPolling();

            expect(useSyncStatusStore.getState().pendingCount).toBe(0);

            // Simulate queue growing
            mockGetPendingWriteCount.mockReturnValue(2);
            vi.advanceTimersByTime(2000);
            expect(useSyncStatusStore.getState().pendingCount).toBe(2);

            // Simulate queue draining
            mockGetPendingWriteCount.mockReturnValue(0);
            vi.advanceTimersByTime(2000);
            expect(useSyncStatusStore.getState().pendingCount).toBe(0);

            cleanup();
        });

        it('returns a cleanup function that stops polling', () => {
            mockGetPendingWriteCount.mockReturnValue(1);
            const cleanup = startSyncStatusPolling();

            expect(useSyncStatusStore.getState().pendingCount).toBe(1);

            // Stop polling
            cleanup();

            // Update mock — should NOT reflect in store since polling stopped
            mockGetPendingWriteCount.mockReturnValue(5);
            vi.advanceTimersByTime(4000);
            expect(useSyncStatusStore.getState().pendingCount).toBe(1);
        });

        it('handles corrupt localStorage gracefully (sets count to 0)', () => {
            // When getPendingWriteCount handles corrupt data, it returns 0
            mockGetPendingWriteCount.mockReturnValue(0);
            const cleanup = startSyncStatusPolling();

            expect(useSyncStatusStore.getState().pendingCount).toBe(0);
            cleanup();
        });
    });
});
