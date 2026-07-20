/**
 * Sync Status Store
 *
 * Tracks the state of pending Firestore writes for UI visibility.
 * Ephemeral session state — no persistence middleware.
 */

import { create } from 'zustand';
import { flushPendingWrites, getPendingWriteCount } from '@/lib/analysisStore';

const STATUS_POLL_INTERVAL_MS = 2000;
const AUTO_RETRY_INTERVAL_MS = 30_000;

interface SyncStatusState {
    /** Number of items queued for Firestore retry */
    pendingCount: number;
    /** Whether a retry flush is currently in progress */
    isRetrying: boolean;
    /** Last error message from a retry attempt, or null */
    lastRetryError: string | null;
    /** Whether the authoritative Firestore listener is connected */
    isLiveConnected: boolean;
    /** Update the pending write count */
    setPendingCount: (count: number) => void;
    /** Set whether a retry is in progress */
    setRetrying: (retrying: boolean) => void;
    /** Set the last retry error message */
    setLastRetryError: (error: string | null) => void;
    setLiveConnected: (connected: boolean) => void;
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
    pendingCount: 0,
    isRetrying: false,
    lastRetryError: null,
    isLiveConnected: true,
    setPendingCount: (count) => set({ pendingCount: count }),
    setRetrying: (retrying) => set({ isRetrying: retrying }),
    setLastRetryError: (error) => set({ lastRetryError: error }),
    setLiveConnected: (connected) => set({ isLiveConnected: connected }),
}));

/**
 * Start polling localStorage for pending write count.
 * Reads immediately, then every 2 seconds.
 * Returns a cleanup function that stops the interval.
 */
export function startSyncStatusPolling(): () => void {
    const refreshCount = () => {
        useSyncStatusStore.getState().setPendingCount(getPendingWriteCount());
    };

    const retryPending = async () => {
        const state = useSyncStatusStore.getState();
        const isOnline = typeof navigator === 'undefined' || navigator.onLine;
        if (state.isRetrying || !isOnline || getPendingWriteCount() === 0) return;

        state.setRetrying(true);
        state.setLastRetryError(null);
        try {
            await flushPendingWrites();
            refreshCount();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Automatic retry failed';
            useSyncStatusStore.getState().setLastRetryError(message);
        } finally {
            useSyncStatusStore.getState().setRetrying(false);
        }
    };

    // Read immediately
    refreshCount();

    // Poll every 2 seconds
    const statusIntervalId = setInterval(refreshCount, STATUS_POLL_INTERVAL_MS);
    const retryIntervalId = setInterval(() => void retryPending(), AUTO_RETRY_INTERVAL_MS);
    window.addEventListener('online', retryPending);

    return () => {
        clearInterval(statusIntervalId);
        clearInterval(retryIntervalId);
        window.removeEventListener('online', retryPending);
    };
}
