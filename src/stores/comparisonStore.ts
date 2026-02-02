/**
 * Comparison State Store
 * Manages screenplay comparison selection
 */

import { create } from 'zustand';
import type { ComparisonState } from '@/types';
import { DEFAULT_COMPARISON_STATE } from '@/types/filters';

const MAX_COMPARISON_ITEMS = 3;

interface ComparisonActions {
  // Toggle screenplay selection for comparison
  toggleComparison: (id: string) => void;

  // Add to comparison (if not full)
  addToComparison: (id: string) => void;

  // Remove from comparison
  removeFromComparison: (id: string) => void;

  // Clear all selections
  clearComparison: () => void;

  // Toggle comparison mode
  setIsComparing: (comparing: boolean) => void;

  // Set view mode
  setViewMode: (mode: 'side-by-side' | 'radar') => void;

  // Open comparison with specific items
  openComparison: (ids: string[]) => void;

  // Close comparison
  closeComparison: () => void;
}

type ComparisonStore = ComparisonState & ComparisonActions;

export const useComparisonStore = create<ComparisonStore>()((set) => ({
  // Initial state
  ...DEFAULT_COMPARISON_STATE,

  // Toggle selection
  toggleComparison: (id) =>
    set((state) => {
      const index = state.selectedIds.indexOf(id);

      if (index !== -1) {
        // Remove if already selected
        return {
          selectedIds: state.selectedIds.filter((i) => i !== id),
        };
      }

      // Add if not at max
      if (state.selectedIds.length < MAX_COMPARISON_ITEMS) {
        return {
          selectedIds: [...state.selectedIds, id],
        };
      }

      // At max, don't add
      return state;
    }),

  // Add to comparison
  addToComparison: (id) =>
    set((state) => {
      if (state.selectedIds.includes(id)) return state;
      if (state.selectedIds.length >= MAX_COMPARISON_ITEMS) return state;

      return {
        selectedIds: [...state.selectedIds, id],
      };
    }),

  // Remove from comparison
  removeFromComparison: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.filter((i) => i !== id),
    })),

  // Clear all
  clearComparison: () =>
    set({
      selectedIds: [],
      isComparing: false,
    }),

  // Toggle comparison mode
  setIsComparing: (comparing) => set({ isComparing: comparing }),

  // Set view mode
  setViewMode: (mode) => set({ viewMode: mode }),

  // Open comparison with specific items
  openComparison: (ids) =>
    set({
      selectedIds: ids.slice(0, MAX_COMPARISON_ITEMS),
      isComparing: true,
    }),

  // Close comparison
  closeComparison: () => set({ isComparing: false }),
}));

/**
 * Helper to check if screenplay is selected for comparison
 */
export function useIsSelectedForComparison(id: string): boolean {
  return useComparisonStore((state) => state.selectedIds.includes(id));
}

/**
 * Helper to check if comparison is full
 */
export function useIsComparisonFull(): boolean {
  return useComparisonStore(
    (state) => state.selectedIds.length >= MAX_COMPARISON_ITEMS
  );
}
