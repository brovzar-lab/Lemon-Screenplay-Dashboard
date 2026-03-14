/**
 * Share Service
 *
 * Firestore CRUD for the `shared_views` collection.
 * Creates, revokes, and looks up per-screenplay share tokens
 * that enable partner access via shareable URLs.
 *
 * All functions gate on `authReady` before Firestore access.
 */

import {
    doc,
    setDoc,
    deleteDoc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
} from 'firebase/firestore';
import { authReady, db } from './firebase';
import { toDocId } from './analysisStore';
import { useShareStore } from '@/stores/shareStore';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SharedView {
    token: string;
    screenplayId: string;
    screenplayTitle: string;
    includeNotes: boolean;
    createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SHARED_VIEWS_COLLECTION = 'shared_views';
const SHARE_BASE_URL = 'https://lemon-screenplay-dashboard.web.app/share';

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Create a share token for a screenplay.
 * Writes a `shared_views` doc with the token as document ID.
 * Returns the token and full share URL.
 */
export async function createShareToken(
    screenplayId: string,
    screenplayTitle: string,
    includeNotes: boolean,
): Promise<{ token: string; url: string }> {
    await authReady;

    const token = crypto.randomUUID();
    const sharedView: SharedView = {
        token,
        screenplayId,
        screenplayTitle,
        includeNotes,
        createdAt: new Date().toISOString(),
    };

    const docRef = doc(db, SHARED_VIEWS_COLLECTION, token);
    await setDoc(docRef, sharedView);

    return {
        token,
        url: `${SHARE_BASE_URL}/${token}`,
    };
}

/**
 * Revoke a share token by deleting its Firestore doc.
 * Also clears the session cache via shareStore.
 */
export async function revokeShareToken(
    token: string,
    screenplayId: string,
): Promise<void> {
    await authReady;

    const docRef = doc(db, SHARED_VIEWS_COLLECTION, token);
    await deleteDoc(docRef);

    // Centralize cache invalidation (per research pitfall 3)
    useShareStore.getState().removeToken(screenplayId);
}

/**
 * Look up an existing share token for a screenplay.
 * Returns the SharedView if found, null otherwise.
 */
export async function getExistingShareToken(
    screenplayId: string,
): Promise<SharedView | null> {
    await authReady;

    const colRef = collection(db, SHARED_VIEWS_COLLECTION);
    const q = query(colRef, where('screenplayId', '==', screenplayId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        return null;
    }

    return snapshot.docs[0].data() as SharedView;
}

/**
 * Fetch all shared views from the collection.
 */
export async function getAllSharedViews(): Promise<SharedView[]> {
    await authReady;

    const colRef = collection(db, SHARED_VIEWS_COLLECTION);
    const snapshot = await getDocs(colRef);

    return snapshot.docs.map((d) => d.data() as SharedView);
}

/**
 * Check if a screenplay has been synced to Firestore.
 * Uses the `uploaded_analyses` collection with the sanitized doc ID.
 */
export async function isScreenplaySynced(sourceFile: string): Promise<boolean> {
    await authReady;

    const docRef = doc(db, 'uploaded_analyses', toDocId(sourceFile));
    const snapshot = await getDoc(docRef);

    return snapshot.exists();
}
