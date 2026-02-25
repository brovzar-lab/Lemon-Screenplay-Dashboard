/**
 * Unit Tests for Data Normalization
 * Tests the core data pipeline: raw JSON → normalized Screenplay objects
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeScreenplay,
    normalizeScreenplays,
    isV6RawAnalysis,
    smartNormalizeScreenplay,
} from './normalize';
import type { RawScreenplayAnalysis } from '@/types';

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

// ─── normalizeScreenplay ────────────────────────────────────

describe('normalizeScreenplay', () => {
    it('normalizes a complete raw analysis to a Screenplay object', () => {
        const raw = createMockRawAnalysis();
        const result = normalizeScreenplay(raw, '2020 Black List');

        expect(result.title).toBe('Test Script');
        expect(result.author).toBe('Jane Doe');
        expect(result.genre).toBe('Thriller');
        expect(result.collection).toBe('2020 Black List');
        expect(result.recommendation).toBe('recommend');
        expect(result.isFilmNow).toBe(false);
        expect(result.weightedScore).toBe(7.8);
        expect(result.cvsTotal).toBe(14);
    });

    it('generates a URL-safe ID from source filename', () => {
        const raw = createMockRawAnalysis({ source_file: 'My Cool Script_analysis_v5.json' });
        const result = normalizeScreenplay(raw, '2020 Black List');

        expect(result.id).toMatch(/^[a-z0-9-]+$/);
        expect(result.id).not.toContain('_analysis_v5');
        expect(result.id).not.toContain('.json');
    });

    it('normalizes dimension scores to numbers', () => {
        const raw = createMockRawAnalysis();
        const result = normalizeScreenplay(raw, '2020 Black List');

        expect(result.dimensionScores.concept).toBe(8);
        expect(result.dimensionScores.protagonist).toBe(9);
        expect(typeof result.dimensionScores.weightedScore).toBe('number');
    });

    it('normalizes CVS factors correctly', () => {
        const raw = createMockRawAnalysis();
        const result = normalizeScreenplay(raw, '2020 Black List');

        expect(result.commercialViability.cvsTotal).toBe(14);
        expect(result.commercialViability.targetAudience.score).toBe(3);
        expect(result.commercialViability.cvsAssessed).toBe(true);
    });

    it('handles string cvs_total by parsing it', () => {
        const raw = createMockRawAnalysis();
        (raw as any).analysis.commercial_viability.cvs_total = '16';
        const result = normalizeScreenplay(raw, '2020 Black List');

        expect(result.cvsTotal).toBe(16);
    });

    it('initializes producer metrics as null (pending AI analysis)', () => {
        const raw = createMockRawAnalysis();
        const result = normalizeScreenplay(raw, '2020 Black List');

        expect(result.producerMetrics).toBeDefined();
        expect(result.producerMetrics.marketPotential).toBeNull();
        expect(result.producerMetrics.marketPotentialRationale).toBeNull();
        expect(result.producerMetrics.uspStrength).toBeNull();
        expect(result.producerMetrics.uspStrengthRationale).toBeNull();
    });

    it('normalizes critical failures from string array format', () => {
        const raw = createMockRawAnalysis();
        (raw as any).analysis.critical_failures = ['Plot hole in act 2', 'Protagonist has no arc'];
        const result = normalizeScreenplay(raw, '2020 Black List');

        expect(result.criticalFailures).toHaveLength(2);
        expect(result.criticalFailures[0]).toBe('Plot hole in act 2');
        expect(result.criticalFailureDetails).toHaveLength(2);
        expect(result.criticalFailureDetails[0].severity).toBe('major');
    });

    it('normalizes critical failures from detailed V6 format', () => {
        const raw = createMockRawAnalysis();
        (raw as any).analysis.critical_failures = [
            { failure: 'Broken causality', severity: 'critical', penalty: -1.5, evidence: 'Act 3' },
        ];
        const result = normalizeScreenplay(raw, '2020 Black List');

        expect(result.criticalFailures).toEqual(['Broken causality']);
        expect(result.criticalFailureDetails[0].severity).toBe('critical');
        expect(result.criticalFailureDetails[0].penalty).toBe(-1.5);
    });

    it('handles empty critical failures', () => {
        const raw = createMockRawAnalysis();
        (raw as any).analysis.critical_failures = [];
        const result = normalizeScreenplay(raw, '2020 Black List');

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
        (raw as any).analysis.assessment.recommendation = input;
        const result = normalizeScreenplay(raw, '2020 Black List');
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
        (raw as any).analysis.budget_tier.category = input;
        const result = normalizeScreenplay(raw, '2020 Black List');
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
        const results = normalizeScreenplays(raws, 'Randoms');

        expect(results).toHaveLength(2);
        expect(results[0].id).not.toBe(results[1].id);
        expect(results[0].collection).toBe('Randoms');
    });

    it('returns empty array for empty input', () => {
        const results = normalizeScreenplays([], '2020 Black List');
        expect(results).toEqual([]);
    });
});

// ─── V6 detection ──────────────────────────────────────────

describe('isV6RawAnalysis', () => {
    it('returns true for v6_core_lenses version', () => {
        expect(isV6RawAnalysis({ analysis_version: 'v6_core_lenses' })).toBe(true);
    });

    it('returns true for v6_unified version', () => {
        expect(isV6RawAnalysis({ analysis_version: 'v6_unified' })).toBe(true);
    });

    it('returns false for v5', () => {
        expect(isV6RawAnalysis({ analysis_version: 'v5' })).toBe(false);
    });

    it('returns false for null/undefined', () => {
        expect(isV6RawAnalysis(null)).toBe(false);
        expect(isV6RawAnalysis(undefined)).toBe(false);
    });

    it('returns false for non-objects', () => {
        expect(isV6RawAnalysis('string')).toBe(false);
        expect(isV6RawAnalysis(42)).toBe(false);
    });
});

// ─── smartNormalizeScreenplay ───────────────────────────────

describe('smartNormalizeScreenplay', () => {
    it('delegates to normalizeScreenplay for V5 data', () => {
        const raw = createMockRawAnalysis({ analysis_version: 'v5' });
        const result = smartNormalizeScreenplay(raw, '2020 Black List');

        expect(result.title).toBe('Test Script');
        expect(result.recommendation).toBe('recommend');
    });
});
