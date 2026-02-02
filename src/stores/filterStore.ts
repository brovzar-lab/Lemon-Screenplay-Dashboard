/**
 * Filter State Store
 * Manages all filtering state using Zustand
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FilterState,
  RangeFilter,
  RecommendationTier,
  BudgetCategory,
  Collection,
} from '@/types';
import { DEFAULT_FILTER_STATE } from '@/types/filters';

interface FilterActions {
  // Search
  setSearchQuery: (query: string) => void;

  // Multi-select filters
  toggleRecommendationTier: (tier: RecommendationTier) => void;
  setRecommendationTiers: (tiers: RecommendationTier[]) => void;
  toggleBudgetCategory: (category: BudgetCategory) => void;
  setBudgetCategories: (categories: BudgetCategory[]) => void;
  toggleCollection: (collection: Collection) => void;
  setCollections: (collections: Collection[]) => void;
  toggleGenre: (genre: string) => void;
  setGenres: (genres: string[]) => void;
  toggleTheme: (theme: string) => void;
  setThemes: (themes: string[]) => void;

  // Range filters
  setWeightedScoreRange: (range: Partial<RangeFilter>) => void;
  setConceptRange: (range: Partial<RangeFilter>) => void;
  setStructureRange: (range: Partial<RangeFilter>) => void;
  setProtagonistRange: (range: Partial<RangeFilter>) => void;
  setSupportingCastRange: (range: Partial<RangeFilter>) => void;
  setDialogueRange: (range: Partial<RangeFilter>) => void;
  setGenreExecutionRange: (range: Partial<RangeFilter>) => void;
  setOriginalityRange: (range: Partial<RangeFilter>) => void;
  setCvsRange: (range: Partial<RangeFilter>) => void;
  setMarketPotentialRange: (range: Partial<RangeFilter>) => void;
  setStarVehiclePotentialRange: (range: Partial<RangeFilter>) => void;
  setFestivalAppealRange: (range: Partial<RangeFilter>) => void;
  setRoiIndicatorRange: (range: Partial<RangeFilter>) => void;

  // Flags
  setShowFilmNowOnly: (show: boolean) => void;
  setHidePassRated: (hide: boolean) => void;
  setHasCriticalFailures: (value: boolean | null) => void;

  // Bulk operations
  resetFilters: () => void;
  applyFilters: (filters: Partial<FilterState>) => void;
}

type FilterStore = FilterState & FilterActions;

// Helper to update a range filter
const updateRange = (
  current: RangeFilter,
  update: Partial<RangeFilter>
): RangeFilter => ({
  ...current,
  ...update,
});

// Helper to toggle item in array
const toggleItem = <T>(array: T[], item: T): T[] => {
  const index = array.indexOf(item);
  if (index === -1) {
    return [...array, item];
  }
  return array.filter((_, i) => i !== index);
};

export const useFilterStore = create<FilterStore>()(
  persist(
    (set) => ({
      // Initial state
      ...DEFAULT_FILTER_STATE,

      // Search
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Recommendation tiers
      toggleRecommendationTier: (tier) =>
        set((state) => ({
          recommendationTiers: toggleItem(state.recommendationTiers, tier),
        })),
      setRecommendationTiers: (tiers) => set({ recommendationTiers: tiers }),

      // Budget categories
      toggleBudgetCategory: (category) =>
        set((state) => ({
          budgetCategories: toggleItem(state.budgetCategories, category),
        })),
      setBudgetCategories: (categories) => set({ budgetCategories: categories }),

      // Collections
      toggleCollection: (collection) =>
        set((state) => ({
          collections: toggleItem(state.collections, collection),
        })),
      setCollections: (collections) => set({ collections }),

      // Genres
      toggleGenre: (genre) =>
        set((state) => ({
          genres: toggleItem(state.genres, genre),
        })),
      setGenres: (genres) => set({ genres }),

      // Themes
      toggleTheme: (theme) =>
        set((state) => ({
          themes: toggleItem(state.themes, theme),
        })),
      setThemes: (themes) => set({ themes }),

      // Range filters
      setWeightedScoreRange: (range) =>
        set((state) => ({
          weightedScoreRange: updateRange(state.weightedScoreRange, range),
        })),
      setConceptRange: (range) =>
        set((state) => ({
          conceptRange: updateRange(state.conceptRange, range),
        })),
      setStructureRange: (range) =>
        set((state) => ({
          structureRange: updateRange(state.structureRange, range),
        })),
      setProtagonistRange: (range) =>
        set((state) => ({
          protagonistRange: updateRange(state.protagonistRange, range),
        })),
      setSupportingCastRange: (range) =>
        set((state) => ({
          supportingCastRange: updateRange(state.supportingCastRange, range),
        })),
      setDialogueRange: (range) =>
        set((state) => ({
          dialogueRange: updateRange(state.dialogueRange, range),
        })),
      setGenreExecutionRange: (range) =>
        set((state) => ({
          genreExecutionRange: updateRange(state.genreExecutionRange, range),
        })),
      setOriginalityRange: (range) =>
        set((state) => ({
          originalityRange: updateRange(state.originalityRange, range),
        })),
      setCvsRange: (range) =>
        set((state) => ({
          cvsRange: updateRange(state.cvsRange, range),
        })),
      setMarketPotentialRange: (range) =>
        set((state) => ({
          marketPotentialRange: updateRange(state.marketPotentialRange, range),
        })),
      setStarVehiclePotentialRange: (range) =>
        set((state) => ({
          starVehiclePotentialRange: updateRange(state.starVehiclePotentialRange, range),
        })),
      setFestivalAppealRange: (range) =>
        set((state) => ({
          festivalAppealRange: updateRange(state.festivalAppealRange, range),
        })),
      setRoiIndicatorRange: (range) =>
        set((state) => ({
          roiIndicatorRange: updateRange(state.roiIndicatorRange, range),
        })),

      // Flags
      setShowFilmNowOnly: (show) => set({ showFilmNowOnly: show }),
      setHidePassRated: (hide) => set({ hidePassRated: hide }),
      setHasCriticalFailures: (value) => set({ hasCriticalFailures: value }),

      // Bulk operations
      resetFilters: () => set(DEFAULT_FILTER_STATE),
      applyFilters: (filters) => set(filters),
    }),
    {
      name: 'lemon-filters',
      partialize: (state) => ({
        // Only persist certain fields
        recommendationTiers: state.recommendationTiers,
        budgetCategories: state.budgetCategories,
        collections: state.collections,
        showFilmNowOnly: state.showFilmNowOnly,
        hidePassRated: state.hidePassRated,
      }),
    }
  )
);
