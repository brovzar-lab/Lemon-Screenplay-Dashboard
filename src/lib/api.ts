/**
 * Data Loading API
 * Fetches and normalizes screenplay data from JSON files
 * Supports V5 and V6 analysis formats
 */

import type { RawScreenplayAnalysis, Screenplay, Collection } from '@/types';
import type { V6ScreenplayAnalysis } from '@/types/screenplay-v6';
import type { ScreenplayWithV6 } from './normalize';
import { normalizeScreenplay, isV6RawAnalysis, normalizeV6Screenplay } from './normalize';

// Base path to analysis data (relative to public folder or absolute)
const DATA_BASE_PATH = '../../.tmp';

/**
 * Collection folder mapping
 * V5 ONLY - All screenplays now in analysis_v5 with collection info in JSON
 */
const COLLECTION_FOLDERS: Record<Collection, string> = {
  '2005 Black List': 'analysis_v5',
  '2006 Black List': 'analysis_v5',
  '2007 Black List': 'analysis_v5',
  '2020 Black List': 'analysis_v5',
  'Randoms': 'analysis_v5',
  'V4 Fixed': 'analysis_v5',
  'V5 Analysis': 'analysis_v5',
  'V6 Analysis': 'analysis_v6',
};

/**
 * Fetch a single analysis JSON file
 */
async function fetchAnalysis(path: string): Promise<RawScreenplayAnalysis | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      console.warn(`Failed to fetch ${path}: ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`Error fetching ${path}:`, error);
    return null;
  }
}

/**
 * List all JSON files in a collection folder
 * Note: This requires server-side support or a manifest file
 * For now, we'll use a manifest approach
 */
async function fetchCollectionManifest(collection: Collection): Promise<string[]> {
  const folder = COLLECTION_FOLDERS[collection];
  const manifestPath = `${DATA_BASE_PATH}/${folder}/manifest.json`;

  try {
    const response = await fetch(manifestPath);
    if (!response.ok) {
      // If no manifest, try to list known files
      console.warn(`No manifest found for ${collection}, using fallback`);
      return [];
    }
    return await response.json();
  } catch {
    return [];
  }
}

/**
 * Fetch all screenplays for a collection
 */
export async function fetchCollection(collection: Collection): Promise<Screenplay[]> {
  const folder = COLLECTION_FOLDERS[collection];
  const basePath = `${DATA_BASE_PATH}/${folder}`;

  // Get list of files from manifest
  const files = await fetchCollectionManifest(collection);

  if (files.length === 0) {
    console.warn(`No files found for collection: ${collection}`);
    return [];
  }

  // Fetch all analysis files in parallel
  const promises = files.map((file) =>
    fetchAnalysis(`${basePath}/${file}`)
  );

  const results = await Promise.all(promises);

  // Filter out nulls and normalize
  return results
    .filter((r): r is RawScreenplayAnalysis => r !== null)
    .map((raw) => normalizeScreenplay(raw, collection));
}

/**
 * Fetch all screenplays from all collections
 */
export async function fetchAllScreenplays(): Promise<Screenplay[]> {
  const collections: Collection[] = [
    '2005 Black List',
    '2006 Black List',
    '2007 Black List',
    '2020 Black List',
    'Randoms',
    'V4 Fixed',
    'V5 Analysis',
  ];

  const promises = collections.map((collection) => fetchCollection(collection));
  const results = await Promise.all(promises);

  // Flatten all collections into one array
  return results.flat();
}

/**
 * For development: Load data directly from imported JSON
 * This approach works better with Vite's static asset handling
 */


/**
 * Load all screenplay data using Vite's glob import
 * This is the preferred method for development
 *
 * Supports both V5 and V6 analysis formats
 * V5: All screenplays are in analysis_v5 folder
 * V6: All screenplays are in analysis_v6 folder (Core + Lenses architecture)
 */
export async function loadAllScreenplaysVite(): Promise<(Screenplay | ScreenplayWithV6)[]> {
  const screenplays: (Screenplay | ScreenplayWithV6)[] = [];

  // Load V5 analysis files
  try {
    const indexResponse = await fetch('/data/analysis_v5/index.json');
    if (indexResponse.ok) {
      const fileList: string[] = await indexResponse.json();
      console.log(`[Lemon] Found ${fileList.length} V5 analysis files`);

      for (const filename of fileList) {
        try {
          const response = await fetch(`/data/analysis_v5/${filename}`);
          if (response.ok) {
            const raw: RawScreenplayAnalysis = await response.json();
            try {
              const collectionFromJson = (raw as any).collection as Collection | undefined;
              const collection: Collection = collectionFromJson || 'V5 Analysis';
              const screenplay = normalizeScreenplay(raw, collection);
              if (!screenplay.producerMetrics) {
                console.error(`[Lemon] Missing producerMetrics for ${filename}`, screenplay);
              }
              screenplays.push(screenplay);
            } catch (normalizeError) {
              console.error(`[Lemon] V5 normalization failed for ${filename}:`, normalizeError);
            }
          }
        } catch (error) {
          console.warn(`[Lemon] Failed to load V5 ${filename}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn(`[Lemon] No V5 analysis index found:`, error);
  }

  // Load V6 analysis files
  try {
    const indexResponse = await fetch('/data/analysis_v6/index.json');
    if (indexResponse.ok) {
      const fileList: string[] = await indexResponse.json();
      console.log(`[Lemon] Found ${fileList.length} V6 analysis files`);

      for (const filename of fileList) {
        try {
          const response = await fetch(`/data/analysis_v6/${filename}`);
          if (response.ok) {
            const raw = await response.json();
            try {
              if (isV6RawAnalysis(raw)) {
                const collectionFromJson = (raw as any).collection as Collection | undefined;
                const collection: Collection = collectionFromJson || 'V6 Analysis';
                const screenplay = normalizeV6Screenplay(raw as V6ScreenplayAnalysis, collection);
                if (!screenplay.producerMetrics) {
                  console.error(`[Lemon] Missing producerMetrics for ${filename}`, screenplay);
                }
                screenplays.push(screenplay);
              } else {
                console.warn(`[Lemon] ${filename} in V6 folder is not V6 format`);
              }
            } catch (normalizeError) {
              console.error(`[Lemon] V6 normalization failed for ${filename}:`, normalizeError);
            }
          }
        } catch (error) {
          console.warn(`[Lemon] Failed to load V6 ${filename}:`, error);
        }
      }
    }
  } catch (error) {
    console.warn(`[Lemon] No V6 analysis index found (this is normal if no V6 analyses exist yet)`);
  }

  // Deduplicate by title - prefer V6 over V5
  const seen = new Map<string, (Screenplay | ScreenplayWithV6)>();
  for (const sp of screenplays) {
    const key = sp.title.toLowerCase().trim();
    const existing = seen.get(key);
    // Prefer V6 (has coreQuality) over V5
    if (!existing || ('coreQuality' in sp && !('coreQuality' in existing))) {
      seen.set(key, sp);
    }
  }
  const deduplicated = Array.from(seen.values());

  console.log(`[Lemon] Successfully loaded ${deduplicated.length} unique screenplays (${screenplays.length} before dedup)`);
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
  if (path.includes('analysis_v3_2005')) return '2005 Black List';
  if (path.includes('analysis_v3_2006')) return '2006 Black List';
  if (path.includes('analysis_v3_2007')) return '2007 Black List';
  if (path.includes('analysis_v3_2020')) return '2020 Black List';
  if (path.includes('analysis_v3_Randoms')) return 'Randoms';
  if (path.includes('analysis_v4_fixed')) return 'V4 Fixed';
  if (path.includes('analysis_v5')) return 'V5 Analysis';
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
