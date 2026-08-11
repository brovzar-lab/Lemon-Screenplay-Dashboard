import { describe, expect, it } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay, SortField } from '@/types';
import { buildScreenplayRanking } from './screenplayRankingProjection';

function slate(count = 7): Screenplay[] {
  return Array.from({ length: count }, (_, index) =>
    createTestScreenplay({
      id: `script-${index + 1}`,
      projectId: `project-${index + 1}`,
      title: `Script ${index + 1}`,
      weightedScore: 9 - index * 0.4,
    }),
  );
}

describe('buildScreenplayRanking', () => {
  it.each<[SortField, string]>([
    ['weightedScore', 'Final score · highest first'],
    ['marketPotential', 'Market potential · highest first'],
    ['cvsTotal', 'Commercial viability · highest first'],
  ])('promotes the first four rankable results for %s', (sortField, reason) => {
    const result = buildScreenplayRanking(slate(), sortField);

    expect(result.showRanking).toBe(true);
    expect(result.reason).toBe(reason);
    expect(result.topResult?.screenplay.id).toBe('script-1');
    expect(result.nextThree.map((entry) => entry.screenplay.id)).toEqual([
      'script-2',
      'script-3',
      'script-4',
    ]);
    expect(result.wall.map((entry) => entry.screenplay.id)).toEqual([
      'script-5',
      'script-6',
      'script-7',
    ]);
    expect(result.wall.map((entry) => entry.rank)).toEqual([5, 6, 7]);
  });

  it('hides ranking for title sort and keeps the complete ordered wall', () => {
    const input = slate(3);
    const result = buildScreenplayRanking(input, 'title');

    expect(result).toEqual({
      showRanking: false,
      reason: null,
      topResult: null,
      nextThree: [],
      wall: [
        { screenplay: input[0], rank: 1 },
        { screenplay: input[1], rank: 2 },
        { screenplay: input[2], rank: 3 },
      ],
    });
  });

  it('does not promote an unrankable result but keeps it in the wall', () => {
    const input = slate(6);
    input[1] = {
      ...input[1],
      producerProjection: { rankable: false },
    } as Screenplay;

    const result = buildScreenplayRanking(input, 'weightedScore');

    expect(result.topResult?.screenplay.id).toBe('script-1');
    expect(result.nextThree.map((entry) => entry.screenplay.id)).toEqual([
      'script-3',
      'script-4',
      'script-5',
    ]);
    expect(result.wall.map((entry) => entry.screenplay.id)).toEqual(['script-2', 'script-6']);
    expect(result.wall.map((entry) => entry.rank)).toEqual([2, 6]);
  });

  it('renders fewer than four available results without placeholder entries', () => {
    const result = buildScreenplayRanking(slate(2), 'weightedScore');

    expect(result.topResult?.rank).toBe(1);
    expect(result.nextThree).toHaveLength(1);
    expect(result.nextThree[0].rank).toBe(2);
    expect(result.wall).toEqual([]);
  });

  it('never repeats a promoted screenplay in the wall', () => {
    const result = buildScreenplayRanking(slate(8), 'weightedScore');
    const promotedIds = new Set([
      result.topResult?.screenplay.id,
      ...result.nextThree.map((entry) => entry.screenplay.id),
    ]);

    expect(result.wall.every((entry) => !promotedIds.has(entry.screenplay.id))).toBe(true);
  });
});
