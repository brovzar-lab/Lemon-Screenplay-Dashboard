/**
 * Coverage PDF Export Service
 * Generates and triggers download of a coverage PDF for a single screenplay.
 */

import { pdf } from '@react-pdf/renderer';
import { CoverageDocument } from './CoverageDocument';
import { useNotesStore } from '@/stores/notesStore';
import type { Screenplay } from '@/types';

/**
 * Sanitize a string for use as a filename.
 * Strips non-alphanumeric characters (except hyphens and spaces),
 * trims, replaces spaces with hyphens, and falls back to "Untitled".
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
 *
 * 1. Fetches notes from the notes store (non-reactive access)
 * 2. Renders CoverageDocument to a PDF blob
 * 3. Creates a temporary anchor element to trigger download
 * 4. Cleans up the blob URL after download
 */
export async function downloadCoveragePdf(screenplay: Screenplay): Promise<void> {
  // Get notes for this screenplay (non-reactive store access)
  const notes = useNotesStore.getState().getNotesForScreenplay(screenplay.id);

  // Generate PDF blob
  const blob = await pdf(
    <CoverageDocument screenplay={screenplay} notes={notes} />
  ).toBlob();

  // Build sanitized filename
  const safeName = sanitizeFilename(screenplay.title);
  const filename = `${safeName}-Coverage.pdf`;

  // Trigger browser download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
