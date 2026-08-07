import type { Screenplay, SortField } from '@/types';

export interface RankedScreenplay {
  screenplay: Screenplay;
  rank: number;
}

export interface ScreenplayRankingLayout {
  showRanking: boolean;
  reason: string | null;
  topResult: RankedScreenplay | null;
  nextThree: RankedScreenplay[];
  wall: RankedScreenplay[];
}

const DECISION_SORT_REASONS: Partial<Record<SortField, string>> = {
  weightedScore: 'Final score · highest first',
  marketPotential: 'Market potential · highest first',
  cvsTotal: 'Commercial viability · highest first',
};

export function buildScreenplayRanking(
  screenplays: Screenplay[],
  sortField: SortField,
): ScreenplayRankingLayout {
  const ordered = screenplays.map((screenplay, index) => ({
    screenplay,
    rank: index + 1,
  }));
  const reason = DECISION_SORT_REASONS[sortField] ?? null;

  if (!reason) {
    return {
      showRanking: false,
      reason: null,
      topResult: null,
      nextThree: [],
      wall: ordered,
    };
  }

  const promoted = ordered
    .filter((entry) => entry.screenplay.producerProjection?.rankable !== false)
    .slice(0, 4);
  const promotedIds = new Set(promoted.map((entry) => entry.screenplay.id));

  return {
    showRanking: promoted.length > 0,
    reason,
    topResult: promoted[0] ?? null,
    nextThree: promoted.slice(1),
    wall: ordered.filter((entry) => !promotedIds.has(entry.screenplay.id)),
  };
}
