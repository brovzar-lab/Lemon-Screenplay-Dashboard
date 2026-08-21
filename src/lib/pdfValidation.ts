import i18n from '@/i18n';

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MIN_SCREENPLAY_WORDS = 500;

const SCREENPLAY_MARKERS = ['INT.', 'EXT.', 'FADE IN', 'FADE OUT', 'SMASH CUT', 'CUT TO'];

/** Return a user-facing reason when a selected file cannot enter the pipeline. */
export function getPdfFileError(file: File): string | null {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return i18n.t('{{filename}} is not a PDF.', { filename: file.name });
  if (file.size > MAX_PDF_BYTES) {
    return i18n.t('{{filename}} is larger than the 50 MB upload limit.', {
      filename: file.name,
    });
  }
  if (file.size === 0) return i18n.t('{{filename}} is empty.', { filename: file.name });
  return null;
}

/** Match the VPS preflight so browser analysis never spends AI calls on unusable text. */
export function getScreenplayTextError(text: string): string | null {
  const trimmed = text.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_SCREENPLAY_WORDS) {
    return i18n.t('This PDF has too little readable text. It may be scanned or image-only.');
  }

  const upper = trimmed.toUpperCase();
  if (!SCREENPLAY_MARKERS.some((marker) => upper.includes(marker))) {
    return i18n.t('This PDF does not appear to use screenplay formatting.');
  }
  return null;
}
