import type { Screenplay } from '@/types';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 'her',
  'his', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'or', 'she', 'that', 'the',
  'their', 'they', 'to', 'when', 'who', 'with', 'must', 'after', 'before',
]);

function tokens(value: string): Set<string> {
  return new Set(
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function normalized(value: string): string {
  return [...tokens(value)].join(' ');
}

export interface SimilarScreenplay {
  screenplay: Screenplay;
  similarity: number;
  reasons: string[];
}

export function findSimilarScreenplays(
  target: Screenplay,
  candidates: Screenplay[],
  limit = 3,
): SimilarScreenplay[] {
  const targetTitle = tokens(target.title);
  const targetLogline = tokens(target.logline);
  const targetMetadata = tokens([target.genre, ...target.subgenres, ...target.themes].join(' '));
  const targetComparables = tokens(target.comparableFilms.map((film) => film.title).join(' '));
  const targetAuthor = normalized(target.author);

  return candidates
    .filter((candidate) => candidate.id !== target.id)
    .map((candidate): SimilarScreenplay => {
      const titleMatch = jaccard(targetTitle, tokens(candidate.title));
      const loglineMatch = jaccard(targetLogline, tokens(candidate.logline));
      const metadataMatch = jaccard(
        targetMetadata,
        tokens([candidate.genre, ...candidate.subgenres, ...candidate.themes].join(' ')),
      );
      const comparableMatch = jaccard(
        targetComparables,
        tokens(candidate.comparableFilms.map((film) => film.title).join(' ')),
      );
      const sameAuthor = Boolean(targetAuthor && targetAuthor === normalized(candidate.author));
      const score = Math.min(
        1,
        titleMatch * 0.35 + loglineMatch * 0.35 + metadataMatch * 0.15 +
          comparableMatch * 0.1 + (sameAuthor ? 0.15 : 0),
      );
      const reasons: string[] = [];
      if (titleMatch >= 0.8) reasons.push('Same or near-identical title');
      if (sameAuthor) reasons.push('Same writer');
      if (loglineMatch >= 0.2) reasons.push('Overlapping premise');
      if (metadataMatch >= 0.3) reasons.push('Shared genre or themes');
      if (comparableMatch >= 0.34) reasons.push('Shared comparable films');

      return { screenplay: candidate, similarity: score, reasons };
    })
    .filter((match) => match.similarity >= 0.2 && match.reasons.length > 0)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit);
}
