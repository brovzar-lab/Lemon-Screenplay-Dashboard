import type { BrainVerdict } from '@/lib/feedbackStore';
import type { RecommendationTier } from '@/types';

const TIER_VALUE: Record<RecommendationTier, number> = {
  pass: 0,
  consider: 1,
  recommend: 2,
  film_now: 3,
};

export interface TasteGenreStat {
  genre: string;
  reviewed: number;
  matched: number;
  matchRate: number;
}

export interface TasteMatchStats {
  reviewed: number;
  matched: number;
  matchRate: number;
  aiTooHigh: number;
  aiTooLow: number;
  adjacent: number;
  genreStats: TasteGenreStat[];
  disagreements: Array<BrainVerdict & { distance: number }>;
}

export function calculateTasteMatch(verdicts: BrainVerdict[]): TasteMatchStats {
  let matched = 0;
  let aiTooHigh = 0;
  let aiTooLow = 0;
  let adjacent = 0;
  const genreMap = new Map<string, { reviewed: number; matched: number }>();
  const disagreements: TasteMatchStats['disagreements'] = [];

  for (const verdict of verdicts) {
    const distance = TIER_VALUE[verdict.aiVerdict] - TIER_VALUE[verdict.billyVerdict];
    const isMatch = distance === 0;
    if (isMatch) matched += 1;
    if (distance > 0) aiTooHigh += 1;
    if (distance < 0) aiTooLow += 1;
    if (Math.abs(distance) === 1) adjacent += 1;
    if (!isMatch) disagreements.push({ ...verdict, distance });

    const genre = verdict.genre.trim() || 'Unspecified';
    const current = genreMap.get(genre) ?? { reviewed: 0, matched: 0 };
    current.reviewed += 1;
    if (isMatch) current.matched += 1;
    genreMap.set(genre, current);
  }

  const genreStats = [...genreMap.entries()]
    .map(([genre, values]) => ({
      genre,
      ...values,
      matchRate: values.reviewed > 0 ? (values.matched / values.reviewed) * 100 : 0,
    }))
    .sort((a, b) => b.reviewed - a.reviewed || b.matchRate - a.matchRate);

  disagreements.sort((a, b) => Math.abs(b.distance) - Math.abs(a.distance));

  return {
    reviewed: verdicts.length,
    matched,
    matchRate: verdicts.length > 0 ? (matched / verdicts.length) * 100 : 0,
    aiTooHigh,
    aiTooLow,
    adjacent,
    genreStats,
    disagreements,
  };
}
