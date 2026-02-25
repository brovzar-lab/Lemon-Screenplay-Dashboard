/**
 * Client-side PDF text extraction using pdfjs-dist.
 *
 * Extracts text, page count, and word count from a PDF File object.
 * Enforces a 200K character limit (matching the Python pipeline).
 */

import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker from pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ≈37.5K tokens — leaves ~160K headroom for the prompt template, lenses, and 16K output budget
const MAX_CHARS = 150_000;

export interface ParsedPDF {
  title: string;
  text: string;
  pageCount: number;
  wordCount: number;
  /** Whether the text was truncated to MAX_CHARS */
  truncated: boolean;
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

  let text = pages.join('\n\n');
  const truncated = text.length > MAX_CHARS;
  if (truncated) {
    text = text.slice(0, MAX_CHARS) + '\n\n[... truncated ...]';
  }

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Infer title from filename (strip extension)
  const title = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');

  return { title, text, pageCount, wordCount, truncated };
}
