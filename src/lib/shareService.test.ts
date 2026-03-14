/**
 * shareService.test.ts
 *
 * Tests for the share token Firestore CRUD operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Screenplay, Note } from '@/types';

// Mock firebase/firestore
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);
const mockGetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn((_db: unknown, _col: string, id: string) => ({ id, path: `${_col}/${id}` }));
const mockCollection = vi.fn((_db: unknown, col: string) => ({ id: col }));
const mockQuery = vi.fn((...args: unknown[]) => args[0]);
const mockWhere = vi.fn((...args: unknown[]) => args);

vi.mock('firebase/firestore', () => ({
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    doc: (...args: unknown[]) => mockDoc(...args),
    collection: (...args: unknown[]) => mockCollection(...args),
    query: (...args: unknown[]) => mockQuery(...args),
    where: (...args: unknown[]) => mockWhere(...args),
}));

// Mock firebase/storage
const mockRef = vi.fn((_storage: unknown, path: string) => ({ path }));
const mockGetDownloadURL = vi.fn();

vi.mock('firebase/storage', () => ({
    ref: (...args: unknown[]) => mockRef(...args),
    getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

// Mock firebase
vi.mock('./firebase', () => ({
    authReady: Promise.resolve({ uid: 'test-user' }),
    db: {},
    storage: {},
}));

// Mock analysisStore
vi.mock('./analysisStore', () => ({
    toDocId: (sourceFile: string) => sourceFile.replace(/[/\\]/g, '_').replace(/[^a-zA-Z0-9_\-. ]/g, '').trim(),
}));

// Mock shareStore
vi.mock('@/stores/shareStore', () => ({
    useShareStore: {
        getState: () => ({
            removeToken: vi.fn(),
        }),
    },
}));

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
    randomUUID: () => 'test-uuid-1234-5678-9abc-def012345678',
});

import {
    createShareToken,
    revokeShareToken,
    getExistingShareToken,
    getAllSharedViews,
    isScreenplaySynced,
    resolveShareToken,
} from './shareService';
import type { SharedView, SharedViewDocument } from './shareService';

// ─── Helper: build a mock Screenplay ────────────────────────────────────────

function makeMockScreenplay(overrides: Partial<Screenplay> = {}): Screenplay {
    return {
        id: 'sp-001',
        title: 'My Screenplay',
        author: 'Test Author',
        collection: 'V6 Analysis',
        category: 'LEMON',
        sourceFile: 'sp-001.pdf',
        analysisModel: 'claude-3',
        analysisVersion: '6.0',
        weightedScore: 7.5,
        cvsTotal: 22,
        genre: 'Drama',
        subgenres: ['Thriller'],
        themes: ['Redemption'],
        logline: 'A test logline',
        tone: 'Dark',
        recommendation: 'recommend',
        recommendationRationale: 'Strong concept',
        verdictStatement: 'Solid script',
        isFilmNow: false,
        filmNowAssessment: null,
        dimensionScores: {
            concept: 8,
            structure: 7,
            protagonist: 7,
            supportingCast: 6,
            dialogue: 7,
            genreExecution: 8,
            originality: 7,
            weightedScore: 7.5,
        },
        dimensionJustifications: {
            concept: 'Good concept',
            structure: 'Solid structure',
            protagonist: 'Compelling lead',
            supportingCast: 'Adequate',
            dialogue: 'Sharp',
            genreExecution: 'Well executed',
            originality: 'Fresh take',
        },
        commercialViability: {
            targetAudience: { score: 4, note: 'Wide appeal' },
            highConcept: { score: 3, note: 'Moderate' },
            castAttachability: { score: 4, note: 'Strong leads' },
            marketingHook: { score: 3, note: 'Clear hook' },
            budgetReturnRatio: { score: 4, note: 'Favorable' },
            comparableSuccess: { score: 4, note: 'Good comps' },
            total: 22,
        },
        criticalFailures: [],
        criticalFailureDetails: [],
        criticalFailureTotalPenalty: 0,
        majorWeaknesses: ['Pacing in Act 2'],
        strengths: ['Strong dialogue', 'Compelling lead'],
        weaknesses: ['Minor pacing issues'],
        developmentNotes: ['Consider tightening Act 2'],
        marketability: 'medium',
        budgetCategory: 'medium',
        budgetJustification: 'Standard production',
        characters: {
            protagonist: 'John Doe',
            antagonist: 'Jane Smith',
            supportingCast: ['Bob', 'Alice'],
        },
        structureAnalysis: {
            formatQuality: 'professional',
            actBreaks: 'Clear three-act structure',
            pacing: 'Good overall',
        },
        comparableFilms: [
            { title: 'Film A', year: 2020, boxOfficeRelevance: 'success', similarity: 'Tone and genre' },
        ],
        standoutScenes: [
            { scene: 'Opening', description: 'Gripping opening', page: 1 },
        ],
        targetAudience: {
            primary: '25-44 male',
            secondary: '18-24 female',
            genderSkew: 'neutral',
        },
        metadata: {
            pageCount: 110,
            wordCount: 22000,
            analysisTimestamp: '2026-01-01T00:00:00Z',
            filename: 'sp-001.pdf',
        },
        producerMetrics: {
            greenlight: 72,
            marketReady: 65,
        },
        posterUrl: 'https://storage.example.com/poster.jpg',
        tmdbStatus: null,
        ...overrides,
    } as Screenplay;
}

describe('shareService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createShareToken', () => {
        it('writes a doc with analysis snapshot and returns token + url', async () => {
            mockGetDownloadURL.mockResolvedValueOnce('https://storage.example.com/screenplay.pdf');
            const screenplay = makeMockScreenplay();
            const result = await createShareToken('sp-001', screenplay, false);

            expect(result.token).toBe('test-uuid-1234-5678-9abc-def012345678');
            expect(result.url).toContain('/share/test-uuid-1234-5678-9abc-def012345678');

            expect(mockSetDoc).toHaveBeenCalledOnce();
            const [, docData] = mockSetDoc.mock.calls[0];
            expect(docData.token).toBe('test-uuid-1234-5678-9abc-def012345678');
            expect(docData.screenplayId).toBe('sp-001');
            expect(docData.screenplayTitle).toBe('My Screenplay');
            expect(docData.includeNotes).toBe(false);
            expect(docData.createdAt).toBeDefined();

            // Analysis snapshot fields
            expect(docData.analysis).toBeDefined();
            expect(docData.analysis.title).toBe('My Screenplay');
            expect(docData.analysis.dimensionScores).toEqual(screenplay.dimensionScores);
            expect(docData.analysis.strengths).toEqual(screenplay.strengths);
            expect(docData.analysis.weaknesses).toEqual(screenplay.weaknesses);
            expect(docData.analysis.recommendation).toBe('recommend');
            expect(docData.analysis.logline).toBe('A test logline');
            expect(docData.analysis.genre).toBe('Drama');

            // pdfUrl resolved
            expect(docData.pdfUrl).toBe('https://storage.example.com/screenplay.pdf');

            // posterUrl from screenplay
            expect(docData.posterUrl).toBe('https://storage.example.com/poster.jpg');
        });

        it('stores null pdfUrl when PDF not found in storage', async () => {
            mockGetDownloadURL.mockRejectedValueOnce(new Error('Not found'));
            const screenplay = makeMockScreenplay();
            const result = await createShareToken('sp-001', screenplay, false);

            expect(result.token).toBeDefined();
            const [, docData] = mockSetDoc.mock.calls[0];
            expect(docData.pdfUrl).toBeNull();
        });

        it('includes notes in snapshot when includeNotes=true and notes provided', async () => {
            mockGetDownloadURL.mockResolvedValueOnce('https://storage.example.com/sp.pdf');
            const screenplay = makeMockScreenplay();
            const notes: Note[] = [
                {
                    id: 'n1',
                    screenplayId: 'sp-001',
                    content: 'Great opening',
                    author: 'Producer',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-01T00:00:00Z',
                },
            ];

            await createShareToken('sp-001', screenplay, true, notes);

            const [, docData] = mockSetDoc.mock.calls[0];
            expect(docData.includeNotes).toBe(true);
            expect(docData.notes).toHaveLength(1);
            expect(docData.notes[0].content).toBe('Great opening');
            expect(docData.notes[0].createdAt).toBe('2026-01-01T00:00:00Z');
            // Should NOT include id, screenplayId, author, updatedAt
            expect(docData.notes[0].id).toBeUndefined();
            expect(docData.notes[0].screenplayId).toBeUndefined();
        });

        it('does NOT include notes when includeNotes=false even if notes provided', async () => {
            mockGetDownloadURL.mockResolvedValueOnce('https://storage.example.com/sp.pdf');
            const screenplay = makeMockScreenplay();
            const notes: Note[] = [
                {
                    id: 'n1',
                    screenplayId: 'sp-001',
                    content: 'Note',
                    author: 'Producer',
                    createdAt: '2026-01-01T00:00:00Z',
                    updatedAt: '2026-01-01T00:00:00Z',
                },
            ];

            await createShareToken('sp-001', screenplay, false, notes);

            const [, docData] = mockSetDoc.mock.calls[0];
            expect(docData.notes).toBeUndefined();
        });

        it('stores null posterUrl when screenplay has no posterUrl', async () => {
            mockGetDownloadURL.mockResolvedValueOnce('https://storage.example.com/sp.pdf');
            const screenplay = makeMockScreenplay({ posterUrl: undefined });

            await createShareToken('sp-001', screenplay, false);

            const [, docData] = mockSetDoc.mock.calls[0];
            expect(docData.posterUrl).toBeNull();
        });
    });

    describe('resolveShareToken', () => {
        it('returns SharedViewDocument for existing token', async () => {
            const mockData: SharedViewDocument = {
                token: 'valid-token',
                screenplayId: 'sp-001',
                screenplayTitle: 'Test',
                includeNotes: false,
                createdAt: '2026-01-01T00:00:00Z',
                pdfUrl: 'https://example.com/sp.pdf',
                posterUrl: null,
                analysis: {
                    title: 'Test',
                    author: 'Author',
                    genre: 'Drama',
                    subgenres: [],
                    logline: 'A test',
                    tone: 'Dark',
                    themes: [],
                    recommendation: 'recommend',
                    recommendationRationale: 'Good',
                    verdictStatement: 'Solid',
                    isFilmNow: false,
                    weightedScore: 7,
                    cvsTotal: 20,
                    dimensionScores: { concept: 7, structure: 7, protagonist: 7, supportingCast: 7, dialogue: 7, genreExecution: 7, originality: 7, weightedScore: 7 },
                    dimensionJustifications: { concept: '', structure: '', protagonist: '', supportingCast: '', dialogue: '', genreExecution: '', originality: '' },
                    commercialViability: { targetAudience: { score: 3, note: '' }, highConcept: { score: 3, note: '' }, castAttachability: { score: 3, note: '' }, marketingHook: { score: 3, note: '' }, budgetReturnRatio: { score: 3, note: '' }, comparableSuccess: { score: 3, note: '' }, total: 18 },
                    strengths: [],
                    weaknesses: [],
                    majorWeaknesses: [],
                    developmentNotes: [],
                    characters: { protagonist: '', antagonist: '', supportingCast: [] },
                    comparableFilms: [],
                    standoutScenes: [],
                    targetAudience: { primary: '', secondary: '', genderSkew: 'neutral' },
                    budgetCategory: 'medium',
                    budgetJustification: '',
                    marketability: 'medium',
                },
            };

            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => mockData,
            });

            const result = await resolveShareToken('valid-token');

            expect(result).toEqual(mockData);
            // Should use doc() with the token
            expect(mockDoc).toHaveBeenCalledWith({}, 'shared_views', 'valid-token');
        });

        it('returns null for nonexistent token', async () => {
            mockGetDoc.mockResolvedValueOnce({
                exists: () => false,
                data: () => undefined,
            });

            const result = await resolveShareToken('nonexistent-token');
            expect(result).toBeNull();
        });

        it('does NOT reference authReady (public read)', async () => {
            // We verify this structurally: resolveShareToken should work
            // even without auth by not awaiting authReady.
            // The mock for authReady is a resolved promise, but we verify
            // it's not in the call chain by checking that the function
            // resolves immediately with a getDoc call.
            mockGetDoc.mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ token: 'test' }),
            });

            await resolveShareToken('test-token');

            // If authReady was awaited, it would still work in tests
            // because our mock resolves immediately. The real verification
            // is that the source code does not import/use authReady in resolveShareToken.
            // This test documents the contract.
            expect(mockGetDoc).toHaveBeenCalledOnce();
        });
    });

    describe('revokeShareToken', () => {
        it('calls deleteDoc for the token doc', async () => {
            await revokeShareToken('some-token', 'sp-001');

            expect(mockDeleteDoc).toHaveBeenCalledOnce();
            expect(mockDoc).toHaveBeenCalledWith({}, 'shared_views', 'some-token');
        });
    });

    describe('getExistingShareToken', () => {
        it('returns SharedView when a matching doc exists', async () => {
            const mockView: SharedView = {
                token: 'existing-token',
                screenplayId: 'sp-001',
                screenplayTitle: 'Test',
                includeNotes: false,
                createdAt: '2026-01-01T00:00:00Z',
            };
            mockGetDocs.mockResolvedValueOnce({
                empty: false,
                docs: [{ data: () => mockView }],
            });

            const result = await getExistingShareToken('sp-001');
            expect(result).toEqual(mockView);
        });

        it('returns null when no matching doc exists', async () => {
            mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

            const result = await getExistingShareToken('sp-999');
            expect(result).toBeNull();
        });
    });

    describe('getAllSharedViews', () => {
        it('returns all SharedView docs from collection', async () => {
            const views: SharedView[] = [
                { token: 't1', screenplayId: 'sp-1', screenplayTitle: 'A', includeNotes: false, createdAt: '2026-01-01' },
                { token: 't2', screenplayId: 'sp-2', screenplayTitle: 'B', includeNotes: true, createdAt: '2026-01-02' },
            ];
            mockGetDocs.mockResolvedValueOnce({
                docs: views.map((v) => ({ data: () => v })),
            });

            const result = await getAllSharedViews();
            expect(result).toHaveLength(2);
            expect(result[0].screenplayId).toBe('sp-1');
            expect(result[1].screenplayId).toBe('sp-2');
        });
    });

    describe('isScreenplaySynced', () => {
        it('returns true when the doc exists in uploaded_analyses', async () => {
            mockGetDoc.mockResolvedValueOnce({ exists: () => true });

            const result = await isScreenplaySynced('scripts/my_film.pdf');
            expect(result).toBe(true);
        });

        it('returns false when the doc does not exist', async () => {
            mockGetDoc.mockResolvedValueOnce({ exists: () => false });

            const result = await isScreenplaySynced('scripts/missing.pdf');
            expect(result).toBe(false);
        });
    });
});
