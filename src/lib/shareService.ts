/**
 * Share Service
 *
 * Firestore CRUD for the `shared_views` collection.
 * Creates, revokes, and looks up per-screenplay share tokens
 * that enable partner access via shareable URLs.
 *
 * - createShareToken: authenticated — snapshots full analysis into shared_views doc
 * - resolveShareToken: public — reads shared_views without authReady gate
 * - Other functions gate on `authReady` before Firestore access.
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
import { ref, getDownloadURL } from 'firebase/storage';
import { authReady, db, storage } from './firebase';
import { toDocId } from './analysisStore';
import { useShareStore } from '@/stores/shareStore';
import type {
    Screenplay,
    Note,
    DimensionScores,
    DimensionJustifications,
    CommercialViability,
    Characters,
    ComparableFilm,
    StandoutScene,
    TargetAudience,
    BudgetCategory,
    Marketability,
    RecommendationTier,
} from '@/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SharedView {
    token: string;
    screenplayId: string;
    screenplayTitle: string;
    includeNotes: boolean;
    createdAt: string;
}

export interface SharedViewDocument {
    token: string;
    screenplayId: string;
    screenplayTitle: string;
    includeNotes: boolean;
    createdAt: string;
    pdfUrl: string | null;
    posterUrl: string | null;
    analysis: {
        title: string;
        author: string;
        genre: string;
        subgenres: string[];
        logline: string;
        tone: string;
        themes: string[];
        recommendation: RecommendationTier;
        recommendationRationale: string;
        verdictStatement: string;
        isFilmNow: boolean;
        weightedScore: number;
        cvsTotal: number;
        dimensionScores: DimensionScores;
        dimensionJustifications: DimensionJustifications;
        commercialViability: CommercialViability;
        strengths: string[];
        weaknesses: string[];
        majorWeaknesses: string[];
        developmentNotes: string[];
        characters: Characters;
        comparableFilms: ComparableFilm[];
        standoutScenes: StandoutScene[];
        targetAudience: TargetAudience;
        budgetCategory: BudgetCategory;
        budgetJustification: string;
        marketability: Marketability;
    };
    notes?: Array<{ content: string; createdAt: string }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SHARED_VIEWS_COLLECTION = 'shared_views';
function getShareBaseUrl(): string {
    return `${window.location.origin}/share`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Construct the Firebase Storage path for a screenplay PDF.
 * Mirrors the logic in ModalHeader.tsx.
 */
function buildPdfStoragePath(screenplay: Screenplay): string {
    const category = screenplay.category || 'OTHER';
    const safeName = (screenplay.title || screenplay.sourceFile || 'untitled')
        .replace(/\.pdf$/i, '')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/\s+/g, '_');
    return `screenplays/${category}/${safeName}.pdf`;
}

/**
 * Build the analysis snapshot from a Screenplay object.
 */
function buildAnalysisSnapshot(screenplay: Screenplay): SharedViewDocument['analysis'] {
    return {
        title: screenplay.title,
        author: screenplay.author,
        genre: screenplay.genre,
        subgenres: screenplay.subgenres,
        logline: screenplay.logline,
        tone: screenplay.tone,
        themes: screenplay.themes,
        recommendation: screenplay.recommendation,
        recommendationRationale: screenplay.recommendationRationale,
        verdictStatement: screenplay.verdictStatement,
        isFilmNow: screenplay.isFilmNow,
        weightedScore: screenplay.weightedScore,
        cvsTotal: screenplay.cvsTotal,
        dimensionScores: screenplay.dimensionScores,
        dimensionJustifications: screenplay.dimensionJustifications,
        commercialViability: screenplay.commercialViability,
        strengths: screenplay.strengths,
        weaknesses: screenplay.weaknesses,
        majorWeaknesses: screenplay.majorWeaknesses,
        developmentNotes: screenplay.developmentNotes,
        characters: screenplay.characters,
        comparableFilms: screenplay.comparableFilms,
        standoutScenes: screenplay.standoutScenes,
        targetAudience: screenplay.targetAudience,
        budgetCategory: screenplay.budgetCategory,
        budgetJustification: screenplay.budgetJustification,
        marketability: screenplay.marketability,
    };
}

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Create a share token for a screenplay.
 * Snapshots the full analysis data, resolves pdfUrl, and stores in shared_views.
 * Returns the token and full share URL.
 */
export async function createShareToken(
    screenplayId: string,
    screenplay: Screenplay,
    includeNotes: boolean,
    notes?: Note[],
): Promise<{ token: string; url: string }> {
    await authReady;

    const token = crypto.randomUUID();

    // Resolve pdfUrl at creation time
    let pdfUrl: string | null = null;
    try {
        const storagePath = buildPdfStoragePath(screenplay);
        const fileRef = ref(storage, storagePath);
        pdfUrl = await getDownloadURL(fileRef);
    } catch {
        // PDF not found in storage — store null
        pdfUrl = null;
    }

    const sharedViewDoc: SharedViewDocument = {
        token,
        screenplayId,
        screenplayTitle: screenplay.title,
        includeNotes,
        createdAt: new Date().toISOString(),
        pdfUrl,
        posterUrl: screenplay.posterUrl || null,
        analysis: buildAnalysisSnapshot(screenplay),
    };

    // Include notes only when requested and available
    if (includeNotes && notes?.length) {
        sharedViewDoc.notes = notes.map((n) => ({
            content: n.content,
            createdAt: n.createdAt,
        }));
    }

    const docRef = doc(db, SHARED_VIEWS_COLLECTION, token);
    await setDoc(docRef, sharedViewDoc);

    return {
        token,
        url: `${getShareBaseUrl()}/${token}`,
    };
}

/**
 * Resolve a share token to a SharedViewDocument.
 * Public read — does NOT await authReady (partners have no auth).
 */
export async function resolveShareToken(
    token: string,
): Promise<SharedViewDocument | null> {
    const docRef = doc(db, SHARED_VIEWS_COLLECTION, token);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
        return null;
    }

    return snapshot.data() as SharedViewDocument;
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
