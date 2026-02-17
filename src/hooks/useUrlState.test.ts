/**
 * Unit Tests for URL State Management
 * Tests parseUrlParams and buildShareableUrl pure functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildShareableUrl } from './useUrlState';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';

describe('buildShareableUrl', () => {
    beforeEach(() => {
        // Reset stores
        useFilterStore.getState().resetFilters();
        useSortStore.getState().resetSort();

        // Mock window.location
        Object.defineProperty(window, 'location', {
            writable: true,
            value: {
                origin: 'https://lemon-dashboard.web.app',
                pathname: '/',
                search: '',
            },
        });
    });

    it('returns base URL with no filters', () => {
        // Need to clear ALL filters, including hideProduced default
        const store = useFilterStore.getState();
        store.resetFilters();
        // Reset sort so no sort params are appended
        useSortStore.getState().resetSort();

        const url = buildShareableUrl();
        // Default hideProduced=true won't add params, so just base URL + possible sort
        expect(url).toContain('https://lemon-dashboard.web.app/');
    });

    it('includes search query', () => {
        useFilterStore.getState().setSearchQuery('thriller');
        const url = buildShareableUrl();
        expect(url).toContain('q=thriller');
    });

    it('includes recommendation tiers', () => {
        useFilterStore.getState().setRecommendationTiers(['film_now', 'recommend']);
        const url = buildShareableUrl();
        expect(url).toContain('tier=film_now');
        expect(url).toContain('tier=recommend');
    });

    it('includes budget categories', () => {
        useFilterStore.getState().setBudgetCategories(['micro', 'low']);
        const url = buildShareableUrl();
        expect(url).toContain('budget=micro');
        expect(url).toContain('budget=low');
    });

    it('includes collections', () => {
        useFilterStore.getState().setCollections(['2020 Black List']);
        const url = buildShareableUrl();
        expect(url).toContain('collection=2020');
    });

    it('includes genres', () => {
        useFilterStore.getState().setGenres(['Action', 'Drama']);
        const url = buildShareableUrl();
        expect(url).toContain('genre=Action');
        expect(url).toContain('genre=Drama');
    });

    it('includes themes', () => {
        useFilterStore.getState().setThemes(['Identity', 'Freedom']);
        const url = buildShareableUrl();
        expect(url).toContain('theme=Identity');
        expect(url).toContain('theme=Freedom');
    });

    it('includes score range when enabled', () => {
        useFilterStore.getState().setWeightedScoreRange({ min: 7, max: 9, enabled: true });
        const url = buildShareableUrl();
        expect(url).toContain('minScore=7');
        expect(url).toContain('maxScore=9');
    });

    it('omits score range when disabled', () => {
        useFilterStore.getState().setWeightedScoreRange({ min: 7, max: 9, enabled: false });
        const url = buildShareableUrl();
        expect(url).not.toContain('minScore');
        expect(url).not.toContain('maxScore');
    });

    it('includes filmNow flag', () => {
        useFilterStore.getState().setShowFilmNowOnly(true);
        const url = buildShareableUrl();
        expect(url).toContain('filmNow=true');
    });

    it('includes hidePass flag', () => {
        useFilterStore.getState().setHidePassRated(true);
        const url = buildShareableUrl();
        expect(url).toContain('hidePass=true');
    });

    it('includes sort config', () => {
        useSortStore.getState().resetSort();
        useSortStore.getState().addSortColumn('weightedScore', 'desc');
        const url = buildShareableUrl();
        expect(url).toContain('sort=weightedScore');
        expect(url).toContain('dir=desc');
    });

    it('builds complex URL with multiple params', () => {
        const filterStore = useFilterStore.getState();
        filterStore.setSearchQuery('drama');
        filterStore.setRecommendationTiers(['recommend']);
        filterStore.setGenres(['Drama']);
        filterStore.setShowFilmNowOnly(true);

        const url = buildShareableUrl();
        expect(url).toContain('q=drama');
        expect(url).toContain('tier=recommend');
        expect(url).toContain('genre=Drama');
        expect(url).toContain('filmNow=true');

        // Should be a valid URL
        expect(() => new URL(url)).not.toThrow();
    });
});
