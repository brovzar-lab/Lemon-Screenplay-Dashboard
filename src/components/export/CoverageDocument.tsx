/**
 * Coverage Document PDF Component
 *
 * Professional screenplay coverage report. High-density layout optimized
 * for producer scanning.
 *
 * Key layout rules:
 *   - Cover page NEVER wraps — content is fixed-height, verdict truncated
 *   - Score bars show ONLY the bar + number (no inline justifications)
 *   - Sections with empty data are omitted entirely
 *   - Structure uses inline text, not card blocks
 *   - All content pages use `wrap` so react-pdf handles overflow
 */

import { Document } from '@react-pdf/renderer';
import type { Screenplay } from '@/types';
import type { Note } from '@/types/filters';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { CoverPage } from './coverage/CoverPage';
import { ScoresPage } from './coverage/ScoresPage';
import { AnalysisPage } from './coverage/AnalysisPage';
import { AppendixPage } from './coverage/AppendixPage';

// Re-export test-visible constants and styles from sub-modules
export { __coverageDocStyles, __scoreGapStyle } from './coverage';

// ─────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────

interface CoverageDocumentProps {
  screenplay: Screenplay;
  notes: Note[];
}

// ─────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────

export function CoverageDocument({ screenplay, notes }: CoverageDocumentProps) {
  const dims = getDimensionDisplay(screenplay);
  const assessed = screenplay.commercialViability?.cvsAssessed ?? false;

  return (
    <Document>
      {/* Page 1 — Cover */}
      <CoverPage screenplay={screenplay} dims={dims} />

      {/* Page 2 — Detailed Scores + Commercial */}
      <ScoresPage screenplay={screenplay} dims={dims} assessed={assessed} />

      {/* Page 3 — Analysis */}
      <AnalysisPage screenplay={screenplay} />

      {/* Page 4 — Appendix */}
      <AppendixPage screenplay={screenplay} notes={notes} />
    </Document>
  );
}

export default CoverageDocument;
