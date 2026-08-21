import type {
  LocalizedAnalysis,
  LocalizedAnalysisContent,
  Screenplay,
} from '@/types';
import type { UiLanguage } from '@/i18n';

function currentVersionId(screenplay: Screenplay): string {
  return screenplay.latestVersionId || screenplay.analysisVersion;
}

export function savedLocalizedAnalysis(
  screenplay: Screenplay,
  language: UiLanguage,
): LocalizedAnalysis | undefined {
  const localized = language === 'es' ? screenplay.localizedAnalysis?.es : undefined;
  return localized?.sourceVersionId === currentVersionId(screenplay) ? localized : undefined;
}

function mergeIndexed<T extends object>(
  originals: T[],
  translations: Array<Partial<T>> | undefined,
): T[] {
  return originals.map((original, index) => ({
    ...original,
    ...(translations?.[index] ?? {}),
  }));
}

function applyContent(screenplay: Screenplay, content: LocalizedAnalysisContent): Screenplay {
  const commercialViability = { ...screenplay.commercialViability };
  const commercialFactors = [
    'targetAudience',
    'highConcept',
    'castAttachability',
    'marketingHook',
    'budgetReturnRatio',
    'comparableSuccess',
  ] as const;
  for (const factor of commercialFactors) {
    const note = content.commercialViabilityNotes?.[factor];
    if (note !== undefined) commercialViability[factor] = { ...commercialViability[factor], note };
  }

  const developmentOpportunity = screenplay.developmentOpportunity && content.developmentOpportunity
    ? {
        ...screenplay.developmentOpportunity,
        ...(content.developmentOpportunity.rationale !== undefined && {
          rationale: content.developmentOpportunity.rationale,
        }),
        ...(content.developmentOpportunity.risks !== undefined && {
          risks: content.developmentOpportunity.risks,
        }),
        evidence: screenplay.developmentOpportunity.evidence.map((original, index) => ({
          ...original,
          ...(content.developmentOpportunity?.evidence?.[index] ?? {}),
        })),
      }
    : screenplay.developmentOpportunity;

  return {
    ...screenplay,
    ...(content.logline !== undefined && { logline: content.logline }),
    ...(content.tone !== undefined && { tone: content.tone }),
    ...(content.recommendationRationale !== undefined && {
      recommendationRationale: content.recommendationRationale,
    }),
    ...(content.verdictStatement !== undefined && {
      verdictStatement: content.verdictStatement,
    }),
    dimensionJustifications: {
      ...screenplay.dimensionJustifications,
      ...content.dimensionJustifications,
    },
    commercialViability,
    criticalFailures: content.criticalFailures ?? screenplay.criticalFailures,
    criticalFailureDetails: mergeIndexed(
      screenplay.criticalFailureDetails,
      content.criticalFailureDetails,
    ),
    majorWeaknesses: content.majorWeaknesses ?? screenplay.majorWeaknesses,
    strengths: content.strengths ?? screenplay.strengths,
    weaknesses: content.weaknesses ?? screenplay.weaknesses,
    developmentNotes: content.developmentNotes ?? screenplay.developmentNotes,
    budgetJustification: content.budgetJustification ?? screenplay.budgetJustification,
    characters: { ...screenplay.characters, ...content.characters },
    structureAnalysis: { ...screenplay.structureAnalysis, ...content.structureAnalysis },
    comparableFilms: mergeIndexed(screenplay.comparableFilms, content.comparableFilms),
    standoutScenes: mergeIndexed(screenplay.standoutScenes, content.standoutScenes),
    targetAudience: { ...screenplay.targetAudience, ...content.targetAudience },
    filmNowAssessment: screenplay.filmNowAssessment
      ? { ...screenplay.filmNowAssessment, ...content.filmNowAssessment }
      : null,
    producerMetrics: { ...screenplay.producerMetrics, ...content.producerMetrics },
    readerDisagreements: mergeIndexed(
      screenplay.readerDisagreements ?? [],
      content.readerDisagreements,
    ),
    developmentOpportunity,
  };
}

export function localizedReaderReports(
  originals: import('@/types').ReaderReportEvidence[],
  content: LocalizedAnalysisContent | undefined,
): import('@/types').ReaderReportEvidence[] {
  return originals.map((original, index) => {
    const translated = content?.readerReports?.find((report) => report.reader === original.reader)
      ?? content?.readerReports?.[index];
    if (!translated) return original;
    return {
      ...original,
      ...(translated.label !== undefined && { label: translated.label }),
      ...(translated.oneSentenceVerdict !== undefined && {
        oneSentenceVerdict: translated.oneSentenceVerdict,
      }),
      ...(translated.redFlags !== undefined && { redFlags: translated.redFlags }),
      subScores: original.subScores.map((subScore, subScoreIndex) => ({
        ...subScore,
        ...(translated.subScores?.[subScoreIndex] ?? {}),
      })),
    };
  });
}

export function localizedScreenplay(
  screenplay: Screenplay,
  language: UiLanguage,
): Screenplay {
  const localized = savedLocalizedAnalysis(screenplay, language);
  return localized ? applyContent(screenplay, localized.content) : screenplay;
}

export function localizedScreenplayPreview(
  screenplay: Screenplay,
  language: UiLanguage,
): Screenplay | undefined {
  return analysisIsEnglishFallback(screenplay, language)
    ? undefined
    : localizedScreenplay(screenplay, language);
}

export function analysisIsEnglishFallback(
  screenplay: Screenplay,
  language: UiLanguage,
): boolean {
  return language === 'es' && !savedLocalizedAnalysis(screenplay, language);
}
