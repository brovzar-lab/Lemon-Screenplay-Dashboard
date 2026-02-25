/**
 * Unit Tests for Filter & Sort Pipeline
 * Tests the pure filter/sort functions extracted from useFilteredScreenplays
 */

import { describe, it, expect } from 'vitest';
import {
    matchesSearch,
    passesFilters,
    getSortValue,
    getRecommendationOrder,
    sortScreenplays,
} from './useFilteredScreenplays';
import { DEFAULT_FILTER_STATE } from '@/types/filters';
import type { Screenplay } from '@/types';
import type { FilterState, SortConfig } from '@/types/filters';

// ─── Mock Factory ───────────────────────────────────────────

function createMockScreenplay(overrides: Partial<Screenplay> = {}): Screenplay {
    return {
        id: 'test-id',
        title: 'Test Screenplay',
        author: 'Test Author',
        logline: 'A detective hunts a clever serial killer.',
        genre: 'Thriller',
        subgenres: ['Crime', 'Mystery'],
        themes: ['Justice', 'Morality'],
        budgetCategory: 'medium',
        collection: '2020 Black List',
        recommendation: 'recommend',
        isFilmNow: false,
        weightedScore: 7.5,
        cvsTotal: 12,
        marketability: 'medium',
        criticalFailures: [],
        dimensionScores: {
            concept: 7,
            structure: 7,
            protagonist: 8,
            supportingCast: 6,
            dialogue: 7,
            genreExecution: 7,
            originality: 7,
            weightedScore: 7.5,
        },
        cvsFactors: {
            targetAudience: { score: 2, note: '' },
            highConcept: { score: 2, note: '' },
            castAttachability: { score: 2, note: '' },
            marketingHook: { score: 2, note: '' },
            budgetReturn: { score: 2, note: '' },
            comparableSuccess: { score: 2, note: '' },
        },
        producerMetrics: {
            marketPotential: 7,
            marketPotentialRationale: 'Good commercial potential.',
            uspStrength: 'Moderate',
            uspStrengthRationale: 'Decent originality.',
        },
        strengths: [],
        weaknesses: [],
        comparableFilms: [],
        standoutScenes: [],
        developmentNotes: [],
        characters: [],
        verdictStatement: '',
        metadata: { sourceFile: 'test.pdf', pageCount: 110, wordCount: 20000, analysisVersion: 'v5' },
        sourceFile: 'test.pdf',
        ...overrides,
    } as Screenplay;
}

function filtersFrom(partial: Partial<FilterState>): FilterState {
    return { ...DEFAULT_FILTER_STATE, ...partial };
}

// ─── matchesSearch ──────────────────────────────────────────

describe('matchesSearch', () => {
    const sp = createMockScreenplay({
        title: 'Dark Waters',
        author: 'Mark Ruffalo',
        genre: 'Drama',
        logline: 'A lawyer uncovers a toxic corporate conspiracy.',
        subgenres: ['Legal', 'Thriller'],
        themes: ['Environment', 'Justice'],
    });

    it('matches against title', () => {
        expect(matchesSearch(sp, 'dark')).toBe(true);
        expect(matchesSearch(sp, 'DARK WATERS')).toBe(true);
    });

    it('matches against author', () => {
        expect(matchesSearch(sp, 'ruffalo')).toBe(true);
    });

    it('matches against genre', () => {
        expect(matchesSearch(sp, 'drama')).toBe(true);
    });

    it('matches against logline', () => {
        expect(matchesSearch(sp, 'conspiracy')).toBe(true);
    });

    it('matches against subgenres', () => {
        expect(matchesSearch(sp, 'legal')).toBe(true);
    });

    it('matches against themes', () => {
        expect(matchesSearch(sp, 'environment')).toBe(true);
    });

    it('returns true for empty/whitespace query', () => {
        expect(matchesSearch(sp, '')).toBe(true);
        expect(matchesSearch(sp, '   ')).toBe(true);
    });

    it('returns false for non-matching query', () => {
        expect(matchesSearch(sp, 'zombie apocalypse')).toBe(false);
    });
});

// ─── passesFilters ──────────────────────────────────────────

describe('passesFilters', () => {
    const sp = createMockScreenplay();

    it('passes with default (empty) filters', () => {
        expect(passesFilters(sp, DEFAULT_FILTER_STATE)).toBe(true);
    });

    describe('recommendation tier filter', () => {
        it('passes when tier matches', () => {
            expect(passesFilters(sp, filtersFrom({ recommendationTiers: ['recommend'] }))).toBe(true);
        });

        it('fails when tier does not match', () => {
            expect(passesFilters(sp, filtersFrom({ recommendationTiers: ['film_now'] }))).toBe(false);
        });

        it('passes when filter is empty (no restriction)', () => {
            expect(passesFilters(sp, filtersFrom({ recommendationTiers: [] }))).toBe(true);
        });
    });

    describe('budget category filter', () => {
        it('passes when budget matches', () => {
            expect(passesFilters(sp, filtersFrom({ budgetCategories: ['medium'] }))).toBe(true);
        });

        it('fails when budget does not match', () => {
            expect(passesFilters(sp, filtersFrom({ budgetCategories: ['micro'] }))).toBe(false);
        });
    });

    describe('collection filter', () => {
        it('passes when collection matches', () => {
            expect(passesFilters(sp, filtersFrom({ collections: ['2020 Black List'] }))).toBe(true);
        });

        it('fails when collection does not match', () => {
            expect(passesFilters(sp, filtersFrom({ collections: ['2005 Black List'] }))).toBe(false);
        });
    });

    describe('genre filter (OR logic)', () => {
        it('passes when primary genre matches', () => {
            expect(passesFilters(sp, filtersFrom({ genres: ['Thriller'] }))).toBe(true);
        });

        it('passes when subgenre matches', () => {
            expect(passesFilters(sp, filtersFrom({ genres: ['Mystery'] }))).toBe(true);
        });

        it('fails when no genre matches', () => {
            expect(passesFilters(sp, filtersFrom({ genres: ['Comedy'] }))).toBe(false);
        });
    });

    describe('theme filter (OR logic)', () => {
        it('passes when theme matches (case-insensitive)', () => {
            expect(passesFilters(sp, filtersFrom({ themes: ['justice'] }))).toBe(true);
            expect(passesFilters(sp, filtersFrom({ themes: ['MORALITY'] }))).toBe(true);
        });

        it('fails when no theme matches', () => {
            expect(passesFilters(sp, filtersFrom({ themes: ['Aliens'] }))).toBe(false);
        });
    });

    describe('weighted score range', () => {
        it('passes when score is within range', () => {
            expect(
                passesFilters(sp, filtersFrom({ weightedScoreRange: { min: 7, max: 8, enabled: true } }))
            ).toBe(true);
        });

        it('fails when score is below range', () => {
            expect(
                passesFilters(sp, filtersFrom({ weightedScoreRange: { min: 8, max: 10, enabled: true } }))
            ).toBe(false);
        });

        it('ignores range when disabled', () => {
            expect(
                passesFilters(sp, filtersFrom({ weightedScoreRange: { min: 9, max: 10, enabled: false } }))
            ).toBe(true);
        });
    });

    describe('CVS range', () => {
        it('passes when CVS is within range', () => {
            expect(
                passesFilters(sp, filtersFrom({ cvsRange: { min: 10, max: 15, enabled: true } }))
            ).toBe(true);
        });

        it('fails when CVS is outside range', () => {
            expect(
                passesFilters(sp, filtersFrom({ cvsRange: { min: 15, max: 18, enabled: true } }))
            ).toBe(false);
        });
    });

    describe('boolean flags', () => {
        it('fails filmNowOnly when screenplay is not film_now', () => {
            expect(passesFilters(sp, filtersFrom({ showFilmNowOnly: true }))).toBe(false);
        });

        it('passes filmNowOnly when screenplay is film_now', () => {
            const filmNow = createMockScreenplay({ isFilmNow: true });
            expect(passesFilters(filmNow, filtersFrom({ showFilmNowOnly: true }))).toBe(true);
        });

        it('filters out pass-rated screenplays', () => {
            const passSp = createMockScreenplay({ recommendation: 'pass' });
            expect(passesFilters(passSp, filtersFrom({ hidePassRated: true }))).toBe(false);
        });
    });

    describe('critical failures filter', () => {
        it('shows only screenplays with failures when true', () => {
            const withFailures = createMockScreenplay({ criticalFailures: ['Plot hole'] });
            const without = createMockScreenplay({ criticalFailures: [] });

            expect(passesFilters(withFailures, filtersFrom({ hasCriticalFailures: true }))).toBe(true);
            expect(passesFilters(without, filtersFrom({ hasCriticalFailures: true }))).toBe(false);
        });

        it('shows only screenplays without failures when false', () => {
            const withFailures = createMockScreenplay({ criticalFailures: ['Plot hole'] });
            const without = createMockScreenplay({ criticalFailures: [] });

            expect(passesFilters(without, filtersFrom({ hasCriticalFailures: false }))).toBe(true);
            expect(passesFilters(withFailures, filtersFrom({ hasCriticalFailures: false }))).toBe(false);
        });

        it('ignores when null', () => {
            const withFailures = createMockScreenplay({ criticalFailures: ['Plot hole'] });
            expect(passesFilters(withFailures, filtersFrom({ hasCriticalFailures: null }))).toBe(true);
        });
    });

    describe('hideProduced filter', () => {
        it('hides produced screenplays when enabled', () => {
            const produced = createMockScreenplay({
                tmdbStatus: { isProduced: true, tmdbId: 1, tmdbTitle: 'Test', releaseDate: '2023', status: 'Released', checkedAt: '', confidence: 1 },
            });
            expect(passesFilters(produced, filtersFrom({ hideProduced: true }))).toBe(false);
        });

        it('shows produced screenplays when disabled', () => {
            const produced = createMockScreenplay({
                tmdbStatus: { isProduced: true, tmdbId: 1, tmdbTitle: 'Test', releaseDate: '2023', status: 'Released', checkedAt: '', confidence: 1 },
            });
            expect(passesFilters(produced, filtersFrom({ hideProduced: false }))).toBe(true);
        });
    });

    describe('combined filters', () => {
        it('requires ALL filters to pass (AND logic)', () => {
            const sp = createMockScreenplay({
                recommendation: 'recommend',
                budgetCategory: 'medium',
                genre: 'Thriller',
            });

            // Both match
            expect(
                passesFilters(sp, filtersFrom({
                    recommendationTiers: ['recommend'],
                    budgetCategories: ['medium'],
                }))
            ).toBe(true);

            // One doesn't match
            expect(
                passesFilters(sp, filtersFrom({
                    recommendationTiers: ['recommend'],
                    budgetCategories: ['micro'],
                }))
            ).toBe(false);
        });
    });
});

// ─── getRecommendationOrder ─────────────────────────────────

describe('getRecommendationOrder', () => {
    it('orders tiers correctly: film_now < recommend < consider < pass', () => {
        expect(getRecommendationOrder('film_now')).toBeLessThan(getRecommendationOrder('recommend'));
        expect(getRecommendationOrder('recommend')).toBeLessThan(getRecommendationOrder('consider'));
        expect(getRecommendationOrder('consider')).toBeLessThan(getRecommendationOrder('pass'));
    });
});

// ─── getSortValue ───────────────────────────────────────────

describe('getSortValue', () => {
    const sp = createMockScreenplay({
        weightedScore: 8.5,
        cvsTotal: 15,
        title: 'Alpha',
        author: 'Zeta',
        genre: 'Comedy',
        recommendation: 'film_now',
        dimensionScores: {
            concept: 9,
            structure: 8,
            protagonist: 7,
            supportingCast: 6,
            dialogue: 5,
            genreExecution: 4,
            originality: 3,
            weightedScore: 8.5,
        },
        producerMetrics: {
            marketPotential: 9,
            marketPotentialRationale: 'Top-tier commercial appeal.',
            uspStrength: 'Strong',
            uspStrengthRationale: 'Highly original concept.',
        },
    });

    it.each([
        ['weightedScore', 8.5],
        ['cvsTotal', 15],
        ['concept', 9],
        ['structure', 8],
        ['protagonist', 7],
        ['supportingCast', 6],
        ['dialogue', 5],
        ['genreExecution', 4],
        ['originality', 3],
        ['marketPotential', 9],
    ])('returns correct numeric value for "%s"', (field, expected) => {
        expect(getSortValue(sp, field)).toBe(expected);
    });

    it('returns lowercased title', () => {
        expect(getSortValue(sp, 'title')).toBe('alpha');
    });

    it('returns lowercased author', () => {
        expect(getSortValue(sp, 'author')).toBe('zeta');
    });

    it('returns recommendation order number', () => {
        expect(getSortValue(sp, 'recommendation')).toBe(0); // film_now = 0
    });

    it('returns 0 for unknown field', () => {
        expect(getSortValue(sp, 'nonexistent')).toBe(0);
    });
});

// ─── sortScreenplays ───────────────────────────────────────

describe('sortScreenplays', () => {
    const filmNow = createMockScreenplay({ id: 'fn', title: 'Zenith', isFilmNow: true, weightedScore: 6 });
    const highest = createMockScreenplay({ id: 'high', title: 'Beta', isFilmNow: false, weightedScore: 9 });
    const lowest = createMockScreenplay({ id: 'low', title: 'Alpha', isFilmNow: false, weightedScore: 5 });
    const middle = createMockScreenplay({ id: 'mid', title: 'Gamma', isFilmNow: false, weightedScore: 7 });

    const all = [lowest, highest, middle, filmNow];

    it('sorts by weightedScore desc', () => {
        const config: SortConfig[] = [{ field: 'weightedScore', direction: 'desc' }];
        const sorted = sortScreenplays(all, config, false);

        expect(sorted.map((s) => s.id)).toEqual(['high', 'mid', 'fn', 'low']);
    });

    it('sorts by weightedScore asc', () => {
        const config: SortConfig[] = [{ field: 'weightedScore', direction: 'asc' }];
        const sorted = sortScreenplays(all, config, false);

        expect(sorted.map((s) => s.id)).toEqual(['low', 'fn', 'mid', 'high']);
    });

    it('sorts by title asc', () => {
        const config: SortConfig[] = [{ field: 'title', direction: 'asc' }];
        const sorted = sortScreenplays(all, config, false);

        expect(sorted.map((s) => s.id)).toEqual(['low', 'high', 'mid', 'fn']);
    });

    it('prioritizes filmNow when enabled', () => {
        const config: SortConfig[] = [{ field: 'weightedScore', direction: 'desc' }];
        const sorted = sortScreenplays(all, config, true);

        expect(sorted[0].id).toBe('fn');
        // After filmNow, sorted by score desc
        expect(sorted.slice(1).map((s) => s.id)).toEqual(['high', 'mid', 'low']);
    });

    it('does not mutate the original array', () => {
        const original = [...all];
        sortScreenplays(all, [{ field: 'weightedScore', direction: 'desc' }], false);
        expect(all).toEqual(original);
    });

    it('handles multi-column sort (tiebreaker)', () => {
        const a = createMockScreenplay({ id: 'a', title: 'Alpha', weightedScore: 7 });
        const b = createMockScreenplay({ id: 'b', title: 'Zeta', weightedScore: 7 });

        const configs: SortConfig[] = [
            { field: 'weightedScore', direction: 'desc' },
            { field: 'title', direction: 'asc' },
        ];
        const sorted = sortScreenplays([b, a], configs, false);

        // Same score → sorted by title asc
        expect(sorted.map((s) => s.id)).toEqual(['a', 'b']);
    });
});
