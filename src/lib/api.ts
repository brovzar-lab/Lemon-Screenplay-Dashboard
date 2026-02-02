/**
 * Data Loading API
 * Fetches and normalizes screenplay data from JSON files
 */

import type { RawScreenplayAnalysis, Screenplay, Collection } from '@/types';
import { normalizeScreenplay } from './normalize';

// Base path to analysis data (relative to public folder or absolute)
const DATA_BASE_PATH = '../../.tmp';

/**
 * Collection folder mapping
 */
const COLLECTION_FOLDERS: Record<Collection, string> = {
  '2005 Black List': 'analysis_v3_2005',
  '2006 Black List': 'analysis_v3_2006',
  '2007 Black List': 'analysis_v3_2007',
  '2020 Black List': 'analysis_v3_2020',
  'Randoms': 'analysis_v3_Randoms',
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
 */
export async function loadAllScreenplaysVite(): Promise<Screenplay[]> {
  // Load screenplay data from public/data folder using fetch
  // This works reliably in both dev and production
  const collections: { name: Collection; folder: string }[] = [
    { name: '2005 Black List', folder: 'analysis_v3_2005' },
    { name: '2006 Black List', folder: 'analysis_v3_2006' },
    { name: '2007 Black List', folder: 'analysis_v3_2007' },
    { name: '2020 Black List', folder: 'analysis_v3_2020' },
    { name: 'Randoms', folder: 'analysis_v3_Randoms' },
  ];

  const screenplays: Screenplay[] = [];

  // First, get the manifest of all files (we'll create this)
  // For now, fetch each collection's index
  for (const { name, folder } of collections) {
    try {
      // Fetch the index of files in this collection
      const indexResponse = await fetch(`/data/${folder}/index.json`);
      if (!indexResponse.ok) {
        console.warn(`[Lemon] No index for ${folder}, trying direct listing`);
        continue;
      }

      const fileList: string[] = await indexResponse.json();
      console.log(`[Lemon] Found ${fileList.length} files in ${folder}`);

      // Fetch each file
      for (const filename of fileList) {
        try {
          const response = await fetch(`/data/${folder}/${filename}`);
          if (response.ok) {
            const raw: RawScreenplayAnalysis = await response.json();
            try {
              const screenplay = normalizeScreenplay(raw, name);
              // Validate required fields exist
              if (!screenplay.producerMetrics) {
                console.error(`[Lemon] Missing producerMetrics for ${filename}`, screenplay);
              }
              screenplays.push(screenplay);
            } catch (normalizeError) {
              console.error(`[Lemon] Normalization failed for ${filename}:`, normalizeError);
              console.error(`[Lemon] Raw data:`, raw);
            }
          }
        } catch (error) {
          console.warn(`[Lemon] Failed to load ${filename}:`, error);
        }
      }
    } catch (error) {
      console.warn(`[Lemon] Failed to load collection ${name}:`, error);
    }
  }

  console.log(`[Lemon] Successfully loaded ${screenplays.length} screenplays`);
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
