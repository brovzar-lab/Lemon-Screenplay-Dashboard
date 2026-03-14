/**
 * Toast Notification Store
 *
 * Ephemeral state for toast notifications — no persistence middleware.
 * Follows the same pattern as syncStatusStore.
 */

import { create } from 'zustand';

export type ToastSeverity = 'error' | 'warning';

export interface Toast {
    id: string;
    message: string;
    severity: ToastSeverity;
    createdAt: number;
}

interface ToastStore {
    toasts: Toast[];
    addToast: (message: string, severity?: ToastSeverity) => void;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

/** Maximum toasts visible in the UI at once */
export const MAX_VISIBLE = 3;

/** Maximum toasts stored (prevents memory leak from rapid errors) */
const MAX_STORED = 10;

/** Auto-dismiss delay in milliseconds */
const AUTO_DISMISS_MS = 5000;

export const useToastStore = create<ToastStore>((set) => ({
    toasts: [],

    addToast: (message, severity = 'error') => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const toast: Toast = {
            id,
            message,
            severity,
            createdAt: Date.now(),
        };

        set((state) => {
            const updated = [...state.toasts, toast];
            // Cap at MAX_STORED, keeping newest
            return { toasts: updated.slice(-MAX_STORED) };
        });

        // Schedule auto-dismiss
        setTimeout(() => {
            useToastStore.getState().removeToast(id);
        }, AUTO_DISMISS_MS);
    },

    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
    },

    clearToasts: () => {
        set({ toasts: [] });
    },
}));
