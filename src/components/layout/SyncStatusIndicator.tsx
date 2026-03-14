/**
 * SyncStatusIndicator
 *
 * Header badge showing pending Firestore write count with manual retry.
 * Renders nothing when fully synced (no visual noise).
 * Matches the premium amber warning theme from the design system.
 */

import { useEffect } from 'react';
import { useSyncStatusStore, startSyncStatusPolling } from '@/stores/syncStatusStore';
import { useSyncRetry } from '@/hooks/useSyncRetry';

export function SyncStatusIndicator() {
    const pendingCount = useSyncStatusStore((s) => s.pendingCount);
    const isRetrying = useSyncStatusStore((s) => s.isRetrying);
    const lastRetryError = useSyncStatusStore((s) => s.lastRetryError);
    const { retryAll } = useSyncRetry();

    // Start polling on mount, clean up on unmount
    useEffect(() => {
        const cleanup = startSyncStatusPolling();
        return cleanup;
    }, []);

    // Invisible when fully synced
    if (pendingCount === 0 && !isRetrying && !lastRetryError) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            {/* Sync icon */}
            <svg
                className={`w-4 h-4 text-amber-400 ${isRetrying ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
            </svg>

            {/* Status text */}
            <span className="text-sm text-amber-400">
                {isRetrying ? 'Syncing...' : `${pendingCount} pending`}
            </span>

            {/* Retry button */}
            {!isRetrying && pendingCount > 0 && (
                <button
                    onClick={retryAll}
                    className="text-xs px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors"
                    aria-label="Retry Now"
                >
                    Retry Now
                </button>
            )}

            {/* Error message */}
            {lastRetryError && (
                <span className="text-xs text-red-400">
                    {lastRetryError}
                </span>
            )}
        </div>
    );
}
