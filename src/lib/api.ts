import type { Screenplay, Collection } from '@/types';
import { isV7RawAnalysis, normalizeV7Screenplay, isV6UnifiedAnalysis, normalizeV6UnifiedScreenplay } from './normalize';
import { loadAllAnalyses, quarantineAnalysis } from './analysisStore';


/**
 * Load all screenplay data from Firestore/localStorage.
 * Migration is complete — reads exclusively from Firestore/localStorage.
 */
export async function loadAllScreenplaysVite(): Promise<Screenplay[]> {
  const screenplays: Screenplay[] = [];
  const t0 = performance.now();

  // ── Load user-uploaded / migrated screenplays from Firestore ────
  try {
    const localRawList = await loadAllAnalyses();
    let loadedCount = 0;
    for (const raw of localRawList) {
      try {
        if (isV7RawAnalysis(raw)) {
          const collection = ((raw as Record<string, unknown>).collection_id ?? (raw as Record<string, unknown>).collection) as Collection | undefined;
          const sp = normalizeV7Screenplay(raw as Record<string, unknown>, collection || 'Analysis');
          screenplays.push(sp);
          loadedCount++;
        } else if (isV6UnifiedAnalysis(raw)) {
          const collection = ((raw as Record<string, unknown>).collection_id ?? (raw as Record<string, unknown>).collection) as Collection | undefined;
          const sp = normalizeV6UnifiedScreenplay(raw as Record<string, unknown>, collection || 'Analysis');
          screenplays.push(sp);
          loadedCount++;
        } else {
          // Unknown format — quarantine it
          const sourceFile = (raw as Record<string, unknown>).source_file as string | undefined;
          console.warn('[Lemon] Quarantining unknown format analysis:', sourceFile);
          try { await quarantineAnalysis(raw as Record<string, unknown>, 'failed isV6RawAnalysis type guard'); } catch { /* ignore */ }
        }

      } catch (err) {
        const sourceFile = (raw as Record<string, unknown>).source_file as string | undefined;
        console.error(`[Lemon] Failed to normalize uploaded analysis "${sourceFile || 'unknown'}", quarantining corrupted entry:`, err);
        try { await quarantineAnalysis(raw as Record<string, unknown>, 'normalization error: ' + (err instanceof Error ? err.message : String(err))); } catch { /* ignore cleanup errors */ }
      }
    }
    if (localRawList.length > 0) {
      console.log(`[Lemon] Loaded ${loadedCount}/${localRawList.length} analyses from store`);
    }
  } catch (err) {
    console.warn('[Lemon] localStorage may be unavailable:', err);
  }

  // Deduplicate by title (prefer later entries — locals loaded after static)
  const seen = new Map<string, Screenplay>();
  for (const sp of screenplays) {
    const key = (sp.title || '').toLowerCase().trim();
    seen.set(key, sp); // last write wins
  }
  const deduplicated = Array.from(seen.values());

  console.log(`[Lemon] Successfully loaded ${deduplicated.length} unique screenplays in ${Math.round(performance.now() - t0)}ms`);
  return deduplicated;
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
    total > 0
      ? screenplays.reduce((sum, s) => sum + s.weightedScore, 0) / total
      : 0;

  const avgCvs =
    total > 0
      ? screenplays.reduce((sum, s) => sum + s.cvsTotal, 0) / total
      : 0;

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
    {} as Record<Collection, number>
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
