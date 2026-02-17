/**
 * Shared utilities for modal sub-components.
 */

import type { Screenplay } from '@/types';
import type { ScreenplayWithV6 } from '@/lib/normalize';

/** Type guard to check if screenplay has V6 fields */
export function hasV6Fields(screenplay: Screenplay): screenplay is Screenplay & ScreenplayWithV6 {
    return 'v6CoreQuality' in screenplay || 'falsePositiveRisk' in screenplay;
}
