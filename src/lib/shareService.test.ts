/**
 * shareService.test.ts
 *
 * Tests for the share token Firestore CRUD operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Mock firebase
vi.mock('./firebase', () => ({
    authReady: Promise.resolve({ uid: 'test-user' }),
    db: {},
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
} from './shareService';
import type { SharedView } from './shareService';

describe('shareService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('createShareToken', () => {
        it('writes a doc with correct shape and returns token + url', async () => {
            const result = await createShareToken('sp-001', 'My Screenplay', false);

            expect(result.token).toBe('test-uuid-1234-5678-9abc-def012345678');
            expect(result.url).toContain('/share/test-uuid-1234-5678-9abc-def012345678');

            expect(mockSetDoc).toHaveBeenCalledOnce();
            const [, docData] = mockSetDoc.mock.calls[0];
            expect(docData.token).toBe('test-uuid-1234-5678-9abc-def012345678');
            expect(docData.screenplayId).toBe('sp-001');
            expect(docData.screenplayTitle).toBe('My Screenplay');
            expect(docData.includeNotes).toBe(false);
            expect(docData.createdAt).toBeDefined();
        });

        it('includes notes when includeNotes is true', async () => {
            await createShareToken('sp-002', 'Another Script', true);

            const [, docData] = mockSetDoc.mock.calls[0];
            expect(docData.includeNotes).toBe(true);
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
