import {
  getScreenplayDisplayTitle,
  getScreenplayFormatInfo,
} from '@/lib/screenplayDisplay';
import type {
  FeaturedEngagement,
  FeaturedPolicy,
  FeaturedPriorityMode,
  FeaturedSelectionReason,
  Screenplay,
} from '@/types';

export const DEFAULT_FEATURED_POLICY: FeaturedPolicy = {
  schemaVersion: 1,
  eligibleVerdicts: ['film_now', 'recommend', 'consider'],
  includeProducerLookPass: true,
  excludeProduced: true,
  excludeIncomplete: true,
  priorityMode: 'highest_overall',
  dustEnabled: false,
  dustDays: 60,
  dustMinimumScore: 6.5,
  fastestReadMinimumScore: 6,
  mandateGenres: [],
  mandateThemes: [],
  mandateFormats: [],
  mandateCategories: [],
  pinnedProjectId: null,
};

export interface FeaturedSelection {
  screenplay: Screenplay | null;
  reason: FeaturedSelectionReason;
}

function projectKey(screenplay: Screenplay): string {
  return screenplay.projectId ?? screenplay.id;
}

function finalScore(screenplay: Screenplay): number {
  return screenplay.producerProjection?.finalScore ?? screenplay.weightedScore;
}

function isScreenplay(screenplay: Screenplay): boolean {
  const source = `${screenplay.sourceFile} ${screenplay.title}`.toLowerCase();
  return !/\b(?:coverage|analysis|reader report|scorecard)\b/.test(source);
}

function isComplete(screenplay: Screenplay): boolean {
  if (screenplay.producerProjection?.rankable === false) return false;
  if (screenplay.analysisQuality?.status === 'partial') return false;
  if (
    screenplay.analysisQuality &&
    screenplay.analysisQuality.completedReaders < screenplay.analysisQuality.expectedReaders
  ) {
    return false;
  }
  return Number.isFinite(finalScore(screenplay)) && finalScore(screenplay) > 0;
}

function mandatoryEligible(screenplay: Screenplay, policy: FeaturedPolicy): boolean {
  if (!isScreenplay(screenplay)) return false;
  if (policy.excludeProduced && screenplay.tmdbStatus?.isProduced) return false;
  if (policy.excludeIncomplete && !isComplete(screenplay)) return false;
  return true;
}

function verdictEligible(
  screenplay: Screenplay,
  policy: FeaturedPolicy,
  producerLookIds: ReadonlySet<string>,
): boolean {
  if (policy.eligibleVerdicts.includes(screenplay.recommendation)) return true;
  return (
    screenplay.recommendation === 'pass' &&
    policy.includeProducerLookPass &&
    (producerLookIds.has(projectKey(screenplay)) ||
      screenplay.developmentOpportunity?.requiresProducerLook === true)
  );
}

function matchesMandate(screenplay: Screenplay, policy: FeaturedPolicy): boolean {
  const format = getScreenplayFormatInfo(screenplay).format;
  const includes = (values: string[], candidate?: string) =>
    values.length === 0 ||
    (candidate !== undefined &&
      values.some((value) => value.toLowerCase() === candidate.toLowerCase()));

  return (
    includes(policy.mandateGenres, screenplay.genre) &&
    (policy.mandateThemes.length === 0 ||
      screenplay.themes.some((theme) =>
        policy.mandateThemes.some((value) => value.toLowerCase() === theme.toLowerCase()),
      )) &&
    includes(policy.mandateFormats, format) &&
    includes(policy.mandateCategories, screenplay.category)
  );
}

function opportunityScore(screenplay: Screenplay): number {
  const opportunity = screenplay.developmentOpportunity;
  if (!opportunity) return 0;
  const fixability = { high: 3, medium: 2, low: 1, unknown: 0 }[opportunity.fixability];
  return opportunity.opportunityScore * 10 + fixability;
}

function priorityValues(screenplay: Screenplay, mode: FeaturedPriorityMode): number[] {
  const score = finalScore(screenplay);
  if (mode === 'strongest_structure') return [screenplay.dimensionScores.structure, score];
  if (mode === 'most_commercial') {
    return [
      screenplay.producerMetrics.marketPotential ?? -1,
      screenplay.commercialViability.cvsAssessed ? screenplay.cvsTotal : -1,
      score,
    ];
  }
  if (mode === 'fastest_read') {
    const pageCount = screenplay.metadata.pageCount;
    return [Number.isFinite(pageCount) && pageCount > 0 ? -pageCount : Number.NEGATIVE_INFINITY, score];
  }
  if (mode === 'development_opportunity') return [opportunityScore(screenplay), score];
  return [score];
}

function compareByPolicy(a: Screenplay, b: Screenplay, mode: FeaturedPriorityMode): number {
  const aValues = priorityValues(a, mode);
  const bValues = priorityValues(b, mode);
  for (let index = 0; index < aValues.length; index += 1) {
    if (aValues[index] !== bValues[index]) return bValues[index] - aValues[index];
  }
  const opportunityDifference = opportunityScore(b) - opportunityScore(a);
  if (opportunityDifference !== 0) return opportunityDifference;
  const scoreDifference = finalScore(b) - finalScore(a);
  if (scoreDifference !== 0) return scoreDifference;
  const titleDifference = getScreenplayDisplayTitle(a.title).title.localeCompare(
    getScreenplayDisplayTitle(b.title).title,
  );
  return titleDifference || projectKey(a).localeCompare(projectKey(b));
}

function priorityCopy(mode: FeaturedPriorityMode, screenplay: Screenplay): [string, string] {
  if (mode === 'strongest_structure') {
    return [
      'Strongest structure among eligible projects',
      `Its structure score of ${screenplay.dimensionScores.structure.toFixed(1)} leads today’s eligible slate.`,
    ];
  }
  if (mode === 'most_commercial') {
    return [
      'Strongest commercial signal among eligible projects',
      'Market potential, commercial viability, and final score place it first under the studio policy.',
    ];
  }
  if (mode === 'fastest_read') {
    const pageCount = screenplay.metadata.pageCount;
    return [
      'Fastest qualifying read',
      Number.isFinite(pageCount) && pageCount > 0
        ? `At ${pageCount} pages, it is the shortest eligible project above the required score.`
        : 'It is the shortest eligible project with a recorded page count above the required score.',
    ];
  }
  if (mode === 'development_opportunity') {
    return [
      'Strongest development opportunity',
      screenplay.developmentOpportunity?.rationale ||
        'Its upside and fixability make it the most useful project to review now.',
    ];
  }
  return [
    'Highest-scoring eligible project',
    `Its ${finalScore(screenplay).toFixed(1)} final score leads the projects allowed by today’s studio policy.`,
  ];
}

function localDay(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function selectFeaturedProject(
  screenplays: Screenplay[],
  policy: FeaturedPolicy,
  options: {
    producerLookIds?: ReadonlySet<string>;
    engagements?: ReadonlyMap<string, FeaturedEngagement>;
    now?: Date;
  } = {},
): FeaturedSelection {
  const now = options.now ?? new Date();
  const selectedForDate = localDay(now);
  const producerLookIds = options.producerLookIds ?? new Set<string>();
  const mandatory = screenplays.filter((screenplay) => mandatoryEligible(screenplay, policy));
  const pinned = policy.pinnedProjectId
    ? mandatory.find((screenplay) => projectKey(screenplay) === policy.pinnedProjectId)
    : undefined;

  if (pinned) {
    return {
      screenplay: pinned,
      reason: {
        code: 'manual_pin',
        headline: 'Pinned by the studio',
        detail: 'This project remains Featured until an administrator removes the pin.',
        selectedProjectId: projectKey(pinned),
        selectedForDate,
        mandateFallback: false,
        invalidPin: false,
      },
    };
  }

  const invalidPin = Boolean(policy.pinnedProjectId);
  const generallyEligible = mandatory.filter((screenplay) =>
    verdictEligible(screenplay, policy, producerLookIds),
  );
  const mandated = generallyEligible.filter((screenplay) => matchesMandate(screenplay, policy));
  const hasMandate =
    policy.mandateGenres.length > 0 ||
    policy.mandateThemes.length > 0 ||
    policy.mandateFormats.length > 0 ||
    policy.mandateCategories.length > 0;
  const mandateFallback = hasMandate && mandated.length === 0;
  let pool = mandated.length > 0 ? mandated : generallyEligible;

  if (policy.priorityMode === 'fastest_read') {
    const qualifying = pool.filter(
      (screenplay) =>
        finalScore(screenplay) >= policy.fastestReadMinimumScore &&
        Number.isFinite(screenplay.metadata.pageCount) &&
        screenplay.metadata.pageCount > 0,
    );
    if (qualifying.length > 0) pool = qualifying;
  }

  if (policy.dustEnabled) {
    const cutoff = now.getTime() - policy.dustDays * 24 * 60 * 60 * 1000;
    const dusty = pool.filter((screenplay) => {
      if (finalScore(screenplay) < policy.dustMinimumScore) return false;
      const engagement = options.engagements?.get(projectKey(screenplay));
      return !engagement || new Date(engagement.lastOpenedAt).getTime() <= cutoff;
    });
    if (dusty.length > 0) {
      const screenplay = [...dusty].sort((a, b) =>
        compareByPolicy(a, b, policy.priorityMode),
      )[0];
      return {
        screenplay,
        reason: {
          code: 'dust_resurfacing',
          headline: 'High-potential project ready for another look',
          detail: `It clears the ${policy.dustMinimumScore.toFixed(1)} minimum and has not been opened within ${policy.dustDays} days.`,
          selectedProjectId: projectKey(screenplay),
          selectedForDate,
          mandateFallback,
          invalidPin,
        },
      };
    }
  }

  pool = [...pool].sort((a, b) => compareByPolicy(a, b, policy.priorityMode));
  const screenplay = pool[0] ?? null;
  if (!screenplay) {
    return {
      screenplay: null,
      reason: {
        code: 'no_eligible_project',
        headline: 'No eligible Featured project today',
        detail: 'The current studio policy excludes every project in the slate.',
        selectedProjectId: null,
        selectedForDate,
        mandateFallback,
        invalidPin,
      },
    };
  }

  const [headline, detail] = priorityCopy(policy.priorityMode, screenplay);
  return {
    screenplay,
    reason: {
      code: invalidPin
        ? 'invalid_pin_fallback'
        : mandateFallback
          ? 'mandate_fallback'
          : policy.priorityMode,
      headline,
      detail: mandateFallback
        ? `No current mandate match. ${detail}`
        : invalidPin
          ? `The pinned project is unavailable. ${detail}`
          : detail,
      selectedProjectId: projectKey(screenplay),
      selectedForDate,
      mandateFallback,
      invalidPin,
    },
  };
}
