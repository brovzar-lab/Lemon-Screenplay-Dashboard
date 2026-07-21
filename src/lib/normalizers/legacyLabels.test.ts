/**
 * Regression guard: legacy analysis_version labels.
 *
 * Production Firestore still holds v8_archaeology documents (16 of 23 at the
 * 2026-07-21 census — scripts/census-analysis-versions.mjs). The normalizer
 * MUST keep accepting them, or those screenplays vanish from the dashboard.
 * If a future cleanup removes v8/v7 from the accept-list without a data
 * migration, this file is the tripwire.
 */

import { describe, it, expect } from 'vitest';
import { isArchaeologyAnalysis, normalizeV9Screenplay } from './normalizeV9';

function pillar(score: number) {
    return { score, evidence: 'solid work throughout', confidence: 'high' };
}

function archaeologyDoc(analysisVersion: string): Record<string, unknown> {
    return {
        source_file: 'GUARD_TEST.pdf',
        analysis_version: analysisVersion,
        collection: 'BLACK_LIST',
        analysis: {
            title: 'Guard Test',
            verdict: 'RECOMMEND',
            weighted_score: 7.5,
            logline: 'A tripwire test keeps old screenplays visible.',
            pillar_scores: {
                structure: pillar(7),
                character: pillar(8),
                craft_scene: pillar(7),
                concept: pillar(8),
                emotional_resonance: pillar(7),
            },
        },
    };
}

describe('legacy analysis_version acceptance', () => {
    it.each(['v9_archaeology', 'v8_archaeology', 'v7_archaeology'])(
        'accepts %s (5-pillar shape is identical across engine versions)',
        (version) => {
            expect(isArchaeologyAnalysis(archaeologyDoc(version))).toBe(true);
        },
    );

    it('accepts v9_triage stubs (triage_score gate)', () => {
        const doc = archaeologyDoc('v9_triage');
        (doc.analysis as Record<string, unknown>).triage_score = 6;
        expect(isArchaeologyAnalysis(doc)).toBe(true);
    });

    it('rejects unknown versions and malformed docs', () => {
        expect(isArchaeologyAnalysis(archaeologyDoc('v10_quantum'))).toBe(false);
        expect(isArchaeologyAnalysis({ analysis_version: 'v9_archaeology' })).toBe(false);
        expect(isArchaeologyAnalysis(null)).toBe(false);
    });

    it('normalizes a production-shaped v8_archaeology doc to a renderable screenplay', () => {
        const sp = normalizeV9Screenplay(archaeologyDoc('v8_archaeology'), 'BLACK_LIST');
        expect(sp.title).toBe('Guard Test');
        expect(sp.weightedScore).toBe(7.5);
        expect(sp.recommendation).toBe('recommend');
        const withPillars = sp as typeof sp & { pillarScores?: unknown[] };
        expect(withPillars.pillarScores).toHaveLength(5);
    });
});
