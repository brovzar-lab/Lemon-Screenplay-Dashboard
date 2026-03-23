/**
 * Cover Page — Page 1 of the Coverage PDF
 *
 * Header bar, title/author, meta grid, score hero, logline, and score bars.
 */

import { Page, Text, View, Image } from '@react-pdf/renderer';
import type { Screenplay } from '@/types';
import type { DimensionDisplayItem } from '@/lib/dimensionDisplay';
import { s, scoreColor, recLabel, recColor, budgetLabel, truncate, today } from './shared';
import { __scoreGapStyle } from './constants';
import { Footer } from './SharedComponents';

interface CoverPageProps {
  screenplay: Screenplay;
  dims: DimensionDisplayItem[];
}

export function CoverPage({ screenplay, dims }: CoverPageProps) {
  return (
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

      </View>

      {/* Score hero */}
      <View style={s.scoreCard}>
        <View style={s.scoreLeft}>
          {/* Score + badge as centered group — explicit marginTop is reliable in react-pdf (flex distribution collapses) */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={[s.scoreNum, { color: scoreColor(Number(screenplay.weightedScore) || 0) }]}>
              {(Number(screenplay.weightedScore) || 0).toFixed(1)}
            </Text>
            <View style={__scoreGapStyle}>
              <View style={[s.recBadge, { backgroundColor: recColor(screenplay.recommendation) }]}>
                <Text style={s.recBadgeText}>{recLabel(screenplay.recommendation)}</Text>
              </View>
            </View>
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
  );
}
