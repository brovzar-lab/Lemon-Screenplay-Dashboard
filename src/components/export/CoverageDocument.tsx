/**
 * Coverage Document PDF Component
 *
 * Professional screenplay coverage report. High-density layout optimized
 * for producer scanning.
 *
 * Key layout rules:
 *   - Cover page NEVER wraps — content is fixed-height, verdict truncated
 *   - Score bars show ONLY the bar + number (no inline justifications)
 *   - Sections with empty data are omitted entirely
 *   - Structure uses inline text, not card blocks
 *   - All content pages use `wrap` so react-pdf handles overflow
 */

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import type { Screenplay } from '@/types';
import type { Note } from '@/types/filters';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import {
  RECOMMENDATION_CONFIG,
  CVS_CONFIG,
  BUDGET_TIERS,
} from '@/types/screenplay';
import type { BudgetCategory, RecommendationTier } from '@/types/screenplay';

// ─────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────

const C = {
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

const s = StyleSheet.create({
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
    marginBottom: 3,
  },
  authorText: {
    fontSize: 11,
    color: C.grey700,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: C.grey50,
    borderRightWidth: 0.5,
    borderRightColor: C.grey300,
  },
  scoreNum: {
    fontSize: 32,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  scoreOf: { fontSize: 7, color: C.grey500, marginBottom: 6 },
  recBadge: { paddingVertical: 3, paddingHorizontal: 12, borderRadius: 2 },
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

const scoreColor = (v: number, max = 10): string => {
  const pct = v / max;
  if (pct >= 0.7) return C.green;
  if (pct >= 0.4) return C.amber;
  return C.red;
};

const recLabel = (r: string): string =>
  RECOMMENDATION_CONFIG[r as RecommendationTier]?.label ?? r.toUpperCase().replace('_', ' ');

const recColor = (r: string): string =>
  REC_COLORS[r as RecommendationTier] ?? C.grey700;

const fmtDate = (d: string): string => {
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
};

const budgetLabel = (cat: BudgetCategory): string => {
  const t = BUDGET_TIERS[cat];
  return t ? `${t.label} (${t.range})` : cat;
};

const boLabel = (r: string): { text: string; color: string; bg: string } => {
  switch (r) {
    case 'success': return { text: 'Hit', color: C.green, bg: C.greenBg };
    case 'mixed': return { text: 'Mixed', color: C.amber, bg: C.amberBg };
    case 'failure': return { text: 'Flop', color: C.red, bg: C.redBg };
    default: return { text: r, color: C.grey700, bg: C.grey100 };
  }
};

const today = (): string =>
  new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/** Truncate text at a word boundary. */
const truncate = (text: string, maxLen: number): string => {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut) + '...';
};

/** True if a standout scene has meaningful data. */
const hasSceneData = (sc: { scene?: string; why?: string } | null | undefined): boolean => {
  if (!sc) return false;
  const scene = (sc.scene ?? '').trim();
  const why = (sc.why ?? '').trim();
  return (scene.length > 0 && scene !== '—') || (why.length > 0 && why !== '—');
};

/** True if a comparable film has meaningful data. */
const hasFilmData = (f: { title?: string; similarity?: string } | null | undefined): boolean => {
  if (!f) return false;
  const title = (f.title ?? '').trim();
  const similarity = (f.similarity ?? '').trim();
  return title.length > 0 || similarity.length > 0;
};

// ─────────────────────────────────────────────
// SHARED
// ─────────────────────────────────────────────

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Confidential — For Lemon Studios internal use only</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

function IntHeader({ title }: { title: string }) {
  return (
    <View style={s.intHeader}>
      <View style={s.intHeaderLeft}>
        <Image src="/lemon-logo-black.png" style={s.intLogo} />
        <Text style={s.intBrand}>Lemon Studios</Text>
      </View>
      <Text style={s.intTitle}>{title}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────

interface CoverageDocumentProps {
  screenplay: Screenplay;
  notes: Note[];
}

// ─────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────

export function CoverageDocument({ screenplay, notes }: CoverageDocumentProps) {
  const dims = getDimensionDisplay(screenplay);
  const cvs = screenplay.commercialViability ?? {} as typeof screenplay.commercialViability;
  const assessed = cvs?.cvsAssessed ?? false;
  const comps = (screenplay.comparableFilms ?? []).filter((f) => hasFilmData(f));
  const scenes = (screenplay.standoutScenes ?? []).filter((sc) => hasSceneData(sc));

  return (
    <Document>
      {/* ═══════════ PAGE 1 — COVER ═══════════ */}
      <Page size="A4" style={s.page}>

        {/* Header bar */}
        <View style={s.coverHeader}>
          <View style={s.coverBrand}>
            <Image src="/lemon-logo-black.png" style={s.coverLogo} />
            <View>
              <Text style={s.brandName}>Lemon Studios</Text>
              <Text style={s.brandSub}>Coverage Report</Text>
            </View>
          </View>
          <Text style={s.coverDate}>{today()}</Text>
        </View>

        {/* Title + author on separate lines */}
        <View style={s.titleBlock}>
          <Text style={s.titleText}>{screenplay.title}</Text>
          <Text style={s.authorText}>by {screenplay.author}</Text>
        </View>

        {/* Meta grid */}
        <View style={s.metaGrid}>
          <View style={[s.metaCell, s.metaCellAlt]}>
            <Text style={s.metaLabel}>Genre</Text>
            <Text style={s.metaValue}>
              {screenplay.genre}{(screenplay.subgenres?.length ?? 0) > 0 ? ` / ${screenplay.subgenres.join(', ')}` : ''}
            </Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Tone</Text>
            <Text style={s.metaValue}>{screenplay.tone || '—'}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Budget Tier</Text>
            <Text style={s.metaValue}>{budgetLabel(screenplay.budgetCategory)}</Text>
          </View>
          <View style={[s.metaCell, s.metaCellAlt]}>
            <Text style={s.metaLabel}>Pages / Words</Text>
            <Text style={s.metaValue}>
              {screenplay.metadata?.pageCount ?? '—'} pp / {(screenplay.metadata?.wordCount ?? 0).toLocaleString()} words
            </Text>
          </View>
          <View style={[s.metaCell, s.metaCellAlt]}>
            <Text style={s.metaLabel}>Themes</Text>
            <Text style={s.metaValue}>{(screenplay.themes?.length ?? 0) > 0 ? screenplay.themes.join(', ') : '—'}</Text>
          </View>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>Analysis</Text>
            <Text style={s.metaValue}>{(screenplay.analysisVersion || 'Unknown').toUpperCase()} — {screenplay.analysisModel || 'Unknown'}</Text>
          </View>
        </View>

        {/* Score hero — verdict truncated to fit */}
        <View style={s.scoreCard}>
          <View style={s.scoreLeft}>
            <Text style={[s.scoreNum, { color: scoreColor(Number(screenplay.weightedScore) || 0) }]}>
              {(Number(screenplay.weightedScore) || 0).toFixed(1)}
            </Text>
            <Text style={s.scoreOf}>out of 10</Text>
            <View style={[s.recBadge, { backgroundColor: recColor(screenplay.recommendation) }]}>
              <Text style={s.recBadgeText}>{recLabel(screenplay.recommendation)}</Text>
            </View>
          </View>
          <View style={s.scoreRight}>
            <Text style={s.verdictLabel}>Verdict</Text>
            <Text style={s.verdictText}>
              {truncate(screenplay.verdictStatement, 600)}
            </Text>
          </View>
        </View>

        {/* Logline */}
        <View style={s.section}>
          <Text style={s.heading}>Logline</Text>
          <View style={s.pq}>
            <Text style={s.pqText}>{screenplay.logline}</Text>
          </View>
        </View>

        {/* Quick dimension summary — bars only, no justifications */}
        <View style={s.section}>
          <Text style={s.heading}>Scores At A Glance</Text>
          {dims.map((dim) => (
            <View key={dim.key} style={s.barRow}>
              <Text style={s.barLabel}>{dim.label}</Text>
              <Text style={s.barWeight}>{(dim.weight * 100).toFixed(0)}%</Text>
              <View style={s.barTrack}>
                <View
                  style={[s.barFill, {
                    width: `${(dim.score / 10) * 100}%`,
                    backgroundColor: scoreColor(dim.score),
                  }]}
                />
              </View>
              <Text style={[s.barVal, { color: scoreColor(dim.score) }]}>
                {dim.score.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>

        <Footer />
      </Page>

      {/* ═══════════ PAGE 2 — DETAILED SCORES + COMMERCIAL ═══════════ */}
      <Page size="A4" style={s.page} wrap>
        <IntHeader title={screenplay.title} />

        {/* Dimension deep-dive — justifications as compact paragraphs */}
        <View style={s.section}>
          <Text style={s.heading}>Quality Dimensions</Text>
          {dims.map((dim) => (
            <View key={dim.key} style={{ marginBottom: 10 }} wrap={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.grey900 }}>
                  {dim.label}
                </Text>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: scoreColor(dim.score) }}>
                  {dim.score.toFixed(1)}/10 ({(dim.weight * 100).toFixed(0)}%)
                </Text>
              </View>
              {dim.justification ? (
                <Text style={{ fontSize: 8, color: C.grey700, lineHeight: 1.4 }}>
                  {dim.justification}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* CVS */}
        {assessed ? (
          <View style={s.section}>
            <Text style={s.heading}>Commercial Viability</Text>
            <View style={s.table}>
              <View style={s.tHead}>
                <Text style={[s.tHeadText, { flex: 1 }]}>Factor</Text>
                <Text style={[s.tHeadText, { width: 45, textAlign: 'center' }]}>Score</Text>
                <Text style={[s.tHeadText, { flex: 2, marginLeft: 6 }]}>Note</Text>
              </View>
              {CVS_CONFIG.map((cfg, i) => {
                const f = cvs[cfg.key];
                return (
                  <View key={cfg.key} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
                    <Text style={[s.tCell, { flex: 1 }]}>{cfg.label}</Text>
                    <Text style={[s.tCellBold, { width: 45, textAlign: 'center', color: scoreColor(f.score, cfg.maxScore) }]}>
                      {f.score}/{cfg.maxScore}
                    </Text>
                    <Text style={[s.tCell, { flex: 2, marginLeft: 6, color: C.grey700, fontSize: 7.5 }]}>
                      {f.note || '—'}
                    </Text>
                  </View>
                );
              })}
              <View style={s.tTotal}>
                <Text style={[s.tTotalText, { flex: 1 }]}>Total</Text>
                <Text style={[s.tTotalText, { width: 45, textAlign: 'center' }]}>
                  {screenplay.cvsTotal}/18
                </Text>
                <Text style={{ flex: 2, marginLeft: 6 }}>{' '}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.heading}>Commercial Viability</Text>
            <View style={s.notAssessed}>
              <Text style={s.naText}>CVS lens was not applied to this analysis.</Text>
            </View>
          </View>
        )}

        {/* Commercial snapshot */}
        <View style={s.section}>
          <Text style={s.heading}>Commercial Snapshot</Text>
          <View style={s.snapGrid}>
            <View style={s.snapCard}>
              <Text style={s.snapLabel}>Marketability</Text>
              <Text style={s.snapValue}>{screenplay.marketability.toUpperCase()}</Text>
            </View>
            <View style={s.snapCard}>
              <Text style={s.snapLabel}>Budget</Text>
              <Text style={s.snapValue}>{BUDGET_TIERS[screenplay.budgetCategory]?.label ?? screenplay.budgetCategory}</Text>
            </View>
            <View style={s.snapCard}>
              <Text style={s.snapLabel}>USP Strength</Text>
              <Text style={s.snapValue}>{screenplay.producerMetrics.uspStrength ?? '—'}</Text>
            </View>
            {screenplay.producerMetrics.marketPotential != null && (
              <View style={s.snapCard}>
                <Text style={s.snapLabel}>Market Potential</Text>
                <Text style={[s.snapValue, { color: scoreColor(screenplay.producerMetrics.marketPotential) }]}>
                  {screenplay.producerMetrics.marketPotential}/10
                </Text>
              </View>
            )}
          </View>
        </View>

        <Footer />
      </Page>

      {/* ═══════════ PAGE 3+ — ANALYSIS ═══════════ */}
      <Page size="A4" style={s.page} wrap>
        <IntHeader title={screenplay.title} />

        {/* Strengths */}
        <View style={s.section}>
          <Text style={s.heading}>Strengths</Text>
          {(screenplay.strengths ?? []).map((str, i) => (
            <View key={i} style={s.li} wrap={false}>
              <Text style={[s.bullet, { color: C.green }]}>+</Text>
              <Text style={s.liText}>{str}</Text>
            </View>
          ))}
        </View>

        {/* Weaknesses */}
        <View style={s.section}>
          <Text style={s.heading}>Weaknesses</Text>
          {(screenplay.weaknesses ?? []).map((w, i) => (
            <View key={i} style={s.li} wrap={false}>
              <Text style={[s.bullet, { color: C.amber }]}>-</Text>
              <Text style={s.liText}>{w}</Text>
            </View>
          ))}
        </View>

        {/* Critical failures */}
        {(screenplay.criticalFailures?.length ?? 0) > 0 && (
          <View style={s.section}>
            <Text style={s.heading}>Critical Failures</Text>
            {(screenplay.criticalFailures ?? []).map((cf, i) => (
              <View key={i} style={s.li} wrap={false}>
                <Text style={[s.bullet, { color: C.red }]}>!</Text>
                <Text style={s.liText}>{cf}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Dev notes */}
        {(screenplay.developmentNotes?.length ?? 0) > 0 && (
          <View style={s.section}>
            <Text style={s.heading}>Development Notes</Text>
            {(screenplay.developmentNotes ?? []).map((dn, i) => (
              <View key={i} style={s.li} wrap={false}>
                <Text style={[s.bullet, { color: C.gold }]}>*</Text>
                <Text style={s.liText}>{dn}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Structure */}
        <View style={s.section}>
          <Text style={s.heading}>Structure</Text>
          <View style={s.structRow}>
            <View style={s.structItem}>
              <Text style={s.structLabel}>Format Quality</Text>
              <Text style={s.structValue}>{screenplay.structureAnalysis?.formatQuality ?? '—'}</Text>
            </View>
            <View style={s.structItem}>
              <Text style={s.structLabel}>Pacing</Text>
              <Text style={s.structValue}>{screenplay.structureAnalysis?.pacing || '—'}</Text>
            </View>
          </View>
          {screenplay.structureAnalysis?.actBreaks ? (
            <Text style={s.structAct}>{screenplay.structureAnalysis.actBreaks}</Text>
          ) : null}
        </View>

        <Footer />
      </Page>

      {/* ═══════════ PAGE 4 — APPENDIX ═══════════ */}
      <Page size="A4" style={s.page} wrap>
        <IntHeader title={screenplay.title} />

        {/* Characters */}
        <View style={s.section}>
          <Text style={s.heading}>Characters</Text>
          <View style={s.charBlock} wrap={false}>
            <Text style={s.charRole}>Protagonist</Text>
            <Text style={s.charDesc}>{screenplay.characters.protagonist || '—'}</Text>
          </View>
          <View style={s.charBlock} wrap={false}>
            <Text style={s.charRole}>Antagonist</Text>
            <Text style={s.charDesc}>{screenplay.characters.antagonist || '—'}</Text>
          </View>
          {(screenplay.characters.supporting?.length ?? 0) > 0 && (
            <View style={s.charBlock}>
              <Text style={s.charRole}>Supporting Cast</Text>
              {screenplay.characters.supporting.map((ch, i) => (
                <View key={i} style={s.li} wrap={false}>
                  <Text style={[s.bullet, { color: C.grey500 }]}>-</Text>
                  <Text style={s.liText}>{ch}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Comparable Films — only if any have real data */}
        {comps.length > 0 && (
          <View style={s.section}>
            <Text style={s.heading}>Comparable Films</Text>
            {comps.map((film, i) => {
              const bo = boLabel(film.boxOfficeRelevance);
              return (
                <View key={i} style={s.compRow} wrap={false}>
                  <View style={s.compInfo}>
                    <Text style={s.compTitle}>{film.title}</Text>
                    {film.similarity ? <Text style={s.compSim}>{film.similarity}</Text> : null}
                  </View>
                  <Text style={[s.compBadge, { color: bo.color, backgroundColor: bo.bg }]}>
                    {bo.text}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Target Audience */}
        <View style={s.section}>
          <Text style={s.heading}>Target Audience</Text>
          <View style={s.audGrid}>
            <View style={s.audItem}>
              <Text style={s.audLabel}>Primary Demographic</Text>
              <Text style={s.audValue}>
                {screenplay.targetAudience.primaryDemographic || 'Not specified'}
              </Text>
            </View>
            <View style={s.audItem}>
              <Text style={s.audLabel}>Gender Skew</Text>
              <Text style={s.audValue}>{screenplay.targetAudience.genderSkew}</Text>
            </View>
          </View>
          {(screenplay.targetAudience.interests?.length ?? 0) > 0 && (
            <View>
              <Text style={s.audLabel}>Interests</Text>
              <Text style={s.audValue}>{screenplay.targetAudience.interests.join(', ')}</Text>
            </View>
          )}
        </View>

        {/* Standout Scenes — only if any have real data */}
        {scenes.length > 0 && (
          <View style={s.section}>
            <Text style={s.heading}>Standout Scenes</Text>
            {scenes.map((sc, i) => {
              const label = [sc.scene, sc.why].filter(Boolean).join(' — ');
              return (
                <View key={i} style={s.li} wrap={false}>
                  <Text style={[s.bullet, { color: C.gold }]}>*</Text>
                  <Text style={s.liText}>{label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Producer Notes */}
        {notes.length > 0 && (
          <View style={s.section}>
            <Text style={s.heading}>Producer Notes</Text>
            {notes.map((note) => (
              <View key={note.id} style={s.noteCard} wrap={false}>
                <Text style={s.noteText}>{note.content}</Text>
                <Text style={s.noteDate}>{fmtDate(note.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        <Footer />
      </Page>
    </Document>
  );
}

export default CoverageDocument;
