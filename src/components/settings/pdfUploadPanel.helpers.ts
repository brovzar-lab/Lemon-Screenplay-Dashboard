/**
 * pdfUploadPanel.helpers.ts
 *
 * Pure helpers for PdfUploadPanel.
 * Split into a separate file so PdfUploadPanel can be a component-only export,
 * which is required for Fast Refresh to work correctly.
 *
 * MUST match the logic in ModalHeader.tsx handleDownloadPdf exactly.
 */

import type { Screenplay } from '@/types';

/**
 * Build the Firebase Storage path for a screenplay's PDF.
 * Path: screenplays/{CATEGORY}/{SAFE_TITLE}.pdf
 */
export function buildStoragePath(screenplay: Screenplay): string {
    const category = screenplay.category || 'OTHER';
    const safeName = (screenplay.title || screenplay.sourceFile || 'untitled')
        .replace(/\.pdf$/i, '')
        .replace(/[^a-zA-Z0-9_\- ]/g, '')
        .trim()
        .replace(/\s+/g, '_');
    return `screenplays/${category}/${safeName}.pdf`;
}
