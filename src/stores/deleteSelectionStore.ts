/**
 * Delete Selection Store
 * Manages bulk delete selection state (ephemeral, not persisted)
 */

import { create } from 'zustand';

interface DeleteSelectionState {
    selectedIds: Set<string>;
    isDeleteMode: boolean;

    // Actions
    toggle: (id: string) => void;
    selectAll: (ids: string[]) => void;
    deselectAll: () => void;
    setDeleteMode: (on: boolean) => void;
}

export const useDeleteSelectionStore = create<DeleteSelectionState>()((set) => ({
    selectedIds: new Set<string>(),
    isDeleteMode: false,

    toggle: (id) =>
        set((state) => {
            const next = new Set(state.selectedIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { selectedIds: next };
        }),

    selectAll: (ids) =>
        set(() => ({
            selectedIds: new Set(ids),
        })),

    deselectAll: () =>
        set(() => ({
            selectedIds: new Set<string>(),
        })),

    setDeleteMode: (on) =>
        set(() => ({
            isDeleteMode: on,
            // Clear selection when exiting delete mode
            ...(!on ? { selectedIds: new Set<string>() } : {}),
        })),
}));

/** Derived hook: is a specific screenplay selected for deletion? */
export function useIsSelectedForDelete(id: string): boolean {
    return useDeleteSelectionStore((s) => s.selectedIds.has(id));
}
