/**
 * Local Analysis Store
 *
 * Persists user-analyzed screenplay results in localStorage so they
 * survive page refreshes. The loadAllScreenplaysVite() function in api.ts
 * reads from this store in addition to the static JSON files.
 */

const STORAGE_KEY = 'lemon-local-analyses';

/**
 * Save a raw V6 analysis result to localStorage.
 */
export function saveLocalAnalysis(raw: Record<string, unknown>): void {
  const existing = loadLocalAnalyses();
  // Use source_file as dedup key
  const key = (raw.source_file as string) || `unknown_${Date.now()}`;
  const filtered = existing.filter((a) => a.source_file !== key);
  filtered.push(raw);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Load all locally stored raw analyses.
 */
export function loadLocalAnalyses(): Record<string, unknown>[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

/**
 * Remove a locally stored analysis by source_file key.
 */
export function removeLocalAnalysis(sourceFile: string): void {
  const existing = loadLocalAnalyses();
  const filtered = existing.filter((a) => a.source_file !== sourceFile);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Clear all locally stored analyses.
 */
export function clearLocalAnalyses(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get count of locally stored analyses.
 */
export function getLocalAnalysisCount(): number {
  return loadLocalAnalyses().length;
}
