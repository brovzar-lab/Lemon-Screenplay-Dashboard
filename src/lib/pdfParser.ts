/**
 * Client-side PDF text extraction using pdfjs-dist.
 *
 * Extracts text, page count, and word count from a PDF File object.
 * Preserves physical page identity and refuses incomplete source evidence.
 */

import * as pdfjsLib from 'pdfjs-dist';
import { getPdfFileError, getScreenplayTextError } from './pdfValidation';
import { buildBrowserPageEvidence } from '@/lib/sourceEvidence';
import type { BrowserPageEvidence } from '@/types';

// Use the bundled worker from pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface ParsedPDF {
  title: string;
  text: string;
  pageCount: number;
  wordCount: number;
  /** Retained for compatibility. Q2 never truncates screenplay source. */
  truncated: boolean;
  sourceEvidence: BrowserPageEvidence;
}

/**
 * Extract text from a PDF File.
 *
 * @param file  A browser File object for a .pdf
 * @param onProgress  Optional callback with percent (0-100)
 */
export async function parsePDF(
  file: File,
  onProgress?: (pct: number) => void,
): Promise<ParsedPDF> {
  const fileError = getPdfFileError(file);
  if (fileError) throw new Error(fileError);

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pageCount = pdf.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .filter((item) => 'str' in item)
      .map((item) => (item as { str: string }).str);
    pages.push(strings.join(' '));

    if (onProgress) {
      onProgress(Math.round((i / pageCount) * 100));
    }
  }

  const sourceEvidence = buildBrowserPageEvidence(pages);
  if (!sourceEvidence.publicationReady) {
    throw new Error(
      `The screenplay extraction needs review: ${sourceEvidence.issues.join(', ')}.`,
    );
  }
  const text = sourceEvidence.text;

  const wordCount = sourceEvidence.diagnostics.reduce(
    (total, page) => total + page.words,
    0,
  );

  const textError = getScreenplayTextError(text);
  if (textError) throw new Error(textError);

  // Infer title from filename (strip extension)
  const title = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');

  return {
    title,
    text,
    pageCount,
    wordCount,
    truncated: false,
    sourceEvidence,
  };
}
