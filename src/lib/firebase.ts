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
    onAuthStateChanged,
    setPersistence,
    signInWithPopup,
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

export function isLemonEmail(email: string | null | undefined): boolean {
    return email?.toLowerCase().endsWith(`@${LEMON_EMAIL_DOMAIN}`) ?? false;
}

export async function signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
        hd: LEMON_EMAIL_DOMAIN,
        prompt: 'select_account',
    });

    const credential = await signInWithPopup(auth, provider);
    if (!credential.user.emailVerified || !isLemonEmail(credential.user.email)) {
        await signOut(auth);
        throw new Error(`Use your @${LEMON_EMAIL_DOMAIN} Google account.`);
    }
    return credential.user;
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
 * Path: ingest-queue/{collection_id}/{sanitized_filename}.pdf
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
    options?: { requestedModel?: string; priority?: number },
): Promise<{ storagePath: string; objectName: string }> {
    // ingest-queue/ Storage rule requires an admin session.
    await authReady;

    const safeName = sanitizeForStoragePath(file.name);
    const objectName = `ingest-queue/${collectionId}/${safeName}.pdf`;
    const storageRef = ref(storage, objectName);

    const customMetadata: Record<string, string> = {
        originalFilename: file.name,
        category: collectionId,
        uploadedAt: new Date().toISOString(),
    };
    if (options?.requestedModel) customMetadata.model = options.requestedModel;
    if (options?.priority != null) customMetadata.priority = String(options.priority);

    await uploadBytes(storageRef, file, {
        contentType: 'application/pdf',
        customMetadata,
    });

    const bucket = firebaseConfig.storageBucket;
    return {
        storagePath: `gs://${bucket}/${objectName}`,
        objectName,
    };
}

export default app;
