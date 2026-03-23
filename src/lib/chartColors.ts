export const CHART_COLORS = {
  emerald: '#10B981',
  gold: '#F59E0B',
  red: '#EF4444',
  violet: '#8B5CF6',
  teal: '#14B8A6',
  amber: '#F59E0B',
  rose: '#F43F5E',
  cyan: '#06B6D4',
  pink: '#EC4899',
  orange: '#F97316',
  indigo: '#6366F1',
  gray: '#6B7280',
} as const;

export const SCORE_COLORS = {
  excellent: CHART_COLORS.emerald,
  good: CHART_COLORS.gold,
  poor: CHART_COLORS.red,
} as const;

export const TIER_COLORS = {
  recommend: CHART_COLORS.emerald,
  consider: CHART_COLORS.amber,
  pass: CHART_COLORS.red,
  film_now: '#FFD700',
} as const;
