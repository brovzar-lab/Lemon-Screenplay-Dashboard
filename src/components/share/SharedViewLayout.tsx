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
import { LanguageControl } from '@/components/layout/LanguageControl';
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
    <div className="public-shared-view min-h-screen bg-black-900">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header with logo */}
        <header className="relative flex items-center justify-center mb-8">
          <img src="/lemon-logo-white.png" alt="Lemon Studios" className="h-8 w-8" />
          <div className="absolute right-0">
            <LanguageControl />
          </div>
        </header>

        {/* Title / Author / Genre bar */}
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-gold-200 mb-2">{displayTitle}</h1>
          <p className="text-lg text-black-300">{analysis.author}</p>
          <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
            <span className="px-3 py-1 text-sm rounded-md bg-black-800 text-black-300 border border-black-700">
              {t(analysis.genre)}
            </span>
            {!analysisFallback && analysis.subgenres?.map((sg) => (
              <span
                key={sg}
                className="px-2 py-1 text-xs rounded-md bg-black-800 text-black-400 border border-black-700"
              >
                {sg}
              </span>
            ))}
            {!analysisFallback && analysis.tone && (
              <span className="px-2 py-1 text-xs rounded-md bg-black-800 text-black-400 border border-black-700">
                {analysis.tone}
              </span>
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
          <blockquote className="bg-black-800 border-l-4 border-gold-500/30 rounded-r-xl p-5 mb-8 text-black-200 italic text-sm sm:text-base">
            {analysis.verdictStatement}
          </blockquote>
        )}

        {/* Download Script button */}
        {data.pdfUrl && (
          <div className="flex justify-center mb-8">
            <button
              type="button"
              onClick={() => window.open(data.pdfUrl!, '_blank')}
              className="px-6 py-3 bg-gold-500 hover:bg-gold-400 text-black-900 font-semibold rounded-lg transition-colors"
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
        <footer className="mt-12 pt-6 border-t border-black-700 text-center">
          <p className="text-xs text-black-500">Lemon Studios</p>
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
