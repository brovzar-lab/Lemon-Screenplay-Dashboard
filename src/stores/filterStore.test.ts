/**
 * Unit Tests for Filter Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useFilterStore } from './filterStore';
import { DEFAULT_FILTER_STATE } from '@/types/filters';

describe('filterStore', () => {
  beforeEach(() => {
    // Reset store to default state before each test
    useFilterStore.getState().resetFilters();
  });

  describe('searchQuery', () => {
    it('sets search query', () => {
      const { setSearchQuery } = useFilterStore.getState();
      setSearchQuery('thriller');

      expect(useFilterStore.getState().searchQuery).toBe('thriller');
    });

    it('clears search query', () => {
      const { setSearchQuery } = useFilterStore.getState();
      setSearchQuery('drama');
      setSearchQuery('');

      expect(useFilterStore.getState().searchQuery).toBe('');
    });
  });

  describe('recommendationTiers', () => {
    it('toggles recommendation tier on', () => {
      const { toggleRecommendationTier } = useFilterStore.getState();
      toggleRecommendationTier('film_now');

      expect(useFilterStore.getState().recommendationTiers).toContain('film_now');
    });

    it('toggles recommendation tier off', () => {
      const { toggleRecommendationTier } = useFilterStore.getState();
      toggleRecommendationTier('film_now');
      toggleRecommendationTier('film_now');

      expect(useFilterStore.getState().recommendationTiers).not.toContain('film_now');
    });

    it('supports multiple tiers', () => {
      const { toggleRecommendationTier } = useFilterStore.getState();
      toggleRecommendationTier('film_now');
      toggleRecommendationTier('recommend');

      const tiers = useFilterStore.getState().recommendationTiers;
      expect(tiers).toContain('film_now');
      expect(tiers).toContain('recommend');
      expect(tiers).toHaveLength(2);
    });

    it('sets tiers directly', () => {
      const { setRecommendationTiers } = useFilterStore.getState();
      setRecommendationTiers(['consider', 'pass']);

      const tiers = useFilterStore.getState().recommendationTiers;
      expect(tiers).toEqual(['consider', 'pass']);
    });
  });

  describe('budgetCategories', () => {
    it('toggles budget category on', () => {
      const { toggleBudgetCategory } = useFilterStore.getState();
      toggleBudgetCategory('high');

      expect(useFilterStore.getState().budgetCategories).toContain('high');
    });

    it('toggles budget category off', () => {
      const { toggleBudgetCategory } = useFilterStore.getState();
      toggleBudgetCategory('low');
      toggleBudgetCategory('low');

      expect(useFilterStore.getState().budgetCategories).not.toContain('low');
    });

    it('sets categories directly', () => {
      const { setBudgetCategories } = useFilterStore.getState();
      setBudgetCategories(['micro', 'low']);

      expect(useFilterStore.getState().budgetCategories).toEqual(['micro', 'low']);
    });
  });

  describe('collections', () => {
    it('toggles collection on', () => {
      const { toggleCollection } = useFilterStore.getState();
      toggleCollection('2020 Black List');

      expect(useFilterStore.getState().collections).toContain('2020 Black List');
    });

    it('toggles collection off', () => {
      const { toggleCollection } = useFilterStore.getState();
      toggleCollection('2020 Black List');
      toggleCollection('2020 Black List');

      expect(useFilterStore.getState().collections).not.toContain('2020 Black List');
    });

    it('sets collections directly', () => {
      const { setCollections } = useFilterStore.getState();
      setCollections(['2005 Black List', '2006 Black List']);

      expect(useFilterStore.getState().collections).toEqual(['2005 Black List', '2006 Black List']);
    });
  });

  describe('genres', () => {
    it('toggles genre on', () => {
      const { toggleGenre } = useFilterStore.getState();
      toggleGenre('Drama');

      expect(useFilterStore.getState().genres).toContain('Drama');
    });

    it('toggles genre off', () => {
      const { toggleGenre } = useFilterStore.getState();
      toggleGenre('Thriller');
      toggleGenre('Thriller');

      expect(useFilterStore.getState().genres).not.toContain('Thriller');
    });

    it('sets genres directly', () => {
      const { setGenres } = useFilterStore.getState();
      setGenres(['Action', 'Comedy']);

      expect(useFilterStore.getState().genres).toEqual(['Action', 'Comedy']);
    });
  });

  describe('themes', () => {
    it('toggles theme on', () => {
      const { toggleTheme } = useFilterStore.getState();
      toggleTheme('Identity');

      expect(useFilterStore.getState().themes).toContain('Identity');
    });

    it('sets themes directly', () => {
      const { setThemes } = useFilterStore.getState();
      setThemes(['Family', 'Redemption']);

      expect(useFilterStore.getState().themes).toEqual(['Family', 'Redemption']);
    });
  });

  describe('range filters', () => {
    it('sets weighted score range', () => {
      const { setWeightedScoreRange } = useFilterStore.getState();
      setWeightedScoreRange({ min: 7, max: 10, enabled: true });

      const range = useFilterStore.getState().weightedScoreRange;
      expect(range.min).toBe(7);
      expect(range.max).toBe(10);
      expect(range.enabled).toBe(true);
    });

    it('partially updates range filter', () => {
      const { setWeightedScoreRange } = useFilterStore.getState();
      setWeightedScoreRange({ min: 5 });

      const range = useFilterStore.getState().weightedScoreRange;
      expect(range.min).toBe(5);
      expect(range.max).toBe(DEFAULT_FILTER_STATE.weightedScoreRange.max);
    });

    it('sets CVS range', () => {
      const { setCvsRange } = useFilterStore.getState();
      setCvsRange({ min: 10, max: 18, enabled: true });

      const range = useFilterStore.getState().cvsRange;
      expect(range.min).toBe(10);
      expect(range.max).toBe(18);
    });

    it('sets market potential range', () => {
      const { setMarketPotentialRange } = useFilterStore.getState();
      setMarketPotentialRange({ min: 8, enabled: true });

      const range = useFilterStore.getState().marketPotentialRange;
      expect(range.min).toBe(8);
      expect(range.enabled).toBe(true);
    });

    it('sets dimension score ranges', () => {
      const { setConceptRange, setProtagonistRange, setOriginalityRange } =
        useFilterStore.getState();

      setConceptRange({ min: 6, enabled: true });
      setProtagonistRange({ min: 7, enabled: true });
      setOriginalityRange({ min: 8, enabled: true });

      expect(useFilterStore.getState().conceptRange.min).toBe(6);
      expect(useFilterStore.getState().protagonistRange.min).toBe(7);
      expect(useFilterStore.getState().originalityRange.min).toBe(8);
    });
  });

  describe('flags', () => {
    it('sets showFilmNowOnly', () => {
      const { setShowFilmNowOnly } = useFilterStore.getState();
      setShowFilmNowOnly(true);

      expect(useFilterStore.getState().showFilmNowOnly).toBe(true);
    });

    it('sets hidePassRated', () => {
      const { setHidePassRated } = useFilterStore.getState();
      setHidePassRated(true);

      expect(useFilterStore.getState().hidePassRated).toBe(true);
    });

    it('sets hasCriticalFailures', () => {
      const { setHasCriticalFailures } = useFilterStore.getState();
      setHasCriticalFailures(false);

      expect(useFilterStore.getState().hasCriticalFailures).toBe(false);
    });

    it('allows null for hasCriticalFailures (no filter)', () => {
      const { setHasCriticalFailures } = useFilterStore.getState();
      setHasCriticalFailures(true);
      setHasCriticalFailures(null);

      expect(useFilterStore.getState().hasCriticalFailures).toBe(null);
    });
  });

  describe('resetFilters', () => {
    it('resets all filters to default state', () => {
      const store = useFilterStore.getState();

      // Apply various filters
      store.setSearchQuery('test');
      store.setRecommendationTiers(['film_now']);
      store.setBudgetCategories(['high']);
      store.setGenres(['Drama']);
      store.setWeightedScoreRange({ min: 7, enabled: true });
      store.setShowFilmNowOnly(true);

      // Reset
      store.resetFilters();

      // Verify all reset
      const state = useFilterStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.recommendationTiers).toEqual([]);
      expect(state.budgetCategories).toEqual([]);
      expect(state.genres).toEqual([]);
      expect(state.weightedScoreRange).toEqual(DEFAULT_FILTER_STATE.weightedScoreRange);
      expect(state.showFilmNowOnly).toBe(false);
    });
  });

  describe('applyFilters', () => {
    it('applies partial filter state', () => {
      const { applyFilters } = useFilterStore.getState();

      applyFilters({
        searchQuery: 'action',
        recommendationTiers: ['recommend'],
        budgetCategories: ['low', 'micro'],
      });

      const state = useFilterStore.getState();
      expect(state.searchQuery).toBe('action');
      expect(state.recommendationTiers).toEqual(['recommend']);
      expect(state.budgetCategories).toEqual(['low', 'micro']);
    });

    it('preserves unspecified filters', () => {
      const { setGenres, applyFilters } = useFilterStore.getState();

      setGenres(['Horror']);
      applyFilters({ searchQuery: 'test' });

      expect(useFilterStore.getState().genres).toEqual(['Horror']);
    });
  });
});
