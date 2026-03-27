/**
 * Selection Store
 * Manages bulk selection state for multi-select operations (export, compare, collect, favorite).
 * Set-based with O(1) lookups. Ephemeral -- not persisted across page refreshes.
 */

import { create } from 'zustand';

interface SelectionState {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedIds: new Set<string>(),

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
    set(() => ({ selectedIds: new Set(ids) })),

  deselectAll: () =>
    set(() => ({ selectedIds: new Set<string>() })),
}));

/** Derived hook: is a specific screenplay selected? */
export function useIsSelected(id: string): boolean {
  return useSelectionStore((s) => s.selectedIds.has(id));
}

/** Derived hook: count of selected items */
export function useSelectionCount(): number {
  return useSelectionStore((s) => s.selectedIds.size);
}

/** Derived hook: are any items selected? (controls BulkActionBar visibility) */
export function useHasSelection(): boolean {
  return useSelectionStore((s) => s.selectedIds.size > 0);
}
