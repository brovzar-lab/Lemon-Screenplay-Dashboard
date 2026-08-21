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
import type { UiLanguage } from '@/i18n';

// ─────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────

interface CoverageDocumentProps {
  screenplay: Screenplay;
  notes: Note[];
  language?: UiLanguage;
  showEnglishAnalysisNotice?: boolean;
}

// ─────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────

export function CoverageDocument({
  screenplay,
  notes,
  language = 'en',
  showEnglishAnalysisNotice = false,
}: CoverageDocumentProps) {
  const dims = getDimensionDisplay(screenplay);
  const assessed = screenplay.commercialViability?.cvsAssessed ?? false;

  return (
    <Document>
      {/* Page 1 — Cover */}
      <CoverPage
        screenplay={screenplay}
        dims={dims}
        language={language}
        showEnglishAnalysisNotice={showEnglishAnalysisNotice}
      />

      {/* Page 2 — Detailed Scores + Commercial */}
      {!showEnglishAnalysisNotice && (
        <ScoresPage screenplay={screenplay} dims={dims} assessed={assessed} language={language} />
      )}

      {/* Page 3 — Analysis */}
      {!showEnglishAnalysisNotice && <AnalysisPage screenplay={screenplay} language={language} />}

      {/* Page 4 — Appendix */}
      {!showEnglishAnalysisNotice && (
        <AppendixPage screenplay={screenplay} notes={notes} language={language} />
      )}
    </Document>
  );
}

export default CoverageDocument;
