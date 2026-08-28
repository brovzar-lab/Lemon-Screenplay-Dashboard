/**
 * SharedViewLayout
 *
 * Full standalone page layout for the shared partner view.
 * Displays branding, title, recommendation, scores,
 * analysis content, and download button.
 *
 * BUNDLE ISOLATION: Only imports from @/types, @/components/ui,
 * @/components/share (siblings), and @/lib/shareService (types).
 */

import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { SharedScoresPanel } from './SharedScoresPanel';
import { SharedContentDetails } from './SharedContentDetails';
import type { SharedViewDocument } from '@/lib/shareService';
import { getScreenplayDisplayTitle } from '@/lib/screenplayDisplay';
import { useTranslation } from 'react-i18next';
import { PublicShareHeader } from '@/components/share/PublicShareHeader';
import i18n from '@/i18n';
import type { LocalizedAnalysisContent } from '@/types';

interface SharedViewLayoutProps {
  data: SharedViewDocument;
}

export function SharedViewLayout({ data }: SharedViewLayoutProps) {
  const { t } = useTranslation();
  const isSpanish = i18n.resolvedLanguage === 'es';
  const content = isSpanish ? data.localizedAnalysis?.es?.content : undefined;
  const analysis = content ? localizeSharedAnalysis(data.analysis, content) : data.analysis;
  const analysisFallback = isSpanish && !content;
  const displayTitle = getScreenplayDisplayTitle(analysis.title).title;

  return (
    <div className="public-share-shell public-shared-view">
      <PublicShareHeader />
      <div className="public-share-content">

        {/* Title / Author / Genre bar */}
        <div className="public-share-title">
          <h1>{displayTitle}</h1>
          <p>{analysis.author}</p>
          <div className="public-share-meta">
            <span>{t(analysis.genre)}</span>
            {!analysisFallback && analysis.subgenres?.map((sg) => (
              <span key={sg}>{sg}</span>
            ))}
            {!analysisFallback && analysis.tone && (
              <span>{analysis.tone}</span>
            )}
          </div>
        </div>

        {/* Recommendation Badge */}
        <div className="flex justify-center mb-6">
          <RecommendationBadge tier={analysis.recommendation} size="lg" />
        </div>

        {analysisFallback && (
          <div role="status" className="mb-6 rounded-lg border border-black-700 bg-black-800 px-4 py-3 text-sm text-black-200">
            <strong className="block text-gold-200">{t('Analysis available in English')}</strong>
            <span>{t('Switch to English to read the original analysis, or return after a Spanish translation is saved.')}</span>
          </div>
        )}

        {/* Verdict Statement */}
        {!analysisFallback && analysis.verdictStatement && (
          <blockquote className="public-share-verdict">
            {analysis.verdictStatement}
          </blockquote>
        )}

        {/* Download Script button */}
        {data.pdfUrl && (
          <div className="public-share-download">
            <button
              type="button"
              onClick={() => window.open(data.pdfUrl!, '_blank')}
            >
              {t('Download Script')}
            </button>
          </div>
        )}

        {/* Scores */}
        {!analysisFallback && <div className="mb-8">
          <SharedScoresPanel analysis={analysis} />
        </div>}

        {/* Content Details */}
        {!analysisFallback && <SharedContentDetails analysis={analysis} notes={data.notes} />}

        {/* Footer */}
        <footer className="public-share-footer">
          <p>Lemon Studios</p>
        </footer>
      </div>
    </div>
  );
}

function localizeSharedAnalysis(
  analysis: SharedViewDocument['analysis'],
  content: LocalizedAnalysisContent,
): SharedViewDocument['analysis'] {
  const commercialViability = { ...analysis.commercialViability };
  const factors = [
    'targetAudience',
    'highConcept',
    'castAttachability',
    'marketingHook',
    'budgetReturnRatio',
    'comparableSuccess',
  ] as const;
  for (const factor of factors) {
    const note = content.commercialViabilityNotes?.[factor];
    if (note !== undefined) commercialViability[factor] = { ...commercialViability[factor], note };
  }

  return {
    ...analysis,
    ...(content.logline !== undefined && { logline: content.logline }),
    ...(content.tone !== undefined && { tone: content.tone }),
    ...(content.recommendationRationale !== undefined && {
      recommendationRationale: content.recommendationRationale,
    }),
    ...(content.verdictStatement !== undefined && { verdictStatement: content.verdictStatement }),
    dimensionJustifications: {
      ...analysis.dimensionJustifications,
      ...content.dimensionJustifications,
    },
    commercialViability,
    strengths: content.strengths ?? analysis.strengths,
    weaknesses: content.weaknesses ?? analysis.weaknesses,
    majorWeaknesses: content.majorWeaknesses ?? analysis.majorWeaknesses,
    developmentNotes: content.developmentNotes ?? analysis.developmentNotes,
    characters: { ...analysis.characters, ...content.characters },
    comparableFilms: (analysis.comparableFilms ?? []).map((film, index) => ({
      ...film,
      ...(content.comparableFilms?.[index] ?? {}),
    })),
    standoutScenes: (analysis.standoutScenes ?? []).map((scene, index) => ({
      ...scene,
      ...(content.standoutScenes?.[index] ?? {}),
    })),
    targetAudience: { ...analysis.targetAudience, ...content.targetAudience },
    budgetJustification: content.budgetJustification ?? analysis.budgetJustification,
  };
}
