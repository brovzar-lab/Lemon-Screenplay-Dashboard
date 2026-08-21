import type {
  CriticalFailureDetail,
  ComparableFilm,
  DevelopmentOpportunityEvidence,
  LocalizedAnalysisContent,
  LocalizedAnalysisMap,
  ReaderDisagreement,
  StandoutScene,
} from '@/types';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function texts(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : undefined;
}

function textFields(value: unknown): Record<string, string> | undefined {
  const source = record(value);
  if (!source) return undefined;
  return Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function objectTexts<K extends string>(
  value: unknown,
  keys: readonly K[],
): Array<Record<K, string>> | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.map((item) => {
    const source = record(item);
    if (!source || keys.some((key) => typeof source[key] !== 'string')) return undefined;
    return Object.fromEntries(keys.map((key) => [key, source[key]])) as Record<K, string>;
  });
  return result.every(Boolean) ? result as Array<Record<K, string>> : undefined;
}

function readerReports(value: unknown): LocalizedAnalysisContent['readerReports'] {
  if (!Array.isArray(value)) return undefined;
  const reports = value.flatMap<NonNullable<LocalizedAnalysisContent['readerReports']>[number]>((item) => {
    const source = record(item);
    if (!source) return [];
    const reader = text(source.reader);
    if (!reader) return [];
    const subScores = Array.isArray(source?.subScores)
      ? source.subScores.flatMap((subScore) => {
          const score = record(subScore);
          if (!score) return [];
          const label = text(score.label);
          const justification = text(score.justification);
          if (!label && !justification) return [];
          return [{
            ...(label !== undefined && { label }),
            ...(justification !== undefined && { justification }),
          }];
        })
      : [];
    return [{
      reader,
      ...(text(source.label) !== undefined && { label: text(source.label) }),
      ...(text(source.oneSentenceVerdict) !== undefined && {
        oneSentenceVerdict: text(source.oneSentenceVerdict),
      }),
      ...(texts(source.redFlags) !== undefined && { redFlags: texts(source.redFlags) }),
      ...(subScores.length > 0 && { subScores }),
    }];
  });
  return reports.length === value.length ? reports : undefined;
}

function content(value: unknown): LocalizedAnalysisContent | undefined {
  const source = record(value);
  if (!source) return undefined;
  const scalarKeys = [
    'logline',
    'tone',
    'recommendationRationale',
    'verdictStatement',
    'budgetJustification',
  ] as const;
  const listKeys = [
    'criticalFailures',
    'majorWeaknesses',
    'strengths',
    'weaknesses',
    'developmentNotes',
  ] as const;
  const result: LocalizedAnalysisContent = {};
  for (const key of scalarKeys) {
    const valueText = text(source[key]);
    if (valueText !== undefined) result[key] = valueText;
  }
  for (const key of listKeys) {
    const valueTexts = texts(source[key]);
    if (valueTexts !== undefined) result[key] = valueTexts;
  }
  result.dimensionJustifications = textFields(source.dimensionJustifications);
  result.commercialViabilityNotes = textFields(source.commercialViabilityNotes);
  result.characters = textFields(source.characters);
  result.structureAnalysis = textFields(source.structureAnalysis);
  const target = record(source.targetAudience);
  const primaryDemographic = text(target?.primaryDemographic);
  const interests = texts(target?.interests);
  if (target) {
    result.targetAudience = {
      ...(primaryDemographic !== undefined && { primaryDemographic }),
      ...(interests !== undefined && { interests }),
    };
  }
  const filmNow = record(source.filmNowAssessment);
  if (filmNow) {
    const lightningTest = text(filmNow.lightningTest);
    const goosebumpsMoments = texts(filmNow.goosebumpsMoments);
    const careerRiskTest = text(filmNow.careerRiskTest);
    const legacyPotential = text(filmNow.legacyPotential);
    const disqualifyingFactors = texts(filmNow.disqualifyingFactors);
    result.filmNowAssessment = {
      ...(lightningTest !== undefined && { lightningTest }),
      ...(goosebumpsMoments !== undefined && { goosebumpsMoments }),
      ...(careerRiskTest !== undefined && { careerRiskTest }),
      ...(legacyPotential !== undefined && { legacyPotential }),
      ...(disqualifyingFactors !== undefined && { disqualifyingFactors }),
    };
  }
  const producerMetrics = record(source.producerMetrics);
  if (producerMetrics) {
    const marketPotentialRationale = text(producerMetrics.marketPotentialRationale);
    const uspStrengthRationale = text(producerMetrics.uspStrengthRationale);
    result.producerMetrics = {
      ...(marketPotentialRationale !== undefined && { marketPotentialRationale }),
      ...(uspStrengthRationale !== undefined && { uspStrengthRationale }),
    };
  }
  result.criticalFailureDetails = objectTexts(
    source.criticalFailureDetails,
    ['failure', 'evidence'] as const,
  ) as Array<Pick<CriticalFailureDetail, 'failure' | 'evidence'>> | undefined;
  result.comparableFilms = objectTexts(
    source.comparableFilms,
    ['similarity'] as const,
  )?.map((film, index) => ({
    ...film,
    ...(text(record((source.comparableFilms as unknown[])[index])?.keyDivergence) !== undefined && {
      keyDivergence: text(record((source.comparableFilms as unknown[])[index])?.keyDivergence),
    }),
  })) as Array<Pick<ComparableFilm, 'similarity' | 'keyDivergence'>> | undefined;
  result.standoutScenes = objectTexts(
    source.standoutScenes,
    ['scene', 'why'] as const,
  ) as Array<Pick<StandoutScene, 'scene' | 'why'>> | undefined;
  result.readerDisagreements = objectTexts(
    source.readerDisagreements,
    ['topic', 'readerAPosition', 'readerBPosition', 'resolution'] as const,
  ) as Array<Pick<ReaderDisagreement, 'topic' | 'readerAPosition' | 'readerBPosition' | 'resolution'>> | undefined;
  result.readerReports = readerReports(source.readerReports);
  const opportunity = record(source.developmentOpportunity);
  if (opportunity) {
    result.developmentOpportunity = {
      ...(text(opportunity.rationale) !== undefined && {
        rationale: text(opportunity.rationale),
      }),
      ...(texts(opportunity.risks) !== undefined && { risks: texts(opportunity.risks) }),
      ...(objectTexts(opportunity.evidence, ['label', 'detail'] as const) !== undefined && {
        evidence: objectTexts(opportunity.evidence, ['label', 'detail'] as const) as Array<
          Pick<DevelopmentOpportunityEvidence, 'label' | 'detail'>
        >,
      }),
    };
  }
  return result;
}

export function normalizeLocalizedAnalysis(value: unknown): LocalizedAnalysisMap | undefined {
  const root = record(value);
  const spanish = record(root?.es);
  const localizedContent = content(spanish?.content);
  if (
    typeof spanish?.sourceVersionId !== 'string' ||
    typeof spanish.generatedAt !== 'string' ||
    typeof spanish.model !== 'string' ||
    !localizedContent
  ) return undefined;
  return {
    es: {
      sourceVersionId: spanish.sourceVersionId,
      generatedAt: spanish.generatedAt,
      model: spanish.model,
      content: localizedContent,
    },
  };
}
