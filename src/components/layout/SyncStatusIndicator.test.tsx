/**
 * SyncStatusIndicator.test.tsx
 *
 * Tests for the sync status indicator component that shows
 * pending Firestore write count and retry controls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock stores and hooks
const mockRetryAll = vi.fn(() => Promise.resolve());
const mockStartSyncStatusPolling = vi.fn(() => vi.fn());

let mockStoreState = {
    pendingCount: 0,
    isRetrying: false,
    lastRetryError: null as string | null,
};

vi.mock('@/stores/syncStatusStore', () => ({
    useSyncStatusStore: (selector: (state: typeof mockStoreState) => unknown) =>
        selector(mockStoreState),
    startSyncStatusPolling: () => mockStartSyncStatusPolling(),
}));

vi.mock('@/hooks/useSyncRetry', () => ({
    useSyncRetry: () => ({ retryAll: mockRetryAll }),
}));

import { SyncStatusIndicator } from './SyncStatusIndicator';

describe('SyncStatusIndicator', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState = {
            pendingCount: 0,
            isRetrying: false,
            lastRetryError: null,
        };
    });

    it('renders nothing when pendingCount=0, isRetrying=false, lastRetryError=null', () => {
        const { container } = render(<SyncStatusIndicator />);
        expect(container.firstChild).toBeNull();
    });

    it('renders pending count when pendingCount > 0', () => {
        mockStoreState.pendingCount = 3;
        render(<SyncStatusIndicator />);
        expect(screen.getByText('3 pending')).toBeDefined();
    });

    it('renders Retry Now button when pendingCount > 0 and not retrying', () => {
        mockStoreState.pendingCount = 2;
        render(<SyncStatusIndicator />);
        expect(screen.getByRole('button', { name: /retry now/i })).toBeDefined();
    });

    it('Retry Now button calls retryAll on click', () => {
        mockStoreState.pendingCount = 1;
        render(<SyncStatusIndicator />);
        fireEvent.click(screen.getByRole('button', { name: /retry now/i }));
        expect(mockRetryAll).toHaveBeenCalledOnce();
    });

    it('renders "Syncing..." when isRetrying=true', () => {
        mockStoreState.pendingCount = 1;
        mockStoreState.isRetrying = true;
        render(<SyncStatusIndicator />);
        expect(screen.getByText('Syncing...')).toBeDefined();
    });

    it('hides Retry Now button when isRetrying=true', () => {
        mockStoreState.pendingCount = 1;
        mockStoreState.isRetrying = true;
        render(<SyncStatusIndicator />);
        expect(screen.queryByRole('button', { name: /retry now/i })).toBeNull();
    });

    it('renders error message when lastRetryError is set', () => {
        mockStoreState.pendingCount = 1;
        mockStoreState.lastRetryError = 'Network error';
        render(<SyncStatusIndicator />);
        expect(screen.getByText('Network error')).toBeDefined();
    });

    it('calls startSyncStatusPolling on mount', () => {
        mockStoreState.pendingCount = 1;
        render(<SyncStatusIndicator />);
        expect(mockStartSyncStatusPolling).toHaveBeenCalledOnce();
    });

    it('calls cleanup function on unmount', () => {
        const mockCleanup = vi.fn();
        mockStartSyncStatusPolling.mockReturnValue(mockCleanup);
        mockStoreState.pendingCount = 1;

        const { unmount } = render(<SyncStatusIndicator />);
        unmount();
        expect(mockCleanup).toHaveBeenCalledOnce();
    });
});
