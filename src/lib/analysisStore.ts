/**
 * Analysis Store
 *
 * Persists user-analyzed screenplay results with **dual-write guarantee**:
 *   1. localStorage (startup cache — instant, never blocks UI)
 *   2. Firestore (authoritative persistence — delivered by one live listener)
 *
 * PERFORMANCE: loadAllAnalyses returns localStorage data without a network
 * read. subscribeToAnalyses owns the single authoritative Firestore stream.
 */

import {
    collection,
    doc,
    setDoc,
    getDocs,
    updateDoc,
    deleteField,
    query,
    where,
    getCountFromServer,
    onSnapshot,
    type QuerySnapshot,
    type DocumentData,
    type Unsubscribe,
} from 'firebase/firestore';
import { authReady, db } from './firebase';
import { useToastStore } from '@/stores/toastStore';
import { requireVerifiedIdentity } from './analysisIdentity';

const FIRESTORE_COLLECTION = 'uploaded_analyses';
const _QUARANTINE_COLLECTION = '_unrecognized_analyses';
const LOCAL_CACHE_KEY = 'lemon-local-analyses';
const MIGRATION_KEY = 'lemon-migration-v6-done';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function isQuarantined(record: Record<string, unknown>): boolean {
    return Boolean(record._quarantined_at);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Sanitize source_file into a Firestore-safe document ID. */
export function toDocId(sourceFile: string): string {
    return (
        sourceFile
            .replace(/[/\\]/g, '_')
            .replace(/[^a-zA-Z0-9_\-. ]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .slice(0, 200) || `doc_${Date.now()}`
    );
}

/**
 * Fields that are safe to strip from a screenplay record when localStorage
 * is full. These are the heavy LLM response payloads; the UI only needs the
 * normalized top-level fields that `normalize.ts` reads.
 */
// 'v9_meta' is written by the current engine (analysisService.ts / ingest_v9.py);
// 'v7_meta' may still exist on records cached by older builds.
const HEAVY_FIELDS = ['analysis', 'v9_meta', 'v7_meta', 'triage', 'lenses_enabled'] as const;

/** Return a slimmed copy with heavy fields removed. Exported for tests. */
export function slimRecord(r: Record<string, unknown>): Record<string, unknown> {
    const slim = { ...r };
    for (const f of HEAVY_FIELDS) delete slim[f];
    return slim;
}

/**
 * Write to localStorage with two-level quota fallback:
 *   1. Try writing full records.
 *   2. On QuotaExceededError: strip heavy fields, try again.
 *   3. If still fails: clear the key so Firestore stays authoritative.
 *
 * @param silent — if true, suppress error toasts (used for background sync).
 */
function writeToLocal(analyses: Record<string, unknown>[], silent = false): void {
    // Level 1 — full write
    try {
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(analyses));
        return;
    } catch (err) {
        const isQuota =
            err instanceof DOMException &&
            (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
        if (!isQuota) {
            console.error('[Lemon] localStorage write failed (non-quota):', err);
            if (!silent)
                useToastStore
                    .getState()
                    .addToast('Failed to save screenplay locally — storage may be full');
            return;
        }
        console.warn('[Lemon] localStorage quota exceeded — retrying with slim records...');
    }

    // Level 2 — slim write (strip heavy analysis payloads)
    try {
        const slim = analyses.map(slimRecord);
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(slim));
        console.log('[Lemon] Slim write succeeded — heavy fields stripped to fit quota');
        return;
    } catch {
        console.warn(
            '[Lemon] localStorage slim write also failed — clearing key, using Firestore as source of truth',
        );
    }

    // Level 3 — clear so next load uses cold Firestore path
    try {
        localStorage.removeItem(LOCAL_CACHE_KEY);
    } catch {
        // Nothing more we can do
    }
    if (!silent)
        useToastStore
            .getState()
            .addToast('Failed to save screenplay locally — storage may be full');
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

type PendingWrite =
    | { kind: 'set'; sourceFile: string; data: Record<string, unknown> }
    | { kind: 'patch'; sourceFile: string; fields: Record<string, unknown> }
    | { kind: 'restore'; sourceFile: string };

function readPendingWrites(): PendingWrite[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(PENDING_QUEUE_KEY) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.flatMap((item): PendingWrite[] => {
            if (!item || typeof item !== 'object') return [];
            if (item.kind === 'set' || item.kind === 'patch' || item.kind === 'restore') {
                return [item as PendingWrite];
            }
            const legacy = item as Record<string, unknown>;
            const sourceFile = legacy.source_file;
            return typeof sourceFile === 'string'
                ? [{ kind: 'set', sourceFile, data: legacy }]
                : [];
        });
    } catch {
        return [];
    }
}

function queueForRetry(write: PendingWrite): void {
    try {
        const queue = readPendingWrites();
        queue.push(write);
        localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
    } catch {
        // Local screenplay cache still preserves the user's visible change.
    }
}

async function applyPendingWrite(write: PendingWrite): Promise<void> {
    const docId = toDocId(write.sourceFile);
    const docRef = doc(db, FIRESTORE_COLLECTION, docId);
    if (write.kind === 'set') {
        await setDoc(docRef, {
            ...write.data,
            _savedAt: new Date().toISOString(),
            _docId: docId,
        });
    } else if (write.kind === 'patch') {
        await updateDoc(docRef, write.fields);
    } else {
        await updateDoc(docRef, { _deleted_at: deleteField() });
    }
}

function applyPendingWritesToRecords(
    records: Record<string, unknown>[],
): Record<string, unknown>[] {
    const bySourceFile = new Map(
        records.map((record) => [String(record.source_file ?? ''), { ...record }]),
    );
    for (const write of readPendingWrites()) {
        const current = bySourceFile.get(write.sourceFile) ?? { source_file: write.sourceFile };
        if (write.kind === 'set') {
            bySourceFile.set(write.sourceFile, { ...write.data });
        } else if (write.kind === 'patch') {
            bySourceFile.set(write.sourceFile, { ...current, ...write.fields });
        } else {
            const { _deleted_at: _discarded, ...rest } = current;
            bySourceFile.set(write.sourceFile, rest);
        }
    }
    return Array.from(bySourceFile.values());
}

/** Flush any pending Firestore writes that failed previously. Non-blocking. */
export async function flushPendingWrites(): Promise<void> {
    try {
        const raw = localStorage.getItem(PENDING_QUEUE_KEY);
        if (!raw) return;
        const queue = readPendingWrites();
        if (queue.length === 0) return;

        await authReady;

        console.log(`[Lemon] Retrying ${queue.length} pending Firestore writes...`);
        const remaining: PendingWrite[] = [];
        for (const write of queue) {
            try {
                await applyPendingWrite(write);
            } catch {
                remaining.push(write);
            }
        }
        localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining));
        console.log(
            `[Lemon] Flushed ${queue.length - remaining.length} pending writes, ${remaining.length} remaining`,
        );
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
        return readPendingWrites().length;
    } catch {
        return 0;
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Save a raw V9 analysis result.
 * ALWAYS writes to localStorage immediately, then attempts Firestore.
 * If Firestore fails, queues for retry on next load.
 */
export async function saveAnalysis(raw: Record<string, unknown>): Promise<void> {
    const persistedRaw =
        raw.analysis_version === 'v9_archaeology'
            ? { ...raw, ...requireVerifiedIdentity(raw) }
            : raw;
    const sourceFile = (persistedRaw.source_file as string) || `unknown_${Date.now()}`;

    // Step 1: ALWAYS save to localStorage immediately (instant, guaranteed)
    const existing = readFromLocal();
    const filtered = existing.filter((a) => a.source_file !== sourceFile);
    filtered.push(persistedRaw);
    writeToLocal(filtered);
    console.log(`[Lemon] Analysis saved to localStorage: ${sourceFile}`);

    // Step 2: Save to Firestore (persistent, may fail). Never throw — localStorage is the success path.
    const docId = toDocId(sourceFile);
    try {
        await authReady;
        const docRef = doc(db, FIRESTORE_COLLECTION, docId);
        await setDoc(docRef, {
            ...persistedRaw,
            _savedAt: new Date().toISOString(),
            _docId: docId,
        });
        console.log(`[Lemon] Analysis saved to Firestore: ${docId}`);
    } catch (err) {
        console.warn(`[Lemon] Firestore write failed for ${docId} (queued for retry):`, err);
        useToastStore
            .getState()
            .addToast('Failed to sync screenplay to cloud — will retry automatically', 'warning');
        queueForRetry({ kind: 'set', sourceFile, data: persistedRaw });
        // Do NOT re-throw — the analysis is safely in localStorage.
    }
}

/**
 * Load all uploaded analyses.
 *
 * Returns the startup cache only. The live listener is the sole Firestore read
 * path and replaces this cache as soon as its initial snapshot arrives.
 */
export async function loadAllAnalyses(): Promise<Record<string, unknown>[]> {
    const localData = readFromLocal().filter((a) => !a._deleted_at && !isQuarantined(a));
    console.log(`[Lemon] Loaded ${localData.length} analyses from startup cache`);
    return localData;
}

/**
 * Subscribe to live changes on the uploaded_analyses collection.
 *
 * Fires `onChange` whenever Firestore reports a change (added/modified/removed).
 * The callback receives the full deduped, non-deleted list — same shape as
 * loadAllAnalyses returns. Also keeps localStorage in sync so subsequent
 * page loads start hot.
 *
 * Use case: the daemon writes to Firestore from the VPS, completely outside
 * the browser's saveAnalysis() path. Without a listener, the dashboard only
 * learns about new analyses on next page load. With this listener, new
 * analyses appear instantly.
 *
 * Returns an Unsubscribe function — call it on cleanup.
 */
export function subscribeToAnalyses(
    onChange: (analyses: Record<string, unknown>[]) => void,
    onError?: (error: Error) => void,
): Unsubscribe {
    const stripInternals = (data: Record<string, unknown>): Record<string, unknown> =>
        Object.fromEntries(
            Object.entries(data).filter(
                ([k]) =>
                    k !== '_savedAt' &&
                    k !== '_docId' &&
                    k !== '_quarantined_at' &&
                    k !== '_quarantine_reason' &&
                    k !== '_original_collection',
            ),
        );

    const q = query(collection(db, FIRESTORE_COLLECTION));

    return onSnapshot(
        q,
        (snapshot: QuerySnapshot<DocumentData>) => {
            const cloudRecords = snapshot.docs
                .map((d) => d.data() as Record<string, unknown>)
                .filter((data) => !isQuarantined(data))
                .map((data) => stripInternals(data));
            const next = applyPendingWritesToRecords(cloudRecords)
                .filter((d) => !d._deleted_at);

            // Mirror to localStorage so the next cold-load is fast.
            writeToLocal(next, true);
            console.log(`[Lemon] Live sync: ${next.length} analyses (Firestore snapshot)`);
            onChange(next);
        },
        (err) => {
            console.warn('[Lemon] Live sync subscription error:', err);
            onError?.(err);
        },
    );
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
        a.source_file === sourceFile ? { ...a, _deleted_at: deletedAt } : a,
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
        queueForRetry({ kind: 'patch', sourceFile, fields: { _deleted_at: deletedAt } });
        useToastStore.getState().addToast('Delete saved locally — cloud sync will retry', 'warning');
    }
}

/**
 * @deprecated Use softDeleteAnalysis instead. Kept for backward compatibility.
 */
export const removeAnalysis = softDeleteAnalysis;

/**
 * Patch a single field on a raw analysis document.
 * Dual-write: localStorage immediately, Firestore non-blocking.
 * Caller must invalidate SCREENPLAYS_QUERY_KEY to refresh UI.
 */
export async function patchAnalysisField(
    sourceFile: string,
    field: string,
    value: unknown,
): Promise<void> {
    // Step 1: Patch in localStorage immediately
    const existing = readFromLocal();
    const updated = existing.map((a) =>
        a.source_file === sourceFile ? { ...a, [field]: value } : a,
    );
    writeToLocal(updated);

    // Step 2: Patch in Firestore (non-blocking, never throws)
    const docId = toDocId(sourceFile);
    try {
        await authReady;
        await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), { [field]: value });
    } catch (err) {
        console.warn(`[Lemon] Firestore patch failed for ${docId}.${field}:`, err);
        queueForRetry({ kind: 'patch', sourceFile, fields: { [field]: value } });
        useToastStore.getState().addToast('Change saved locally — cloud sync will retry', 'warning');
    }
}

/**
 * Soft-delete ALL uploaded analyses by setting _deleted_at on every entry.
 */
export async function softDeleteAllAnalyses(): Promise<void> {
    const deletedAt = new Date().toISOString();

    // Set _deleted_at on all localStorage entries
    const existing = readFromLocal();
    const updated = existing.map((a) => ({ ...a, _deleted_at: deletedAt }));
    writeToLocal(updated);

    // Set _deleted_at on all Firestore docs — never throw, localStorage is the success path
    try {
        await authReady;
        const q = query(collection(db, FIRESTORE_COLLECTION));
        const snapshot = await getDocs(q);
        await Promise.all(snapshot.docs.map((d) => updateDoc(d.ref, { _deleted_at: deletedAt })));
        console.log(`[Lemon] Soft-deleted ${snapshot.size} analyses in Firestore`);
    } catch (err) {
        console.warn('[Lemon] Firestore soft-delete-all failed:', err);
        for (const item of existing) {
            const sourceFile = item.source_file;
            if (typeof sourceFile === 'string') {
                queueForRetry({ kind: 'patch', sourceFile, fields: { _deleted_at: deletedAt } });
            }
        }
        useToastStore.getState().addToast('Deletes saved locally — cloud sync will retry', 'warning');
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
        queueForRetry({ kind: 'restore', sourceFile });
        useToastStore.getState().addToast('Restore saved locally — cloud sync will retry', 'warning');
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
 * Marks the source document as quarantined and removes it from localStorage.
 * The source remains intact for Admin SDK/manual recovery and audit purposes.
 */
export async function quarantineAnalysis(
    raw: Record<string, unknown>,
    reason: string,
): Promise<void> {
    const sourceFile = raw.source_file as string | undefined;
    if (!sourceFile) return;

    await authReady;
    const docId = toDocId(sourceFile);

    try {
        await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), {
            _quarantined_at: new Date().toISOString(),
            _quarantine_reason: reason,
            _original_collection: FIRESTORE_COLLECTION,
        });

        // Remove from localStorage
        const existing = readFromLocal();
        const filtered = existing.filter((a) => a.source_file !== sourceFile);
        writeToLocal(filtered);

        console.log(`[Lemon] Soft-quarantined "${sourceFile}": ${reason}`);
    } catch (err) {
        console.warn(`[Lemon] Quarantine failed for "${sourceFile}":`, err);
    }
}

/**
 * Get count of soft-quarantined and legacy quarantine documents.
 * Returns 0 if the collection is empty or on error.
 */
export async function getQuarantineCount(): Promise<number> {
    try {
        await authReady;
        const softQuarantineQuery = query(
            collection(db, FIRESTORE_COLLECTION),
            where('_quarantined_at', '>', ''),
        );
        const [softSnapshot, legacySnapshot] = await Promise.all([
            getCountFromServer(softQuarantineQuery),
            getCountFromServer(collection(db, _QUARANTINE_COLLECTION)),
        ]);
        return softSnapshot.data().count + legacySnapshot.data().count;
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
        sourceFileSet.has(a.source_file as string) ? { ...a, _deleted_at: deletedAt } : a,
    );
    writeToLocal(updated);
    console.log(`[Lemon] Soft-deleted ${sourceFiles.length} analyses in localStorage`);

    // Soft-delete in Firestore in parallel (batches of 10) — never throw
    const batchSize = 10;
    try {
        await authReady;
    } catch {
        for (const sourceFile of sourceFiles) {
            queueForRetry({ kind: 'patch', sourceFile, fields: { _deleted_at: deletedAt } });
        }
        useToastStore.getState().addToast('Deletes saved locally — cloud sync will retry', 'warning');
        return;
    }
    for (let i = 0; i < sourceFiles.length; i += batchSize) {
        const batch = sourceFiles.slice(i, i + batchSize);
        await Promise.allSettled(
            batch.map(async (sf) => {
                const docId = toDocId(sf);
                try {
                    await updateDoc(doc(db, FIRESTORE_COLLECTION, docId), {
                        _deleted_at: deletedAt,
                    });
                } catch (err) {
                    console.warn(`[Lemon] Firestore soft-delete failed for ${docId}:`, err);
                    queueForRetry({ kind: 'patch', sourceFile: sf, fields: { _deleted_at: deletedAt } });
                }
            }),
        );
    }
    console.log(`[Lemon] Soft-deleted ${sourceFiles.length} analyses in Firestore`);
}

/**
 * @deprecated Use softDeleteMultipleAnalyses instead. Kept for backward compatibility.
 */
export const removeMultipleAnalyses = softDeleteMultipleAnalyses;

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
