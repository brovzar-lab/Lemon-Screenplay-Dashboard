/**
 * Coverage Document PDF Component
 * Generates a branded, print-friendly coverage PDF for a single screenplay
 * using @react-pdf/renderer.
 *
 * Layout: Cover Page -> Scores Page -> Analysis Page(s) -> Details Page
 * Light theme with gold accents and Lemon Studios branding.
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
import { RECOMMENDATION_CONFIG, CVS_CONFIG } from '@/types/screenplay';

// ============================================
// COLOR PALETTE (print-friendly)
// ============================================

const colors = {
  background: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#4A4A5A',
  gold: '#B8860B',
  goldLight: '#FFF8DC',
  scoreGreen: '#16A34A',
  scoreAmber: '#D97706',
  scoreRed: '#DC2626',
  border: '#E5E7EB',
  footerText: '#9CA3AF',
  barBackground: '#F3F4F6',
} as const;

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: colors.background,
    padding: 40,
    fontFamily: 'Helvetica',
    color: colors.text,
    paddingBottom: 70,
  },
  // Header (every page)
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLogo: {
    width: 30,
    height: 30,
    marginRight: 8,
  },
  headerText: {
    fontSize: 8,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Footer (every page)
  pageFooter: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  footerConfidential: {
    fontSize: 7,
    color: colors.footerText,
  },
  footerPage: {
    fontSize: 7,
    color: colors.footerText,
  },
  // Cover page
  coverContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverLogo: {
    width: 100,
    marginBottom: 30,
  },
  coverPoster: {
    width: 180,
    maxHeight: 260,
    marginBottom: 24,
    borderRadius: 4,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  coverAuthor: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 6,
  },
  coverGenre: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  coverBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: colors.goldLight,
    marginBottom: 12,
  },
  coverBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  coverScore: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  coverScoreLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  coverVerdict: {
    maxWidth: 400,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    backgroundColor: colors.goldLight,
    borderRadius: 4,
  },
  coverVerdictText: {
    fontSize: 11,
    color: colors.text,
    lineHeight: 1.6,
    fontStyle: 'italic',
  },
  // Section headers
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.gold,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 6,
  },
  section: {
    marginBottom: 20,
  },
  // Score bars
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    width: 130,
    fontSize: 10,
    color: colors.text,
  },
  scoreBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: colors.barBackground,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  scoreValue: {
    width: 40,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  // CVS summary
  cvsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cvsLabel: {
    fontSize: 10,
    color: colors.text,
  },
  cvsScore: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cvsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.goldLight,
    borderRadius: 4,
    marginTop: 4,
  },
  cvsTotalLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.gold,
  },
  cvsTotalValue: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.gold,
  },
  // Lists
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  bullet: {
    fontSize: 10,
    color: colors.textSecondary,
    marginRight: 6,
    width: 10,
  },
  listText: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.5,
    flex: 1,
  },
  // Comparable films
  compFilm: {
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  compDetail: {
    fontSize: 9,
    color: colors.textSecondary,
    lineHeight: 1.4,
  },
  // Characters
  characterRow: {
    marginBottom: 6,
  },
  characterLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  characterValue: {
    fontSize: 10,
    color: colors.text,
    marginTop: 2,
  },
  // Notes
  noteCard: {
    padding: 10,
    marginBottom: 8,
    backgroundColor: colors.goldLight,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  noteContent: {
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  noteDate: {
    fontSize: 8,
    color: colors.textSecondary,
  },
  // Pullquote
  pullquote: {
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    backgroundColor: colors.goldLight,
    borderRadius: 4,
  },
  pullquoteText: {
    fontSize: 11,
    color: colors.text,
    lineHeight: 1.6,
    fontStyle: 'italic',
  },
  // Target audience
  audienceGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  audienceItem: {
    flex: 1,
  },
  audienceLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  audienceValue: {
    fontSize: 10,
    color: colors.text,
  },
});

// ============================================
// HELPERS
// ============================================

const getScoreColor = (score: number, max: number = 10): string => {
  const pct = score / max;
  if (pct >= 0.7) return colors.scoreGreen;
  if (pct >= 0.4) return colors.scoreAmber;
  return colors.scoreRed;
};

const getRecommendationLabel = (recommendation: string): string => {
  const config = RECOMMENDATION_CONFIG[recommendation as keyof typeof RECOMMENDATION_CONFIG];
  return config?.label ?? recommendation.toUpperCase().replace('_', ' ');
};

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

const boxOfficeLabel = (relevance: string): string => {
  switch (relevance) {
    case 'success': return 'Box Office Success';
    case 'mixed': return 'Mixed Results';
    case 'failure': return 'Box Office Failure';
    default: return relevance;
  }
};

// ============================================
// SUB-COMPONENTS
// ============================================

function PageHeader() {
  return (
    <View style={styles.pageHeader}>
      <Image src="/lemon-logo-black.png" style={styles.headerLogo} />
      <Text style={styles.headerText}>Lemon Studios Coverage Report</Text>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.footerConfidential}>
        Confidential -- For Lemon Studios internal use
      </Text>
      <Text style={styles.footerPage} render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
        `Page ${pageNumber} of ${totalPages}`
      } />
    </View>
  );
}

// ============================================
// PROPS
// ============================================

interface CoverageDocumentProps {
  screenplay: Screenplay;
  notes: Note[];
}

// ============================================
// MAIN COMPONENT
// ============================================

export function CoverageDocument({ screenplay, notes }: CoverageDocumentProps) {
  const dimensions = getDimensionDisplay(screenplay);

  return (
    <Document>
      {/* ========== COVER PAGE ========== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.coverContent}>
          <Image src="/lemon-logo-black.png" style={styles.coverLogo} />

          {screenplay.posterUrl && (
            <Image src={screenplay.posterUrl} style={styles.coverPoster} />
          )}

          <Text style={styles.coverTitle}>{screenplay.title}</Text>
          <Text style={styles.coverAuthor}>by {screenplay.author}</Text>
          <Text style={styles.coverGenre}>
            {screenplay.genre}{screenplay.subgenres.length > 0 ? ` | ${screenplay.subgenres.join(', ')}` : ''}
          </Text>

          <View style={styles.coverBadge}>
            <Text style={styles.coverBadgeText}>
              {getRecommendationLabel(screenplay.recommendation)}
            </Text>
          </View>

          <Text style={[styles.coverScore, { color: getScoreColor(screenplay.weightedScore) }]}>
            {screenplay.weightedScore.toFixed(1)}
          </Text>
          <Text style={styles.coverScoreLabel}>Overall Weighted Score</Text>

          <View style={styles.coverVerdict}>
            <Text style={styles.coverVerdictText}>{screenplay.verdictStatement}</Text>
          </View>
        </View>

        <PageFooter />
      </Page>

      {/* ========== SCORES PAGE ========== */}
      <Page size="A4" style={styles.page} wrap>
        <PageHeader />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dimension Scores</Text>
          {dimensions.map((dim) => (
            <View key={dim.key} style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{dim.label}</Text>
              <View style={styles.scoreBarContainer}>
                <View
                  style={[
                    styles.scoreBarFill,
                    {
                      width: `${(dim.score / 10) * 100}%`,
                      backgroundColor: getScoreColor(dim.score, 10),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.scoreValue, { color: getScoreColor(dim.score, 10) }]}>
                {dim.score.toFixed(1)}/10
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commercial Viability Scores</Text>
          {CVS_CONFIG.map((cvs) => {
            const factor = screenplay.commercialViability[cvs.key];
            return (
              <View key={cvs.key} style={styles.cvsRow}>
                <Text style={styles.cvsLabel}>{cvs.label}</Text>
                <Text style={[styles.cvsScore, { color: getScoreColor(factor.score, cvs.maxScore) }]}>
                  {factor.score}/{cvs.maxScore}
                </Text>
              </View>
            );
          })}
          <View style={styles.cvsTotalRow}>
            <Text style={styles.cvsTotalLabel}>CVS Total</Text>
            <Text style={styles.cvsTotalValue}>{screenplay.cvsTotal}/18</Text>
          </View>
        </View>

        {screenplay.commercialViability.cvsAssessed && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Commercial Summary</Text>
            <View style={styles.pullquote}>
              <Text style={styles.pullquoteText}>
                Marketability: {screenplay.marketability.toUpperCase()} | Budget: {screenplay.budgetCategory.toUpperCase()} | USP Strength: {screenplay.producerMetrics.uspStrength ?? 'N/A'}
              </Text>
            </View>
          </View>
        )}

        <PageFooter />
      </Page>

      {/* ========== ANALYSIS PAGE ========== */}
      <Page size="A4" style={styles.page} wrap>
        <PageHeader />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synopsis</Text>
          <View style={styles.pullquote}>
            <Text style={styles.pullquoteText}>{screenplay.logline}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strengths</Text>
          {screenplay.strengths.map((strength, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.scoreGreen }]}>+</Text>
              <Text style={styles.listText}>{strength}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weaknesses</Text>
          {screenplay.weaknesses.map((weakness, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={[styles.bullet, { color: colors.scoreAmber }]}>-</Text>
              <Text style={styles.listText}>{weakness}</Text>
            </View>
          ))}
        </View>

        {screenplay.developmentNotes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Development Notes</Text>
            {screenplay.developmentNotes.map((note, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.bullet}>*</Text>
                <Text style={styles.listText}>{note}</Text>
              </View>
            ))}
          </View>
        )}

        <PageFooter />
      </Page>

      {/* ========== DETAILS PAGE ========== */}
      <Page size="A4" style={styles.page} wrap>
        <PageHeader />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comparable Films</Text>
          {screenplay.comparableFilms.map((film, i) => (
            <View key={i} style={styles.compFilm}>
              <Text style={styles.compTitle}>{film.title}</Text>
              <Text style={styles.compDetail}>{film.similarity}</Text>
              <Text style={styles.compDetail}>{boxOfficeLabel(film.boxOfficeRelevance)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Characters</Text>
          <View style={styles.characterRow}>
            <Text style={styles.characterLabel}>Protagonist</Text>
            <Text style={styles.characterValue}>{screenplay.characters.protagonist}</Text>
          </View>
          <View style={styles.characterRow}>
            <Text style={styles.characterLabel}>Antagonist</Text>
            <Text style={styles.characterValue}>{screenplay.characters.antagonist}</Text>
          </View>
          {screenplay.characters.supporting.length > 0 && (
            <View style={styles.characterRow}>
              <Text style={styles.characterLabel}>Supporting Cast</Text>
              <Text style={styles.characterValue}>{screenplay.characters.supporting.join(', ')}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Target Audience</Text>
          <View style={styles.audienceGrid}>
            <View style={styles.audienceItem}>
              <Text style={styles.audienceLabel}>Primary Demographic</Text>
              <Text style={styles.audienceValue}>{screenplay.targetAudience.primaryDemographic}</Text>
            </View>
            <View style={styles.audienceItem}>
              <Text style={styles.audienceLabel}>Gender Skew</Text>
              <Text style={styles.audienceValue}>{screenplay.targetAudience.genderSkew}</Text>
            </View>
          </View>
          {screenplay.targetAudience.interests.length > 0 && (
            <View>
              <Text style={styles.audienceLabel}>Interests</Text>
              <Text style={styles.audienceValue}>{screenplay.targetAudience.interests.join(', ')}</Text>
            </View>
          )}
        </View>

        {/* Producer Notes: omitted entirely when no notes exist */}
        {notes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Producer Notes</Text>
            {notes.map((note) => (
              <View key={note.id} style={styles.noteCard}>
                <Text style={styles.noteContent}>{note.content}</Text>
                <Text style={styles.noteDate}>{formatDate(note.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        <PageFooter />
      </Page>
    </Document>
  );
}

export default CoverageDocument;
