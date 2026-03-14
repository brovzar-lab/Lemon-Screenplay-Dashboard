/**
 * useSyncRetry Hook
 *
 * Wraps the retry logic for flushing pending Firestore writes.
 * Manages isRetrying/lastRetryError state in syncStatusStore.
 * Prevents concurrent retries via guard check.
 */

import { useCallback } from 'react';
import { useSyncStatusStore } from '@/stores/syncStatusStore';
import { flushPendingWrites, getPendingWriteCount } from '@/lib/analysisStore';

interface UseSyncRetryReturn {
    /** Flush all pending Firestore writes. No-ops if already retrying. */
    retryAll: () => Promise<void>;
}

export function useSyncRetry(): UseSyncRetryReturn {
    const retryAll = useCallback(async () => {
        const { isRetrying, setRetrying, setLastRetryError, setPendingCount } =
            useSyncStatusStore.getState();

        // Guard: prevent concurrent retries
        if (isRetrying) return;

        setRetrying(true);
        setLastRetryError(null);

        try {
            await flushPendingWrites();
            // Immediately refresh count after flush
            setPendingCount(getPendingWriteCount());
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setLastRetryError(message);
        } finally {
            setRetrying(false);
        }
    }, []);

    return { retryAll };
}
