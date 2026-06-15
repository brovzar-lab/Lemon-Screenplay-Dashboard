/**
 * Chart colors — Halation tokens as literal hex.
 * Recharts and @react-pdf/renderer cannot read CSS variables at runtime, so
 * the design tokens are mirrored here as concrete values. Dark-mode values
 * are used (brighter) since charts typically sit on dark surfaces; for light
 * mode the slight brightness boost still reads well.
 *
 * Accent (violet) is for brand/CTA. Verdicts use their own hues.
 */
export const CHART_COLORS = {
  // Accent / brand
  accent: '#7C6AF6',

  // Verdicts
  filmNow: '#F5B651',
  recommend: '#4CDE9B',
  consider: '#F1A93C',
  pass: '#F76E7C',

  // Neutral
  ink: '#F4F2FF',    // text on dark charts
  mute: '#A9A4C4',   // dim axis text
  hairline: 'rgba(255,255,255,0.08)',

  // Secondary
  cyan: '#46E5FF',

  // Genre palette
  drama:    '#46C99A',
  horror:   '#FF6B6B',
  thriller: '#6C8BFF',
  crime:    '#C792FF',
  action:   '#FFA336',
  scifi:    '#3FC8E6',
  fantasy:  '#9D8DF1',
  comedy:   '#FF7AB6',
  western:  '#D69A56',
  romance:  '#FF8FA3',

  // Backwards-compat aliases (old names → new tokens)
  rose: '#7C6AF6',     // accent
  emerald: '#4CDE9B',  // recommend
  sage: '#4CDE9B',     // recommend
  sand: '#F1A93C',     // consider
  amber: '#F1A93C',    // consider
  clay: '#F76E7C',     // pass
  red: '#F76E7C',      // pass
  gold: '#F5B651',     // film now
  violet: '#9D8DF1',   // fantasy genre
  teal: '#3FC8E6',     // sci-fi
  pink: '#FF7AB6',     // comedy
  orange: '#FFA336',   // action
  indigo: '#6C8BFF',   // thriller
  gray: '#6F6A8C',     // muted
} as const;

export const SCORE_COLORS = {
  excellent: CHART_COLORS.recommend,
  good: CHART_COLORS.consider,
  poor: CHART_COLORS.pass,
} as const;

export const TIER_COLORS = {
  recommend: CHART_COLORS.recommend,
  consider: CHART_COLORS.consider,
  pass: CHART_COLORS.pass,
  film_now: CHART_COLORS.filmNow,
} as const;
