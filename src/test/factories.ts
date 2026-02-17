/**
 * Shared Test Factories
 * Provides type-complete mock objects for all test files.
 * Update THIS file when the Screenplay interface changes.
 */

import type { Screenplay } from '@/types';

/**
 * Creates a fully type-complete Screenplay mock.
 * Every required field is populated — override only what your test cares about.
 */
export function createTestScreenplay(overrides: Partial<Screenplay> = {}): Screenplay {
    return {
        id: 'test-id',
        title: 'Test Screenplay',
        author: 'Test Author',
        logline: 'A gripping tale that tests our components.',
        genre: 'Drama',
        subgenres: ['Indie'],
        themes: ['Identity', 'Family'],
        tone: 'Atmospheric',
        collection: '2020 Black List',
        sourceFile: 'test.pdf',
        analysisModel: 'gemini-2.0-flash',
        analysisVersion: 'v5',
        weightedScore: 7.5,
        cvsTotal: 12,
        recommendation: 'recommend',
        recommendationRationale: 'Strong execution with clear market potential.',
        verdictStatement: 'A solid screenplay with potential.',
        isFilmNow: false,
        filmNowAssessment: null,
        marketability: 'medium',
        budgetCategory: 'low',
        budgetJustification: 'Single location, small cast.',
        dimensionScores: {
            concept: 7,
            structure: 7,
            protagonist: 8,
            supportingCast: 7,
            dialogue: 6,
            genreExecution: 7,
            originality: 8,
            weightedScore: 7.5,
        },
        dimensionJustifications: {
            concept: 'Original premise with strong hook.',
            structure: 'Well-paced three-act structure.',
            protagonist: 'Complex, compelling lead character.',
            supportingCast: 'Solid ensemble cast.',
            dialogue: 'Natural and character-specific.',
            genreExecution: 'Meets genre expectations well.',
            originality: 'Fresh take on familiar territory.',
        },
        commercialViability: {
            targetAudience: { score: 2, note: 'Good audience' },
            highConcept: { score: 2, note: 'Solid concept' },
            castAttachability: { score: 2, note: 'Castable' },
            marketingHook: { score: 2, note: 'Has hook' },
            budgetReturnRatio: { score: 2, note: 'Good ratio' },
            comparableSuccess: { score: 2, note: 'Has comps' },
            cvsTotal: 12,
            cvsAssessed: true,
        },
        producerMetrics: {
            marketPotential: 7,
            productionRisk: 'Medium',
            starVehiclePotential: 8,
            festivalAppeal: 7,
            roiIndicator: 4,
            uspStrength: 'Moderate',
        },
        criticalFailures: [],
        criticalFailureDetails: [],
        criticalFailureTotalPenalty: 0,
        majorWeaknesses: [],
        strengths: ['Strong characters', 'Unique voice'],
        weaknesses: ['Pacing issues'],
        developmentNotes: ['Polish dialogue'],
        characters: {
            protagonist: 'Jane',
            antagonist: 'Mr. Black',
            supporting: ['Ally', 'Mentor'],
        },
        structureAnalysis: {
            formatQuality: 'professional',
            actBreaks: 'Classic three-act',
            pacing: 'Tight',
        },
        comparableFilms: [
            { title: 'Film A', similarity: 'Tone', boxOfficeRelevance: 'success' },
        ],
        standoutScenes: [
            { scene: 'Opening sequence', why: 'Sets tone perfectly' },
        ],
        targetAudience: {
            primaryDemographic: '25-45 M/F',
            genderSkew: 'neutral',
            interests: ['character dramas'],
        },
        metadata: {
            filename: 'test.pdf',
            pageCount: 110,
            wordCount: 20000,
        },
        tmdbStatus: null,
        ...overrides,
    } as Screenplay;
}
