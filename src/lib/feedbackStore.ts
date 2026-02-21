/**
 * Feedback Store
 *
 * Stores structured producer feedback on screenplay analyses in Firestore.
 * Used by the Calibration Profile system to learn producer preferences.
 *
 * Firestore collection: screenplay_feedback/{screenplayId}
 */

import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    query,
} from 'firebase/firestore';
import { db } from './firebase';

const FEEDBACK_COLLECTION = 'screenplay_feedback';
const PROFILE_COLLECTION = 'producer_profiles';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DimensionOverride {
    aiScore: number;
    userScore: number;
}

export interface ScreenplayFeedback {
    screenplayId: string;
    screenplayTitle: string;
    /** User's overall score (1-10) */
    userScore: number | null;
    /** User's verdict override */
    userVerdict: string | null;
    /** Per-dimension score overrides */
    dimensionOverrides: Record<string, DimensionOverride>;
    /** What the AI missed */
    aiMissed: string;
    /** What the AI got right */
    aiGotRight: string;
    /** Would you greenlight? */
    greenlight: 'yes' | 'no' | 'maybe' | null;
    /** AI's original weighted score (for delta computation) */
    aiWeightedScore: number;
    /** AI's original verdict */
    aiVerdict: string;
    /** Timestamp */
    updatedAt: string;
}

export interface CalibrationProfile {
    displayName: string;
    totalReviews: number;
    lastCalibrated: string;
    /** The editable calibration prompt text injected into analyses */
    calibrationPrompt: string;
    /** Whether to use the calibration profile for analyses */
    enabled: boolean;
}

// ─── Feedback CRUD ───────────────────────────────────────────────────────────

export async function saveFeedback(feedback: ScreenplayFeedback): Promise<void> {
    try {
        const docRef = doc(db, FEEDBACK_COLLECTION, feedback.screenplayId);
        await setDoc(docRef, {
            ...feedback,
            updatedAt: new Date().toISOString(),
        });
        console.log(`[Lemon] Feedback saved for ${feedback.screenplayTitle}`);
    } catch (err) {
        console.error('[Lemon] Failed to save feedback:', err);
    }
}

export async function loadFeedback(screenplayId: string): Promise<ScreenplayFeedback | null> {
    try {
        const docRef = doc(db, FEEDBACK_COLLECTION, screenplayId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data() as ScreenplayFeedback;
        }
        return null;
    } catch (err) {
        console.warn('[Lemon] Failed to load feedback:', err);
        return null;
    }
}

export async function loadAllFeedback(): Promise<ScreenplayFeedback[]> {
    try {
        const q = query(collection(db, FEEDBACK_COLLECTION));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => d.data() as ScreenplayFeedback);
    } catch (err) {
        console.warn('[Lemon] Failed to load all feedback:', err);
        return [];
    }
}

// ─── Calibration Profile ─────────────────────────────────────────────────────

const PROFILE_ID = 'admin'; // Single admin profile

export async function saveCalibrationProfile(profile: CalibrationProfile): Promise<void> {
    try {
        const docRef = doc(db, PROFILE_COLLECTION, PROFILE_ID);
        await setDoc(docRef, profile);
        console.log('[Lemon] Calibration profile saved');
    } catch (err) {
        console.error('[Lemon] Failed to save calibration profile:', err);
    }
}

export async function loadCalibrationProfile(): Promise<CalibrationProfile | null> {
    try {
        const docRef = doc(db, PROFILE_COLLECTION, PROFILE_ID);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            return snap.data() as CalibrationProfile;
        }
        return null;
    } catch (err) {
        console.warn('[Lemon] Failed to load calibration profile:', err);
        return null;
    }
}

// ─── Calibration Synthesis ───────────────────────────────────────────────────

/**
 * Synthesize a calibration prompt from all feedback data.
 * Returns a human-readable prompt block that can be injected into analysis prompts.
 */
export function synthesizeCalibrationPrompt(feedbackList: ScreenplayFeedback[]): string {
    if (feedbackList.length === 0) return '';

    const lines: string[] = [];
    lines.push('CALIBRATION PROFILE (Admin Producer)');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`Based on ${feedbackList.length} screenplay review(s).`);
    lines.push('');

    // Compute score deltas per dimension
    const dimensionDeltas: Record<string, number[]> = {};
    const verdictOverrides: string[] = [];
    const corrections: string[] = [];
    let totalScoreDelta = 0;
    let scoreDeltaCount = 0;

    for (const fb of feedbackList) {
        // Overall score delta
        if (fb.userScore !== null) {
            totalScoreDelta += fb.userScore - fb.aiWeightedScore;
            scoreDeltaCount++;
        }

        // Dimension deltas
        for (const [dim, override] of Object.entries(fb.dimensionOverrides)) {
            if (!dimensionDeltas[dim]) dimensionDeltas[dim] = [];
            dimensionDeltas[dim].push(override.userScore - override.aiScore);
        }

        // Verdict disagreements
        if (fb.userVerdict && fb.userVerdict !== fb.aiVerdict) {
            verdictOverrides.push(
                `"${fb.screenplayTitle}": AI said ${fb.aiVerdict}, producer said ${fb.userVerdict}`
            );
        }

        // Specific corrections
        if (fb.aiMissed.trim()) {
            corrections.push(`[${fb.screenplayTitle}] AI missed: ${fb.aiMissed.trim()}`);
        }
    }

    // Scoring adjustments
    lines.push('SCORING ADJUSTMENTS (average delta: user score - AI score):');
    if (scoreDeltaCount > 0) {
        const avgDelta = totalScoreDelta / scoreDeltaCount;
        lines.push(`  Overall: ${avgDelta >= 0 ? '+' : ''}${avgDelta.toFixed(1)} bias`);
    }
    for (const [dim, deltas] of Object.entries(dimensionDeltas)) {
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        if (Math.abs(avg) >= 0.3) {
            lines.push(`  ${dim}: ${avg >= 0 ? '+' : ''}${avg.toFixed(1)} bias`);
        }
    }
    lines.push('');

    // Verdict philosophy
    if (verdictOverrides.length > 0) {
        lines.push('VERDICT DISAGREEMENTS:');
        for (const v of verdictOverrides.slice(0, 10)) {
            lines.push(`  - ${v}`);
        }
        lines.push('');
    }

    // Specific corrections
    if (corrections.length > 0) {
        lines.push('LEARNED CORRECTIONS (apply to future analyses):');
        for (const c of corrections.slice(0, 15)) {
            lines.push(`  - ${c}`);
        }
        lines.push('');
    }

    // Greenlight pattern
    const greenlights = feedbackList.filter((f) => f.greenlight === 'yes');
    const noGreenlight = feedbackList.filter((f) => f.greenlight === 'no');
    if (greenlights.length > 0 || noGreenlight.length > 0) {
        lines.push('GREENLIGHT PATTERNS:');
        if (greenlights.length > 0) {
            const avgGLScore = greenlights.reduce((a, f) => a + f.aiWeightedScore, 0) / greenlights.length;
            lines.push(`  Greenlit scripts avg AI score: ${avgGLScore.toFixed(1)}`);
        }
        if (noGreenlight.length > 0) {
            const avgNoScore = noGreenlight.reduce((a, f) => a + f.aiWeightedScore, 0) / noGreenlight.length;
            lines.push(`  Passed scripts avg AI score: ${avgNoScore.toFixed(1)}`);
        }
    }

    return lines.join('\n');
}
