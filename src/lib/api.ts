import type { Screenplay, Collection } from '@/types';
import {
    isArchaeologyAnalysis,
    normalizeV9Screenplay,
} from './normalize';
import { loadAllAnalyses, quarantineAnalysis } from './analysisStore';
import { useToastStore } from '@/stores/toastStore';

const reportedQuarantineSources = new Set<string>();

/** Normalize raw cached or live Firestore analyses into the UI screenplay shape. */
export async function normalizeAnalyses(rawList: Record<string, unknown>[]): Promise<Screenplay[]> {
    const screenplays: Screenplay[] = [];
    const t0 = performance.now();

    let loadedCount = 0;
    let newlyQuarantinedCount = 0;
    for (const raw of rawList) {
        try {
            if (isArchaeologyAnalysis(raw)) {
                const collection = (raw.collection_id ?? raw.collection) as Collection | undefined;
                const sp = normalizeV9Screenplay(raw, collection || 'Analysis');
                screenplays.push(sp);
                loadedCount++;
            } else {
                const sourceFile = raw.source_file as string | undefined;
                console.warn('[Lemon] Quarantining unknown format analysis:', sourceFile);
                const quarantineKey = sourceFile || 'unknown-document';
                if (!reportedQuarantineSources.has(quarantineKey)) {
                    reportedQuarantineSources.add(quarantineKey);
                    newlyQuarantinedCount++;
                }
                try {
                    await quarantineAnalysis(raw, 'unrecognized analysis_version (not a V9/V8 archaeology document)');
                } catch {
                    /* ignore */
                }
            }
        } catch (err) {
            const sourceFile = raw.source_file as string | undefined;
            console.error(
                `[Lemon] Failed to normalize uploaded analysis "${sourceFile || 'unknown'}", quarantining corrupted entry:`,
                err,
            );
            const quarantineKey = sourceFile || 'unknown-document';
            if (!reportedQuarantineSources.has(quarantineKey)) {
                reportedQuarantineSources.add(quarantineKey);
                newlyQuarantinedCount++;
            }
            try {
                await quarantineAnalysis(
                    raw,
                    'normalization error: ' + (err instanceof Error ? err.message : String(err)),
                );
            } catch {
                /* ignore cleanup errors */
            }
        }
    }
    if (rawList.length > 0) {
        console.log(`[Lemon] Normalized ${loadedCount}/${rawList.length} analyses`);
    }
    if (newlyQuarantinedCount > 0) {
        const label = newlyQuarantinedCount === 1 ? 'analysis was' : 'analyses were';
        useToastStore
            .getState()
            .addToast(
                `${newlyQuarantinedCount} malformed ${label} quarantined. Review Settings > Data.`,
                'warning',
            );
    }

    const seen = new Map<string, Screenplay>();
    for (const sp of screenplays) {
        const key = (sp.title || '').toLowerCase().trim();
        seen.set(key, sp);
    }
    const deduplicated = Array.from(seen.values());

    console.log(
        `[Lemon] Prepared ${deduplicated.length} unique screenplays in ${Math.round(performance.now() - t0)}ms`,
    );
    return deduplicated;
}

/** Load the startup cache. Live Firestore snapshots replace it in React Query. */
export async function loadAllScreenplaysVite(): Promise<Screenplay[]> {
    try {
        return normalizeAnalyses(await loadAllAnalyses());
    } catch (err) {
        console.warn('[Lemon] Startup cache may be unavailable:', err);
        return [];
    }
}

/**
 * Get statistics from screenplay data
 */
export function getScreenplayStats(screenplays: Screenplay[]) {
    const total = screenplays.length;
    const filmNowCount = screenplays.filter((s) => s.isFilmNow).length;
    const recommendCount = screenplays.filter((s) => s.recommendation === 'recommend').length;
    const considerCount = screenplays.filter((s) => s.recommendation === 'consider').length;
    const passCount = screenplays.filter((s) => s.recommendation === 'pass').length;

    const avgWeightedScore =
        total > 0 ? screenplays.reduce((sum, s) => sum + s.weightedScore, 0) / total : 0;

    const avgCvs = total > 0 ? screenplays.reduce((sum, s) => sum + s.cvsTotal, 0) / total : 0;

    // Unique genres
    const genres = [...new Set(screenplays.map((s) => s.genre))].sort();

    // Unique themes
    const allThemes = screenplays.flatMap((s) => s.themes);
    const themes = [...new Set(allThemes)].sort();

    // Collection counts
    const byCollection = screenplays.reduce(
        (acc, s) => {
            acc[s.collection] = (acc[s.collection] || 0) + 1;
            return acc;
        },
        {} as Record<Collection, number>,
    );

    return {
        total,
        filmNowCount,
        recommendCount,
        considerCount,
        passCount,
        avgWeightedScore: Math.round(avgWeightedScore * 100) / 100,
        avgCvs: Math.round(avgCvs * 100) / 100,
        genres,
        themes,
        byCollection,
    };
}
