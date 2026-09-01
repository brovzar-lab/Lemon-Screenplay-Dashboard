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

import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { Screenplay } from '@/types';
import type { Note } from '@/types/filters';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import { getScreenplayDisplayAuthor, getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import { isCoverageV1Screenplay } from '@/lib/producerProjection';
import { CoverPage } from '@/components/export/coverage/CoverPage';
import { ScoresPage } from '@/components/export/coverage/ScoresPage';
import { AnalysisPage } from '@/components/export/coverage/AnalysisPage';
import { AppendixPage } from '@/components/export/coverage/AppendixPage';
import { Footer } from '@/components/export/coverage/SharedComponents';
import { recColor, recLabel, s } from '@/components/export/coverage/shared';
import i18n, { type UiLanguage } from '@/i18n';

// ─────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────

interface CoverageDocumentProps {
  screenplay: Screenplay;
  notes: Note[];
  language?: UiLanguage;
  showEnglishAnalysisNotice?: boolean;
}

function PdfSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.heading}>{title}</Text>
      {children}
    </View>
  );
}

function PdfList({ items }: { items: string[] }) {
  return items.map((item) => (
    <View key={item} style={s.li} wrap={false}>
      <Text style={s.bullet}>•</Text>
      <Text style={s.liText}>{item}</Text>
    </View>
  ));
}

function PdfHeader({ title }: { title: string }) {
  return (
    <View style={s.intHeader}>
      <Text style={s.intBrand}>Lemon Studios</Text>
      <Text style={s.intTitle}>{title}</Text>
    </View>
  );
}

function CoverageV1Document({
  screenplay,
  notes,
  language,
  showEnglishAnalysisNotice,
}: Required<CoverageDocumentProps>) {
  const t = i18n.getFixedT(language);
  const detail = screenplay.coverage;
  const title = getScreenplayDisplayTitle(screenplay.title).title;
  const author = getScreenplayDisplayAuthor(screenplay.author);

  if (showEnglishAnalysisNotice) {
    return (
      <Document>
        <Page size="A4" style={s.page} wrap>
          <PdfHeader title={t('Coverage')} />
          <Text style={s.titleText}>{title}</Text>
          <Text style={s.heading}>{t('Coverage · unscored by design')}</Text>
          <Text style={s.verdictText}>{t('Analysis available in English')}</Text>
          <Footer language={language} />
        </Page>
      </Document>
    );
  }

  if (!detail) {
    return (
      <Document>
        <Page size="A4" style={s.page} wrap>
          <PdfHeader title={t('Coverage')} />
          <Text style={s.titleText}>{title}</Text>
          <Text style={s.heading}>{t('Coverage · unscored by design')}</Text>
          <Text style={s.verdictText}>{t('Not available')}</Text>
          <Footer language={language} />
        </Page>
      </Document>
    );
  }

  const spine = [
    [t('Protagonist'), screenplay.characters.protagonist],
    [t('Want'), detail.want],
    [t('Need'), detail.need],
    [t('Opposition'), screenplay.characters.antagonist],
    [t('Stakes'), detail.stakes],
    [t('Climax'), detail.climax],
    [t('Ending'), detail.ending],
  ].filter((field): field is [string, string] => Boolean(field[1]?.trim()));

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        <PdfHeader title={t('Coverage')} />
        <View style={s.titleBlock}>
          <Text style={s.titleText}>{title}</Text>
          {author && <Text style={s.authorText}>{t('by {{author}}', { author })}</Text>}
        </View>

        <View style={s.scoreCard} wrap={false}>
          <View style={s.scoreLeft}>
            <View style={[s.recBadge, { backgroundColor: recColor(screenplay.recommendation) }]}>
              <Text style={s.recBadgeText}>{t(recLabel(screenplay.recommendation))}</Text>
            </View>
            <Text style={[s.metaLabel, { marginTop: 8 }]}>
              {t('Coverage · unscored by design')}
            </Text>
          </View>
          <View style={s.scoreRight}>
            <Text style={s.verdictLabel}>{t('Verdict')}</Text>
            <Text style={s.verdictText}>{detail.verdict}</Text>
          </View>
        </View>

        <View style={s.metaGrid} wrap={false}>
          <View style={s.metaCell}>
            <Text style={s.metaLabel}>{t('Confidence')}</Text>
            <Text style={s.metaValue}>{t(detail.confidence)}</Text>
          </View>
          <View style={[s.metaCell, s.metaCellAlt]}>
            <Text style={s.metaLabel}>{t('Analysis')}</Text>
            <Text style={s.metaValue}>{detail.engineVersion}</Text>
          </View>
          {detail.citationsTotal !== undefined && detail.citationsVerified !== undefined && (
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>{t('Citations verified')}</Text>
              <Text style={s.metaValue}>
                {detail.citationsVerified}/{detail.citationsTotal}
              </Text>
            </View>
          )}
          {detail.supportRate !== undefined && (
            <View style={[s.metaCell, s.metaCellAlt]}>
              <Text style={s.metaLabel}>{t('Fact-audit support')}</Text>
              <Text style={s.metaValue}>{Math.round(detail.supportRate * 100)}%</Text>
            </View>
          )}
        </View>

        {screenplay.humanReviewRecommended && screenplay.reviewReasons?.length ? (
          <View style={s.noteCard} wrap={false}>
            <Text style={s.metaLabel}>{t('Human review recommended')}</Text>
            <PdfList items={screenplay.reviewReasons} />
          </View>
        ) : null}

        <PdfSection title={t('Logline')}>
          <Text style={s.pqText}>{screenplay.logline}</Text>
        </PdfSection>

        {detail.synopsis.trim() && (
          <PdfSection title={t('Synopsis')}>
            <Text style={s.verdictText}>{detail.synopsis}</Text>
          </PdfSection>
        )}

        <PdfSection title={t('Story spine')}>
          {spine.map(([label, value]) => (
            <View key={label} style={s.charBlock} wrap={false}>
              <Text style={s.charRole}>{label}</Text>
              <Text style={s.charDesc}>{value}</Text>
            </View>
          ))}
          {detail.majorTurns.map((turn, index) => (
            <View key={`${turn.turn}-${index}`} style={s.li} wrap={false}>
              <Text style={s.bullet}>{turn.page === undefined ? `${index + 1}.` : `p.${turn.page}`}</Text>
              <Text style={s.liText}>{turn.turn}</Text>
            </View>
          ))}
        </PdfSection>

        {screenplay.lensGrades?.length ? (
          <PdfSection title={t('Methodology lenses')}>
            {screenplay.lensGrades.map((lens) => (
              <View key={lens.lens} style={s.charBlock} wrap={false}>
                <Text style={s.charRole}>{lens.lens} · {t(lens.grade)}</Text>
                <Text style={s.charDesc}>{lens.note}</Text>
              </View>
            ))}
          </PdfSection>
        ) : null}

        {screenplay.strengths.length > 0 && (
          <PdfSection title={t('Strengths')}><PdfList items={screenplay.strengths} /></PdfSection>
        )}
        {screenplay.weaknesses.length > 0 && (
          <PdfSection title={t('Concerns')}><PdfList items={screenplay.weaknesses} /></PdfSection>
        )}
        {screenplay.developmentNotes.length > 0 && (
          <PdfSection title={t('Development priorities')}>
            <PdfList items={screenplay.developmentNotes} />
          </PdfSection>
        )}
        {screenplay.continuityFlags?.length ? (
          <PdfSection title={t('Continuity flags')}>
            <PdfList items={screenplay.continuityFlags} />
          </PdfSection>
        ) : null}
        {detail.championReason.trim() && (
          <PdfSection title={t('The case for')}>
            <Text style={s.verdictText}>{detail.championReason}</Text>
          </PdfSection>
        )}
        {detail.passReason.trim() && (
          <PdfSection title={t('The case against')}>
            <Text style={s.verdictText}>{detail.passReason}</Text>
          </PdfSection>
        )}
        {screenplay.uncertainties?.length ? (
          <PdfSection title={t('Reader-stated uncertainties')}>
            <PdfList items={screenplay.uncertainties} />
          </PdfSection>
        ) : null}
        {detail.commercialHypothesis.trim() && (
          <PdfSection title={t('Commercial hypothesis')}>
            <Text style={s.verdictText}>{detail.commercialHypothesis}</Text>
          </PdfSection>
        )}
        {notes.length > 0 && (
          <PdfSection title={t('Producer Notes')}>
            <PdfList items={notes.map((note) => note.content)} />
          </PdfSection>
        )}
        {detail.pageConvention && <Text style={s.footerText}>{detail.pageConvention}</Text>}
        <Footer language={language} />
      </Page>
    </Document>
  );
}

// ─────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────

export function CoverageDocument({
  screenplay,
  notes,
  language = 'en',
  showEnglishAnalysisNotice = false,
}: CoverageDocumentProps) {
  if (isCoverageV1Screenplay(screenplay)) {
    return (
      <CoverageV1Document
        screenplay={screenplay}
        notes={notes}
        language={language}
        showEnglishAnalysisNotice={showEnglishAnalysisNotice}
      />
    );
  }

  const dims = getDimensionDisplay(screenplay);
  const assessed = screenplay.commercialViability?.cvsAssessed ?? false;

  return (
    <Document>
      {/* Page 1 — Cover */}
      <CoverPage
        screenplay={screenplay}
        dims={dims}
        language={language}
        showEnglishAnalysisNotice={showEnglishAnalysisNotice}
      />

      {/* Page 2 — Detailed Scores + Commercial */}
      {!showEnglishAnalysisNotice && (
        <ScoresPage screenplay={screenplay} dims={dims} assessed={assessed} language={language} />
      )}

      {/* Page 3 — Analysis */}
      {!showEnglishAnalysisNotice && <AnalysisPage screenplay={screenplay} language={language} />}

      {/* Page 4 — Appendix */}
      {!showEnglishAnalysisNotice && (
        <AppendixPage screenplay={screenplay} notes={notes} language={language} />
      )}
    </Document>
  );
}

export default CoverageDocument;
