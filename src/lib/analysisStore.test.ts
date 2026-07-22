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
const mockTransactionSet = vi.fn();
let mockParentSnapshotData: Record<string, unknown> | undefined;
let mockVersionSnapshotData: Record<string, unknown> | undefined;
const mockTransactionGet = vi.fn(async (reference: unknown) => {
    const data =
        reference === 'mock-version-doc-ref' ? mockVersionSnapshotData : mockParentSnapshotData;
    return {
        exists: () => data !== undefined,
        data: () => data,
    };
});
const mockRunTransaction = vi.fn();

class MockTimestamp {
    readonly milliseconds: number;

    private constructor(milliseconds: number) {
        this.milliseconds = milliseconds;
    }

    static fromMillis(milliseconds: number): MockTimestamp {
        return new MockTimestamp(milliseconds);
    }

    toMillis(): number {
        return this.milliseconds;
    }
}

function resetTransactionMock(): void {
    mockParentSnapshotData = undefined;
    mockVersionSnapshotData = undefined;
    mockTransactionGet.mockClear();
    mockTransactionSet.mockClear();
    mockRunTransaction.mockReset();
    mockRunTransaction.mockImplementation(
        async (_db: unknown, update: (tx: unknown) => unknown) => {
            callOrder.push('runTransaction');
            return update({
                get: mockTransactionGet,
                set: mockTransactionSet,
            });
        },
    );
}
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
let snapshotSuccess:
    | ((snapshot: { docs: Array<{ data: () => Record<string, unknown> }> }) => void)
    | undefined;
let snapshotError: ((error: Error) => void) | undefined;
const mockUnsubscribe = vi.fn();
const mockOnSnapshot = vi.fn(
    (
        _query: unknown,
        onSuccess: (snapshot: { docs: Array<{ data: () => Record<string, unknown> }> }) => void,
        onError: (error: Error) => void,
    ) => {
        snapshotSuccess = onSuccess;
        snapshotError = onError;
        return mockUnsubscribe;
    },
);

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => 'mock-collection-ref'),
    doc: vi.fn((...args: unknown[]) =>
        args.includes('versions') ? 'mock-version-doc-ref' : 'mock-doc-ref',
    ),
    query: vi.fn((ref: unknown) => ref),
    where: vi.fn(() => 'mock-where-constraint'),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
    Timestamp: MockTimestamp,
    getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
    updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
    deleteField: () => mockDeleteField(),
    onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
}));

// Mock localStorage
const localStore: Record<string, string> = {};
const mockLocalStorage = {
    getItem: vi.fn((key: string) => localStore[key] ?? null),
    setItem: vi.fn((key: string, val: string) => {
        localStore[key] = val;
    }),
    removeItem: vi.fn((key: string) => {
        delete localStore[key];
    }),
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

const PENDING_QUEUE_KEY = 'lemon-pending-writes';

function seedVersionedPendingWrite({
    sourceFile,
    projectId,
    contentHash,
    queuedAtMs,
    data = {},
}: {
    sourceFile: string;
    projectId: string;
    contentHash: string;
    queuedAtMs: number;
    data?: Record<string, unknown>;
}): string {
    const versionId = `${contentHash}_${queuedAtMs}`;
    localStore[PENDING_QUEUE_KEY] = JSON.stringify([
        {
            kind: 'versioned-set',
            sourceFile,
            projectId,
            versionId,
            queuedAtMs,
            data: {
                source_file: sourceFile,
                project_id: projectId,
                analysis_version: 'v9_archaeology',
                content_hash: contentHash,
                identity_status: 'verified',
                queued_at_ms: queuedAtMs,
                ...data,
            },
        },
    ]);
    return versionId;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('analysisStore authReady gates', () => {
    beforeEach(() => {
        callOrder.length = 0;
        mockGetDocs.mockClear();
        mockSetDoc.mockClear();
        resetTransactionMock();
        mockUpdateDoc.mockClear();
        mockDeleteField.mockClear();
        mockGetCountFromServer.mockClear();
        mockLocalStorage.getItem.mockClear();
        mockLocalStorage.setItem.mockClear();
        mockLocalStorage.removeItem.mockClear();
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        resetAuthReady();

        vi.resetModules();
    });

    it('loadAllAnalyses reads only the startup cache and never calls Firestore', async () => {
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'seed.pdf', title: 'Seed' },
        ]);
        const { loadAllAnalyses } = await import('./analysisStore');

        await expect(loadAllAnalyses()).resolves.toEqual([
            { source_file: 'seed.pdf', title: 'Seed' },
        ]);
        expect(mockGetDocs).not.toHaveBeenCalled();
        expect(callOrder).not.toContain('getDocs');
    });

    it('pending write recovery awaits authReady before calling Firestore', async () => {
        localStore[PENDING_QUEUE_KEY] = JSON.stringify([
            { kind: 'set', sourceFile: 'test.pdf', data: { title: 'Test' } },
        ]);
        const { flushPendingWrites } = await import('./analysisStore');

        const flushPromise = flushPendingWrites();
        await Promise.resolve();
        expect(callOrder).not.toContain('setDoc');

        resolveAuthReady();
        await flushPromise;

        const authIdx = callOrder.indexOf('authReady:resolved');
        const setDocIdx = callOrder.indexOf('setDoc');
        expect(authIdx).toBeGreaterThanOrEqual(0);
        expect(setDocIdx).toBeGreaterThan(authIdx);
    });

    it('atomically creates a typed immutable version and advances its parent', async () => {
        const contentHash = 'ef'.repeat(32);
        const queuedAtMs = 1_784_588_800_123;
        const versionId = `${contentHash}_${queuedAtMs}`;
        seedVersionedPendingWrite({
            sourceFile: 'identified.pdf',
            projectId: 'identified.pdf',
            contentHash,
            queuedAtMs,
        });
        const { flushPendingWrites } = await import('./analysisStore');

        resolveAuthReady();
        await flushPendingWrites();

        expect(mockRunTransaction).toHaveBeenCalledOnce();
        expect(mockTransactionSet).toHaveBeenNthCalledWith(
            1,
            'mock-version-doc-ref',
            expect.objectContaining({
                content_hash: contentHash,
                identity_status: 'verified',
                version_id: versionId,
                version_number: 1,
                created_at: expect.any(MockTimestamp),
            }),
        );
        expect(mockTransactionSet).toHaveBeenNthCalledWith(
            2,
            'mock-doc-ref',
            expect.objectContaining({
                latest_version_id: versionId,
                version_count: 1,
            }),
        );
        const versionDocument = mockTransactionSet.mock.calls[0][1] as Record<string, unknown>;
        expect((versionDocument.created_at as MockTimestamp).toMillis()).toBe(queuedAtMs);
        expect(Number.isInteger(versionDocument.version_number)).toBe(true);
        expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('advances an existing project to version two while preserving its original source name', async () => {
        const contentHash = 'de'.repeat(32);
        const queuedAtMs = 1_784_588_800_789;
        mockParentSnapshotData = {
            source_file: 'Original Draft.pdf',
            version_count: 1,
        };
        seedVersionedPendingWrite({
            sourceFile: 'Completely Renamed Draft.pdf',
            projectId: 'Original_Draft.pdf',
            contentHash,
            queuedAtMs,
        });
        const { flushPendingWrites } = await import('./analysisStore');

        resolveAuthReady();
        await flushPendingWrites();

        expect(mockTransactionSet).toHaveBeenNthCalledWith(
            1,
            'mock-version-doc-ref',
            expect.objectContaining({
                source_file: 'Completely Renamed Draft.pdf',
                project_id: 'Original_Draft.pdf',
                version_number: 2,
            }),
        );
        expect(mockTransactionSet).toHaveBeenNthCalledWith(
            2,
            'mock-doc-ref',
            expect.objectContaining({
                source_file: 'Original Draft.pdf',
                latest_source_file: 'Completely Renamed Draft.pdf',
                project_id: 'Original_Draft.pdf',
                version_count: 2,
            }),
        );
    });

    it('does not advance the parent when the deterministic version already exists', async () => {
        const contentHash = 'ad'.repeat(32);
        const queuedAtMs = 1_784_588_800_999;
        mockParentSnapshotData = { version_count: 1 };
        mockVersionSnapshotData = {
            version_id: `${contentHash}_${queuedAtMs}`,
            version_number: 2,
        };
        seedVersionedPendingWrite({
            sourceFile: 'Retry.pdf',
            projectId: 'Original_Draft.pdf',
            contentHash,
            queuedAtMs,
        });
        const { flushPendingWrites } = await import('./analysisStore');

        resolveAuthReady();
        await flushPendingWrites();

        expect(mockRunTransaction).toHaveBeenCalledOnce();
        expect(mockTransactionSet).not.toHaveBeenCalled();
        expect(JSON.parse(localStore[PENDING_QUEUE_KEY])).toEqual([]);
    });

    it('keeps an invalid version queued instead of persisting it', async () => {
        const contentHash = 'fa'.repeat(32);
        const queuedAtMs = 1_784_588_800_456;
        seedVersionedPendingWrite({
            sourceFile: 'missing-identity.pdf',
            projectId: 'missing-identity.pdf',
            contentHash,
            queuedAtMs,
            data: { identity_status: 'unverified' },
        });
        const { flushPendingWrites } = await import('./analysisStore');

        resolveAuthReady();
        await flushPendingWrites();

        expect(mockRunTransaction).not.toHaveBeenCalled();
        expect(JSON.parse(localStore[PENDING_QUEUE_KEY])).toEqual([
            expect.objectContaining({
                kind: 'versioned-set',
                sourceFile: 'missing-identity.pdf',
                projectId: 'missing-identity.pdf',
                queuedAtMs,
            }),
        ]);
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
        callOrder.length = 0;
        mockSetDoc.mockClear();
        resetTransactionMock();
        mockUpdateDoc.mockClear();
        mockDeleteField.mockClear();
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        resetAuthReady();
        vi.resetModules();
    });

    it('is exported and callable externally', async () => {
        const { flushPendingWrites } = await import('./analysisStore');
        expect(typeof flushPendingWrites).toBe('function');
    });

    it('awaits authReady before retrying queued Firestore writes', async () => {
        localStore['lemon-pending-writes'] = JSON.stringify([{ source_file: 'queued.pdf' }]);
        const { flushPendingWrites } = await import('./analysisStore');

        const flushPromise = flushPendingWrites();
        await Promise.resolve();
        expect(mockSetDoc).not.toHaveBeenCalled();

        resolveAuthReady();
        await flushPromise;

        expect(callOrder.indexOf('setDoc')).toBeGreaterThan(
            callOrder.indexOf('authReady:resolved'),
        );
        expect(JSON.parse(localStore['lemon-pending-writes'])).toEqual([]);
    });

    it('replays queued patches and restores in their original order', async () => {
        localStore['lemon-pending-writes'] = JSON.stringify([
            {
                kind: 'patch',
                sourceFile: 'queued.pdf',
                fields: { category: 'LEMON' },
            },
            { kind: 'restore', sourceFile: 'queued.pdf' },
        ]);
        const { flushPendingWrites } = await import('./analysisStore');

        resolveAuthReady();
        await flushPendingWrites();

        expect(mockUpdateDoc).toHaveBeenNthCalledWith(1, 'mock-doc-ref', {
            category: 'LEMON',
        });
        expect(mockUpdateDoc).toHaveBeenNthCalledWith(2, 'mock-doc-ref', {
            _deleted_at: mockDeleteFieldSentinel,
        });
        expect(JSON.parse(localStore['lemon-pending-writes'])).toEqual([]);
    });
});

describe('patchAnalysisField', () => {
    beforeEach(() => {
        mockUpdateDoc.mockClear();
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        resetAuthReady();
        vi.resetModules();
    });

    it('keeps the local edit and queues it when Firestore is unavailable', async () => {
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'test.pdf', category: 'OTHER' },
        ]);
        mockUpdateDoc.mockRejectedValueOnce(new Error('offline'));
        const { patchAnalysisField } = await import('./analysisStore');

        resolveAuthReady();
        await patchAnalysisField('test.pdf', 'category', 'LEMON');

        expect(JSON.parse(localStore['lemon-local-analyses'])[0].category).toBe('LEMON');
        expect(JSON.parse(localStore['lemon-pending-writes'])).toEqual([
            {
                kind: 'patch',
                sourceFile: 'test.pdf',
                fields: { category: 'LEMON' },
            },
        ]);
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
        const deleted = stored.find(
            (a: Record<string, unknown>) => a.source_file === 'delete-me.pdf',
        );
        const kept = stored.find((a: Record<string, unknown>) => a.source_file === 'keep.pdf');
        expect(deleted._deleted_at).toBeDefined();
        expect(typeof deleted._deleted_at).toBe('string');
        expect(kept._deleted_at).toBeUndefined();
    });

    it('calls updateDoc on Firestore with _deleted_at', async () => {
        localStore['lemon-local-analyses'] = JSON.stringify([{ source_file: 'test.pdf' }]);

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
            {
                source_file: 'restore-me.pdf',
                title: 'Restore',
                _deleted_at: '2026-03-10T00:00:00Z',
            },
        ]);

        const { restoreAnalysis } = await import('./analysisStore');
        resolveAuthReady();
        await restoreAnalysis('restore-me.pdf');

        const stored = JSON.parse(localStore['lemon-local-analyses']);
        const restored = stored.find(
            (a: Record<string, unknown>) => a.source_file === 'restore-me.pdf',
        );
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
        mockUpdateDoc.mockClear();
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        resetAuthReady();
        vi.resetModules();
    });

    it('marks the source document as quarantined without deleting it', async () => {
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'bad.pdf', title: 'Bad' },
        ]);

        const { quarantineAnalysis } = await import('./analysisStore');
        resolveAuthReady();
        await quarantineAnalysis({ source_file: 'bad.pdf', title: 'Bad' }, 'failed type guard');

        expect(mockUpdateDoc).toHaveBeenCalledWith(
            'mock-doc-ref',
            expect.objectContaining({
                _quarantine_reason: 'failed type guard',
                _original_collection: 'uploaded_analyses',
            }),
        );
        expect(mockSetDoc).not.toHaveBeenCalled();

        // Should also remove from localStorage
        const stored = JSON.parse(localStore['lemon-local-analyses']);
        expect(
            stored.find((a: Record<string, unknown>) => a.source_file === 'bad.pdf'),
        ).toBeUndefined();
    });

    it('does not return a quarantined record from the local cache', async () => {
        localStore['lemon-local-analyses'] = JSON.stringify([
            { source_file: 'good.pdf', title: 'Good' },
            {
                source_file: 'bad.pdf',
                title: 'Bad',
                _quarantined_at: '2026-07-19T00:00:00.000Z',
            },
        ]);

        const { loadAllAnalyses } = await import('./analysisStore');
        const result = await loadAllAnalyses();

        expect(result).toEqual([{ source_file: 'good.pdf', title: 'Good' }]);
    });
});

describe('subscribeToAnalyses', () => {
    beforeEach(() => {
        mockOnSnapshot.mockClear();
        mockUnsubscribe.mockClear();
        snapshotSuccess = undefined;
        snapshotError = undefined;
        Object.keys(localStore).forEach((k) => delete localStore[k]);
        vi.resetModules();
    });

    it('publishes and caches only visible records without Firestore internals', async () => {
        const onChange = vi.fn();
        const { subscribeToAnalyses } = await import('./analysisStore');
        const unsubscribe = subscribeToAnalyses(onChange);

        snapshotSuccess?.({
            docs: [
                {
                    data: () => ({
                        source_file: 'visible.pdf',
                        title: 'Visible',
                        _savedAt: 'now',
                        _docId: 'visible',
                    }),
                },
                { data: () => ({ source_file: 'deleted.pdf', _deleted_at: 'yesterday' }) },
                { data: () => ({ source_file: 'bad.pdf', _quarantined_at: 'today' }) },
            ],
        });

        const expected = [{ source_file: 'visible.pdf', title: 'Visible' }];
        expect(onChange).toHaveBeenCalledWith(expected);
        expect(JSON.parse(localStore['lemon-local-analyses'])).toEqual(expected);

        unsubscribe();
        expect(mockUnsubscribe).toHaveBeenCalledOnce();
    });

    it('preserves queued edits and deletes over a stale Firestore snapshot', async () => {
        localStore['lemon-pending-writes'] = JSON.stringify([
            {
                kind: 'patch',
                sourceFile: 'edited.pdf',
                fields: { category: 'LEMON' },
            },
            {
                kind: 'patch',
                sourceFile: 'deleted.pdf',
                fields: { _deleted_at: 'pending-delete' },
            },
        ]);
        const onChange = vi.fn();
        const { subscribeToAnalyses } = await import('./analysisStore');
        subscribeToAnalyses(onChange);

        snapshotSuccess?.({
            docs: [
                {
                    data: () => ({
                        source_file: 'edited.pdf',
                        category: 'OTHER',
                    }),
                },
                { data: () => ({ source_file: 'deleted.pdf', title: 'Stale' }) },
            ],
        });

        expect(onChange).toHaveBeenCalledWith([{ source_file: 'edited.pdf', category: 'LEMON' }]);
    });

    it('forwards listener failures to the reconnect layer', async () => {
        const onError = vi.fn();
        const { subscribeToAnalyses } = await import('./analysisStore');
        subscribeToAnalyses(vi.fn(), onError);

        const error = new Error('permission denied');
        snapshotError?.(error);

        expect(onError).toHaveBeenCalledWith(error);
    });
});

describe('slimRecord (localStorage quota fallback)', () => {
    it('strips the current engine v9_meta payload as well as legacy v7_meta', async () => {
        const { slimRecord } = await import('./analysisStore');
        const record = {
            source_file: 'TERAPIA_V4.pdf',
            analysis_version: 'v9_archaeology',
            analysis: { title: 'Terapia', verdict: 'RECOMMEND' },
            v9_meta: { reader_count: 5, total_tokens: { input_tokens: 100_000 } },
            v7_meta: { legacy: true },
            triage: { triage_score: 8 },
            lenses_enabled: ['commercial'],
        };

        const slim = slimRecord(record);

        expect(slim).not.toHaveProperty('analysis');
        expect(slim).not.toHaveProperty('v9_meta');
        expect(slim).not.toHaveProperty('v7_meta');
        expect(slim).not.toHaveProperty('triage');
        expect(slim).not.toHaveProperty('lenses_enabled');
        // Light fields the UI needs must survive
        expect(slim.source_file).toBe('TERAPIA_V4.pdf');
        expect(slim.analysis_version).toBe('v9_archaeology');
        // Original record must be untouched (slim is a copy)
        expect(record).toHaveProperty('v9_meta');
    });
});
