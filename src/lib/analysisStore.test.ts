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

vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => 'mock-collection-ref'),
    doc: vi.fn(() => 'mock-doc-ref'),
    query: vi.fn((ref: unknown) => ref),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
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

    it('removeAnalysis awaits authReady before calling deleteDoc', async () => {
        const { removeAnalysis } = await import('./analysisStore');

        const removePromise = removeAnalysis('test.pdf');

        // Wait for microtasks
        await new Promise((r) => setTimeout(r, 50));

        // deleteDoc should NOT have been called yet
        expect(callOrder).not.toContain('deleteDoc');

        // Resolve authReady
        resolveAuthReady();
        await removePromise;

        // deleteDoc should come after authReady
        const authIdx = callOrder.indexOf('authReady:resolved');
        const deleteIdx = callOrder.indexOf('deleteDoc');
        expect(authIdx).toBeGreaterThanOrEqual(0);
        expect(deleteIdx).toBeGreaterThan(authIdx);
    });

    it('clearAllAnalyses awaits authReady before calling getDocs', async () => {
        const { clearAllAnalyses } = await import('./analysisStore');

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
