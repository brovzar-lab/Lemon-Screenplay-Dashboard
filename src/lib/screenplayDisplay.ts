import type { Screenplay } from '@/types';

export interface ScreenplayDisplayTitle {
  title: string;
  qualifier?: string;
  length: 'standard' | 'long' | 'very-long';
}

export interface ScreenplayFormatInfo {
  format?: string;
  source?: string;
}

const LEADING_HASH = /^(?:[a-f\d]{20,})(?:[-_\s]+)(?=[a-z])/i;
const MACHINE_ONLY_VALUE = /^(?:[a-f\d]{20,}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})(?:\.pdf)?$/i;
const WORKING_TITLE = /\s*\((?:working\s+title|formerly|aka)\s*:\s*([^()]+)\)\s*$/i;
const DISPLAY_TITLE_CORRECTIONS: Readonly<Record<string, string>> = {
  HERMANOSMARQUEZCASTILLO: 'Hermanos Márquez Castillo',
};
const LOWERCASE_TITLE_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'de',
  'del',
  'en',
  'for',
  'from',
  'in',
  'la',
  'las',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
  'with',
  'y',
]);

function readable(value: string): string {
  return value.replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
}

function titleCase(value: string): string {
  const words = value.split(/\s+/);
  return words
    .map((word, index) => {
      if (!word) return word;
      if (/[a-z]\d|\d[a-z]/i.test(word)) return word.toLocaleUpperCase();

      const lower = word.toLocaleLowerCase();
      if (
        index > 0 &&
        index < words.length - 1 &&
        LOWERCASE_TITLE_WORDS.has(lower.replace(/[^\p{L}]/gu, ''))
      ) {
        return lower;
      }

      return lower.replace(
        /(^|[-/])(\p{L})/gu,
        (_match, separator: string, letter: string) => `${separator}${letter.toLocaleUpperCase()}`,
      );
    })
    .join(' ');
}

export function getScreenplayDisplayTitle(rawTitle: string): ScreenplayDisplayTitle {
  const readableTitle = readable(rawTitle);
  const sanitized =
    (MACHINE_ONLY_VALUE.test(readableTitle)
      ? 'Untitled submission'
      : readableTitle.replace(LEADING_HASH, '').trim()) || 'Untitled submission';
  const cleaned = DISPLAY_TITLE_CORRECTIONS[sanitized.toUpperCase()] ?? sanitized;
  const workingTitle = cleaned.match(WORKING_TITLE);
  const baseTitle =
    (workingTitle ? cleaned.slice(0, workingTitle.index ?? cleaned.length).trim() : cleaned) ||
    cleaned;
  const title = titleCase(baseTitle);
  const qualifier = workingTitle
    ? `Working title: ${titleCase(readable(workingTitle[1]))}`
    : undefined;
  const longestWord = Math.max(...title.split(/\s+/).map((word) => word.length));
  const length =
    title.length > 48 || longestWord > 22
      ? 'very-long'
      : title.length > 27 || longestWord > 15
        ? 'long'
        : 'standard';

  return { title, qualifier, length };
}

export function getScreenplayDisplayAuthor(rawAuthor?: string): string | undefined {
  const author = readable(rawAuthor ?? '');
  if (!author || /^unknown(?:\s+writer)?$/i.test(author)) return undefined;
  if (/^(?:anonymous|anonymized|anonymised)\b/i.test(author)) return 'Anonymized submission';
  if (/^uncredited\b/i.test(author) || MACHINE_ONLY_VALUE.test(author)) {
    return 'Uncredited submission';
  }
  return author;
}

export function getScreenplayDisplayGenre(rawGenre?: string): string | undefined {
  return readable(rawGenre ?? '') || undefined;
}

function combinedClassificationText(screenplay: Screenplay): string {
  return [
    screenplay.genre,
    ...screenplay.subgenres,
    screenplay.recommendationRationale,
    screenplay.verdictStatement,
  ]
    .filter(Boolean)
    .join(' ');
}

export function getScreenplayFormatInfo(screenplay: Screenplay): ScreenplayFormatInfo {
  const classification = combinedClassificationText(screenplay);
  const pageCount = screenplay.metadata.pageCount;

  let format: string | undefined;
  if (/\b(?:tv|television|series)\s+pilot\b|\bpilot\b/i.test(classification)) {
    format = 'TV pilot';
  } else if (/\bshort(?:[-\s]+(?:film|screenplay|script|form))\b/i.test(classification)) {
    format = 'Short film';
  } else if (/\bfeature(?:\s+film|\s+screenplay)?\b/i.test(classification) || pageCount >= 75) {
    format = 'Feature film';
  }

  let source: string | undefined;
  if (
    /\b(?:adapted from|adaptation of|based on (?:the |an? )?(?:novel|book|memoir|article|play|comic|game)|existing ip)\b/i.test(
      classification,
    )
  ) {
    source = 'Adaptation';
  } else if (/\boriginal screenplay\b/i.test(classification)) {
    source = 'Original screenplay';
  }

  return {
    ...(format ? { format } : {}),
    ...(source ? { source } : {}),
  };
}
