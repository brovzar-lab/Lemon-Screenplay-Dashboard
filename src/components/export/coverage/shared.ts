/**
 * Shared palette, styles, and helpers for Coverage PDF sub-components.
 *
 * All @react-pdf styles must be inline StyleSheet objects — no CSS classes.
 */

import { StyleSheet } from '@react-pdf/renderer';
import {
  RECOMMENDATION_CONFIG,
  BUDGET_TIERS,
} from '@/types/screenplay';
import type { BudgetCategory, RecommendationTier } from '@/types/screenplay';

// ─────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────

export const C = {
  white: '#FFFFFF',
  grey50: '#F8F9FA',
  grey100: '#F1F3F5',
  grey200: '#E9ECEF',
  grey300: '#DEE2E6',
  grey500: '#ADB5BD',
  grey700: '#495057',
  grey900: '#212529',
  gold: '#B8860B',
  goldMuted: '#D4A843',
  goldBg: '#FDF8EE',
  green: '#0F7B3F',
  greenBg: '#ECFDF3',
  amber: '#B45309',
  amberBg: '#FFFBEB',
  red: '#B91C1C',
  redBg: '#FEF2F2',
  filmNow: '#B8860B',
  recommend: '#0F7B3F',
  consider: '#B45309',
  pass: '#B91C1C',
} as const;

const REC_COLORS: Record<RecommendationTier, string> = {
  film_now: C.filmNow, recommend: C.recommend, consider: C.consider, pass: C.pass,
};

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

export const s = StyleSheet.create({
  // ── Page ──
  page: {
    backgroundColor: C.white,
    paddingTop: 40,
    paddingHorizontal: 48,
    paddingBottom: 56,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.grey900,
    lineHeight: 1.4,
  },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: C.grey300,
  },
  footerText: { fontSize: 6.5, color: C.grey500 },

  // ── Cover header ──
  coverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: C.gold,
  },
  coverBrand: { flexDirection: 'row', alignItems: 'center' },
  coverLogo: { width: 32, height: 32, marginRight: 8 },
  brandName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.grey900,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  brandSub: {
    fontSize: 6.5,
    color: C.grey500,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 1,
  },
  coverDate: { fontSize: 7.5, color: C.grey500 },

  // ── Title ──
  titleBlock: { marginBottom: 16 },
  titleText: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: C.grey900,
    marginBottom: 8,
  },
  authorText: {
    fontSize: 11,
    color: C.grey700,
    marginTop: 2,
  },

  // ── Meta grid ──
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: C.grey300,
    borderRadius: 3,
    overflow: 'hidden',
  },
  metaCell: {
    width: '50%',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: C.grey200,
  },
  metaCellAlt: { backgroundColor: C.grey50 },
  metaLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.grey500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  metaValue: { fontSize: 8.5, color: C.grey900 },

  // ── Score hero ──
  scoreCard: {
    flexDirection: 'row',
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: C.grey300,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreLeft: {
    width: 120,
    alignItems: 'stretch',
    backgroundColor: C.grey50,
    borderRightWidth: 0.5,
    borderRightColor: C.grey300,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  scoreNum: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
  },
  recBadge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 2 },
  recBadgeText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: 1.2,
  },
  scoreRight: { flex: 1, padding: 12 },
  verdictLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.grey500,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  verdictText: {
    fontSize: 8,
    color: C.grey700,
    lineHeight: 1.45,
  },

  // ── Interior header ──
  intHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.gold,
  },
  intHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  intLogo: { width: 16, height: 16, marginRight: 5 },
  intBrand: {
    fontSize: 6.5,
    color: C.grey500,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  intTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.grey700 },

  // ── Sections ──
  heading: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: C.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: C.grey200,
  },
  section: { marginBottom: 14 },

  // ── Score bars ──
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: { width: 110, fontSize: 8.5, color: C.grey700 },
  barWeight: {
    width: 28,
    fontSize: 6.5,
    color: C.grey500,
    textAlign: 'right',
    marginRight: 6,
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: C.grey100,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
  barVal: {
    width: 36,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    marginLeft: 6,
  },

  // ── CVS table ──
  table: {
    borderWidth: 0.5,
    borderColor: C.grey300,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  tHead: {
    flexDirection: 'row',
    backgroundColor: C.grey100,
    borderBottomWidth: 0.5,
    borderBottomColor: C.grey300,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tHeadText: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.grey500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.grey200,
  },
  tRowAlt: { backgroundColor: C.grey50 },
  tCell: { fontSize: 8.5, color: C.grey900 },
  tCellBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  tTotal: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: C.goldBg,
  },
  tTotalText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.gold },

  // ── Snap cards ──
  snapGrid: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  snapCard: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: C.grey50,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: C.grey200,
    alignItems: 'center',
  },
  snapLabel: {
    fontSize: 6,
    color: C.grey500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  snapValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.grey900 },

  // ── Lists ──
  li: { flexDirection: 'row', marginBottom: 4, paddingLeft: 2 },
  bullet: { width: 12, fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 0.5 },
  liText: { flex: 1, fontSize: 8.5, color: C.grey900, lineHeight: 1.45 },

  // ── Pullquote ──
  pq: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    backgroundColor: C.goldBg,
    borderRadius: 2,
    marginBottom: 10,
  },
  pqText: { fontSize: 9, color: C.grey900, lineHeight: 1.5, fontStyle: 'italic' },

  // ── Characters ──
  charBlock: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.grey200,
  },
  charRole: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  charDesc: { fontSize: 8.5, color: C.grey900, lineHeight: 1.45 },

  // ── Comparable films ──
  compRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: C.grey50,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: C.grey200,
  },
  compInfo: { flex: 1 },
  compTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.grey900, marginBottom: 1 },
  compSim: { fontSize: 7.5, color: C.grey700, lineHeight: 1.35 },
  compBadge: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 2,
    marginLeft: 6,
    marginTop: 1,
  },

  // ── Notes ──
  noteCard: {
    padding: 8,
    marginBottom: 5,
    backgroundColor: C.goldBg,
    borderRadius: 3,
    borderLeftWidth: 3,
    borderLeftColor: C.goldMuted,
  },
  noteText: { fontSize: 8.5, color: C.grey900, lineHeight: 1.45, marginBottom: 2 },
  noteDate: { fontSize: 6.5, color: C.grey500 },

  // ── Audience ──
  audGrid: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  audItem: { flex: 1 },
  audLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.grey500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  audValue: { fontSize: 8.5, color: C.grey900 },

  // ── Not assessed ──
  notAssessed: {
    padding: 8,
    backgroundColor: C.grey50,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: C.grey200,
  },
  naText: { fontSize: 8, color: C.grey500, fontStyle: 'italic', textAlign: 'center' },

  // ── Structure ──
  structRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  structItem: { flex: 1 },
  structLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.grey500,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  structValue: { fontSize: 8.5, color: C.grey900, lineHeight: 1.4 },
  structAct: { fontSize: 8, color: C.grey700, lineHeight: 1.4, marginTop: 4 },
});

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

export const scoreColor = (v: number, max = 10): string => {
  const pct = v / max;
  if (pct >= 0.7) return C.green;
  if (pct >= 0.4) return C.amber;
  return C.red;
};

export const recLabel = (r: string): string =>
  RECOMMENDATION_CONFIG[r as RecommendationTier]?.label ?? r.toUpperCase().replace('_', ' ');

export const recColor = (r: string): string =>
  REC_COLORS[r as RecommendationTier] ?? C.grey700;

export const fmtDate = (d: string): string => {
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
};

export const budgetLabel = (cat: BudgetCategory): string => {
  const t = BUDGET_TIERS[cat];
  return t ? `${t.label} (${t.range})` : cat;
};

export const boLabel = (r: string): { text: string; color: string; bg: string } => {
  switch (r) {
    case 'success': return { text: 'Hit', color: C.green, bg: C.greenBg };
    case 'mixed': return { text: 'Mixed', color: C.amber, bg: C.amberBg };
    case 'failure': return { text: 'Flop', color: C.red, bg: C.redBg };
    default: return { text: r, color: C.grey700, bg: C.grey100 };
  }
};

export const today = (): string =>
  new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/** Truncate text at a word boundary. */
export const truncate = (text: string, maxLen: number): string => {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut) + '...';
};

/** True if a standout scene has meaningful data. */
export const hasSceneData = (sc: { scene?: string; why?: string } | null | undefined): boolean => {
  if (!sc) return false;
  const scene = (sc.scene ?? '').trim();
  const why = (sc.why ?? '').trim();
  return (scene.length > 0 && scene !== '—') || (why.length > 0 && why !== '—');
};

/** True if a comparable film has meaningful data. */
export const hasFilmData = (f: { title?: string; similarity?: string } | null | undefined): boolean => {
  if (!f) return false;
  const title = (f.title ?? '').trim();
  const similarity = (f.similarity ?? '').trim();
  return title.length > 0 || similarity.length > 0;
};
