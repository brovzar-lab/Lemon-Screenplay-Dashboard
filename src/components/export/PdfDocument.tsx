/**
 * PDF Document Component
 * Generates PDF pitch deck for screenplays using @react-pdf/renderer
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { Screenplay } from '@/types';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#0F172A',
    padding: 40,
    fontFamily: 'Helvetica',
    color: '#F1F5F9',
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#F59E0B',
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FEF3C7',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 4,
  },
  badge: {
    display: 'flex',
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginTop: 12,
  },
  badgeFilmNow: {
    backgroundColor: '#F59E0B',
    color: '#0F172A',
  },
  badgeRecommend: {
    backgroundColor: '#10B981',
    color: '#FFFFFF',
  },
  badgeConsider: {
    backgroundColor: '#F59E0B',
    color: '#0F172A',
  },
  badgePass: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F59E0B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  logline: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 1.6,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoItem: {
    marginBottom: 8,
    minWidth: 120,
  },
  infoLabel: {
    fontSize: 9,
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 11,
    color: '#F1F5F9',
  },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scoreItem: {
    width: '48%',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
  },
  scoreLabel: {
    fontSize: 9,
    color: '#94A3B8',
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreBar: {
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    marginTop: 4,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  list: {
    marginLeft: 12,
  },
  listItem: {
    fontSize: 10,
    color: '#CBD5E1',
    marginBottom: 4,
    lineHeight: 1.5,
  },
  strengthItem: {
    color: '#10B981',
  },
  weaknessItem: {
    color: '#F59E0B',
  },
  criticalItem: {
    color: '#EF4444',
  },
  comparableFilm: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
  },
  comparableTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginBottom: 2,
  },
  comparableSimilarity: {
    fontSize: 9,
    color: '#94A3B8',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 8,
    color: '#64748B',
  },
  verdict: {
    padding: 16,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  verdictText: {
    fontSize: 11,
    color: '#F1F5F9',
    lineHeight: 1.6,
  },
  producerMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  metricBox: {
    width: '30%',
    padding: 12,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  metricLabel: {
    fontSize: 8,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginTop: 4,
    textAlign: 'center',
  },
});

// Helper to get score color
const getScoreColor = (score: number, max: number = 10): string => {
  const pct = score / max;
  if (pct >= 0.8) return '#10B981'; // Emerald
  if (pct >= 0.6) return '#F59E0B'; // Gold
  return '#EF4444'; // Red
};

// Helper to get badge style
const getBadgeStyle = (recommendation: string) => {
  switch (recommendation) {
    case 'film_now':
      return styles.badgeFilmNow;
    case 'recommend':
      return styles.badgeRecommend;
    case 'consider':
      return styles.badgeConsider;
    case 'pass':
      return styles.badgePass;
    default:
      return {};
  }
};

// Helper to format recommendation label
const getRecommendationLabel = (recommendation: string): string => {
  return recommendation.toUpperCase().replace('_', ' ');
};

interface PdfDocumentProps {
  screenplay: Screenplay;
}

export function PdfDocument({ screenplay }: PdfDocumentProps) {
  return (
    <Document>
      {/* Title Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{screenplay.title}</Text>
          <Text style={styles.subtitle}>by {screenplay.author}</Text>
          <Text style={styles.subtitle}>{screenplay.genre} • {screenplay.collection}</Text>
          <View style={[styles.badge, getBadgeStyle(screenplay.recommendation)]}>
            <Text style={styles.badgeText}>
              {getRecommendationLabel(screenplay.recommendation)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Logline</Text>
          <Text style={styles.logline}>{screenplay.logline}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Core Scores</Text>
          <View style={styles.scoreGrid}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>Weighted Score</Text>
              <Text style={[styles.scoreValue, { color: getScoreColor(screenplay.weightedScore) }]}>
                {screenplay.weightedScore.toFixed(1)}
              </Text>
              <View style={styles.scoreBar}>
                <View
                  style={[
                    styles.scoreBarFill,
                    {
                      width: `${(screenplay.weightedScore / 10) * 100}%`,
                      backgroundColor: getScoreColor(screenplay.weightedScore),
                    },
                  ]}
                />
              </View>
            </View>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>CVS Total</Text>
              <Text style={[styles.scoreValue, { color: getScoreColor(screenplay.cvsTotal, 18) }]}>
                {screenplay.cvsTotal}/18
              </Text>
              <View style={styles.scoreBar}>
                <View
                  style={[
                    styles.scoreBarFill,
                    {
                      width: `${(screenplay.cvsTotal / 18) * 100}%`,
                      backgroundColor: getScoreColor(screenplay.cvsTotal, 18),
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Producer Metrics</Text>
          <View style={styles.producerMetrics}>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{screenplay.producerMetrics.marketPotential}</Text>
              <Text style={styles.metricLabel}>Market Potential</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{'★'.repeat(screenplay.producerMetrics.roiIndicator)}</Text>
              <Text style={styles.metricLabel}>ROI Indicator</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricValue}>{screenplay.producerMetrics.festivalAppeal}</Text>
              <Text style={styles.metricLabel}>Festival Appeal</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verdict</Text>
          <View style={styles.verdict}>
            <Text style={styles.verdictText}>{screenplay.verdictStatement}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Lemon Screenplay Dashboard • V3 Analysis • Generated {new Date().toLocaleDateString()}
          </Text>
        </View>
      </Page>

      {/* Dimension Scores Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dimension Scores</Text>
          <View style={styles.scoreGrid}>
            {[
              { key: 'concept', label: 'Concept', score: screenplay.dimensionScores.concept },
              { key: 'structure', label: 'Structure', score: screenplay.dimensionScores.structure },
              { key: 'protagonist', label: 'Protagonist', score: screenplay.dimensionScores.protagonist },
              { key: 'supportingCast', label: 'Supporting Cast', score: screenplay.dimensionScores.supportingCast },
              { key: 'dialogue', label: 'Dialogue', score: screenplay.dimensionScores.dialogue },
              { key: 'genreExecution', label: 'Genre Execution', score: screenplay.dimensionScores.genreExecution },
              { key: 'originality', label: 'Originality', score: screenplay.dimensionScores.originality },
            ].map((dim) => (
              <View key={dim.key} style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>{dim.label}</Text>
                <Text style={[styles.scoreValue, { color: getScoreColor(dim.score) }]}>
                  {dim.score.toFixed(1)}
                </Text>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      {
                        width: `${(dim.score / 10) * 100}%`,
                        backgroundColor: getScoreColor(dim.score),
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Strengths</Text>
          <View style={styles.list}>
            {screenplay.strengths.slice(0, 5).map((strength, i) => (
              <Text key={i} style={[styles.listItem, styles.strengthItem]}>
                • {strength}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Areas for Development</Text>
          <View style={styles.list}>
            {screenplay.weaknesses.slice(0, 5).map((weakness, i) => (
              <Text key={i} style={[styles.listItem, styles.weaknessItem]}>
                • {weakness}
              </Text>
            ))}
          </View>
        </View>

        {screenplay.criticalFailures.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Critical Failures</Text>
            <View style={styles.list}>
              {screenplay.criticalFailures.map((failure, i) => (
                <Text key={i} style={[styles.listItem, styles.criticalItem]}>
                  ⚠ {failure}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {screenplay.title} • Page 2
          </Text>
        </View>
      </Page>

      {/* Comparable Films Page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comparable Films</Text>
          {screenplay.comparableFilms.map((film, i) => (
            <View key={i} style={styles.comparableFilm}>
              <Text style={styles.comparableTitle}>{film.title}</Text>
              <Text style={styles.comparableSimilarity}>{film.similarity}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Production Details</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Budget Tier</Text>
              <Text style={styles.infoValue}>{screenplay.budgetCategory.toUpperCase()}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Marketability</Text>
              <Text style={styles.infoValue}>{screenplay.marketability.toUpperCase()}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Production Risk</Text>
              <Text style={styles.infoValue}>{screenplay.producerMetrics.productionRisk}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>USP Strength</Text>
              <Text style={styles.infoValue}>{screenplay.producerMetrics.uspStrength}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Audience</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Primary Demographic</Text>
              <Text style={styles.infoValue}>{screenplay.targetAudience.primaryDemographic}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Gender Skew</Text>
              <Text style={styles.infoValue}>{screenplay.targetAudience.genderSkew}</Text>
            </View>
          </View>
          <View style={{ marginTop: 8 }}>
            <Text style={styles.infoLabel}>Interests</Text>
            <Text style={styles.infoValue}>{screenplay.targetAudience.interests.join(', ')}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Development Notes</Text>
          <View style={styles.list}>
            {screenplay.developmentNotes.slice(0, 5).map((note, i) => (
              <Text key={i} style={styles.listItem}>
                • {note}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {screenplay.title} • Page 3
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export default PdfDocument;
