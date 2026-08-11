import type { PercentileRank } from '@/lib/percentileRanking';
import type { Screenplay } from '@/types';

export type PercentileMap = ReadonlyMap<string, PercentileRank>;

export interface OpenScreenplay {
  (screenplay: Screenplay, trigger: HTMLButtonElement): void;
}
