/**
 * Firebase Configuration
 * Initializes Firebase app and exports Storage reference
 */

import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
