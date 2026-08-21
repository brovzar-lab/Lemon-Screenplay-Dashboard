import type {
  OpportunityFixability,
  DevelopmentOpportunity,
  DevelopmentOpportunityEvidence,
  DevelopmentOpportunitySignal,
  ProducerAssessmentHead,
  Screenplay,
} from '@/types';
import type { TFunction } from 'i18next';

export interface ProducerLookCandidate {
  screenplay: Screenplay;
  opportunity: DevelopmentOpportunity;
}

const SIGNAL_LABELS: Record<DevelopmentOpportunitySignal, string> = {
  high_concept: 'High-concept hook',
  narrative_engine: 'Narrative engine',
  originality: 'Originality',
  voice: 'Distinctive voice',
  actor_appeal: 'Actor appeal',
  commercial_hook: 'Commercial hook',
  cultural_specificity: 'Cultural specificity',
  emotional_engine: 'Emotional engine',
  development_upside: 'Development upside',
};

const OPPORTUNITY_PATTERNS: Array<{
  signal: DevelopmentOpportunitySignal;
  pattern: RegExp;
  floor: number;
}> = [
  {
    signal: 'high_concept',
    pattern: /high[- ]concept|pitchable (?:idea|hook|premise)|easy to pitch/i,
    floor: 8.2,
  },
  {
    signal: 'narrative_engine',
    pattern: /narrative engine|story engine|repeatable engine|comic engine/i,
    floor: 7.8,
  },
  {
    signal: 'originality',
    pattern: /original|fresh (?:idea|take|premise)|unusual premise|inventive/i,
    floor: 7.6,
  },
  {
    signal: 'voice',
    pattern: /distinctive voice|singular voice|authorial voice|specific voice/i,
    floor: 7.6,
  },
  {
    signal: 'actor_appeal',
    pattern: /actor appeal|castable|star vehicle|strong (?:comic )?role/i,
    floor: 7.4,
  },
  {
    signal: 'commercial_hook',
    pattern: /marketing hook|commercial hook|easy to market|clear audience/i,
    floor: 7.5,
  },
  {
    signal: 'cultural_specificity',
    pattern: /cultural specificity|culturally specific|specific sense of place/i,
    floor: 7.5,
  },
  {
    signal: 'emotional_engine',
    pattern: /emotional engine|emotional impact|moving|deeply felt/i,
    floor: 7.5,
  },
  {
    signal: 'development_upside',
    pattern: /development upside|worth developing|repairable|fixable/i,
    floor: 7.4,
  },
];

const FIXABLE_PATTERN =
  /passive|agency|pacing|late (?:inciting|turn)|act timing|clarity|dialogue|tighten|streamline|motivation|character arc|ending|payoff|second act/i;
const FUNDAMENTAL_PATTERN =
  /derivative premise|no (?:narrative|story|repeatable) engine|no clear hook|hard to pitch|reconsider the (?:central )?premise|fundamentally broken/i;

function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(10, value)) * 10) / 10;
}

function emptyOpportunity(): DevelopmentOpportunity {
  return {
    schemaVersion: 1,
    level: 'none',
    fixability: 'unknown',
    evidenceConfidence: 'summary_only',
    strongestSignal: null,
    rationale: 'No exceptional, corroborated development opportunity was identified.',
    rationaleCode: 'none',
    evidence: [],
    risks: [],
    source: 'legacy_summary',
    requiresProducerLook: false,
    opportunityScore: 0,
  };
}

function assessmentMatchesVersion(
  screenplay: Screenplay,
  assessment: ProducerAssessmentHead,
): boolean {
  return !screenplay.latestVersionId || assessment.versionId === screenplay.latestVersionId;
}

function producerOverride(
  screenplay: Screenplay,
  assessment?: ProducerAssessmentHead,
): DevelopmentOpportunityEvidence | null {
  if (!assessment || !assessmentMatchesVersion(screenplay, assessment)) return null;
  const positiveVerdict =
    assessment.producerVerdict === 'recommend' || assessment.producerVerdict === 'film_now';
  const positivePursuit = assessment.pursuit === 'yes' || assessment.pursuit === 'maybe';
  if (assessment.producerScore < 7.5 || !positiveVerdict || !positivePursuit) return null;

  return {
    signal: 'development_upside',
    label: SIGNAL_LABELS.development_upside,
    score: clampScore(assessment.producerScore),
    detail: `Producer Take scored this ${assessment.producerScore.toFixed(1)} and marked it ${assessment.producerVerdict === 'film_now' ? 'Film Now' : 'Recommend'}.`,
    messageCode: 'producer_take',
    messageParams: {
      score: assessment.producerScore.toFixed(1),
      verdict: assessment.producerVerdict === 'film_now' ? 'FILM NOW' : 'RECOMMEND',
    },
    source: 'producer_take',
    pageCitations: [],
  };
}

function inferFixability(screenplay: Screenplay): OpportunityFixability {
  const problems = [...screenplay.weaknesses, ...screenplay.majorWeaknesses].join(' ');
  const repairs = screenplay.developmentNotes.join(' ');
  if (FUNDAMENTAL_PATTERN.test(`${problems} ${repairs}`)) return 'low';

  const repairCount = [...screenplay.weaknesses, ...screenplay.developmentNotes].filter((item) =>
    FIXABLE_PATTERN.test(item),
  ).length;
  if (repairCount >= 2 && screenplay.developmentNotes.length > 0) return 'high';
  if (repairCount > 0 || screenplay.developmentNotes.length > 0) return 'medium';
  return 'unknown';
}

function evidenceFromCommercial(screenplay: Screenplay): DevelopmentOpportunityEvidence[] {
  if (!screenplay.commercialViability.cvsAssessed) return [];
  const result: DevelopmentOpportunityEvidence[] = [];
  const { highConcept, marketingHook, castAttachability } = screenplay.commercialViability;
  const scale = (score: number) => clampScore(score * 3);

  if (highConcept.score >= 2) {
    result.push({
      signal: 'high_concept',
      label: SIGNAL_LABELS.high_concept,
      score: scale(highConcept.score),
      detail: highConcept.note || 'Commercial review identified a strong high-concept premise.',
      ...(!highConcept.note && { messageCode: 'commercial_high_concept' }),
      source: 'legacy_summary',
      pageCitations: [],
    });
  }
  if (marketingHook.score >= 2) {
    result.push({
      signal: 'commercial_hook',
      label: SIGNAL_LABELS.commercial_hook,
      score: scale(marketingHook.score),
      detail: marketingHook.note || 'Commercial review identified a clear marketing hook.',
      ...(!marketingHook.note && { messageCode: 'commercial_marketing_hook' }),
      source: 'legacy_summary',
      pageCitations: [],
    });
  }
  if (castAttachability.score >= 2) {
    result.push({
      signal: 'actor_appeal',
      label: SIGNAL_LABELS.actor_appeal,
      score: scale(castAttachability.score),
      detail: castAttachability.note || 'Commercial review identified meaningful cast appeal.',
      ...(!castAttachability.note && { messageCode: 'commercial_actor_appeal' }),
      source: 'legacy_summary',
      pageCitations: [],
    });
  }
  return result;
}

function evidenceFromSummary(screenplay: Screenplay): DevelopmentOpportunityEvidence[] {
  const sourceItems = [
    ...screenplay.strengths,
    screenplay.recommendationRationale,
    screenplay.verdictStatement,
  ].filter(Boolean);
  const bySignal = new Map<DevelopmentOpportunitySignal, DevelopmentOpportunityEvidence>();
  const conceptFloor = clampScore(screenplay.dimensionScores.concept + 1.5);

  for (const detail of sourceItems) {
    for (const candidate of OPPORTUNITY_PATTERNS) {
      if (!candidate.pattern.test(detail)) continue;
      const score = Math.max(candidate.floor, conceptFloor);
      const existing = bySignal.get(candidate.signal);
      if (!existing || existing.score < score) {
        bySignal.set(candidate.signal, {
          signal: candidate.signal,
          label: SIGNAL_LABELS[candidate.signal],
          score: clampScore(score),
          detail,
          source: 'legacy_summary',
          pageCitations: [],
        });
      }
    }
  }
  return [...bySignal.values()];
}

function mergeEvidence(
  evidence: DevelopmentOpportunityEvidence[],
): DevelopmentOpportunityEvidence[] {
  const bySignal = new Map<DevelopmentOpportunitySignal, DevelopmentOpportunityEvidence>();
  for (const item of evidence) {
    const existing = bySignal.get(item.signal);
    if (!existing || item.score > existing.score || item.source === 'structured_v9') {
      bySignal.set(item.signal, item);
    }
  }
  return [...bySignal.values()].sort((left, right) => right.score - left.score);
}

function normalizeStoredOpportunity(
  opportunity?: DevelopmentOpportunity,
): DevelopmentOpportunity | null {
  if (!opportunity || opportunity.schemaVersion !== 1) return null;
  return {
    ...opportunity,
    evidence: opportunity.evidence.map((item) => ({
      ...item,
      score: clampScore(item.score),
      pageCitations: item.pageCitations.filter(Number.isFinite),
    })),
    opportunityScore: clampScore(opportunity.opportunityScore),
  };
}

/**
 * Computes non-scoring routing evidence. The screenplay object is never mutated,
 * and the stored score and verdict are intentionally absent from the output.
 */
export function evaluateDevelopmentOpportunity(
  screenplay: Screenplay,
  assessment?: ProducerAssessmentHead,
): DevelopmentOpportunity {
  const stored = normalizeStoredOpportunity(screenplay.developmentOpportunity);
  const override = producerOverride(screenplay, assessment);

  if (stored?.requiresProducerLook && !override) return stored;

  const evidence = mergeEvidence([
    ...(stored?.evidence ?? []),
    ...evidenceFromCommercial(screenplay),
    ...evidenceFromSummary(screenplay),
    ...(override ? [override] : []),
  ]);
  if (evidence.length === 0) return emptyOpportunity();

  const fixability = stored?.fixability ?? inferFixability(screenplay);
  const strongEvidence = evidence.filter((item) => item.score >= 7.4);
  const strongest = evidence[0];
  const corroborated = strongEvidence.length >= 2 || strongest.score >= 8.8;
  const requiresProducerLook =
    Boolean(override) ||
    Boolean(stored?.requiresProducerLook) ||
    (corroborated && fixability !== 'low');
  const opportunityScore = override ? Math.max(strongest.score, override.score) : strongest.score;
  const source = override ? 'producer_take' : (stored?.source ?? 'legacy_summary');

  return {
    schemaVersion: 1,
    level: requiresProducerLook ? 'producer_review' : strongest.score >= 7.4 ? 'watch' : 'none',
    fixability,
    evidenceConfidence: override
      ? 'producer_override'
      : (stored?.evidenceConfidence ?? 'summary_only'),
    strongestSignal: strongest.signal,
    rationale: override
      ? `${override.detail} The AI score and verdict remain unchanged.`
      : requiresProducerLook
        ? `${strongest.label} is strong enough to warrant a producer look before this project is dismissed. The AI score and verdict remain unchanged.`
        : 'The upside evidence is not yet strong or corroborated enough for Producer Look routing.',
    rationaleCode: override
      ? 'producer_override'
      : requiresProducerLook
        ? 'producer_review'
        : 'watch',
    rationaleParams: override
      ? override.messageParams
      : { signal: strongest.label },
    evidence,
    risks: [...screenplay.weaknesses, ...screenplay.majorWeaknesses].slice(0, 3),
    source,
    requiresProducerLook,
    opportunityScore: clampScore(opportunityScore),
  };
}

export function localizedOpportunityRationale(
  opportunity: DevelopmentOpportunity,
  t: TFunction,
): string {
  if (!opportunity.rationaleCode) return opportunity.rationale;
  return t(`developmentOpportunity.rationale.${opportunity.rationaleCode}`, {
    ...opportunity.rationaleParams,
    defaultValue: opportunity.rationale,
  });
}

export function localizedOpportunitySignal(
  signal: DevelopmentOpportunitySignal | null,
  fallback: string,
  t: TFunction,
): string {
  return signal
    ? t(`developmentOpportunity.signal.${signal}`, { defaultValue: fallback })
    : fallback;
}

export function selectProducerLookCandidates(
  screenplays: Screenplay[],
  assessments: ReadonlyMap<string, ProducerAssessmentHead> = new Map(),
  limit = 3,
): ProducerLookCandidate[] {
  return screenplays
    .map((screenplay) => {
      const projectId = screenplay.projectId ?? screenplay.id;
      return {
        screenplay,
        opportunity: evaluateDevelopmentOpportunity(screenplay, assessments.get(projectId)),
      };
    })
    .filter(({ opportunity }) => opportunity.requiresProducerLook)
    .sort((left, right) => {
      const leftProducer = left.opportunity.source === 'producer_take' ? 1 : 0;
      const rightProducer = right.opportunity.source === 'producer_take' ? 1 : 0;
      return (
        rightProducer - leftProducer ||
        right.opportunity.opportunityScore - left.opportunity.opportunityScore ||
        right.screenplay.weightedScore - left.screenplay.weightedScore
      );
    })
    .slice(0, Math.max(0, limit));
}
