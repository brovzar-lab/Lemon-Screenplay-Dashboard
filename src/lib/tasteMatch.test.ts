import { describe, expect, it } from 'vitest';
import type { BrainVerdict } from '@/lib/feedbackStore';
import { calculateTasteMatch } from './tasteMatch';

function verdict(overrides: Partial<BrainVerdict>): BrainVerdict {
  return {
    screenplayId: 'sp-1',
    screenplayTitle: 'Test Script',
    billyVerdict: 'consider',
    aiVerdict: 'consider',
    note: '',
    genre: 'Drama',
    subgenres: [],
    weightedScore: 6,
    source: 'screenplay-dashboard',
    ...overrides,
  };
}

describe('calculateTasteMatch', () => {
  it('measures agreement and the direction of disagreements', () => {
    const stats = calculateTasteMatch([
      verdict({ screenplayId: '1' }),
      verdict({ screenplayId: '2', aiVerdict: 'recommend', billyVerdict: 'pass' }),
      verdict({ screenplayId: '3', aiVerdict: 'pass', billyVerdict: 'recommend' }),
      verdict({ screenplayId: '4', genre: 'Comedy' }),
    ]);

    expect(stats.reviewed).toBe(4);
    expect(stats.matched).toBe(2);
    expect(stats.matchRate).toBe(50);
    expect(stats.aiTooHigh).toBe(1);
    expect(stats.aiTooLow).toBe(1);
    expect(stats.disagreements).toHaveLength(2);
  });

  it('groups agreement by genre and handles an empty history', () => {
    const stats = calculateTasteMatch([
      verdict({ screenplayId: '1' }),
      verdict({ screenplayId: '2', genre: 'Drama', aiVerdict: 'pass' }),
      verdict({ screenplayId: '3', genre: 'Comedy' }),
    ]);

    expect(stats.genreStats[0]).toMatchObject({ genre: 'Drama', reviewed: 2, matched: 1, matchRate: 50 });
    expect(calculateTasteMatch([]).matchRate).toBe(0);
  });
});
