/**
 * Coverage PDF Export Service
 * Generates and triggers download of a coverage PDF for a single screenplay.
 */

import { pdf } from '@react-pdf/renderer';
import { CoverageDocument } from './CoverageDocument';
import { useNotesStore } from '@/stores/notesStore';
import type { Screenplay } from '@/types';
import { analysisIsEnglishFallback, localizedScreenplay } from '@/lib/localizedAnalysis';
import { currentUiLanguage } from '@/i18n';
import {
  isCoverageReadyScreenplay,
  isCoverageV1Screenplay,
  requireDecisionReady,
} from '@/lib/producerProjection';

/**
 * Sanitize a string for use as a filename.
 */
export function sanitizeFilename(title: string): string {
  const sanitized = title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  return sanitized || 'Untitled';
}

/**
 * Generate a coverage PDF blob and trigger a browser download.
 */
export async function downloadCoveragePdf(screenplay: Screenplay): Promise<void> {
  const isCoverage = isCoverageV1Screenplay(screenplay);
  if (isCoverage && !isCoverageReadyScreenplay(screenplay)) {
    throw new Error('Coverage PDF requires a sealed Coverage report.');
  }
  if (!isCoverage) requireDecisionReady([screenplay]);
  const language = currentUiLanguage();
  const localized = localizedScreenplay(screenplay, language);
  const notes = useNotesStore.getState().getNotesForScreenplay(screenplay.id);

  const blob = await pdf(
    <CoverageDocument
      screenplay={localized}
      notes={notes}
      language={language}
      showEnglishAnalysisNotice={!isCoverage && analysisIsEnglishFallback(screenplay, language)}
    />
  ).toBlob();

  const safeName = sanitizeFilename(screenplay.title);
  const filename = `${safeName}-Coverage.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
