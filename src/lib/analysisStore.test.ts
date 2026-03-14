/**
 * analysisStore.test.ts
 *
 * Tests that all Firestore call paths in analysisStore.ts await authReady
 * before making any Firestore SDK calls. localStorage operations must NOT
 * be gated by authReady.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Track call order to verify authReady resolves before Firestore calls
const callOrder: string[] = [];

// authReady mock — a real promise that records when it resolves
let resolveAuthReady: () => void;
let authReadyPromise: Promise<void>;

function resetAuthReady() {
    authReadyPromise = new Promise<void>((resolve) => {
        resolveAuthReady = () => {
            callOrder.push('authReady:resolved');
            resolve();
        };
    });
}

// Mock firebase module
vi.mock('./firebase', () => ({
    get authReady() {
        return authReadyPromise;
    },
    db: {} as unknown,
}));

// Mock firebase/firestore SDK
const mockGetDocs = vi.fn().mockImplementation(() => {
    callOrder.push('getDocs');
    return Promise.resolve({ docs: [], size: 0 });
});
const mockSetDoc = vi.fn().mockImplementation(() => {
    callOrder.push('setDoc');
    return Promise.resolve();
});
const mockDeleteDoc = vi.fn().mockImplementation(() => {
    callOrder.push('deleteDoc');
    return Promise.resolve();
});
const mockGetCountFromServer = vi.fn().mockImplementation(() => {
    callOrder.push('getCountFromServer');
    return Promise.resolve({ data: () => ({ count: 5 }) });
});
const mockUpdateDoc = vi.fn().mockImplementation(() => {
    callOrder.push('updateDoc');
    return Promise.resolve();
});
const mockDeleteFieldSentinel = Symbol('deleteField');
const mockDeleteField = vi.fn(() => mockDeleteFieldSentinel);

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => 'mock-collection-ref'),
    doc: vi.fn(() => 'mock-doc-ref'),
    query: vi.fn((ref: unknown) => ref),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    deleteField: () => mockDeleteField(),
}));

// Mock localStorage
const localStore: Record<string, string> = {};
const mockLocalStorage = {
    getItem: vi.fn((key: string) => localStore[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { localStore[key] = val; }),
    removeItem: vi.fn((key: string) => { delete localStore[key]; }),
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('analysisStore authReady gates', () => {
    beforeEach(() => {
        callOrder.length = 0;
        mockGetDocs.mockClear();
        mockSetDoc.mockClear();
        mockDeleteDoc.mockClear();
        mockUpdateDoc.mockClear();
        mockDeleteField.mockClear();
        mockGetCountFromServer.mockClear();
        mockLocalStorage.getItem.mockClear();
        mockLocalStorage.setItem.mockClear();
        mockLocalStorage.removeItem.mockClear();
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        resetAuthReady();

        // Reset the module-level _bgSyncDone flag by re-importing
        vi.resetModules();
    });

    it('backgroundFirestoreSync awaits authReady before calling getDocs', async () => {
        // Must re-import after vi.resetModules to get fresh module state
        const { loadAllAnalyses } = await import('./analysisStore');

        // loadAllAnalyses triggers backgroundFirestoreSync via setTimeout
        vi.useFakeTimers();
        await loadAllAnalyses();

        // Advance timer to trigger background sync
        vi.advanceTimersByTime(3000);
        vi.useRealTimers();

        // At this point, authReady hasn't resolved — getDocs should NOT have been called
        await new Promise((r) => setTimeout(r, 50));
        expect(callOrder).not.toContain('getDocs');

        // Now resolve authReady
        resolveAuthReady();
        await authReadyPromise;
        // Let microtasks flush
        await new Promise((r) => setTimeout(r, 50));

        // getDocs should now have been called, and authReady resolved first
        const authIdx = callOrder.indexOf('authReady:resolved');
        const getDocsIdx = callOrder.indexOf('getDocs');
        expect(authIdx).toBeGreaterThanOrEqual(0);
        expect(getDocsIdx).toBeGreaterThan(authIdx);
    });

    it('saveAnalysis awaits authReady before calling setDoc', async () => {
        const { saveAnalysis } = await import('./analysisStore');

        const savePromise = saveAnalysis({ source_file: 'test.pdf', title: 'Test' });

        // localStorage write should have happened immediately
        await new Promise((r) => setTimeout(r, 50));
        expect(mockLocalStorage.setItem).toHaveBeenCalled();

        // But setDoc should NOT have been called (authReady not resolved)
        expect(callOrder).not.toContain('setDoc');

        // Now resolve authReady
        resolveAuthReady();
        await savePromise;

        // setDoc should have been called after authReady
        const authIdx = callOrder.indexOf('authReady:resolved');
        const setDocIdx = callOrder.indexOf('setDoc');
        expect(authIdx).toBeGreaterThanOrEqual(0);
        expect(setDocIdx).toBeGreaterThan(authIdx);
    });

    it('removeAnalysis (soft-delete) awaits authReady before calling updateDoc', async () => {
        const { removeAnalysis } = await import('./analysisStore');

        const removePromise = removeAnalysis('test.pdf');

        // Wait for microtasks
        await new Promise((r) => setTimeout(r, 50));

        // updateDoc should NOT have been called yet
        expect(callOrder).not.toContain('updateDoc');

        // Resolve authReady
        resolveAuthReady();
        await removePromise;

        // updateDoc should come after authReady
        const authIdx = callOrder.indexOf('authReady:resolved');
        const updateIdx = callOrder.indexOf('updateDoc');
        expect(authIdx).toBeGreaterThanOrEqual(0);
        expect(updateIdx).toBeGreaterThan(authIdx);
    });

    it('clearAllAnalyses (soft-delete) awaits authReady before calling getDocs/updateDoc', async () => {
        const { clearAllAnalyses } = await import('./analysisStore');

        // Seed localStorage with data so soft-delete has items to mark
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'a.pdf' },
            { source_file: 'b.pdf' },
        ]);

        // Mock getDocs to return docs so updateDoc gets called
        mockGetDocs.mockImplementationOnce(() => {
            callOrder.push('getDocs');
            return Promise.resolve({
                docs: [
                    { ref: 'mock-ref-a', data: () => ({ source_file: 'a.pdf' }) },
                    { ref: 'mock-ref-b', data: () => ({ source_file: 'b.pdf' }) },
                ],
                size: 2,
            });
        });

        const clearPromise = clearAllAnalyses();

        // Wait for microtasks
        await new Promise((r) => setTimeout(r, 50));

        // getDocs should NOT have been called yet
        expect(callOrder).not.toContain('getDocs');

        // Resolve authReady
        resolveAuthReady();
        await clearPromise;

        // getDocs should come after authReady
        const authIdx = callOrder.indexOf('authReady:resolved');
        const getDocsIdx = callOrder.indexOf('getDocs');
        expect(authIdx).toBeGreaterThanOrEqual(0);
        expect(getDocsIdx).toBeGreaterThan(authIdx);
    });
});

describe('getPendingWriteCount', () => {
    beforeEach(() => {
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        vi.resetModules();
    });

    it('returns 0 when PENDING_QUEUE_KEY is absent from localStorage', async () => {
        const { getPendingWriteCount } = await import('./analysisStore');
        expect(getPendingWriteCount()).toBe(0);
    });

    it('returns 0 when PENDING_QUEUE_KEY contains invalid JSON', async () => {
        const { getPendingWriteCount } = await import('./analysisStore');
        localStore['lemon-pending-writes'] = 'not-valid-json{{{';
        expect(getPendingWriteCount()).toBe(0);
    });

    it('returns N when PENDING_QUEUE_KEY contains a JSON array of N items', async () => {
        const { getPendingWriteCount } = await import('./analysisStore');
        localStore['lemon-pending-writes'] = JSON.stringify([
            { source_file: 'a.pdf' },
            { source_file: 'b.pdf' },
            { source_file: 'c.pdf' },
        ]);
        expect(getPendingWriteCount()).toBe(3);
    });

    it('returns 0 when PENDING_QUEUE_KEY contains a non-array JSON value', async () => {
        const { getPendingWriteCount } = await import('./analysisStore');
        localStore['lemon-pending-writes'] = JSON.stringify({ not: 'an array' });
        expect(getPendingWriteCount()).toBe(0);
    });
});

describe('flushPendingWrites export', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('is exported and callable externally', async () => {
        const { flushPendingWrites } = await import('./analysisStore');
        expect(typeof flushPendingWrites).toBe('function');
    });
});

// ─── Soft-delete, restore, quarantine tests ─────────────────────────────────

describe('softDeleteAnalysis', () => {
    beforeEach(() => {
        callOrder.length = 0;
        mockUpdateDoc.mockClear();
        mockDeleteField.mockClear();
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        resetAuthReady();
        vi.resetModules();
    });

    it('sets _deleted_at on the matching localStorage entry', async () => {
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'keep.pdf', title: 'Keep' },
            { source_file: 'delete-me.pdf', title: 'Delete Me' },
        ]);

        const { softDeleteAnalysis } = await import('./analysisStore');
        resolveAuthReady();
        await softDeleteAnalysis('delete-me.pdf');

        const stored = JSON.parse(localStore['lemon-local-analyses']);
        const deleted = stored.find((a: Record<string, unknown>) => a.source_file === 'delete-me.pdf');
        const kept = stored.find((a: Record<string, unknown>) => a.source_file === 'keep.pdf');
        expect(deleted._deleted_at).toBeDefined();
        expect(typeof deleted._deleted_at).toBe('string');
        expect(kept._deleted_at).toBeUndefined();
    });

    it('calls updateDoc on Firestore with _deleted_at', async () => {
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'test.pdf' },
        ]);

        const { softDeleteAnalysis } = await import('./analysisStore');
        resolveAuthReady();
        await softDeleteAnalysis('test.pdf');

        expect(mockUpdateDoc).toHaveBeenCalled();
    });
});

describe('loadAllAnalyses filters soft-deleted items', () => {
    beforeEach(() => {
        callOrder.length = 0;
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        resetAuthReady();
        vi.resetModules();
    });

    it('excludes items with _deleted_at from the return value', async () => {
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'visible.pdf', title: 'Visible' },
            { source_file: 'hidden.pdf', title: 'Hidden', _deleted_at: '2026-03-10T00:00:00Z' },
        ]);

        const { loadAllAnalyses } = await import('./analysisStore');
        vi.useFakeTimers();
        const result = await loadAllAnalyses();
        vi.useRealTimers();

        expect(result).toHaveLength(1);
        expect(result[0].source_file).toBe('visible.pdf');
    });
});

describe('restoreAnalysis', () => {
    beforeEach(() => {
        callOrder.length = 0;
        mockUpdateDoc.mockClear();
        mockDeleteField.mockClear();
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        resetAuthReady();
        vi.resetModules();
    });

    it('removes _deleted_at from localStorage and calls updateDoc with deleteField()', async () => {
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'restore-me.pdf', title: 'Restore', _deleted_at: '2026-03-10T00:00:00Z' },
        ]);

        const { restoreAnalysis } = await import('./analysisStore');
        resolveAuthReady();
        await restoreAnalysis('restore-me.pdf');

        const stored = JSON.parse(localStore['lemon-local-analyses']);
        const restored = stored.find((a: Record<string, unknown>) => a.source_file === 'restore-me.pdf');
        expect(restored._deleted_at).toBeUndefined();
        expect(mockUpdateDoc).toHaveBeenCalled();
    });
});

describe('getDeletedAnalyses', () => {
    beforeEach(() => {
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        vi.resetModules();
    });

    it('returns items deleted within last 30 days', async () => {
        const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'active.pdf', title: 'Active' },
            { source_file: 'recent-del.pdf', title: 'Recent Del', _deleted_at: recentDate },
        ]);

        const { getDeletedAnalyses } = await import('./analysisStore');
        const result = getDeletedAnalyses();

        expect(result).toHaveLength(1);
        expect(result[0].source_file).toBe('recent-del.pdf');
    });

    it('excludes items deleted more than 30 days ago', async () => {
        const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(); // 45 days ago
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'old-del.pdf', title: 'Old Del', _deleted_at: oldDate },
        ]);

        const { getDeletedAnalyses } = await import('./analysisStore');
        const result = getDeletedAnalyses();

        expect(result).toHaveLength(0);
    });
});

describe('quarantineAnalysis', () => {
    beforeEach(() => {
        callOrder.length = 0;
        mockSetDoc.mockClear();
        mockDeleteDoc.mockClear();
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        resetAuthReady();
        vi.resetModules();
    });

    it('calls setDoc on _unrecognized_analyses and deleteDoc on source collection', async () => {
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'bad.pdf', title: 'Bad' },
        ]);

        const { quarantineAnalysis } = await import('./analysisStore');
        resolveAuthReady();
        await quarantineAnalysis({ source_file: 'bad.pdf', title: 'Bad' }, 'failed type guard');

        expect(mockSetDoc).toHaveBeenCalled();
        expect(mockDeleteDoc).toHaveBeenCalled();

        // Should also remove from localStorage
        const stored = JSON.parse(localStore['lemon-local-analyses']);
        expect(stored.find((a: Record<string, unknown>) => a.source_file === 'bad.pdf')).toBeUndefined();
    });
});

describe('backgroundFirestoreSync preserves _deleted_at', () => {
    beforeEach(() => {
        callOrder.length = 0;
        mockGetDocs.mockClear();
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        resetAuthReady();
        vi.resetModules();
    });

    it('preserves _deleted_at field in synced data (does not strip it)', async () => {
        const deletedAt = '2026-03-10T00:00:00Z';

        // Mock Firestore to return a doc with _deleted_at, _savedAt, and _docId
        mockGetDocs.mockImplementationOnce(() => {
            callOrder.push('getDocs');
            return Promise.resolve({
                docs: [
                    {
                        data: () => ({
                            source_file: 'soft-del.pdf',
                            title: 'Soft Deleted',
                            _deleted_at: deletedAt,
                            _savedAt: '2026-03-09T00:00:00Z',
                            _docId: 'soft-del_pdf',
                        }),
                    },
                ],
                size: 1,
            });
        });

        const { loadAllAnalyses } = await import('./analysisStore');

        resolveAuthReady();
        vi.useFakeTimers();
        await loadAllAnalyses();

        // Advance timer to trigger background sync
        vi.advanceTimersByTime(3000);
        vi.useRealTimers();

        // Wait for sync to complete
        await new Promise((r) => setTimeout(r, 200));

        // Check localStorage — _deleted_at should be preserved, _savedAt/_docId stripped
        const stored = JSON.parse(localStore['lemon-local-analyses']);
        const entry = stored.find((a: Record<string, unknown>) => a.source_file === 'soft-del.pdf');
        expect(entry).toBeDefined();
        expect(entry._deleted_at).toBe(deletedAt);
        expect(entry._savedAt).toBeUndefined();
        expect(entry._docId).toBeUndefined();
    });
});
