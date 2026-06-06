/**
 * Collection → Category Mapping
 * Maps collection names to Settings category IDs.
 */

/**
 * Map a collection name to a Settings category ID.
 * Pre-loaded data uses long collection names ("2006 Black List", "Randoms")
 * but the app uses short category IDs (BLKLST, LEMON, OTHER, etc.)
 * Uploaded screenplays already have a category set during upload.
 */
export function collectionToCategoryId(collection: string, existingCategory?: string): string {
  // If already has a category (e.g. uploaded screenplays), use it
  if (existingCategory) return existingCategory;

  const lower = String(collection || '').toLowerCase();

  if (lower.includes('black list') || lower.includes('blacklist') || lower.includes('blklst')) {
    return 'BLKLST';
  }
  if (lower.includes('lemon')) {
    return 'LEMON';
  }
  if (lower.includes('submission') || lower.includes('submitted')) {
    return 'SUBMISSION';
  }
  if (lower.includes('contest') || lower.includes('competition')) {
    return 'CONTEST';
  }
  // Everything else → OTHER  (Randoms, V6 Analysis, etc.)
  return 'OTHER';
}
