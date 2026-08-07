import type { Screenplay } from '@/types';

export interface ScreenplayDisplayTitle {
  title: string;
  qualifier?: string;
  length: 'standard' | 'long' | 'very-long';
}

export interface ScreenplayFormatInfo {
  format: string;
  source: string;
}

const LEADING_HASH = /^(?:[a-f\d]{20,})(?:[-_\s]+)(?=[a-z])/i;
const WORKING_TITLE = /\s*\((?:working\s+title|formerly|aka)\s*:\s*([^()]+)\)\s*$/i;
const DISPLAY_TITLE_CORRECTIONS: Readonly<Record<string, string>> = {
  HERMANOSMARQUEZCASTILLO: 'Hermanos Márquez Castillo',
};

function readable(value: string): string {
  return value.replaceAll('_', ' ').replace(/\s+/g, ' ').trim();
}

export function getScreenplayDisplayTitle(rawTitle: string): ScreenplayDisplayTitle {
  const sanitized = readable(rawTitle).replace(LEADING_HASH, '').trim() || 'Untitled screenplay';
  const cleaned = DISPLAY_TITLE_CORRECTIONS[sanitized.toUpperCase()] ?? sanitized;
  const workingTitle = cleaned.match(WORKING_TITLE);
  const title =
    (workingTitle ? cleaned.slice(0, workingTitle.index ?? cleaned.length).trim() : cleaned) ||
    cleaned;
  const qualifier = workingTitle ? `Working title: ${readable(workingTitle[1])}` : undefined;
  const longestWord = Math.max(...title.split(/\s+/).map((word) => word.length));
  const length =
    title.length > 48 || longestWord > 22
      ? 'very-long'
      : title.length > 27 || longestWord > 15
        ? 'long'
        : 'standard';

  return { title, qualifier, length };
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

  let format = 'Format not recorded';
  if (/\b(?:tv|television|series)\s+pilot\b|\bpilot\b/i.test(classification)) {
    format = 'TV pilot';
  } else if (/\bshort(?:[-\s]+(?:film|screenplay|script|form))\b/i.test(classification)) {
    format = 'Short film';
  } else if (/\bfeature(?:\s+film|\s+screenplay)?\b/i.test(classification) || pageCount >= 75) {
    format = 'Feature film';
  }

  let source = 'Source not recorded';
  if (
    /\b(?:adapted from|adaptation of|based on (?:the |an? )?(?:novel|book|memoir|article|play|comic|game)|existing ip)\b/i.test(
      classification,
    )
  ) {
    source = 'Adaptation';
  } else if (/\boriginal screenplay\b/i.test(classification)) {
    source = 'Original screenplay';
  }

  return { format, source };
}
