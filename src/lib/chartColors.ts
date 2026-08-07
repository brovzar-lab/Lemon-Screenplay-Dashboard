/**
 * Chart colors — Instrument design system tokens as literal hex.
 * Recharts and @react-pdf/renderer cannot read CSS variables at runtime, so
 * the design tokens are mirrored here as concrete values.
 *
 * Data colors (blue, violet, teal, coral) live in charts and status only.
 * They never touch the chrome or an action.
 * Cobalt accent is for brand/CTA only. Verdicts use semantic colors.
 *
 * Gold is reserved for the Film Now verdict. It is never used as generic chrome.
 */
export const CHART_COLORS = {
  // Accent / brand (cobalt)
  accent: '#2B54F0',

  // Verdicts (semantic)
  filmNow: '#D8A828', // Film Now gold
  recommend: '#12A66B', // success green
  consider: '#2B54F0', // Consider blue
  pass: '#FF5247', // error red

  // Neutral
  ink: '#EDF1F9', // text on dark charts
  mute: '#94A2BE', // dim axis text
  hairline: 'rgba(255,255,255,0.08)',

  // Data palette (blue, violet, teal, coral)
  dataBlue: '#6E8BFF',
  dataViolet: '#9F86FF',
  dataTeal: '#2FC9B0',
  dataCoral: '#FF8A78',

  // Genre palette — data hues only, no warm/gold/amber
  drama: '#2FC9B0', // teal
  horror: '#FF8A78', // coral
  thriller: '#6E8BFF', // blue
  crime: '#9F86FF', // violet
  action: '#FF6B5C', // coral variant
  scifi: '#2FC9B0', // teal
  fantasy: '#9F86FF', // violet
  comedy: '#FF8A78', // coral
  western: '#119C8B', // deep teal
  romance: '#FF6B5C', // coral

  // Backwards-compat aliases
  rose: '#2B54F0', // accent
  emerald: '#12A66B', // success
  sage: '#12A66B', // success
  sand: '#F5A524', // warning
  amber: '#F5A524', // warning
  clay: '#FF5247', // error
  red: '#FF5247', // error
  gold: '#2B54F0', // legacy alias remains cobalt; use filmNow for verdict gold
  violet: '#9F86FF', // data violet
  teal: '#2FC9B0', // data teal
  pink: '#FF8A78', // data coral
  orange: '#FF6B5C', // data coral variant
  indigo: '#6E8BFF', // data blue
  gray: '#73819E', // muted
  cyan: '#2FC9B0', // data teal
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
