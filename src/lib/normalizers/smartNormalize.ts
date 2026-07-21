/**
 * Smart normalize — version-detecting entry point
 * Detects the analysis version and delegates to the appropriate normalizer.
 */

import type { RawScreenplayAnalysis, Screenplay, Collection } from '@/types';

import { isArchaeologyAnalysis, normalizeV9Screenplay } from './normalizeV9';
import { isV6UnifiedAnalysis, normalizeV6UnifiedScreenplay } from './normalizeV6';
import { normalizeScreenplay } from './normalizeV5';

/**
 * Smart normalize function that detects version and calls appropriate normalizer
 */
export function smartNormalizeScreenplay(
  raw: RawScreenplayAnalysis,
  collection: Collection
): Screenplay {
  if (isArchaeologyAnalysis(raw)) {
    return normalizeV9Screenplay(raw as unknown as Record<string, unknown>, collection);
  }
  if (isV6UnifiedAnalysis(raw)) {
    return normalizeV6UnifiedScreenplay(raw as unknown as Record<string, unknown>, collection);
  }
  return normalizeScreenplay(raw as RawScreenplayAnalysis, collection);
}
