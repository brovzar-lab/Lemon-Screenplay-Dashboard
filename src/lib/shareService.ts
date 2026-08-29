/**
 * Share Service
 *
 * Firestore CRUD for the `shared_views` collection.
 * Creates, revokes, and looks up per-screenplay share tokens
 * that enable partner access via shareable URLs.
 *
 * - createShareToken: authenticated — snapshots full analysis into shared_views doc
 * - resolveShareToken: public — resolves through the server authority receipt
 * - Other functions gate on `authReady` before Firestore access.
 */

import {
    doc,
    getDoc,
} from 'firebase/firestore';
import { authReady, db } from './firebase';
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
    PillarScore,
    ProducerProjection,
    LocalizedAnalysisMap,
} from '@/types';
import { normalizeV9Screenplay } from '@/lib/normalizers/normalizeV9';
import { getProxyAuthHeaders } from '@/lib/proxyClient';
import { requireDecisionReady } from '@/lib/producerProjection';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SharedView {
    authorityVersion?: string;
    token: string;
    screenplayId: string;
    screenplayTitle: string;
    includeNotes: boolean;
    createdAt: string;
    /** ISO timestamp after which the link no longer resolves. */
    expiresAt?: string;
}

export interface SharedViewDocument {
    token: string;
    screenplayId: string;
    screenplayTitle: string;
    includeNotes: boolean;
    createdAt: string;
    /** ISO timestamp after which the link no longer resolves (for display). */
    expiresAt?: string;
    /** Same instant as epoch millis — the Firestore rule compares this. */
    expiresAtMillis?: number;
    pdfUrl: string | null;
    posterUrl: string | null;
    localizedAnalysis?: LocalizedAnalysisMap;
    sealedVersion?: Record<string, unknown>;
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
        pillarScores?: PillarScore[];
        producerProjection?: ProducerProjection;
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

const SHARE_AUTHORITY_VERSION = 'lemon-share-authority-v1';

/** Default share-link lifetime. Confidential coverage should not live at a
 *  public URL forever; a forwarded link goes stale on its own. */
export const DEFAULT_SHARE_TTL_DAYS = 30;

function getShareBaseUrl(): string {
    return `${window.location.origin}/share`;
}

function getShareEndpoint(): string {
    return import.meta.env.DEV
        ? 'http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/shareManager'
        : '/api/share';
}

/** True when a share doc carries an expiry that is now in the past. Docs with
 *  no expiresAt (created before this feature) never expire — grandfathered. */
function isExpired(doc: { expiresAt?: string }): boolean {
    if (!doc.expiresAt) return false;
    const expiry = Date.parse(doc.expiresAt);
    return Number.isFinite(expiry) && expiry < Date.now();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the analysis snapshot from a Screenplay object.
 */
function compactProducerProjection(
    projection: ProducerProjection,
): ProducerProjection {
    const {
        verdictBeforeGates,
        trustManifestVersion,
        ...required
    } = projection;
    return {
        ...required,
        ...(verdictBeforeGates !== undefined ? { verdictBeforeGates } : {}),
        ...(trustManifestVersion !== undefined ? { trustManifestVersion } : {}),
    };
}

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
        ...(screenplay.pillarScores
            ? { pillarScores: screenplay.pillarScores }
            : {}),
        ...(screenplay.producerProjection
            ? {
                producerProjection: compactProducerProjection(
                    screenplay.producerProjection,
                ),
            }
            : {}),
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
    ttlDays: number = DEFAULT_SHARE_TTL_DAYS,
): Promise<{ token: string; url: string; expiresAt: string }> {
    requireDecisionReady([screenplay]);
    if (!screenplay.projectId || !screenplay.latestVersionId) {
        throw new Error('Sharing requires the exact immutable analysis version.');
    }
    await authReady;
    if (ttlDays !== DEFAULT_SHARE_TTL_DAYS) {
        throw new Error('The server enforces the 30-day share lifetime.');
    }
    const response = await fetch(getShareEndpoint(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(await getProxyAuthHeaders()),
        },
        body: JSON.stringify({
            projectId: screenplay.projectId,
            versionId: screenplay.latestVersionId,
            screenplayId,
            includeNotes,
            notes: includeNotes
                ? notes?.map((note) => ({ content: note.content, createdAt: note.createdAt }))
                : undefined,
        }),
    });
    const result = await response.json() as {
        token?: string;
        expiresAt?: string;
        error?: string;
    };
    if (!response.ok || !result.token || !result.expiresAt) {
        throw new Error(result.error || 'Failed to create a trusted share link.');
    }

    return {
        token: result.token,
        url: `${getShareBaseUrl()}/${result.token}`,
        expiresAt: result.expiresAt,
    };
}

/**
 * Resolve a share token to a SharedViewDocument.
 * Public read — does NOT await authReady (partners have no auth).
 */
export async function resolveShareToken(
    token: string,
): Promise<SharedViewDocument | null> {
    const response = await fetch(`${getShareEndpoint()}?token=${encodeURIComponent(token)}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('The trusted share could not be resolved.');
    const data = await response.json() as SharedViewDocument;
    if (data.token !== token) return null;

    // Expired links resolve to null — the SharedViewPage renders ExpiredLinkPage,
    // exactly as it does for a missing/revoked token.
    if (isExpired(data)) {
        return null;
    }

    if (data.sealedVersion) {
        const normalized = normalizeV9Screenplay({
            ...data.sealedVersion,
            _trust_authority: 'immutable_public_share',
        }, 'Analysis');
        requireDecisionReady([normalized]);
        const localizedAnalysis = normalized.localizedAnalysis?.es?.sourceVersionId
            === normalized.latestVersionId
            ? normalized.localizedAnalysis
            : undefined;
        return {
            ...data,
            analysis: buildAnalysisSnapshot(normalized),
            localizedAnalysis,
        };
    }

    return null;
}

/**
 * Update whether an existing share exposes current producer notes. The server
 * rebuilds the snapshot from the immutable analysis version; the browser never
 * writes the capability document directly.
 */
export async function updateShareNotes(
    token: string,
    screenplayId: string,
    includeNotes: boolean,
    notes?: Note[],
): Promise<void> {
    await authReady;
    const response = await fetch(getShareEndpoint(), {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            ...(await getProxyAuthHeaders()),
        },
        body: JSON.stringify({
            token,
            screenplayId,
            includeNotes,
            notes: includeNotes
                ? notes?.map((note) => ({ content: note.content, createdAt: note.createdAt }))
                : undefined,
        }),
    });
    if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || 'Failed to update the trusted share link.');
    }
}

/**
 * Revoke a share token through the authenticated server manager.
 * Also clears the session cache via shareStore.
 */
export async function revokeShareToken(
    token: string,
    screenplayId: string,
): Promise<void> {
    await authReady;
    const response = await fetch(getShareEndpoint(), {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            ...(await getProxyAuthHeaders()),
        },
        body: JSON.stringify({ token, screenplayId }),
    });
    if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || 'Failed to revoke the trusted share link.');
    }

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
    const response = await fetch(
        `${getShareEndpoint()}?screenplayId=${encodeURIComponent(screenplayId)}`,
        { headers: await getProxyAuthHeaders() },
    );
    if (!response.ok) throw new Error('Failed to verify existing share links.');
    const result = await response.json() as { views?: SharedView[] };
    const live = (result.views ?? []).find(
        (view) => view.authorityVersion === SHARE_AUTHORITY_VERSION && !isExpired(view),
    );

    return live ?? null;
}

/**
 * Fetch all shared views from the collection.
 */
export async function getAllSharedViews(): Promise<SharedView[]> {
    await authReady;
    const response = await fetch(getShareEndpoint(), {
        headers: await getProxyAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to verify active share links.');
    const result = await response.json() as { views?: SharedView[] };
    return (result.views ?? []).filter(
        (view) => view.authorityVersion === SHARE_AUTHORITY_VERSION && !isExpired(view),
    );
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
