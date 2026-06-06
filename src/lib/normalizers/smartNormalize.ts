/**
 * Smart normalize — version-detecting entry point
 * Detects the analysis version and delegates to the appropriate normalizer.
 */

import type { RawScreenplayAnalysis, Screenplay, Collection } from '@/types';

import { isV7RawAnalysis, normalizeV7Screenplay } from './normalizeV7';
import { isV6UnifiedAnalysis, normalizeV6UnifiedScreenplay } from './normalizeV6';
import { normalizeScreenplay } from './normalizeV5';

/**
 * Smart normalize function that detects version and calls appropriate normalizer
 */
export function smartNormalizeScreenplay(
  raw: RawScreenplayAnalysis,
  collection: Collection
): Screenplay {
  if (isV7RawAnalysis(raw)) {
    return normalizeV7Screenplay(raw as unknown as Record<string, unknown>, collection);
  }
  if (isV6UnifiedAnalysis(raw)) {
    return normalizeV6UnifiedScreenplay(raw as unknown as Record<string, unknown>, collection);
  }
  return normalizeScreenplay(raw as RawScreenplayAnalysis, collection);
}
