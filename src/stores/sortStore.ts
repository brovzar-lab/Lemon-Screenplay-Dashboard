/**
 * Sort State Store
 * Manages multi-column sorting using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SortState, SortConfig, SortField, SortDirection } from '@/types';
import { DEFAULT_SORT_STATE } from '@/types/filters';

interface SortActions {
  // Add/update sort column
  addSortColumn: (field: SortField, direction?: SortDirection) => void;

  // Remove sort column
  removeSortColumn: (field: SortField) => void;

  // Toggle sort direction for existing column
  toggleSortDirection: (field: SortField) => void;

  // Reorder sort columns (for drag-drop)
  reorderSortColumns: (fromIndex: number, toIndex: number) => void;

  // Set complete sort configuration
  setSortConfigs: (configs: SortConfig[]) => void;

  // Toggle Film Now priority
  setPrioritizeFilmNow: (prioritize: boolean) => void;

  // Reset to defaults
  resetSort: () => void;

  // Clear all sorting
  clearSort: () => void;
}

type SortStore = SortState & SortActions;

export const useSortStore = create<SortStore>()(
  persist(
    (set) => ({
      // Initial state
      ...DEFAULT_SORT_STATE,

      // Add or update a sort column
      addSortColumn: (field, direction = 'desc') =>
        set((state) => {
          // Check if column already exists
          const existingIndex = state.sortConfigs.findIndex(
            (c) => c.field === field
          );

          if (existingIndex !== -1) {
            // Update existing - move to first position
            const existing = state.sortConfigs[existingIndex];
            const newConfigs = state.sortConfigs.filter(
              (_, i) => i !== existingIndex
            );
            return {
              sortConfigs: [{ ...existing, direction }, ...newConfigs],
            };
          }

          // Add new column at the beginning (highest priority)
          // Limit to 5 sort columns max
          const newConfigs = [
            { field, direction },
            ...state.sortConfigs.slice(0, 4),
          ];

          return { sortConfigs: newConfigs };
        }),

      // Remove a sort column
      removeSortColumn: (field) =>
        set((state) => ({
          sortConfigs: state.sortConfigs.filter((c) => c.field !== field),
        })),

      // Toggle direction for existing column
      toggleSortDirection: (field) =>
        set((state) => ({
          sortConfigs: state.sortConfigs.map((c) =>
            c.field === field
              ? { ...c, direction: c.direction === 'asc' ? 'desc' : 'asc' }
              : c
          ),
        })),

      // Reorder columns (drag-drop)
      reorderSortColumns: (fromIndex, toIndex) =>
        set((state) => {
          const configs = [...state.sortConfigs];
          const [removed] = configs.splice(fromIndex, 1);
          configs.splice(toIndex, 0, removed);
          return { sortConfigs: configs };
        }),

      // Set complete configuration
      setSortConfigs: (configs) => set({ sortConfigs: configs }),

      // Toggle Film Now priority
      setPrioritizeFilmNow: (prioritize) =>
        set({ prioritizeFilmNow: prioritize }),

      // Reset to defaults
      resetSort: () => set(DEFAULT_SORT_STATE),

      // Clear all sorting
      clearSort: () => set({ sortConfigs: [] }),
    }),
    {
      name: 'lemon-sort',
    }
  )
);
