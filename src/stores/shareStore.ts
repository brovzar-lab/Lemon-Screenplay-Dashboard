/**
 * Share Store
 *
 * Ephemeral Zustand store caching active share tokens per session.
 * Tokens are keyed by screenplayId for quick lookups.
 * No persistence middleware — session-only data.
 */

import { create } from 'zustand';
import type { SharedView } from '@/lib/shareService';

interface ShareState {
    /** Active share tokens keyed by screenplayId */
    tokens: Record<string, SharedView>;
    /** Cache a share token for a screenplay */
    setToken: (screenplayId: string, view: SharedView) => void;
    /** Remove a cached share token */
    removeToken: (screenplayId: string) => void;
    /** Clear all cached tokens */
    clearAll: () => void;
}

export const useShareStore = create<ShareState>((set) => ({
    tokens: {},

    setToken: (screenplayId, view) =>
        set((state) => ({
            tokens: { ...state.tokens, [screenplayId]: view },
        })),

    removeToken: (screenplayId) =>
        set((state) => {
            const { [screenplayId]: _, ...rest } = state.tokens;
            return { tokens: rest };
        }),

    clearAll: () => set({ tokens: {} }),
}));
