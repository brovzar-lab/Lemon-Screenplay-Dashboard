/**
 * Firebase Configuration
 * Initializes Firebase app, Storage, Firestore, and Google Auth.
 *
 * Dashboard access is restricted to verified @lemonfilms.com accounts.
 * App Check is intentionally skipped (prior provider mismatch caused 400 errors).
 */

import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import {
    GoogleAuthProvider,
    browserLocalPersistence,
    getAuth,
    getRedirectResult,
    onAuthStateChanged,
    setPersistence,
    signInWithCredential,
    signInWithCustomToken,
    signInWithPopup,
    signInWithRedirect,
    signOut,
} from 'firebase/auth';
import type { Unsubscribe, User } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyBN_JWOlHSeu5nbcqY47fkY-9NDd2lIA00",
    authDomain: "lemon-screenplay-dashboard.firebaseapp.com",
    projectId: "lemon-screenplay-dashboard",
    storageBucket: "lemon-screenplay-dashboard.firebasestorage.app",
    messagingSenderId: "493694843892",
    appId: "1:493694843892:web:a31ae16c08191ff25797a1",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Storage
export const storage = getStorage(app);

// Firebase Firestore
export const db = getFirestore(app);

// Firebase Auth (Google Workspace)
export const auth = getAuth(app);

// Resolves after Firebase restores any persisted session. Protected routes do
// not mount data consumers until this resolves with a signed-in user.
export const authReady: Promise<User | null> = (async () => {
    await setPersistence(auth, browserLocalPersistence);

    // Complete any full-page Google sign-in before resolving the restored
    // session. Embedded review browsers return through Firebase's hosted auth
    // handler, so explicitly consuming the redirect result is required for
    // the signed-in user to survive the trip back to localhost.
    await getRedirectResult(auth);

    return new Promise<User | null>((resolve, reject) => {
        let unsubscribe: Unsubscribe = () => {};
        unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
                unsubscribe();
                resolve(user);
            },
            reject,
        );
    });
})();

export const LEMON_EMAIL_DOMAIN = 'lemonfilms.com';

// Public OAuth client identifier used by Google Identity Services. This is
// not a secret. Local embedded review browsers use it to return a Google ID
// token directly to Firebase without relying on a cross-window popup handoff.
export const GOOGLE_WEB_CLIENT_ID =
    '493694843892-o0m76qpj6h6he3ovdnp14sag1lhln9ef.apps.googleusercontent.com';

export function isLemonEmail(email: string | null | undefined): boolean {
    return email?.toLowerCase().endsWith(`@${LEMON_EMAIL_DOMAIN}`) ?? false;
}

export async function signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
        hd: LEMON_EMAIL_DOMAIN,
        prompt: 'select_account',
    });

    try {
        // Popup auth keeps the app origin alive while Google verifies the
        // account. This is the reliable path in embedded review browsers,
        // where cross-site redirect state may be partitioned or discarded.
        await signInWithPopup(auth, provider);
    } catch (error) {
        const code =
            typeof error === 'object' && error !== null && 'code' in error
                ? String(error.code)
                : '';

        if (
            code !== 'auth/popup-blocked' &&
            code !== 'auth/operation-not-supported-in-this-environment'
        ) {
            throw error;
        }

        // Preserve a full-page fallback for browsers that cannot create a
        // popup. authReady consumes the redirect result when the app returns.
        await signInWithRedirect(auth, provider);
    }
}

export async function signInWithGoogleIdToken(idToken: string): Promise<void> {
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
}

export async function signInForLocalReview(): Promise<void> {
    const isLoopback =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
    if (!import.meta.env.DEV || !isLoopback) {
        throw new Error('Local review sign-in is available only on this Mac.');
    }

    const response = await fetch('/__local-review/session', {
        method: 'POST',
        headers: { 'X-Lemon-Local-Review': '1' },
        credentials: 'same-origin',
    });
    const payload = await response.json() as { token?: string; error?: string };

    if (!response.ok || !payload.token) {
        throw new Error(payload.error ?? 'Local review sign-in is unavailable.');
    }

    await signInWithCustomToken(auth, payload.token);
}

export function signOutUser(): Promise<void> {
    return signOut(auth);
}

/**
 * Sanitize a screenplay name for use as a Storage path component.
 * Same logic both `uploadScreenplayPdf` and `uploadPdfToIngestQueue` share so
 * the daemon can find the file the browser uploaded.
 */
function sanitizeForStoragePath(name: string): string {
    return name
        .replace(/\.pdf$/i, '')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/\s+/g, '_');
}

/**
 * Upload a screenplay PDF to Firebase Storage.
 * Path: screenplays/{category}/{sanitized_filename}.pdf
 *
 * @returns download URL of the uploaded file
 */
export async function uploadScreenplayPdf(
    file: File,
    category: string,
    title?: string,
): Promise<string> {
    const safeName = sanitizeForStoragePath(title || file.name);
    const path = `screenplays/${category}/${safeName}.pdf`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file, {
        contentType: 'application/pdf',
        customMetadata: {
            originalFilename: file.name,
            category,
            uploadedAt: new Date().toISOString(),
        },
    });

    return getDownloadURL(storageRef);
}

/**
 * Upload a PDF to the ingest-queue drop zone.
 * Path: ingest-queue/{collection_id}/{upload_id}/{sanitized_filename}.pdf
 *
 * The `onScreenplayUploaded` Cloud Function (Storage trigger) watches this
 * path and writes a pending IngestJob doc to Firestore. The VPS daemon then
 * claims and processes it.
 *
 * Optional `requestedModel` is forwarded via Storage `customMetadata.model`
 * so the daemon picks the right tier.
 *
 * @returns the `gs://bucket/objectName` storage path (used to find the
 *          resulting `ingest-queue` Firestore doc).
 */
export async function uploadPdfToIngestQueue(
    file: File,
    collectionId: string,
    options?: {
        engine?: 'coverage_v1' | 'v9';
        requestedModel?: string;
        priority?: number;
        targetProjectId?: string;
        /** Force a distinct project when the filename/title matches an existing one. */
        separateProject?: boolean;
        /** Test/replay override. Normal uploads always receive a fresh UUID. */
        uploadId?: string;
        /** Same-batch parent upload that must complete before this revision runs. */
        dependsOnUploadId?: string;
    },
): Promise<{ storagePath: string; objectName: string; uploadId: string }> {
    // ingest-queue/ Storage rule requires an admin session.
    await authReady;

    const safeName = sanitizeForStoragePath(file.name);
    const uploadId = options?.uploadId ?? crypto.randomUUID();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(uploadId)) {
        throw new Error('Upload ID must be a safe Storage path component.');
    }
    if (
        options?.targetProjectId &&
        (options.targetProjectId.length > 200 || options.targetProjectId.includes('/'))
    ) {
        throw new Error('Target project ID must be a valid Firestore document ID.');
    }
    if (options?.targetProjectId && options.separateProject) {
        throw new Error('An upload cannot be both a revision and a separate project.');
    }
    if (options?.engine && options.engine !== 'coverage_v1' && options.engine !== 'v9') {
        throw new Error('Upload engine must be coverage_v1 or v9.');
    }
    if (
        options?.dependsOnUploadId &&
        !/^[a-zA-Z0-9_-]{8,128}$/.test(options.dependsOnUploadId)
    ) {
        throw new Error('Parent upload ID must be a safe Storage identity.');
    }

    const objectName = `ingest-queue/${collectionId}/${uploadId}/${safeName}.pdf`;
    const storageRef = ref(storage, objectName);

    const customMetadata: Record<string, string> = {
        originalFilename: file.name,
        category: collectionId,
        uploadedAt: new Date().toISOString(),
        uploadId,
    };
    if (options?.requestedModel) customMetadata.model = options.requestedModel;
    if (options?.engine) customMetadata.engine = options.engine;
    if (options?.priority != null) customMetadata.priority = String(options.priority);
    if (options?.targetProjectId) customMetadata.targetProjectId = options.targetProjectId;
    if (options?.separateProject) customMetadata.separateProject = 'true';
    if (options?.dependsOnUploadId) {
        customMetadata.dependsOnUploadId = options.dependsOnUploadId;
    }

    await uploadBytes(storageRef, file, {
        contentType: 'application/pdf',
        customMetadata,
    });

    const bucket = firebaseConfig.storageBucket;
    return {
        storagePath: `gs://${bucket}/${objectName}`,
        objectName,
        uploadId,
    };
}

export default app;
