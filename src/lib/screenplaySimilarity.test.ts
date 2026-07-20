import { describe, expect, it } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { findSimilarScreenplays } from './screenplaySimilarity';

describe('findSimilarScreenplays', () => {
  const target = createTestScreenplay({
    id: 'target',
    title: 'Frozen Blood',
    author: 'Ana Writer',
    logline: 'A detective hunts a serial killer through an isolated frozen border town.',
    genre: 'Thriller',
    subgenres: ['Crime'],
    themes: ['Justice', 'Obsession'],
  });

  it('ranks likely revisions and explains the match', () => {
    const revision = createTestScreenplay({
      id: 'revision',
      title: 'Frozen Blood',
      author: 'Ana Writer',
      logline: 'A detective hunts a serial killer in an isolated frozen town.',
      genre: 'Thriller',
      subgenres: ['Crime'],
      themes: ['Justice'],
    });
    const unrelated = createTestScreenplay({
      id: 'unrelated',
      title: 'Summer Wedding',
      author: 'Someone Else',
      logline: 'Two families gather for a chaotic destination wedding.',
      genre: 'Comedy',
      subgenres: ['Romance'],
      themes: ['Family'],
    });

    const matches = findSimilarScreenplays(target, [target, unrelated, revision]);

    expect(matches).toHaveLength(1);
    expect(matches[0].screenplay.id).toBe('revision');
    expect(matches[0].reasons).toEqual(
      expect.arrayContaining(['Same or near-identical title', 'Same writer', 'Overlapping premise']),
    );
  });

  it('limits results and excludes the screenplay itself', () => {
    const copies = Array.from({ length: 5 }, (_, index) =>
      createTestScreenplay({
        ...target,
        id: `copy-${index}`,
        title: `Frozen Blood ${index}`,
      }),
    );

    const matches = findSimilarScreenplays(target, [target, ...copies], 2);

    expect(matches).toHaveLength(2);
    expect(matches.every((match) => match.screenplay.id !== target.id)).toBe(true);
  });
});
