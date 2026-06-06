/**
 * Chart colors — Soft Print tokens as literal hex.
 * Recharts and @react-pdf/renderer cannot read CSS variables at runtime, so
 * the design tokens are mirrored here as concrete values. Light-mode values
 * are used for both modes; if the chart needs dark-mode tints, branch on
 * resolvedTheme in the component, not here.
 *
 * Brand (rose) is reserved for brand/CTA. Status uses sage/sand/clay.
 */
export const CHART_COLORS = {
  rose: '#BC6A77',   // brand only
  sage: '#5E8C63',   // success / Recommend
  sand: '#B07F2E',   // warning / Consider
  clay: '#B0543F',   // danger / Pass
  ink: '#2F2B25',    // primary text
  mute: '#645C50',   // secondary text
  hairline: '#E4DCCD',
  // Backwards-compat aliases (old names → new tokens) so existing chart code
  // doesn't break while it migrates. All semantic.
  emerald: '#5E8C63',
  amber: '#B07F2E',
  red: '#B0543F',
  gold: '#BC6A77',
  violet: '#645C50',
  teal: '#645C50',
  cyan: '#645C50',
  pink: '#BC6A77',
  orange: '#B07F2E',
  indigo: '#645C50',
  gray: '#8A8273',
} as const;

export const SCORE_COLORS = {
  excellent: CHART_COLORS.sage,
  good: CHART_COLORS.sand,
  poor: CHART_COLORS.clay,
} as const;

export const TIER_COLORS = {
  recommend: CHART_COLORS.sage,
  consider: CHART_COLORS.sand,
  pass: CHART_COLORS.clay,
  film_now: CHART_COLORS.rose,
} as const;
