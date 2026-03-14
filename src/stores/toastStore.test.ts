/**
 * toastStore.test.ts
 *
 * Tests for the toast notification Zustand store.
 * Ephemeral state — no persistence middleware.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToastStore, MAX_VISIBLE } from './toastStore';

describe('toastStore', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Reset store state between tests
        useToastStore.setState({ toasts: [] });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('addToast', () => {
        it('creates a toast with default severity "error"', () => {
            useToastStore.getState().addToast('Something went wrong');
            const toasts = useToastStore.getState().toasts;

            expect(toasts).toHaveLength(1);
            expect(toasts[0].message).toBe('Something went wrong');
            expect(toasts[0].severity).toBe('error');
            expect(toasts[0].id).toBeDefined();
            expect(toasts[0].createdAt).toBeDefined();
        });

        it('creates a toast with specified severity "warning"', () => {
            useToastStore.getState().addToast('Be careful', 'warning');
            const toasts = useToastStore.getState().toasts;

            expect(toasts).toHaveLength(1);
            expect(toasts[0].severity).toBe('warning');
        });

        it('caps the toast array at 10 entries (keeps newest)', () => {
            for (let i = 0; i < 12; i++) {
                useToastStore.getState().addToast(`Toast ${i}`);
            }

            const toasts = useToastStore.getState().toasts;
            expect(toasts).toHaveLength(10);
            // Newest should be last
            expect(toasts[toasts.length - 1].message).toBe('Toast 11');
            // Oldest two should have been dropped
            expect(toasts[0].message).toBe('Toast 2');
        });

        it('auto-dismisses after ~5 seconds', () => {
            useToastStore.getState().addToast('Will disappear');
            expect(useToastStore.getState().toasts).toHaveLength(1);

            vi.advanceTimersByTime(5000);
            expect(useToastStore.getState().toasts).toHaveLength(0);
        });

        it('generates unique ids for each toast', () => {
            useToastStore.getState().addToast('First');
            useToastStore.getState().addToast('Second');
            const toasts = useToastStore.getState().toasts;

            expect(toasts[0].id).not.toBe(toasts[1].id);
        });
    });

    describe('removeToast', () => {
        it('removes a toast by id', () => {
            useToastStore.getState().addToast('Remove me');
            const id = useToastStore.getState().toasts[0].id;

            useToastStore.getState().removeToast(id);
            expect(useToastStore.getState().toasts).toHaveLength(0);
        });

        it('is idempotent — no error when removing non-existent id', () => {
            useToastStore.getState().addToast('Keep me');
            expect(() => {
                useToastStore.getState().removeToast('non-existent-id');
            }).not.toThrow();
            expect(useToastStore.getState().toasts).toHaveLength(1);
        });
    });

    describe('clearToasts', () => {
        it('removes all toasts', () => {
            useToastStore.getState().addToast('One');
            useToastStore.getState().addToast('Two');
            useToastStore.getState().addToast('Three');
            expect(useToastStore.getState().toasts).toHaveLength(3);

            useToastStore.getState().clearToasts();
            expect(useToastStore.getState().toasts).toHaveLength(0);
        });
    });

    describe('MAX_VISIBLE constant', () => {
        it('exports MAX_VISIBLE as 3', () => {
            expect(MAX_VISIBLE).toBe(3);
        });
    });
});
