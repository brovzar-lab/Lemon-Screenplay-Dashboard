/**
 * Hook for filtered and sorted screenplays
 * Combines filter state, sort state, and screenplay data
 */

import { useMemo } from 'react';
import { useScreenplays } from './useScreenplays';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';
import { canonicalizeGenre } from '@/lib/calculations';
import type { Screenplay, FilterState, SortConfig, RecommendationTier } from '@/types';

/**
 * Check if screenplay matches search query
 */
export function matchesSearch(screenplay: Screenplay, query: string): boolean {
  if (!query.trim()) return true;

  const lowerQuery = query.toLowerCase();
  return (
    (screenplay.title || '').toLowerCase().includes(lowerQuery) ||
    (screenplay.author || '').toLowerCase().includes(lowerQuery) ||
    (screenplay.genre || '').toLowerCase().includes(lowerQuery) ||
    (screenplay.logline || '').toLowerCase().includes(lowerQuery) ||
    (screenplay.subgenres || []).some((g) => String(g).toLowerCase().includes(lowerQuery)) ||
    (screenplay.themes || []).some((t) => String(t).toLowerCase().includes(lowerQuery))
  );
}

/**
 * Check if screenplay passes all filters
 */
export function passesFilters(screenplay: Screenplay, filters: FilterState): boolean {
  // Search
  if (!matchesSearch(screenplay, filters.searchQuery)) return false;

  // Recommendation tiers
  if (
    filters.recommendationTiers.length > 0 &&
    !filters.recommendationTiers.includes(screenplay.recommendation)
  ) {
    return false;
  }

  // Budget categories
  if (
    filters.budgetCategories.length > 0 &&
    !filters.budgetCategories.includes(screenplay.budgetCategory)
  ) {
    return false;
  }

  // Collections
  if (
    filters.collections.length > 0 &&
    !filters.collections.includes(screenplay.collection)
  ) {
    return false;
  }

  // Categories (source of screenplay)
  if (
    filters.categories.length > 0 &&
    !filters.categories.includes(screenplay.category || 'OTHER')
  ) {
    return false;
  }

  // Genres (OR logic - exact canonical match)
  if (filters.genres.length > 0) {
    const allCanonical = [screenplay.genre, ...screenplay.subgenres].map(canonicalizeGenre);
    const hasMatchingGenre = filters.genres.some((g) =>
      allCanonical.includes(canonicalizeGenre(g))
    );
    if (!hasMatchingGenre) return false;
  }

  // Themes (OR logic - exact case-insensitive match)
  if (filters.themes.length > 0) {
    const hasMatchingTheme = filters.themes.some((t) =>
      (screenplay.themes || []).some((st) => String(st).toLowerCase() === t.toLowerCase())
    );
    if (!hasMatchingTheme) return false;
  }

  // Weighted score range
  if (filters.weightedScoreRange.enabled) {
    if (
      screenplay.weightedScore < filters.weightedScoreRange.min ||
      screenplay.weightedScore > filters.weightedScoreRange.max
    ) {
      return false;
    }
  }

  // CVS range
  if (filters.cvsRange.enabled) {
    if (
      screenplay.cvsTotal < filters.cvsRange.min ||
      screenplay.cvsTotal > filters.cvsRange.max
    ) {
      return false;
    }
  }

  // Dimension ranges
  const dimensionRanges = [
    { filter: filters.conceptRange, score: screenplay.dimensionScores.concept },
    { filter: filters.structureRange, score: screenplay.dimensionScores.structure },
    { filter: filters.protagonistRange, score: screenplay.dimensionScores.protagonist },
    { filter: filters.supportingCastRange, score: screenplay.dimensionScores.supportingCast },
    { filter: filters.dialogueRange, score: screenplay.dimensionScores.dialogue },
    { filter: filters.genreExecutionRange, score: screenplay.dimensionScores.genreExecution },
    { filter: filters.originalityRange, score: screenplay.dimensionScores.originality },
  ];

  for (const { filter, score } of dimensionRanges) {
    if (filter.enabled && (score < filter.min || score > filter.max)) {
      return false;
    }
  }

  // Producer metric ranges
  const producerRanges = [
    { filter: filters.marketPotentialRange, score: screenplay.producerMetrics.marketPotential },
    { filter: filters.starVehiclePotentialRange, score: screenplay.producerMetrics.starVehiclePotential },
    { filter: filters.festivalAppealRange, score: screenplay.producerMetrics.festivalAppeal },
    { filter: filters.roiIndicatorRange, score: screenplay.producerMetrics.roiIndicator },
  ];

  for (const { filter, score } of producerRanges) {
    if (filter.enabled && (score < filter.min || score > filter.max)) {
      return false;
    }
  }

  // Film Now only
  if (filters.showFilmNowOnly && !screenplay.isFilmNow) {
    return false;
  }

  // Hide Pass rated
  if (filters.hidePassRated && screenplay.recommendation === 'pass') {
    return false;
  }

  // Critical failures filter
  if (filters.hasCriticalFailures !== null) {
    const hasCriticalFailures = screenplay.criticalFailures.length > 0;
    if (filters.hasCriticalFailures !== hasCriticalFailures) {
      return false;
    }
  }

  // Hide produced films (TMDB validation)
  if (filters.hideProduced && screenplay.tmdbStatus?.isProduced) {
    return false;
  }

  // Hide non-screenplays (industry docs, reference materials)
  if (filters.hideNonScreenplays) {
    const genre = (screenplay.genre || '').toLowerCase();
    const isIndustryDoc =
      genre.includes('industry') ||
      genre.includes('reference') ||
      genre.includes('documentary/industry');
    const hasCriticalNotScreenplay =
      (screenplay.criticalFailures || []).some((f) =>
        String(f).toLowerCase().includes('not a screenplay')
      );
    if ((isIndustryDoc && screenplay.weightedScore <= 2.0) || hasCriticalNotScreenplay) {
      return false;
    }
  }

  return true;
}

/**
 * Get recommendation tier sort order
 */
export function getRecommendationOrder(tier: RecommendationTier): number {
  switch (tier) {
    case 'film_now':
      return 0;
    case 'recommend':
      return 1;
    case 'consider':
      return 2;
    case 'pass':
      return 3;
    default:
      return 4;
  }
}

/**
 * Get value for sorting from screenplay
 */
export function getSortValue(screenplay: Screenplay, field: string): number | string {
  switch (field) {
    case 'weightedScore':
      return screenplay.weightedScore;
    case 'cvsTotal':
      return screenplay.cvsTotal;
    case 'concept':
      return screenplay.dimensionScores.concept;
    case 'structure':
      return screenplay.dimensionScores.structure;
    case 'protagonist':
      return screenplay.dimensionScores.protagonist;
    case 'supportingCast':
      return screenplay.dimensionScores.supportingCast;
    case 'dialogue':
      return screenplay.dimensionScores.dialogue;
    case 'genreExecution':
      return screenplay.dimensionScores.genreExecution;
    case 'originality':
      return screenplay.dimensionScores.originality;
    case 'marketPotential':
      return screenplay.producerMetrics.marketPotential;
    case 'starVehiclePotential':
      return screenplay.producerMetrics.starVehiclePotential;
    case 'festivalAppeal':
      return screenplay.producerMetrics.festivalAppeal;
    case 'roiIndicator':
      return screenplay.producerMetrics.roiIndicator;
    case 'title':
      return (screenplay.title || '').toLowerCase();
    case 'author':
      return (screenplay.author || '').toLowerCase();
    case 'genre':
      return (screenplay.genre || '').toLowerCase();
    case 'collection':
      return screenplay.collection;
    case 'recommendation':
      return getRecommendationOrder(screenplay.recommendation);
    default:
      return 0;
  }
}

/**
 * Sort screenplays by multiple columns
 */
export function sortScreenplays(
  screenplays: Screenplay[],
  sortConfigs: SortConfig[],
  prioritizeFilmNow: boolean
): Screenplay[] {
  return [...screenplays].sort((a, b) => {
    // Film Now priority
    if (prioritizeFilmNow) {
      if (a.isFilmNow && !b.isFilmNow) return -1;
      if (!a.isFilmNow && b.isFilmNow) return 1;
    }

    // Apply each sort config in order
    for (const config of sortConfigs) {
      const aValue = getSortValue(a, config.field);
      const bValue = getSortValue(b, config.field);

      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      if (comparison !== 0) {
        return config.direction === 'asc' ? comparison : -comparison;
      }
    }

    return 0;
  });
}

/**
 * Main hook for filtered and sorted screenplays
 */
export function useFilteredScreenplays() {
  const { data: screenplays, isLoading, error } = useScreenplays();

  // Get filter state (selective subscription to avoid re-renders)
  const filters = useFilterStore();
  const { sortConfigs, prioritizeFilmNow } = useSortStore();

  // Memoize filtered and sorted data
  const filteredScreenplays = useMemo(() => {
    if (!screenplays) return [];

    // Filter
    const filtered = screenplays.filter((sp) => passesFilters(sp, filters));

    // Sort
    return sortScreenplays(filtered, sortConfigs, prioritizeFilmNow);
  }, [screenplays, filters, sortConfigs, prioritizeFilmNow]);

  return {
    screenplays: filteredScreenplays,
    totalCount: screenplays?.length || 0,
    filteredCount: filteredScreenplays.length,
    isLoading,
    error,
  };
}

/**
 * Hook to check if any filters are active
 */
export function useHasActiveFilters(): boolean {
  const filters = useFilterStore();

  return (
    filters.searchQuery !== '' ||
    filters.recommendationTiers.length > 0 ||
    filters.budgetCategories.length > 0 ||
    filters.collections.length > 0 ||
    filters.categories.length > 0 ||
    filters.genres.length > 0 ||
    filters.themes.length > 0 ||
    filters.weightedScoreRange.enabled ||
    filters.cvsRange.enabled ||
    filters.conceptRange.enabled ||
    filters.structureRange.enabled ||
    filters.protagonistRange.enabled ||
    filters.supportingCastRange.enabled ||
    filters.dialogueRange.enabled ||
    filters.genreExecutionRange.enabled ||
    filters.originalityRange.enabled ||
    filters.marketPotentialRange.enabled ||
    filters.starVehiclePotentialRange.enabled ||
    filters.festivalAppealRange.enabled ||
    filters.roiIndicatorRange.enabled ||
    filters.showFilmNowOnly ||
    filters.hidePassRated ||
    filters.hasCriticalFailures !== null ||
    !filters.hideProduced || // Default is true (hide produced). Active when user opted to show produced films.
    !filters.hideNonScreenplays // Default is true (hide non-screenplays). Active when user opted to show them.
  );
}
