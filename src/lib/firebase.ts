/**
 * Firebase Configuration
 * Initializes Firebase app, App Check (reCAPTCHA v3), Storage, and Firestore.
 *
 * App Check (C1/C2 fix final layer):
 *   - Forces all Firestore + Storage requests to carry a valid reCAPTCHA v3 token
 *   - Firebase Console enforcement rejects any request without a valid token
 *   - This means only requests from lemon-screenplay-dashboard.web.app are accepted
 */

import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

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

// ── App Check — reCAPTCHA v3 ──────────────────────────────────────────────────
// IMPORTANT: This must be initialized BEFORE getFirestore() / getStorage().
// In local development, set window.FIREBASE_APPCHECK_DEBUG_TOKEN = true in the
// browser console to generate a debug token, then add it to Firebase Console
// under App Check > Apps > ⋮ > Manage debug tokens.
if (typeof window !== 'undefined') {
    initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider('6Le1EYgsAAAAADsmvLtnkHzt_uJ6G9bin05q8CWu'),
        // isTokenAutoRefreshEnabled: keep tokens fresh without user interaction
        isTokenAutoRefreshEnabled: true,
    });
}

// Firebase Storage
export const storage = getStorage(app);

// Firebase Firestore
export const db = getFirestore(app);

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
    // Build a clean filename
    const safeName = (title || file.name.replace(/\.pdf$/i, ''))
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/\s+/g, '_');

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

export default app;
