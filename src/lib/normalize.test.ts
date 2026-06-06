/**
 * Unit Tests for Data Normalization
 * Tests the core data pipeline: raw JSON → normalized Screenplay objects
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeScreenplay,
    normalizeScreenplays,
    smartNormalizeScreenplay,
    collectionToCategoryId,
    isV7RawAnalysis,
    normalizeV7Screenplay,
    isV6UnifiedAnalysis,
} from './normalize';
import type { RawScreenplayAnalysis, RawTmdbStatus } from '@/types';

// ─── Factories ──────────────────────────────────────────────

function createMockRawAnalysis(
    overrides: Record<string, unknown> = {}
): RawScreenplayAnalysis {
    return {
        source_file: 'Test_Script.pdf',
        analysis_model: 'gemini-2.0-flash',
        analysis_version: 'v5',
        analysis: {
            title: 'Test Script',
            author: 'Jane Doe',
            genre: 'Thriller',
            subgenres: ['Crime', 'Noir'],
            themes: ['Justice', 'Corruption'],
            logline: 'A detective discovers the city council is secretly running a crime ring.',
            tone: 'Dark and atmospheric',
            assessment: {
                recommendation: 'recommend',
                recommendation_rationale: 'Strong execution with commercial appeal.',
                strengths: ['Tight pacing', 'Complex characters'],
                weaknesses: ['Predictable third act'],
                development_notes: ['Strengthen the antagonist arc'],
                marketability: 'high',
            },
            verdict_statement: 'A compelling thriller worth pursuing.',
            dimension_scores: {
                concept: { score: 8, justification: 'Original premise' },
                structure: { score: 7, justification: 'Well-structured' },
                protagonist: { score: 9, justification: 'Deeply compelling lead' },
                supporting_cast: { score: 7, justification: 'Solid ensemble' },
                dialogue: { score: 8, justification: 'Sharp and authentic' },
                genre_execution: { score: 7, justification: 'Genre-savvy' },
                originality: { score: 8, justification: 'Fresh take on noir' },
                weighted_score: 7.8,
            },
            commercial_viability: {
                target_audience: { score: 3, note: 'Wide appeal' },
                high_concept: { score: 2, note: 'Solid hook' },
                cast_attachability: { score: 3, note: 'A-list bait' },
                marketing_hook: { score: 2, note: 'Good trailer moments' },
                budget_return_ratio: { score: 2, note: 'Reasonable budget' },
                comparable_success: { score: 2, note: 'Similar to Zodiac' },
                cvs_total: 14,
            },
            budget_tier: {
                category: 'medium ($30-60M)',
                justification: 'Urban locations, no VFX',
            },
            critical_failures: [],
            critical_failure_total_penalty: 0,
            film_now_assessment: {
                qualifies: false,
                lightning_test: 'Good but not exceptional',
                goosebumps_moments: ['Act 2 reveal'],
                career_risk_test: 'Low risk',
                legacy_potential: 'Moderate',
                disqualifying_factors: [],
            },
            characters: {
                protagonist: 'Det. Sarah Chen',
                antagonist: 'Mayor Blackwood',
                supporting: ['Officer Ray', 'Journalist Kim'],
            },
            structure_analysis: {
                format_quality: 'professional',
                act_breaks: 'Classic three-act with midpoint reversal',
                pacing: 'Tight',
            },
            comparable_films: [
                { title: 'Zodiac', similarity: 'Investigative tension', box_office_relevance: 'success' },
            ],
            standout_scenes: [
                { scene: 'The warehouse confrontation', why: 'Peak dramatic tension' },
            ],
            target_audience: {
                primary_demographic: '25-45 M/F',
                gender_skew: 'neutral',
                interests: ['true crime', 'political thrillers'],
            },
            major_weaknesses: [],
        },
        metadata: {
            filename: 'Test_Script.pdf',
            page_count: 115,
            word_count: 22000,
        },
        ...overrides,
    } as unknown as RawScreenplayAnalysis;
}

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

// ─── normalizeScreenplay ────────────────────────────────────

describe('normalizeScreenplay', () => {
    it('normalizes a complete raw analysis to a Screenplay object', () => {
        const raw = createMockRawAnalysis();
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.title).toBe('Test Script');
        expect(result.author).toBe('Jane Doe');
        expect(result.genre).toBe('Thriller');
        expect(result.collection).toBe('Analysis');
        expect(result.recommendation).toBe('recommend');
        expect(result.isFilmNow).toBe(false);
        expect(result.weightedScore).toBe(7.8);
        expect(result.cvsTotal).toBe(14);
    });

    it('generates a URL-safe ID from source filename', () => {
        const raw = createMockRawAnalysis({ source_file: 'My Cool Script_analysis_v5.json' });
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.id).toMatch(/^[a-z0-9-]+$/);
        expect(result.id).not.toContain('_analysis_v5');
        expect(result.id).not.toContain('.json');
    });

    it('normalizes dimension scores to numbers', () => {
        const raw = createMockRawAnalysis();
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.dimensionScores.concept).toBe(8);
        expect(result.dimensionScores.protagonist).toBe(9);
        expect(typeof result.dimensionScores.weightedScore).toBe('number');
    });

    it('normalizes CVS factors correctly', () => {
        const raw = createMockRawAnalysis();
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.commercialViability.cvsTotal).toBe(14);
        expect(result.commercialViability.targetAudience.score).toBe(3);
        expect(result.commercialViability.cvsAssessed).toBe(true);
    });

    it('handles string cvs_total by parsing it', () => {
        const raw = createMockRawAnalysis();
        (raw as unknown as Record<string, { commercial_viability: { cvs_total: string } }>).analysis.commercial_viability.cvs_total = '16';
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.cvsTotal).toBe(16);
    });

    it('initializes producer metrics as null (pending AI analysis)', () => {
        const raw = createMockRawAnalysis();
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.producerMetrics).toBeDefined();
        expect(result.producerMetrics.marketPotential).toBeNull();
        expect(result.producerMetrics.marketPotentialRationale).toBeNull();
        expect(result.producerMetrics.uspStrength).toBeNull();
        expect(result.producerMetrics.uspStrengthRationale).toBeNull();
    });

    it('normalizes critical failures from string array format', () => {
        const raw = createMockRawAnalysis();
        (raw as unknown as Record<string, { critical_failures: string[] }>).analysis.critical_failures = ['Plot hole in act 2', 'Protagonist has no arc'];
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.criticalFailures).toHaveLength(2);
        expect(result.criticalFailures[0]).toBe('Plot hole in act 2');
        expect(result.criticalFailureDetails).toHaveLength(2);
        expect(result.criticalFailureDetails[0].severity).toBe('major');
    });

    it('normalizes critical failures from detailed V6 format', () => {
        const raw = createMockRawAnalysis();
        (raw as unknown as Record<string, { critical_failures: { failure: string; severity: string; penalty: number; evidence: string }[] }>).analysis.critical_failures = [
            { failure: 'Broken causality', severity: 'critical', penalty: -1.5, evidence: 'Act 3' },
        ];
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.criticalFailures).toEqual(['Broken causality']);
        expect(result.criticalFailureDetails[0].severity).toBe('critical');
        expect(result.criticalFailureDetails[0].penalty).toBe(-1.5);
    });

    it('handles empty critical failures', () => {
        const raw = createMockRawAnalysis();
        (raw as unknown as Record<string, { critical_failures: never[] }>).analysis.critical_failures = [];
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.criticalFailures).toEqual([]);
        expect(result.criticalFailureTotalPenalty).toBe(0);
    });
});

describe('normalizeRecommendation (via normalizeScreenplay)', () => {
    it.each([
        ['FILM NOW', 'film_now'],
        ['Film_Now', 'film_now'],
        ['film-now', 'film_now'],
        ['RECOMMEND', 'recommend'],
        ['Recommend', 'recommend'],
        ['CONSIDER', 'consider'],
        ['consider', 'consider'],
        ['PASS', 'pass'],
        ['pass', 'pass'],
        ['unknown_value', 'pass'], // fallback
    ])('maps "%s" → "%s"', (input, expected) => {
        const raw = createMockRawAnalysis();
        (raw as unknown as Record<string, { assessment: { recommendation: string } }>).analysis.assessment.recommendation = input;
        const result = normalizeScreenplay(raw, 'Analysis');
        expect(result.recommendation).toBe(expected);
    });
});

describe('extractBudgetCategory (via normalizeScreenplay)', () => {
    it.each([
        ['micro ($0-5M)', 'micro'],
        ['low ($5-15M)', 'low'],
        ['medium ($15-50M)', 'medium'],
        ['mid-budget', 'medium'],
        ['high ($50M+)', 'high'],
        ['HIGH', 'high'],
    ])('maps "%s" → "%s"', (input, expected) => {
        const raw = createMockRawAnalysis();
        (raw as unknown as Record<string, { budget_tier: { category: string } }>).analysis.budget_tier.category = input;
        const result = normalizeScreenplay(raw, 'Analysis');
        expect(result.budgetCategory).toBe(expected);
    });
});

// ─── normalizeScreenplays (batch) ───────────────────────────

describe('normalizeScreenplays', () => {
    it('normalizes an array of screenplays', () => {
        const raws = [
            createMockRawAnalysis({ source_file: 'Script_A.pdf' }),
            createMockRawAnalysis({ source_file: 'Script_B.pdf' }),
        ];
        const results = normalizeScreenplays(raws, 'Analysis');

        expect(results).toHaveLength(2);
        expect(results[0].id).not.toBe(results[1].id);
        expect(results[0].collection).toBe('Analysis');
    });

    it('returns empty array for empty input', () => {
        const results = normalizeScreenplays([], 'Analysis');
        expect(results).toEqual([]);
    });
});

// ─── smartNormalizeScreenplay ───────────────────────────────

describe('smartNormalizeScreenplay', () => {
    it('delegates to normalizeScreenplay for V5 data', () => {
        const raw = createMockRawAnalysis({ analysis_version: 'v5' });
        const result = smartNormalizeScreenplay(raw, 'Analysis');

        expect(result.title).toBe('Test Script');
        expect(result.recommendation).toBe('recommend');
    });

    it('delegates to normalizeV7Screenplay for V9 data', () => {
        const raw = createMockV9Raw();
        const result = smartNormalizeScreenplay(raw as unknown as RawScreenplayAnalysis, 'Analysis');

        expect(result.title).toBe('Moonrise Kingdom');
        expect(result.recommendation).toBe('recommend');
    });

    it('delegates to normalizeV6UnifiedScreenplay for v6_unified data', () => {
        const raw = createMockRawAnalysis({ analysis_version: 'v6_unified' });
        // v6_unified needs a different shape — just verify routing doesn't crash
        const minimalV6: Record<string, unknown> = {
            source_file: 'V6_Script.pdf',
            analysis_version: 'v6_unified',
            analysis_model: 'claude-sonnet',
            metadata: { filename: 'V6_Script.pdf', page_count: 90, word_count: 18000 },
            analysis: {
                title: 'V6 Script',
                author: 'Author V6',
                genre: 'Comedy',
                core_quality: { weighted_score: 6.5, verdict: 'CONSIDER' },
                lenses: {},
            },
        };
        const result = smartNormalizeScreenplay(minimalV6 as unknown as RawScreenplayAnalysis, 'Analysis');
        expect(result.title).toBe('V6 Script');
    });
});


// ============================================
// collectionToCategoryId
// ============================================

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
// normalizeTmdbStatus (via normalizeScreenplay)
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
        const raw = createMockRawAnalysis({ tmdb_status: tmdb });
        const result = normalizeScreenplay(raw, 'Analysis');

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
        const raw = createMockRawAnalysis({ tmdb_status: tmdb });
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.tmdbStatus).not.toBeNull();
        expect(result.tmdbStatus!.isProduced).toBe(false);
        expect(result.tmdbStatus!.tmdbId).toBeNull();
        expect(result.tmdbStatus!.tmdbTitle).toBeNull();
        expect(result.tmdbStatus!.releaseDate).toBeNull();
        expect(result.tmdbStatus!.confidence).toBe('medium');
    });

    it('returns null for undefined tmdb_status', () => {
        const raw = createMockRawAnalysis();
        // No tmdb_status set on the mock
        const result = normalizeScreenplay(raw, 'Analysis');
        expect(result.tmdbStatus).toBeNull();
    });

    it('returns null when tmdb_status is explicitly undefined', () => {
        const raw = createMockRawAnalysis({ tmdb_status: undefined });
        const result = normalizeScreenplay(raw, 'Analysis');
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
        const raw = createMockRawAnalysis({ tmdb_status: partialTmdb });
        const result = normalizeScreenplay(raw, 'Analysis');

        expect(result.tmdbStatus).not.toBeNull();
        expect(result.tmdbStatus!.isProduced).toBe(true);
        expect(result.tmdbStatus!.tmdbId).toBeUndefined();
        expect(result.tmdbStatus!.tmdbTitle).toBeUndefined();
        expect(result.tmdbStatus!.confidence).toBe('low');
    });
});


// ============================================
// isV7RawAnalysis
// ============================================

describe('isV7RawAnalysis', () => {
    it('returns true for v7_archaeology', () => {
        expect(isV7RawAnalysis({ analysis_version: 'v7_archaeology' })).toBe(true);
    });

    it('returns true for v8_archaeology', () => {
        expect(isV7RawAnalysis({ analysis_version: 'v8_archaeology' })).toBe(true);
    });

    it('returns true for v9_archaeology', () => {
        expect(isV7RawAnalysis({ analysis_version: 'v9_archaeology' })).toBe(true);
    });

    it('returns true for v7_triage', () => {
        expect(isV7RawAnalysis({ analysis_version: 'v7_triage' })).toBe(true);
    });

    it('returns true for v8_triage', () => {
        expect(isV7RawAnalysis({ analysis_version: 'v8_triage' })).toBe(true);
    });

    it('returns true for v9_triage', () => {
        expect(isV7RawAnalysis({ analysis_version: 'v9_triage' })).toBe(true);
    });

    it('returns true for plain v7 (legacy browser path)', () => {
        expect(isV7RawAnalysis({ analysis_version: 'v7' })).toBe(true);
    });

    it('returns false for v6_unified', () => {
        expect(isV7RawAnalysis({ analysis_version: 'v6_unified' })).toBe(false);
    });

    it('returns false for v5', () => {
        expect(isV7RawAnalysis({ analysis_version: 'v5' })).toBe(false);
    });

    it('returns false for no analysis_version field', () => {
        expect(isV7RawAnalysis({ title: 'Some doc' })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isV7RawAnalysis(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isV7RawAnalysis(undefined)).toBe(false);
    });

    it('returns false for non-object values', () => {
        expect(isV7RawAnalysis('v9_archaeology')).toBe(false);
        expect(isV7RawAnalysis(42)).toBe(false);
    });
});

describe('isV6UnifiedAnalysis', () => {
    it('returns true for v6_unified', () => {
        expect(isV6UnifiedAnalysis({ analysis_version: 'v6_unified' })).toBe(true);
    });

    it('returns false for v9_archaeology', () => {
        expect(isV6UnifiedAnalysis({ analysis_version: 'v9_archaeology' })).toBe(false);
    });

    it('returns false for null/undefined', () => {
        expect(isV6UnifiedAnalysis(null)).toBe(false);
        expect(isV6UnifiedAnalysis(undefined)).toBe(false);
    });
});


// ============================================
// normalizeV7Screenplay (Archaeology Engine V9)
// ============================================

describe('normalizeV7Screenplay', () => {
    it('normalizes a V9 archaeology fixture with all 5 pillar scores', () => {
        const raw = createMockV9Raw();
        const result = normalizeV7Screenplay(raw, 'Analysis');

        // Basic fields
        expect(result.title).toBe('Moonrise Kingdom');
        expect(result.author).toBe('Wes Anderson');
        expect(result.genre).toBe('Drama');
        expect(result.logline).toContain('twelve-year-olds');
        expect(result.analysisVersion).toBe('v9_archaeology');
    });

    it('correctly maps 5-pillar scores to legacy 7-dimension format', () => {
        const raw = createMockV9Raw();
        const result = normalizeV7Screenplay(raw, 'Analysis');

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
        const result = normalizeV7Screenplay(raw, 'Analysis');
        expect(result.weightedScore).toBe(8.35);
    });

    it('maps recommendation from verdict field', () => {
        const raw = createMockV9Raw();
        const result = normalizeV7Screenplay(raw, 'Analysis');
        expect(result.recommendation).toBe('recommend');
        expect(result.isFilmNow).toBe(false);
    });

    it('sets isFilmNow true for FILM NOW verdict', () => {
        const raw = createMockV9Raw();
        (raw.analysis as Record<string, unknown>).verdict = 'FILM NOW';
        const result = normalizeV7Screenplay(raw, 'Analysis');

        expect(result.recommendation).toBe('film_now');
        expect(result.isFilmNow).toBe(true);
        expect(result.filmNowAssessment).not.toBeNull();
        expect(result.filmNowAssessment!.qualifies).toBe(true);
    });

    it('sets category from collection_id (BLACK_LIST → BLACK_LIST pass-through)', () => {
        const raw = createMockV9Raw({ collection_id: 'BLACK_LIST' });
        const result = normalizeV7Screenplay(raw, 'Analysis');
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
        const result = normalizeV7Screenplay(raw, 'Analysis');
        expect(result.tmdbStatus).not.toBeNull();
        expect(result.tmdbStatus!.isProduced).toBe(true);
        expect(result.tmdbStatus!.tmdbId).toBe(77777);
    });

    it('sets tmdbStatus to null when not present on V9 data', () => {
        const raw = createMockV9Raw();
        delete raw.tmdb_status;
        const result = normalizeV7Screenplay(raw, 'Analysis');
        expect(result.tmdbStatus).toBeNull();
    });

    it('preserves v7PillarScores array for native display', () => {
        const raw = createMockV9Raw();
        const result = normalizeV7Screenplay(raw, 'Analysis');

        expect(result.v7PillarScores).toBeDefined();
        expect(result.v7PillarScores).toHaveLength(5);

        const pillarNames = result.v7PillarScores!.map((p) => p.name).sort();
        expect(pillarNames).toEqual(['character', 'concept', 'craft_scene', 'emotional_resonance', 'structure']);
    });

    it('preserves v7GoosebumpsMoments', () => {
        const raw = createMockV9Raw();
        const result = normalizeV7Screenplay(raw, 'Analysis');

        expect(result.v7GoosebumpsMoments).toHaveLength(2);
        expect(result.v7GoosebumpsMoments![0].page).toBe(42);
        expect(result.v7GoosebumpsMoments![0].description).toContain('cove dance');
    });

    it('preserves v7StoryVsSituation', () => {
        const raw = createMockV9Raw();
        const result = normalizeV7Screenplay(raw, 'Analysis');

        expect(result.v7StoryVsSituation).toBeDefined();
        expect(result.v7StoryVsSituation!.score).toBe(8);
        expect(result.v7StoryVsSituation!.gate_applied).toBe(false);
    });

    it('preserves v7ExecutiveSummary', () => {
        const raw = createMockV9Raw();
        const result = normalizeV7Screenplay(raw, 'Analysis');
        expect(result.v7ExecutiveSummary).toContain('beautifully crafted');
    });

    it('maps comparable_films from object format to array', () => {
        const raw = createMockV9Raw();
        const result = normalizeV7Screenplay(raw, 'Analysis');

        expect(result.comparableFilms).toHaveLength(2);
        expect(result.comparableFilms[0].title).toBe('The Royal Tenenbaums');
        expect(result.comparableFilms[1].title).toBe('Stand by Me');
    });

    it('builds commercial viability from lenses block', () => {
        const raw = createMockV9Raw();
        const result = normalizeV7Screenplay(raw, 'Analysis');

        expect(result.commercialViability.cvsAssessed).toBe(true);
        expect(result.commercialViability.targetAudience.score).toBe(2);
        expect(result.commercialViability.castAttachability.score).toBe(3);
        // cvsTotal is the sum of all scores
        expect(result.commercialViability.cvsTotal).toBe(2 + 1 + 3 + 2 + 3 + 3);
    });

    it('cleans up "unknown" author names from synthesis', () => {
        const raw = createMockV9Raw();
        (raw.analysis as Record<string, unknown>).author = 'Author not found';
        const result = normalizeV7Screenplay(raw, 'Analysis');
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
        const result = normalizeV7Screenplay(raw, 'Analysis');

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
        const result = normalizeV7Screenplay(raw, 'Analysis');

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
        const result = normalizeV7Screenplay(raw, 'Analysis');

        // collectionToCategoryId('', '') → existingCategory = '' (falsy) → mapping logic → '' returns 'OTHER'
        expect(result.category).toBe('OTHER');
    });

    it('handles missing analysis block gracefully', () => {
        const raw = createMockV9Raw();
        delete raw.analysis;
        // Should not throw
        const result = normalizeV7Screenplay(raw, 'Analysis');
        expect(result.title).toBe('');
        expect(result.weightedScore).toBe(0);
    });

    it('handles missing metadata block gracefully', () => {
        const raw = createMockV9Raw();
        delete raw.metadata;
        const result = normalizeV7Screenplay(raw, 'Analysis');
        expect(result.metadata.pageCount).toBe(0);
        expect(result.metadata.wordCount).toBe(0);
    });

    it('handles missing goosebumps_moments gracefully', () => {
        const raw = createMockV9Raw();
        delete (raw.analysis as Record<string, unknown>).goosebumps_moments;
        const result = normalizeV7Screenplay(raw, 'Analysis');
        expect(result.v7GoosebumpsMoments).toEqual([]);
    });

    it('handles missing comparable_films gracefully', () => {
        const raw = createMockV9Raw();
        delete (raw.analysis as Record<string, unknown>).comparable_films;
        const result = normalizeV7Screenplay(raw, 'Analysis');
        expect(result.comparableFilms).toEqual([]);
    });

    it('defaults to cvsAssessed: false when no lenses block present', () => {
        const raw = createMockV9Raw();
        delete (raw.analysis as Record<string, unknown>).lenses;
        const result = normalizeV7Screenplay(raw, 'Analysis');

        expect(result.commercialViability.cvsAssessed).toBe(false);
        expect(result.commercialViability.cvsTotal).toBe(0);
    });
});
