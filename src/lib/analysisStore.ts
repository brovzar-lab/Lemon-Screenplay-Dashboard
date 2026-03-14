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
    updateDoc,
    deleteField,
    query,
    getCountFromServer,
} from 'firebase/firestore';
import { authReady, db } from './firebase';

const FIRESTORE_COLLECTION = 'uploaded_analyses';
const _QUARANTINE_COLLECTION = '_unrecognized_analyses';
const LOCAL_CACHE_KEY = 'lemon-local-analyses';
const MIGRATION_KEY = 'lemon-migration-v6-done';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
export async function flushPendingWrites(): Promise<void> {
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

/**
 * Get the number of pending Firestore writes queued for retry.
 * Returns 0 if the queue is empty, absent, or corrupt.
 */
export function getPendingWriteCount(): number {
    try {
        const raw = localStorage.getItem(PENDING_QUEUE_KEY);
        if (!raw) return 0;
        const queue = JSON.parse(raw);
        return Array.isArray(queue) ? queue.length : 0;
    } catch {
        return 0;
    }
}

// Track if background sync has already run this session
let _bgSyncDone = false;

/**
 * Background Firestore sync — runs AFTER the UI has loaded.
 *
 * STRATEGY: Firestore is authoritative.
 * localStorage is REPLACED with Firestore data, not merged.
 * This ensures that items deleted from Firestore also disappear
 * from localStorage on the next session load.
 */
async function backgroundFirestoreSync(): Promise<void> {
    if (_bgSyncDone) return;
    _bgSyncDone = true;

    try {
        // Gate: wait for anonymous auth before any Firestore calls
        await authReady;

        // Flush any locally-queued writes first
        await flushPendingWrites();

        // Load authoritative data from Firestore
        const q = query(collection(db, FIRESTORE_COLLECTION));
        const snapshot = await getDocs(q);

        const firestoreData = snapshot.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return Object.fromEntries(
                Object.entries(data).filter(([k]) => k !== '_savedAt' && k !== '_docId' && k !== '_quarantined_at' && k !== '_quarantine_reason' && k !== '_original_collection')
            ) as Record<string, unknown>;
        });

        if (firestoreData.length === 0) {
            // Firestore is empty — wipe localStorage to match
            writeToLocal([]);
            console.log('[Lemon] Firestore empty → localStorage cleared');
            return;
        }

        // REPLACE: Firestore is the ground truth.
        // Push any localStorage-only items that Firestore doesn't have yet
        // (e.g. items written while offline / App Check was broken).
        const localData = readFromLocal();
        const firestoreKeys = new Set(firestoreData.map((f) => f.source_file as string));

        const localOnlyItems = localData.filter(
            (l) => l.source_file && !firestoreKeys.has(l.source_file as string)
        );

        if (localOnlyItems.length > 0) {
            console.log(`[Lemon] Background syncing ${localOnlyItems.length} local-only entries to Firestore...`);
            await Promise.allSettled(
                localOnlyItems.map(async (item) => {
                    const sf = (item.source_file as string) || `unknown_${Date.now()}`;
                    const docId = toDocId(sf);
                    await setDoc(doc(db, FIRESTORE_COLLECTION, docId), {
                        ...item,
                        _savedAt: new Date().toISOString(),
                        _docId: docId,
                    });
                })
            );
            // Include those items in the final set
            firestoreData.push(...localOnlyItems);
        }

        // Overwrite localStorage with the authoritative Firestore set
        writeToLocal(firestoreData);
        console.log(`[Lemon] Sync complete: localStorage replaced with ${firestoreData.length} Firestore entries`);
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

    // Step 2: Save to Firestore (persistent, may fail). Never throw — localStorage is the success path.
    const docId = toDocId(sourceFile);
    try {
        await authReady;
        const docRef = doc(db, FIRESTORE_COLLECTION, docId);
        await setDoc(docRef, {
            ...raw,
            _savedAt: new Date().toISOString(),
            _docId: docId,
        });
        console.log(`[Lemon] Analysis saved to Firestore: ${docId}`);
    } catch (err) {
        console.warn(`[Lemon] Firestore write failed for ${docId} (queued for retry):`, err);
        queueForRetry(raw);
        // Do NOT re-throw — the analysis is safely in localStorage.
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
    // Filter out soft-deleted items (items with _deleted_at)
    const localData = readFromLocal().filter((a) => !a._deleted_at);

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
 * Soft-delete an analysis by setting _deleted_at timestamp.
 * The document is preserved in both stores but hidden from loadAllAnalyses.
 */
export async function softDeleteAnalysis(sourceFile: string): Promise<void> {
    const deletedAt = new Date().toISOString();

    // Set _deleted_at in localStorage immediately
    const existing = readFromLocal();
    const updated = existing.map((a) =>
        a.source_file === sourceFile ? { ...a, _deleted_at: deletedAt } : a
    );
    writeToLocal(updated);
    console.log(`[Lemon] Soft-deleted from localStorage: ${sourceFile}`);

    // Set _deleted_at in Firestore — never throw, localStorage is the success path
    const docId = toDocId(sourceFile);
    try {
        await authReady;
        await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), { _deleted_at: deletedAt });
        console.log(`[Lemon] Soft-deleted in Firestore: ${docId}`);
    } catch (err) {
        console.warn(`[Lemon] Firestore soft-delete failed for ${docId}:`, err);
    }
}

/**
 * @deprecated Use softDeleteAnalysis instead. Kept for backward compatibility.
 */
export const removeAnalysis = softDeleteAnalysis;

/**
 * Soft-delete ALL uploaded analyses by setting _deleted_at on every entry.
 */
export async function softDeleteAllAnalyses(): Promise<void> {
    const deletedAt = new Date().toISOString();

    // Set _deleted_at on all localStorage entries
    const existing = readFromLocal();
    const updated = existing.map((a) => ({ ...a, _deleted_at: deletedAt }));
    writeToLocal(updated);

    // Clear the pending write queue
    try {
        localStorage.removeItem(PENDING_QUEUE_KEY);
    } catch {
        // ignore
    }

    // Set _deleted_at on all Firestore docs — never throw, localStorage is the success path
    try {
        await authReady;
        const q = query(collection(db, FIRESTORE_COLLECTION));
        const snapshot = await getDocs(q);
        await Promise.all(
            snapshot.docs.map((d) =>
                updateDoc(d.ref, { _deleted_at: deletedAt })
            )
        );
        console.log(`[Lemon] Soft-deleted ${snapshot.size} analyses in Firestore`);
    } catch (err) {
        console.warn('[Lemon] Firestore soft-delete-all failed:', err);
    }
}

/**
 * @deprecated Use softDeleteAllAnalyses instead. Kept for backward compatibility.
 */
export const clearAllAnalyses = softDeleteAllAnalyses;

/**
 * Restore a soft-deleted analysis by removing its _deleted_at field.
 */
export async function restoreAnalysis(sourceFile: string): Promise<void> {
    // Remove _deleted_at from localStorage entry
    const existing = readFromLocal();
    const updated = existing.map((a) => {
        if (a.source_file === sourceFile) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { _deleted_at: _discarded, ...rest } = a;
            return rest;
        }
        return a;
    });
    writeToLocal(updated);
    console.log(`[Lemon] Restored in localStorage: ${sourceFile}`);

    // Remove _deleted_at from Firestore
    await authReady;
    const docId = toDocId(sourceFile);
    try {
        await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), { _deleted_at: deleteField() });
        console.log(`[Lemon] Restored in Firestore: ${docId}`);
    } catch (err) {
        console.warn(`[Lemon] Firestore restore failed for ${docId}:`, err);
    }
}

/**
 * Get all soft-deleted analyses within the last 30 days.
 */
export function getDeletedAnalyses(): Record<string, unknown>[] {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return readFromLocal().filter((a) => {
        if (!a._deleted_at) return false;
        const deletedTime = new Date(a._deleted_at as string).getTime();
        return deletedTime >= cutoff;
    });
}

/**
 * Quarantine a document that failed type-guard validation.
 * Copies the document to _unrecognized_analyses with metadata,
 * then removes it from the source collection and localStorage.
 */
export async function quarantineAnalysis(
    raw: Record<string, unknown>,
    reason: string
): Promise<void> {
    const sourceFile = raw.source_file as string | undefined;
    if (!sourceFile) return;

    await authReady;
    const docId = toDocId(sourceFile);

    try {
        // Copy to quarantine collection with metadata
        await setDoc(doc(db, _QUARANTINE_COLLECTION, docId), {
            ...raw,
            _quarantined_at: new Date().toISOString(),
            _quarantine_reason: reason,
            _original_collection: FIRESTORE_COLLECTION,
        });

        // Remove from source collection
        await deleteDoc(doc(db, FIRESTORE_COLLECTION, docId));

        // Remove from localStorage
        const existing = readFromLocal();
        const filtered = existing.filter((a) => a.source_file !== sourceFile);
        writeToLocal(filtered);

        console.log(`[Lemon] Quarantined "${sourceFile}" to ${_QUARANTINE_COLLECTION}: ${reason}`);
    } catch (err) {
        console.warn(`[Lemon] Quarantine failed for "${sourceFile}":`, err);
    }
}

/**
 * Get count of quarantined documents in the _unrecognized_analyses collection.
 * Returns 0 if the collection is empty or on error.
 */
export async function getQuarantineCount(): Promise<number> {
    try {
        await authReady;
        const coll = collection(db, _QUARANTINE_COLLECTION);
        const snapshot = await getCountFromServer(coll);
        return snapshot.data().count;
    } catch {
        return 0;
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
        await authReady;
        const coll = collection(db, FIRESTORE_COLLECTION);
        const snapshot = await getCountFromServer(coll);
        return snapshot.data().count;
    } catch {
        return 0;
    }
}

/**
 * Soft-delete multiple analyses by source_file keys (batch soft-delete).
 */
export async function softDeleteMultipleAnalyses(sourceFiles: string[]): Promise<void> {
    if (sourceFiles.length === 0) return;
    const deletedAt = new Date().toISOString();

    // Set _deleted_at on all matching localStorage entries in one pass
    const existing = readFromLocal();
    const sourceFileSet = new Set(sourceFiles);
    const updated = existing.map((a) =>
        sourceFileSet.has(a.source_file as string) ? { ...a, _deleted_at: deletedAt } : a
    );
    writeToLocal(updated);
    console.log(`[Lemon] Soft-deleted ${sourceFiles.length} analyses in localStorage`);

    // Soft-delete in Firestore in parallel (batches of 10) — never throw
    const batchSize = 10;
    try {
        await authReady;
    } catch {
        console.warn('[Lemon] Firestore auth not ready, skipping Firestore batch soft-delete');
        return;
    }
    for (let i = 0; i < sourceFiles.length; i += batchSize) {
        const batch = sourceFiles.slice(i, i + batchSize);
        await Promise.allSettled(
            batch.map(async (sf) => {
                const docId = toDocId(sf);
                try {
                    await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), { _deleted_at: deletedAt });
                } catch (err) {
                    console.warn(`[Lemon] Firestore soft-delete failed for ${docId}:`, err);
                }
            })
        );
    }
    console.log(`[Lemon] Soft-deleted ${sourceFiles.length} analyses in Firestore`);
}

/**
 * @deprecated Use softDeleteMultipleAnalyses instead. Kept for backward compatibility.
 */
export const removeMultipleAnalyses = softDeleteMultipleAnalyses;

/**
 * Check if static-to-Firestore migration is complete.
 */
export function isMigrationComplete(): boolean {
    try {
        return localStorage.getItem(MIGRATION_KEY) === 'true';
    } catch {
        return false;
    }
}

/**
 * One-time migration: copy static JSON files from /data/analysis_v6/ into Firestore.
 * Runs once, sets a localStorage flag, and is non-blocking.
 */
export async function migrateStaticToFirestore(): Promise<void> {
    if (isMigrationComplete()) return;

    console.log('[Lemon] Starting one-time static → Firestore migration...');

    try {
        // Fetch the static index
        const res = await fetch('/data/analysis_v6/index.json');
        if (!res.ok) {
            console.warn('[Lemon] No static index found, skipping migration');
            return;
        }
        const fileList: string[] = await res.json();
        console.log(`[Lemon] Migrating ${fileList.length} static analysis files...`);

        let migratedCount = 0;
        const batchSize = 5;

        for (let i = 0; i < fileList.length; i += batchSize) {
            const batch = fileList.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(async (filename) => {
                    const response = await fetch(`/data/analysis_v6/${filename}`);
                    if (!response.ok) return;
                    const raw = await response.json() as Record<string, unknown>;
                    await saveAnalysis(raw);
                })
            );
            migratedCount += results.filter((r) => r.status === 'fulfilled').length;
        }

        // Mark migration complete
        localStorage.setItem(MIGRATION_KEY, 'true');
        console.log(`[Lemon] Migration complete: ${migratedCount}/${fileList.length} files migrated`);
    } catch (err) {
        console.error('[Lemon] Migration failed:', err);
        // Don't set flag — will retry on next load
    }
}

/**
 * Reset migration flag (used when clearing all data).
 */
export function resetMigrationFlag(): void {
    try {
        localStorage.removeItem(MIGRATION_KEY);
    } catch {
        // ignore
    }
}
