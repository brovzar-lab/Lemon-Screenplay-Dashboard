import type { Screenplay } from '@/types';

// --- Constants ---
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per D-06
export const MATCH_THRESHOLD = 50; // Minimum score to auto-assign per research recommendation

// --- Types ---
export type ValidationError = 'not-pdf' | 'too-large' | null;

export type RowUploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'done' }
  | { status: 'error'; message: string; file?: File };

// --- Validation (D-05, D-06) ---
export function validatePdfFile(file: File): ValidationError {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'not-pdf';
  if (file.size > MAX_FILE_SIZE) return 'too-large';
  return null;
}

export function validationMessage(error: ValidationError): string {
  switch (error) {
    case 'not-pdf':
      return 'PDF files only';
    case 'too-large':
      return 'File too large \u2014 max 50MB';
    default:
      return '';
  }
}

// --- Filename Matching (adapted from PdfUploadPanel.tsx) ---
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.pdf$/i, '')
    .replace(/[_\s-]+/g, ' ')
    .trim();
}

export function matchScore(
  droppedName: string,
  screenplay: Screenplay
): number {
  const dropped = normalize(droppedName);
  const title = normalize(screenplay.title);
  const source = normalize(screenplay.sourceFile);

  if (dropped === title || dropped === source) return 100;
  if (title.includes(dropped) || dropped.includes(title)) return 80;
  if (source.includes(dropped) || dropped.includes(source)) return 70;

  const droppedWords = new Set(dropped.split(' ').filter(Boolean));
  const titleWords = title.split(' ').filter(Boolean);
  const matched = titleWords.filter((w) => droppedWords.has(w)).length;
  if (matched > 0) return Math.min(60, matched * 25);

  return 0;
}

export function matchFilesToScreenplays(
  files: File[],
  screenplays: Screenplay[]
): { matched: Array<{ file: File; screenplay: Screenplay }>; unmatched: File[] } {
  const matched: Array<{ file: File; screenplay: Screenplay }> = [];
  const unmatched: File[] = [];
  const claimed = new Set<string>();

  for (const file of files) {
    const scored = screenplays
      .filter((s) => !claimed.has(s.id))
      .map((s) => ({ screenplay: s, score: matchScore(file.name, s) }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best && best.score >= MATCH_THRESHOLD) {
      matched.push({ file, screenplay: best.screenplay });
      claimed.add(best.screenplay.id);
    } else {
      unmatched.push(file);
    }
  }

  return { matched, unmatched };
}

// --- Display (D-16) ---
export function middleTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const ellipsis = '\u2026';
  const charsToShow = maxLength - 1;
  const front = Math.ceil(charsToShow * 0.6);
  const back = Math.floor(charsToShow * 0.4);
  return text.slice(0, front) + ellipsis + text.slice(-back);
}
