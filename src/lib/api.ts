/**
 * Data Loading API
 * Fetches and normalizes screenplay data from JSON files
 * V6 analysis format only
 */

import type { Screenplay, Collection } from '@/types';
import type { V6ScreenplayAnalysis } from '@/types/screenplay-v6';
import type { ScreenplayWithV6 } from './normalize';
import { isV6RawAnalysis, normalizeV6Screenplay } from './normalize';
import { loadAllAnalyses, removeAnalysis } from './analysisStore';

/**
 * Load all screenplay data from V6 analysis files
 */
export async function loadAllScreenplaysVite(): Promise<ScreenplayWithV6[]> {
  const screenplays: ScreenplayWithV6[] = [];
  const t0 = performance.now();

  // Fetch V6 index
  let v6FileList: string[] = [];
  try {
    const res = await fetch('/data/analysis_v6/index.json');
    if (res.ok) v6FileList = await res.json() as string[];
  } catch { /* no V6 index */ }

  console.log(`[Lemon] Found ${v6FileList.length} V6 analysis files`);

  // Fetch all V6 analysis files in parallel
  const fetches = v6FileList.map(async (filename) => {
    try {
      const response = await fetch(`/data/analysis_v6/${filename}`);
      if (!response.ok) return;
      const raw = await response.json();
      if (isV6RawAnalysis(raw)) {
        const collectionFromJson = (raw as unknown as Record<string, unknown>).collection as Collection | undefined;
        const collection: Collection = collectionFromJson || 'V6 Analysis';
        const screenplay = normalizeV6Screenplay(raw as V6ScreenplayAnalysis, collection);
        screenplays.push(screenplay);
      } else {
        console.warn(`[Lemon] ${filename} in V6 folder is not V6 format`);
      }
    } catch (error) {
      console.warn(`[Lemon] Failed to load/normalize V6 ${filename}:`, error);
    }
  });

  await Promise.all(fetches);
  console.log(`[Lemon] Fetched ${screenplays.length} screenplays in ${Math.round(performance.now() - t0)}ms`);

  // Load locally analyzed screenplays (from user uploads via Firestore)
  try {
    const localRawList = await loadAllAnalyses();
    let loadedCount = 0;
    for (const raw of localRawList) {
      try {
        if (isV6RawAnalysis(raw)) {
          const collection = (raw as Record<string, unknown>).collection as Collection | undefined;
          const sp = normalizeV6Screenplay(raw as unknown as V6ScreenplayAnalysis, collection || 'V6 Analysis');
          screenplays.push(sp);
          loadedCount++;
        } else {
          // Pre-V6 upload detected — remove it
          const sourceFile = (raw as Record<string, unknown>).source_file as string | undefined;
          console.warn('[Lemon] Removing pre-V6 uploaded analysis:', sourceFile);
          if (sourceFile) {
            try { await removeAnalysis(sourceFile); } catch { /* ignore */ }
          }
        }
      } catch (err) {
        const sourceFile = (raw as Record<string, unknown>).source_file as string | undefined;
        console.error(`[Lemon] Failed to normalize uploaded analysis "${sourceFile || 'unknown'}", removing corrupted entry:`, err);
        if (sourceFile) {
          try { await removeAnalysis(sourceFile); } catch { /* ignore cleanup errors */ }
        }
      }
    }
    if (localRawList.length > 0) {
      console.log(`[Lemon] Loaded ${loadedCount}/${localRawList.length} locally analyzed screenplays`);
    }
  } catch (err) {
    console.warn('[Lemon] localStorage may be unavailable:', err);
  }

  // Deduplicate by title (prefer local uploads over static files)
  const seen = new Map<string, ScreenplayWithV6>();
  for (const sp of screenplays) {
    const key = (sp.title || '').toLowerCase().trim();
    seen.set(key, sp); // last write wins — locals loaded after static
  }
  const deduplicated = Array.from(seen.values());

  console.log(`[Lemon] Successfully loaded ${deduplicated.length} unique screenplays`);
  return deduplicated;
}

/**
 * Load only V6 analysis files
 * Returns screenplays with V6-specific fields (core quality, lenses, false positive check)
 */
export async function loadV6ScreenplaysOnly(): Promise<ScreenplayWithV6[]> {
  const screenplays: ScreenplayWithV6[] = [];

  try {
    const indexResponse = await fetch('/data/analysis_v6/index.json');
    if (!indexResponse.ok) {
      console.warn('[Lemon] No V6 analysis index found');
      return [];
    }

    const fileList: string[] = await indexResponse.json();
    console.log(`[Lemon] Found ${fileList.length} V6 analysis files`);

    for (const filename of fileList) {
      try {
        const response = await fetch(`/data/analysis_v6/${filename}`);
        if (response.ok) {
          const raw = await response.json();
          if (isV6RawAnalysis(raw)) {
            const collectionFromJson = (raw as any).collection as Collection | undefined;
            const collection: Collection = collectionFromJson || 'V6 Analysis';
            const screenplay = normalizeV6Screenplay(raw as V6ScreenplayAnalysis, collection);
            screenplays.push(screenplay);
          }
        }
      } catch (error) {
        console.warn(`[Lemon] Failed to load V6 ${filename}:`, error);
      }
    }
  } catch (error) {
    console.error(`[Lemon] Failed to load V6 analysis:`, error);
  }

  return screenplays;
}

/**
 * Extract collection name from file path
 */
export function getCollectionFromPath(path: string): Collection | null {
  if (path.includes('analysis_v6')) return 'V6 Analysis';
  return null;
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
