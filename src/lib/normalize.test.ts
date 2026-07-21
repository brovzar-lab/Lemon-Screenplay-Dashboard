/**
 * Unit Tests for Data Normalization
 * Tests the core data pipeline: raw JSON → normalized Screenplay objects
 */

import { describe, it, expect } from 'vitest';
import {



    collectionToCategoryId,
    isArchaeologyAnalysis,
    normalizeV9Screenplay,

} from './normalize';
import type { RawTmdbStatus } from '@/types';

// ─── Factories ──────────────────────────────────────────────


/**
 * Create a realistic V9 archaeology engine mock.
 * Mirrors the 5-pillar structure produced by the daemon.
 */
function createMockV9Raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        source_file: 'Moonrise_Kingdom_v9.pdf',
        analysis_model: 'claude-sonnet-4',
        analysis_version: 'v9_archaeology',
        collection_id: 'BLACK_LIST',
        metadata: {
            filename: 'Moonrise_Kingdom_v9.pdf',
            page_count: 105,
            word_count: 19500,
        },
        analysis: {
            title: 'Moonrise Kingdom',
            author: 'Wes Anderson',
            genre: 'Drama',
            subgenres: ['Coming-of-age', 'Romance'],
            themes: ['Innocence', 'Escapism', 'Belonging'],
            logline: 'Two twelve-year-olds fall in love and run away together into the wilderness.',
            tone: 'Whimsical and melancholic',
            verdict: 'RECOMMEND',
            executive_summary: 'A beautifully crafted coming-of-age story with exceptional voice.',
            pillar_scores: {
                structure: { score: 7.5, weight: 0.20 },
                character: { score: 8.2, weight: 0.25 },
                concept: { score: 8.8, weight: 0.20 },
                craft_scene: { score: 9.0, weight: 0.20 },
                emotional_resonance: { score: 8.5, weight: 0.15 },
            },
            weighted_score: 8.35,
            characters: {
                protagonist: 'Sam Shakusky',
                antagonist: 'Social Services',
                supporting: ['Suzy Bishop', 'Scout Master Ward'],
            },
            comparable_films: {
                film1: { title: 'The Royal Tenenbaums', similarity: 'Anderson whimsy + family dysfunction' },
                film2: { title: 'Stand by Me', structural_match: 'Kids on a journey', key_divergence: 'Romance vs. friendship' },
            },
            goosebumps_moments: [
                { page: 42, description: 'The cove dance scene', why_it_works: 'Pure emotional honesty' },
                { page: 88, description: 'Lightning strike reunion', why_it_works: 'Visual metaphor for their bond' },
            ],
            reader_disagreements: ['Tone may be too precious for mainstream'],
            story_vs_situation: { score: 8, verdict: 'True story arc', gate_applied: false },
            strengths: ['Unique visual storytelling', 'Deeply felt characters'],
            weaknesses: ['Limited mass appeal'],
            development_notes: ['Consider broadening third act scope'],
            lenses: {
                commercial_viability: {
                    target_audience: { score: 2, note: 'Art-house crowd' },
                    high_concept: { score: 1, note: 'Not traditionally high-concept' },
                    cast_attachability: { score: 3, note: 'Ensemble-driven' },
                    marketing_hook: { score: 2, note: 'Anderson brand is the hook' },
                    budget_return_ratio: { score: 3, note: 'Low budget, high return potential' },
                    comparable_success: { score: 3, note: 'Anderson films perform well' },
                },
            },
            critical_failures: [],
            red_flags: [],
        },
        ...overrides,
    };
}

function createMockTriageRaw(analysisVersion: string): Record<string, unknown> {
    return {
        source_file: 'Triage_Test.pdf',
        analysis_version: analysisVersion,
        analysis: {
            title: 'Triage Test',
            verdict: 'CONSIDER',
            triage_score: 6.5,
        },
    };
}
describe('collectionToCategoryId', () => {
    it('returns existingCategory when provided', () => {
        expect(collectionToCategoryId('anything', 'MY_CAT')).toBe('MY_CAT');
    });

    it('maps collection names containing "black list" to BLKLST', () => {
        expect(collectionToCategoryId('2006 Black List')).toBe('BLKLST');
        expect(collectionToCategoryId('2020 Black List')).toBe('BLKLST');
        expect(collectionToCategoryId('The Blacklist Annual')).toBe('BLKLST');
    });

    it('maps "BLKLST" to BLKLST', () => {
        expect(collectionToCategoryId('BLKLST')).toBe('BLKLST');
        expect(collectionToCategoryId('blklst')).toBe('BLKLST');
    });

    it('maps lemon collections to LEMON', () => {
        expect(collectionToCategoryId('Lemon Studios')).toBe('LEMON');
        expect(collectionToCategoryId('LEMON')).toBe('LEMON');
    });

    it('maps submissions to SUBMISSION', () => {
        expect(collectionToCategoryId('Submission Pool')).toBe('SUBMISSION');
        expect(collectionToCategoryId('Submitted Scripts')).toBe('SUBMISSION');
    });

    it('maps contests to CONTEST', () => {
        expect(collectionToCategoryId('Contest Winner')).toBe('CONTEST');
        expect(collectionToCategoryId('Competition Finalists')).toBe('CONTEST');
    });

    it('falls back to OTHER for undefined/null', () => {
        // @ts-expect-error — testing defensive coding
        expect(collectionToCategoryId(undefined)).toBe('OTHER');
        // @ts-expect-error — testing defensive coding
        expect(collectionToCategoryId(null)).toBe('OTHER');
    });

    it('falls back to OTHER for empty string', () => {
        expect(collectionToCategoryId('')).toBe('OTHER');
    });

    it('falls back to OTHER for unrecognized collections', () => {
        expect(collectionToCategoryId('Randoms')).toBe('OTHER');
        expect(collectionToCategoryId('V6 Analysis')).toBe('OTHER');
    });
});


// ============================================
// normalizeTmdbStatus (via normalizeV9Screenplay)
// ============================================

describe('normalizeTmdbStatus', () => {
    it('normalizes full tmdb_status with is_produced: true', () => {
        const tmdb: RawTmdbStatus = {
            is_produced: true,
            tmdb_id: 123456,
            tmdb_title: 'Test Movie',
            release_date: '2024-03-15',
            status: 'Released',
            checked_at: '2025-01-01T00:00:00Z',
            confidence: 'high',
        };
        const raw = createMockV9Raw({ tmdb_status: tmdb });
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.tmdbStatus).not.toBeNull();
        expect(result.tmdbStatus!.isProduced).toBe(true);
        expect(result.tmdbStatus!.tmdbId).toBe(123456);
        expect(result.tmdbStatus!.tmdbTitle).toBe('Test Movie');
        expect(result.tmdbStatus!.releaseDate).toBe('2024-03-15');
        expect(result.tmdbStatus!.status).toBe('Released');
        expect(result.tmdbStatus!.checkedAt).toBe('2025-01-01T00:00:00Z');
        expect(result.tmdbStatus!.confidence).toBe('high');
    });

    it('normalizes tmdb_status with is_produced: false', () => {
        const tmdb: RawTmdbStatus = {
            is_produced: false,
            tmdb_id: null,
            tmdb_title: null,
            release_date: null,
            status: null,
            checked_at: '2025-06-01T12:00:00Z',
            confidence: 'medium',
        };
        const raw = createMockV9Raw({ tmdb_status: tmdb });
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.tmdbStatus).not.toBeNull();
        expect(result.tmdbStatus!.isProduced).toBe(false);
        expect(result.tmdbStatus!.tmdbId).toBeNull();
        expect(result.tmdbStatus!.tmdbTitle).toBeNull();
        expect(result.tmdbStatus!.releaseDate).toBeNull();
        expect(result.tmdbStatus!.confidence).toBe('medium');
    });

    it('returns null for undefined tmdb_status', () => {
        const raw = createMockV9Raw();
        // No tmdb_status set on the mock
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.tmdbStatus).toBeNull();
    });

    it('returns null when tmdb_status is explicitly undefined', () => {
        const raw = createMockV9Raw({ tmdb_status: undefined });
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.tmdbStatus).toBeNull();
    });

    it('normalizes partial tmdb_status with missing fields', () => {
        // Simulate a partial object — only is_produced and checked_at present
        const partialTmdb = {
            is_produced: true,
            tmdb_id: undefined,
            tmdb_title: undefined,
            release_date: undefined,
            status: undefined,
            checked_at: '2025-03-01T00:00:00Z',
            confidence: 'low' as const,
        };
        const raw = createMockV9Raw({ tmdb_status: partialTmdb });
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.tmdbStatus).not.toBeNull();
        expect(result.tmdbStatus!.isProduced).toBe(true);
        expect(result.tmdbStatus!.tmdbId).toBeUndefined();
        expect(result.tmdbStatus!.tmdbTitle).toBeUndefined();
        expect(result.tmdbStatus!.confidence).toBe('low');
    });
});


// ============================================
// isArchaeologyAnalysis
// ============================================

describe('isArchaeologyAnalysis', () => {
    it('returns true for v7_archaeology', () => {
        expect(isArchaeologyAnalysis(createMockV9Raw({ analysis_version: 'v7_archaeology' }))).toBe(true);
    });

    it('returns true for v8_archaeology', () => {
        expect(isArchaeologyAnalysis(createMockV9Raw({ analysis_version: 'v8_archaeology' }))).toBe(true);
    });

    it('returns true for v9_archaeology', () => {
        expect(isArchaeologyAnalysis(createMockV9Raw())).toBe(true);
    });

    it('returns true for v7_triage', () => {
        expect(isArchaeologyAnalysis(createMockTriageRaw('v7_triage'))).toBe(true);
    });

    it('returns true for v8_triage', () => {
        expect(isArchaeologyAnalysis(createMockTriageRaw('v8_triage'))).toBe(true);
    });

    it('returns true for v9_triage', () => {
        expect(isArchaeologyAnalysis(createMockTriageRaw('v9_triage'))).toBe(true);
    });

    it('returns true for plain v7 (legacy browser path)', () => {
        expect(isArchaeologyAnalysis(createMockV9Raw({ analysis_version: 'v7' }))).toBe(true);
    });

    it('rejects a version-only document that would become a blank zero-score card', () => {
        expect(isArchaeologyAnalysis({ analysis_version: 'v9_archaeology' })).toBe(false);
    });

    it('rejects archaeology output with a missing pillar score', () => {
        const raw = createMockV9Raw();
        const analysis = raw.analysis as Record<string, unknown>;
        const pillars = analysis.pillar_scores as Record<string, unknown>;
        delete pillars.structure;
        expect(isArchaeologyAnalysis(raw)).toBe(false);
    });

    it('accepts a genuine zero score when all required values are present', () => {
        const raw = createMockV9Raw();
        const analysis = raw.analysis as Record<string, unknown>;
        analysis.weighted_score = 0;
        const pillars = analysis.pillar_scores as Record<string, { score: number }>;
        Object.values(pillars).forEach((pillar) => { pillar.score = 0; });
        expect(isArchaeologyAnalysis(raw)).toBe(true);
    });

    it('returns false for v6_unified', () => {
        expect(isArchaeologyAnalysis({ analysis_version: 'v6_unified' })).toBe(false);
    });

    it('returns false for v5', () => {
        expect(isArchaeologyAnalysis({ analysis_version: 'v5' })).toBe(false);
    });

    it('returns false for no analysis_version field', () => {
        expect(isArchaeologyAnalysis({ title: 'Some doc' })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isArchaeologyAnalysis(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isArchaeologyAnalysis(undefined)).toBe(false);
    });

    it('returns false for non-object values', () => {
        expect(isArchaeologyAnalysis('v9_archaeology')).toBe(false);
        expect(isArchaeologyAnalysis(42)).toBe(false);
    });
});


describe('normalizeV9Screenplay', () => {
    it('normalizes a V9 archaeology fixture with all 5 pillar scores', () => {
        const raw = createMockV9Raw();
        const result = normalizeV9Screenplay(raw, 'Analysis');

        // Basic fields
        expect(result.title).toBe('Moonrise Kingdom');
        expect(result.author).toBe('Wes Anderson');
        expect(result.genre).toBe('Drama');
        expect(result.logline).toContain('twelve-year-olds');
        expect(result.analysisVersion).toBe('v9_archaeology');
    });

    it('correctly maps 5-pillar scores to legacy 7-dimension format', () => {
        const raw = createMockV9Raw();
        const result = normalizeV9Screenplay(raw, 'Analysis');

        // concept pillar → dimensionScores.concept
        expect(result.dimensionScores.concept).toBe(8.8);
        // structure pillar → dimensionScores.structure
        expect(result.dimensionScores.structure).toBe(7.5);
        // character pillar → dimensionScores.protagonist
        expect(result.dimensionScores.protagonist).toBe(8.2);
        // character * 0.9 → supportingCast
        expect(result.dimensionScores.supportingCast).toBeCloseTo(8.2 * 0.9);
        // craft_scene pillar → dimensionScores.dialogue
        expect(result.dimensionScores.dialogue).toBe(9.0);
        // concept pillar → genreExecution
        expect(result.dimensionScores.genreExecution).toBe(8.8);
        // emotional_resonance → originality
        expect(result.dimensionScores.originality).toBe(8.5);
        // weighted_score
        expect(result.dimensionScores.weightedScore).toBe(8.35);
    });

    it('preserves weighted score from analysis', () => {
        const raw = createMockV9Raw();
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.weightedScore).toBe(8.35);
    });

    it('maps recommendation from verdict field', () => {
        const raw = createMockV9Raw();
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.recommendation).toBe('recommend');
        expect(result.isFilmNow).toBe(false);
    });

    it('sets isFilmNow true for FILM NOW verdict', () => {
        const raw = createMockV9Raw();
        (raw.analysis as Record<string, unknown>).verdict = 'FILM NOW';
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.recommendation).toBe('film_now');
        expect(result.isFilmNow).toBe(true);
        expect(result.filmNowAssessment).not.toBeNull();
        expect(result.filmNowAssessment!.qualifies).toBe(true);
    });

    it('sets category from collection_id (BLACK_LIST → BLACK_LIST pass-through)', () => {
        const raw = createMockV9Raw({ collection_id: 'BLACK_LIST' });
        const result = normalizeV9Screenplay(raw, 'Analysis');
        // collectionToCategoryId is called with collection_id as both args,
        // so existingCategory = 'BLACK_LIST' and it returns immediately
        expect(result.category).toBe('BLACK_LIST');
    });

    it('normalizes tmdb_status when present on V9 data', () => {
        const raw = createMockV9Raw({
            tmdb_status: {
                is_produced: true,
                tmdb_id: 77777,
                tmdb_title: 'Moonrise Kingdom',
                release_date: '2012-06-29',
                status: 'Released',
                checked_at: '2025-12-01T00:00:00Z',
                confidence: 'high',
            },
        });
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.tmdbStatus).not.toBeNull();
        expect(result.tmdbStatus!.isProduced).toBe(true);
        expect(result.tmdbStatus!.tmdbId).toBe(77777);
    });

    it('sets tmdbStatus to null when not present on V9 data', () => {
        const raw = createMockV9Raw();
        delete raw.tmdb_status;
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.tmdbStatus).toBeNull();
    });

    it('preserves pillarScores array for native display', () => {
        const raw = createMockV9Raw();
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.pillarScores).toBeDefined();
        expect(result.pillarScores).toHaveLength(5);

        const pillarNames = result.pillarScores!.map((p) => p.name).sort();
        expect(pillarNames).toEqual(['character', 'concept', 'craft_scene', 'emotional_resonance', 'structure']);
    });

    it('preserves goosebumpsMomentDetails', () => {
        const raw = createMockV9Raw();
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.goosebumpsMomentDetails).toHaveLength(2);
        expect(result.goosebumpsMomentDetails![0].page).toBe(42);
        expect(result.goosebumpsMomentDetails![0].description).toContain('cove dance');
    });

    it('preserves storyVsSituation', () => {
        const raw = createMockV9Raw();
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.storyVsSituation).toBeDefined();
        expect(result.storyVsSituation!.score).toBe(8);
        expect(result.storyVsSituation!.gate_applied).toBe(false);
    });

    it('preserves executiveSummary', () => {
        const raw = createMockV9Raw();
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.executiveSummary).toContain('beautifully crafted');
    });

    it('maps comparable_films from object format to array', () => {
        const raw = createMockV9Raw();
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.comparableFilms).toHaveLength(2);
        expect(result.comparableFilms[0].title).toBe('The Royal Tenenbaums');
        expect(result.comparableFilms[1].title).toBe('Stand by Me');
    });

    it('builds commercial viability from lenses block', () => {
        const raw = createMockV9Raw();
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.commercialViability.cvsAssessed).toBe(true);
        expect(result.commercialViability.targetAudience.score).toBe(2);
        expect(result.commercialViability.castAttachability.score).toBe(3);
        // cvsTotal is the sum of all scores
        expect(result.commercialViability.cvsTotal).toBe(2 + 1 + 3 + 2 + 3 + 3);
    });

    it('cleans up "unknown" author names from synthesis', () => {
        const raw = createMockV9Raw();
        (raw.analysis as Record<string, unknown>).author = 'Author not found';
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.author).toBe('');
    });
});


// ============================================
// Edge cases: Missing data
// ============================================

describe('Edge cases — missing data', () => {
    it('handles missing pillar scores without crashing', () => {
        const raw = createMockV9Raw();
        // Remove pillar_scores and weighted_score entirely
        delete (raw.analysis as Record<string, unknown>).pillar_scores;
        delete (raw.analysis as Record<string, unknown>).weighted_score;
        const result = normalizeV9Screenplay(raw, 'Analysis');

        // All pillar-derived scores should default to 0
        expect(result.dimensionScores.concept).toBe(0);
        expect(result.dimensionScores.structure).toBe(0);
        expect(result.dimensionScores.protagonist).toBe(0);
        expect(result.dimensionScores.dialogue).toBe(0);
        expect(result.dimensionScores.originality).toBe(0);
        // weighted_score at the analysis level also removed → 0
        expect(result.dimensionScores.weightedScore).toBe(0);
        expect(result.weightedScore).toBe(0);
    });

    it('handles partially missing pillar scores', () => {
        const raw = createMockV9Raw();
        // Only structure and concept present
        (raw.analysis as Record<string, unknown>).pillar_scores = {
            structure: { score: 7.0, weight: 0.20 },
            concept: { score: 8.0, weight: 0.20 },
        };
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.dimensionScores.structure).toBe(7.0);
        expect(result.dimensionScores.concept).toBe(8.0);
        // Missing pillars default to 0
        expect(result.dimensionScores.protagonist).toBe(0);
        expect(result.dimensionScores.dialogue).toBe(0);
        expect(result.dimensionScores.originality).toBe(0);
    });

    it('handles missing collection AND collection_id → category should be OTHER', () => {
        const raw = createMockV9Raw();
        delete raw.collection_id;
        delete raw.collection;
        const result = normalizeV9Screenplay(raw, 'Analysis');

        // collectionToCategoryId('', '') → existingCategory = '' (falsy) → mapping logic → '' returns 'OTHER'
        expect(result.category).toBe('OTHER');
    });

    it('handles missing analysis block gracefully', () => {
        const raw = createMockV9Raw();
        delete raw.analysis;
        // Should not throw
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.title).toBe('');
        expect(result.weightedScore).toBe(0);
    });

    it('handles missing metadata block gracefully', () => {
        const raw = createMockV9Raw();
        delete raw.metadata;
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.metadata.pageCount).toBe(0);
        expect(result.metadata.wordCount).toBe(0);
    });

    it('handles missing goosebumps_moments gracefully', () => {
        const raw = createMockV9Raw();
        delete (raw.analysis as Record<string, unknown>).goosebumps_moments;
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.goosebumpsMomentDetails).toEqual([]);
    });

    it('handles missing comparable_films gracefully', () => {
        const raw = createMockV9Raw();
        delete (raw.analysis as Record<string, unknown>).comparable_films;
        const result = normalizeV9Screenplay(raw, 'Analysis');
        expect(result.comparableFilms).toEqual([]);
    });

    it('defaults to cvsAssessed: false when no lenses block present', () => {
        const raw = createMockV9Raw();
        delete (raw.analysis as Record<string, unknown>).lenses;
        const result = normalizeV9Screenplay(raw, 'Analysis');

        expect(result.commercialViability.cvsAssessed).toBe(false);
        expect(result.commercialViability.cvsTotal).toBe(0);
    });
});
