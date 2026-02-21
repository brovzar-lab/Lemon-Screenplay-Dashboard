/**
 * Export Selection Store
 *
 * Tracks which screenplay cards are checked for selective export.
 * Uncapped — any number of cards can be selected.
 * Not persisted — clears on page refresh.
 */

import { create } from 'zustand';

interface ExportSelectionState {
    selectedIds: string[];

    /** Toggle a single card's selection */
    toggle: (id: string) => void;

    /** Select all specified IDs */
    selectAll: (ids: string[]) => void;

    /** Deselect all */
    deselectAll: () => void;

    /** Check if an ID is selected */
    isSelected: (id: string) => boolean;
}

export const useExportSelectionStore = create<ExportSelectionState>()((set, get) => ({
    selectedIds: [],

    toggle: (id) =>
        set((state) => {
            const index = state.selectedIds.indexOf(id);
            if (index !== -1) {
                return { selectedIds: state.selectedIds.filter((i) => i !== id) };
            }
            return { selectedIds: [...state.selectedIds, id] };
        }),

    selectAll: (ids) => set({ selectedIds: [...ids] }),

    deselectAll: () => set({ selectedIds: [] }),

    isSelected: (id) => get().selectedIds.includes(id),
}));

/**
 * Hook to check if a specific screenplay is selected for export
 */
export function useIsSelectedForExport(id: string): boolean {
    return useExportSelectionStore((state) => state.selectedIds.includes(id));
}

/**
 * Hook to get the count of selected items
 */
export function useExportSelectionCount(): number {
    return useExportSelectionStore((state) => state.selectedIds.length);
}
