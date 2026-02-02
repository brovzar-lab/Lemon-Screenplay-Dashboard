/**
 * URL State Hook
 * Syncs filter state with URL query parameters for shareable views
 */

import { useEffect, useRef } from 'react';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';
import type { RecommendationTier, BudgetCategory, Collection, SortDirection } from '@/types';

// URL parameter keys
const PARAM_KEYS = {
  search: 'q',
  tiers: 'tier',
  budgets: 'budget',
  collections: 'collection',
  genres: 'genre',
  themes: 'theme',
  minScore: 'minScore',
  maxScore: 'maxScore',
  filmNowOnly: 'filmNow',
  hidePass: 'hidePass',
  sort: 'sort',
  sortDir: 'dir',
} as const;

/**
 * Parse URL parameters on initial load
 */
function parseUrlParams(): Partial<{
  searchQuery: string;
  recommendationTiers: RecommendationTier[];
  budgetCategories: BudgetCategory[];
  collections: Collection[];
  genres: string[];
  themes: string[];
  weightedScoreRange: { min: number; max: number; enabled: boolean };
  showFilmNowOnly: boolean;
  hidePassRated: boolean;
  sortField: string;
  sortDirection: SortDirection;
}> {
  const params = new URLSearchParams(window.location.search);
  const result: ReturnType<typeof parseUrlParams> = {};

  // Search query
  const search = params.get(PARAM_KEYS.search);
  if (search) result.searchQuery = search;

  // Recommendation tiers
  const tiers = params.getAll(PARAM_KEYS.tiers);
  if (tiers.length > 0) {
    result.recommendationTiers = tiers.filter((t): t is RecommendationTier =>
      ['film_now', 'recommend', 'consider', 'pass'].includes(t)
    );
  }

  // Budget categories
  const budgets = params.getAll(PARAM_KEYS.budgets);
  if (budgets.length > 0) {
    result.budgetCategories = budgets.filter((b): b is BudgetCategory =>
      ['micro', 'low', 'medium', 'high'].includes(b)
    );
  }

  // Collections
  const collections = params.getAll(PARAM_KEYS.collections);
  if (collections.length > 0) {
    result.collections = collections.filter((c): c is Collection =>
      ['2005 Black List', '2006 Black List', '2007 Black List', '2020 Black List', 'Randoms'].includes(c)
    );
  }

  // Genres
  const genres = params.getAll(PARAM_KEYS.genres);
  if (genres.length > 0) result.genres = genres;

  // Themes
  const themes = params.getAll(PARAM_KEYS.themes);
  if (themes.length > 0) result.themes = themes;

  // Score range
  const minScore = params.get(PARAM_KEYS.minScore);
  const maxScore = params.get(PARAM_KEYS.maxScore);
  if (minScore || maxScore) {
    result.weightedScoreRange = {
      min: minScore ? parseFloat(minScore) : 0,
      max: maxScore ? parseFloat(maxScore) : 10,
      enabled: true,
    };
  }

  // Boolean flags
  if (params.get(PARAM_KEYS.filmNowOnly) === 'true') result.showFilmNowOnly = true;
  if (params.get(PARAM_KEYS.hidePass) === 'true') result.hidePassRated = true;

  // Sort
  const sortField = params.get(PARAM_KEYS.sort);
  const sortDir = params.get(PARAM_KEYS.sortDir);
  if (sortField) {
    result.sortField = sortField;
    result.sortDirection = sortDir === 'asc' ? 'asc' : 'desc';
  }

  return result;
}

/**
 * Build URL from current filter state
 */
export function buildShareableUrl(): string {
  const filterState = useFilterStore.getState();
  const sortState = useSortStore.getState();
  const params = new URLSearchParams();

  // Search query
  if (filterState.searchQuery) {
    params.set(PARAM_KEYS.search, filterState.searchQuery);
  }

  // Recommendation tiers
  filterState.recommendationTiers.forEach((tier) => {
    params.append(PARAM_KEYS.tiers, tier);
  });

  // Budget categories
  filterState.budgetCategories.forEach((budget) => {
    params.append(PARAM_KEYS.budgets, budget);
  });

  // Collections
  filterState.collections.forEach((collection) => {
    params.append(PARAM_KEYS.collections, collection);
  });

  // Genres
  filterState.genres.forEach((genre) => {
    params.append(PARAM_KEYS.genres, genre);
  });

  // Themes
  filterState.themes.forEach((theme) => {
    params.append(PARAM_KEYS.themes, theme);
  });

  // Score range
  if (filterState.weightedScoreRange.enabled) {
    if (filterState.weightedScoreRange.min > 0) {
      params.set(PARAM_KEYS.minScore, filterState.weightedScoreRange.min.toString());
    }
    if (filterState.weightedScoreRange.max < 10) {
      params.set(PARAM_KEYS.maxScore, filterState.weightedScoreRange.max.toString());
    }
  }

  // Boolean flags
  if (filterState.showFilmNowOnly) {
    params.set(PARAM_KEYS.filmNowOnly, 'true');
  }
  if (filterState.hidePassRated) {
    params.set(PARAM_KEYS.hidePass, 'true');
  }

  // Sort (only if not default)
  if (sortState.sortConfigs.length > 0) {
    const primarySort = sortState.sortConfigs[0];
    params.set(PARAM_KEYS.sort, primarySort.field);
    params.set(PARAM_KEYS.sortDir, primarySort.direction);
  }

  const queryString = params.toString();
  const baseUrl = window.location.origin + window.location.pathname;
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Hook to sync URL state with filter/sort stores
 */
export function useUrlState() {
  const initialized = useRef(false);

  // Filter store actions
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const setRecommendationTiers = useFilterStore((s) => s.setRecommendationTiers);
  const setBudgetCategories = useFilterStore((s) => s.setBudgetCategories);
  const setCollections = useFilterStore((s) => s.setCollections);
  const setGenres = useFilterStore((s) => s.setGenres);
  const setThemes = useFilterStore((s) => s.setThemes);
  const setWeightedScoreRange = useFilterStore((s) => s.setWeightedScoreRange);
  const setShowFilmNowOnly = useFilterStore((s) => s.setShowFilmNowOnly);
  const setHidePassRated = useFilterStore((s) => s.setHidePassRated);

  // Sort store actions
  const resetSort = useSortStore((s) => s.resetSort);
  const addSortColumn = useSortStore((s) => s.addSortColumn);

  // Subscribe to store changes and update URL
  useEffect(() => {
    // Only run once on mount - parse URL and apply to stores
    if (!initialized.current && window.location.search) {
      const urlState = parseUrlParams();

      if (urlState.searchQuery) setSearchQuery(urlState.searchQuery);
      if (urlState.recommendationTiers) setRecommendationTiers(urlState.recommendationTiers);
      if (urlState.budgetCategories) setBudgetCategories(urlState.budgetCategories);
      if (urlState.collections) setCollections(urlState.collections);
      if (urlState.genres) setGenres(urlState.genres);
      if (urlState.themes) setThemes(urlState.themes);
      if (urlState.weightedScoreRange) setWeightedScoreRange(urlState.weightedScoreRange);
      if (urlState.showFilmNowOnly) setShowFilmNowOnly(true);
      if (urlState.hidePassRated) setHidePassRated(true);

      if (urlState.sortField) {
        resetSort();
        addSortColumn(urlState.sortField as any, urlState.sortDirection || 'desc');
      }

      initialized.current = true;
    }
  }, [
    setSearchQuery,
    setRecommendationTiers,
    setBudgetCategories,
    setCollections,
    setGenres,
    setThemes,
    setWeightedScoreRange,
    setShowFilmNowOnly,
    setHidePassRated,
    resetSort,
    addSortColumn,
  ]);

  return {
    getShareableUrl: buildShareableUrl,
  };
}

/**
 * Copy shareable URL to clipboard
 */
export async function copyShareableUrl(): Promise<boolean> {
  try {
    const url = buildShareableUrl();
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.error('Failed to copy URL:', error);
    return false;
  }
}
