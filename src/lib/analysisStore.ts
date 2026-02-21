/**
 * Analysis Store
 *
 * Persists user-analyzed screenplay results with **dual-write guarantee**:
 *   1. localStorage (primary for reads — instant, never blocks UI)
 *   2. Firestore (primary for persistence — syncs in background)
 *
 * PERFORMANCE: loadAllAnalyses returns localStorage data INSTANTLY.
 * Firestore sync happens in the background without blocking the UI.
 */

import {
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc,
    query,
    getCountFromServer,
} from 'firebase/firestore';
import { db } from './firebase';

const FIRESTORE_COLLECTION = 'uploaded_analyses';
const LOCAL_CACHE_KEY = 'lemon-local-analyses';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Sanitize source_file into a Firestore-safe document ID. */
function toDocId(sourceFile: string): string {
    return sourceFile
        .replace(/[/\\]/g, '_')
        .replace(/[^a-zA-Z0-9_\-. ]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 200) || `doc_${Date.now()}`;
}

/** Write to localStorage. */
function writeToLocal(analyses: Record<string, unknown>[]): void {
    try {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(analyses));
    } catch (err) {
        console.error('[Lemon] localStorage write failed:', err);
    }
}

/** Read from localStorage. */
function readFromLocal(): Record<string, unknown>[] {
    try {
        const stored = localStorage.getItem(LOCAL_CACHE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed as Record<string, unknown>[];
    } catch {
        return [];
    }
}

/** Track failed Firestore writes for retry. */
const PENDING_QUEUE_KEY = 'lemon-pending-writes';

function queueForRetry(raw: Record<string, unknown>): void {
    try {
        const queue = JSON.parse(localStorage.getItem(PENDING_QUEUE_KEY) || '[]');
        queue.push(raw);
        localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    } catch {
        // last resort — at least localStorage has the data
    }
}

/** Flush any pending Firestore writes that failed previously. Non-blocking. */
async function flushPendingWrites(): Promise<void> {
    try {
        const raw = localStorage.getItem(PENDING_QUEUE_KEY);
        if (!raw) return;
        const queue = JSON.parse(raw) as Record<string, unknown>[];
        if (queue.length === 0) return;

        console.log(`[Lemon] Retrying ${queue.length} pending Firestore writes...`);
        const succeeded: number[] = [];

        // Process in parallel for speed (max 5 concurrent)
        const batchSize = 5;
        for (let i = 0; i < queue.length; i += batchSize) {
            const batch = queue.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(async (item, idx) => {
                    const sourceFile = (item.source_file as string) || `unknown_${Date.now()}`;
                    const docId = toDocId(sourceFile);
                    const docRef = doc(db, FIRESTORE_COLLECTION, docId);
                    await setDoc(docRef, {
                        ...item,
                        _savedAt: new Date().toISOString(),
                        _docId: docId,
                    });
                    return i + idx;
                })
            );
            for (const r of results) {
                if (r.status === 'fulfilled') succeeded.push(r.value);
            }
        }

        if (succeeded.length > 0) {
            const remaining = queue.filter((_, i) => !succeeded.includes(i));
            localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining));
            console.log(`[Lemon] Flushed ${succeeded.length} pending writes, ${remaining.length} remaining`);
        }
    } catch {
        // Non-critical
    }
}

// Track if background sync has already run this session
let _bgSyncDone = false;

/**
 * Background Firestore sync — runs AFTER the UI has loaded.
 * Merges Firestore data into localStorage and pushes any missing entries.
 */
async function backgroundFirestoreSync(): Promise<void> {
    if (_bgSyncDone) return;
    _bgSyncDone = true;

    try {
        // Flush pending writes first
        await flushPendingWrites();

        // Load from Firestore
        const q = query(collection(db, FIRESTORE_COLLECTION));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return;

        const firestoreData = snapshot.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            const { _savedAt: _, _docId: __, ...raw } = data;
            return raw;
        });

        const localData = readFromLocal();

        // Merge: Firestore wins on conflict
        const merged = new Map<string, Record<string, unknown>>();
        for (const item of localData) {
            const key = (item.source_file as string) || JSON.stringify(item).slice(0, 100);
            merged.set(key, item);
        }
        for (const item of firestoreData) {
            const key = (item.source_file as string) || JSON.stringify(item).slice(0, 100);
            merged.set(key, item);
        }

        // Update localStorage with merged data
        const result = Array.from(merged.values());
        writeToLocal(result);

        // Push any localStorage-only entries to Firestore (parallel)
        const firestoreKeys = new Set(firestoreData.map((f) => f.source_file as string));
        const missingInFirestore = localData.filter(
            (l) => !firestoreKeys.has(l.source_file as string)
        );

        if (missingInFirestore.length > 0) {
            console.log(`[Lemon] Background syncing ${missingInFirestore.length} entries to Firestore...`);
            await Promise.allSettled(
                missingInFirestore.map(async (item) => {
                    const sf = (item.source_file as string) || `unknown_${Date.now()}`;
                    const docId = toDocId(sf);
                    await setDoc(doc(db, FIRESTORE_COLLECTION, docId), {
                        ...item,
                        _savedAt: new Date().toISOString(),
                        _docId: docId,
                    });
                })
            );
        }

        console.log(`[Lemon] Background sync complete: ${result.length} total analyses`);
    } catch (err) {
        console.warn('[Lemon] Background Firestore sync failed:', err);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Save a raw V6 analysis result.
 * ALWAYS writes to localStorage immediately, then attempts Firestore.
 * If Firestore fails, queues for retry on next load.
 */
export async function saveAnalysis(raw: Record<string, unknown>): Promise<void> {
    const sourceFile = (raw.source_file as string) || `unknown_${Date.now()}`;

    // Step 1: ALWAYS save to localStorage immediately (instant, guaranteed)
    const existing = readFromLocal();
    const filtered = existing.filter((a) => a.source_file !== sourceFile);
    filtered.push(raw);
    writeToLocal(filtered);
    console.log(`[Lemon] Analysis saved to localStorage: ${sourceFile}`);

    // Step 2: Save to Firestore (persistent, may fail)
    const docId = toDocId(sourceFile);
    try {
        const docRef = doc(db, FIRESTORE_COLLECTION, docId);
        await setDoc(docRef, {
            ...raw,
            _savedAt: new Date().toISOString(),
            _docId: docId,
        });
        console.log(`[Lemon] Analysis saved to Firestore: ${docId}`);
    } catch (err) {
        console.error(`[Lemon] Firestore write failed for ${docId}, queuing for retry:`, err);
        queueForRetry(raw);
    }
}

/**
 * Load all uploaded analyses.
 *
 * FAST PATH: Returns localStorage data immediately (no network wait).
 * Firestore sync happens in background and updates localStorage for next load.
 */
export async function loadAllAnalyses(): Promise<Record<string, unknown>[]> {
    // Return localStorage data instantly — no Firestore blocking
    const localData = readFromLocal();

    if (localData.length > 0) {
        console.log(`[Lemon] Loaded ${localData.length} analyses from localStorage (instant)`);
    }

    // Schedule background Firestore sync (non-blocking)
    // Uses setTimeout to ensure UI renders first
    setTimeout(() => {
        backgroundFirestoreSync().catch(() => {
            // Silent — localStorage data is already serving the UI
        });
    }, 2000); // 2 second delay to let UI fully render first

    return localData;
}

/**
 * Remove an analysis by source_file key from both stores.
 */
export async function removeAnalysis(sourceFile: string): Promise<void> {
    // Remove from localStorage immediately
    const existing = readFromLocal();
    const filtered = existing.filter((a) => a.source_file !== sourceFile);
    writeToLocal(filtered);

    // Remove from Firestore in background
    const docId = toDocId(sourceFile);
    try {
        await deleteDoc(doc(db, FIRESTORE_COLLECTION, docId));
        console.log(`[Lemon] Removed from Firestore: ${docId}`);
    } catch (err) {
        console.warn(`[Lemon] Firestore delete failed for ${docId}:`, err);
    }
}

/**
 * Clear all uploaded analyses from both stores.
 */
export async function clearAllAnalyses(): Promise<void> {
    // Clear localStorage immediately
    try {
        localStorage.removeItem(LOCAL_CACHE_KEY);
        localStorage.removeItem(PENDING_QUEUE_KEY);
    } catch {
        // ignore
    }

    // Clear Firestore in background
    try {
        const q = query(collection(db, FIRESTORE_COLLECTION));
        const snapshot = await getDocs(q);
        await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
        console.log(`[Lemon] Cleared ${snapshot.size} analyses from Firestore`);
    } catch (err) {
        console.warn('[Lemon] Firestore clear failed:', err);
    }
}

/**
 * Get count of uploaded analyses.
 */
export async function getAnalysisCount(): Promise<number> {
    // Fast path: use localStorage count
    const localCount = readFromLocal().length;
    if (localCount > 0) return localCount;

    // Fallback: query Firestore
    try {
        const coll = collection(db, FIRESTORE_COLLECTION);
        const snapshot = await getCountFromServer(coll);
        return snapshot.data().count;
    } catch {
        return 0;
    }
}
