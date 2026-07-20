import { describe, expect, it } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { computeAllPercentiles, computeSinglePercentile } from './percentileRanking';

describe('percentileRanking', () => {
  const slate = [
    createTestScreenplay({ id: 'a', title: 'A', genre: 'Comedy', weightedScore: 9 }),
    createTestScreenplay({ id: 'b', title: 'B', genre: 'Drama', weightedScore: 8 }),
    createTestScreenplay({ id: 'c', title: 'C', genre: 'Comedy', weightedScore: 7 }),
    createTestScreenplay({ id: 'd', title: 'D', genre: 'Comedy', weightedScore: 6 }),
  ];

  it('computes exact overall and genre positions from the complete slate', () => {
    const ranks = computeAllPercentiles(slate);

    expect(ranks.get('a')).toEqual(expect.objectContaining({
      overallPosition: 1,
      corpusSize: 4,
      genrePosition: 1,
      genreSize: 3,
      genre: 'Comedy',
      label: 'Top 1%',
    }));
    expect(ranks.get('c')).toEqual(expect.objectContaining({
      overallPosition: 3,
      genrePosition: 2,
    }));
  });

  it('gives tied scores the same position', () => {
    const tied = [
      createTestScreenplay({ id: 'first', genre: 'Drama', weightedScore: 8 }),
      createTestScreenplay({ id: 'second', genre: 'Drama', weightedScore: 8 }),
      createTestScreenplay({ id: 'third', genre: 'Drama', weightedScore: 5 }),
    ];
    const ranks = computeAllPercentiles(tied);

    expect(ranks.get('first')?.overallPosition).toBe(1);
    expect(ranks.get('second')?.overallPosition).toBe(1);
    expect(ranks.get('third')?.overallPosition).toBe(3);
  });

  it('matches the single-screenplay calculation', () => {
    expect(computeSinglePercentile(slate[2], slate)).toEqual(
      computeAllPercentiles(slate).get('c'),
    );
  });

  it('groups common genre aliases into the same field', () => {
    const aliases = [
      createTestScreenplay({ id: 'sci-fi', genre: 'Sci-Fi', weightedScore: 8 }),
      createTestScreenplay({ id: 'science-fiction', genre: 'Science Fiction', weightedScore: 7 }),
    ];
    const ranks = computeAllPercentiles(aliases);

    expect(ranks.get('sci-fi')?.genreSize).toBe(2);
    expect(ranks.get('science-fiction')?.genrePosition).toBe(2);
  });

  it('uses a meaningful bottom-tier label', () => {
    expect(computeAllPercentiles(slate).get('d')?.label).toBe('Bottom 10%');
  });
});
