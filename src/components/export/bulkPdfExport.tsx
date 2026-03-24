/**
 * Bulk PDF Export
 * Generates individual PitchDeck PDFs per screenplay, bundles into a zip, triggers download.
 * Uses JSZip (dynamic import for code splitting) and @react-pdf/renderer pdf().toBlob().
 */

import { pdf } from '@react-pdf/renderer';
import { PdfDocument } from './PdfDocument';
import type { Screenplay } from '@/types';

export interface BulkPdfProgress {
  current: number;
  total: number;
}

/**
 * Sanitize a title for use as a filename inside the zip.
 */
function sanitizeForZip(title: string): string {
  return title.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-') || 'Untitled';
}

/**
 * Generate individual PDFs for each screenplay, bundle into a zip, and trigger download.
 *
 * @param screenplays - Array of Screenplay objects to export
 * @param onProgress - Callback for progress updates (current/total)
 * @returns Promise that resolves when download is triggered
 * @throws Error if PDF generation or zip creation fails
 */
export async function bulkExportPdfs(
  screenplays: Screenplay[],
  onProgress?: (progress: BulkPdfProgress) => void
): Promise<void> {
  // Dynamic import JSZip to keep it out of main bundle
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (let i = 0; i < screenplays.length; i++) {
    const sp = screenplays[i];
    onProgress?.({ current: i + 1, total: screenplays.length });

    const blob = await pdf(<PdfDocument screenplay={sp} />).toBlob();
    const safeName = sanitizeForZip(sp.title);
    zip.file(`${safeName}-PitchDeck.pdf`, blob);

    // Yield to event loop between iterations to keep UI responsive (D-13)
    // The await on toBlob() already yields, but this ensures progress renders
    if (i < screenplays.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });

  // Trigger download
  const dateStr = new Date().toISOString().split('T')[0];
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `screenplays-export-${dateStr}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
