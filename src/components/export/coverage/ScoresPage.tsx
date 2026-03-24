/**
 * Scores Page — Page 2 of the Coverage PDF
 *
 * Quality dimension deep-dive, CVS table, and commercial snapshot.
 */

import { Page, Text, View } from '@react-pdf/renderer';
import type { Screenplay } from '@/types';
import type { DimensionDisplayItem } from '@/lib/dimensionDisplay';
import { CVS_CONFIG, BUDGET_TIERS } from '@/types/screenplay';
import { s, C, scoreColor } from './shared';
import { Footer, IntHeader } from './SharedComponents';

interface ScoresPageProps {
  screenplay: Screenplay;
  dims: DimensionDisplayItem[];
  assessed: boolean;
}

export function ScoresPage({ screenplay, dims, assessed }: ScoresPageProps) {
  const cvs = screenplay.commercialViability ?? {} as typeof screenplay.commercialViability;

  return (
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
  );
}
