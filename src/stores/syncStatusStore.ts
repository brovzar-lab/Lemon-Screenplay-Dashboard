/**
 * Sync Status Store
 *
 * Tracks the state of pending Firestore writes for UI visibility.
 * Ephemeral session state — no persistence middleware.
 */

import { create } from 'zustand';
import { getPendingWriteCount } from '@/lib/analysisStore';

interface SyncStatusState {
    /** Number of items queued for Firestore retry */
    pendingCount: number;
    /** Whether a retry flush is currently in progress */
    isRetrying: boolean;
    /** Last error message from a retry attempt, or null */
    lastRetryError: string | null;
    /** Update the pending write count */
    setPendingCount: (count: number) => void;
    /** Set whether a retry is in progress */
    setRetrying: (retrying: boolean) => void;
    /** Set the last retry error message */
    setLastRetryError: (error: string | null) => void;
}

export const useSyncStatusStore = create<SyncStatusState>((set) => ({
    pendingCount: 0,
    isRetrying: false,
    lastRetryError: null,
    setPendingCount: (count) => set({ pendingCount: count }),
    setRetrying: (retrying) => set({ isRetrying: retrying }),
    setLastRetryError: (error) => set({ lastRetryError: error }),
}));

/**
 * Start polling localStorage for pending write count.
 * Reads immediately, then every 2 seconds.
 * Returns a cleanup function that stops the interval.
 */
export function startSyncStatusPolling(): () => void {
    const { setPendingCount } = useSyncStatusStore.getState();

    // Read immediately
    setPendingCount(getPendingWriteCount());

    // Poll every 2 seconds
    const intervalId = setInterval(() => {
        useSyncStatusStore.getState().setPendingCount(getPendingWriteCount());
    }, 2000);

    return () => {
        clearInterval(intervalId);
    };
}
