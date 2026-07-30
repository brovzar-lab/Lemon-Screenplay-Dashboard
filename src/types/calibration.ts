import type { PillarScore, RecommendationTier } from './screenplay';

export const PRODUCER_ASSESSMENT_SCHEMA_VERSION =
  'lemon-producer-assessment-v1' as const;
export const CALIBRATION_PROFILE_SCHEMA_VERSION =
  'lemon-calibration-profile-v1' as const;

export type CalibrationPillar =
  | 'structure'
  | 'character'
  | 'craft_scene'
  | 'concept'
  | 'emotional_resonance';

export type ProducerPursuit = 'no' | 'maybe' | 'yes';
export type ProducerConfidence = 'low' | 'medium' | 'high';
export type DevelopmentFixability =
  | 'low'
  | 'medium'
  | 'high'
  | 'not_applicable';

export type TasteSignal =
  | 'reading_pleasure'
  | 'comedy'
  | 'voice'
  | 'emotional_impact'
  | 'actor_appeal'
  | 'commercial_instinct'
  | 'originality'
  | 'cultural_specificity'
  | 'development_upside'
  | 'character_agency'
  | 'genre_delivery';

export interface ProducerJudgment {
  producerScore: number;
  producerVerdict: RecommendationTier;
  pursuit: ProducerPursuit;
  fixability: DevelopmentFixability;
  confidence: ProducerConfidence;
  tasteSignals: TasteSignal[];
  aiMissed: string;
  aiGotRight: string;
  pillarOverrides: Partial<Record<CalibrationPillar, number>>;
  includeInCalibration: boolean;
}

export interface SubmitProducerAssessmentInput {
  projectId: string;
  versionId: string;
  judgment: ProducerJudgment;
}

export interface ProducerAnalysisSnapshot {
  projectId: string;
  versionId: string;
  contentHash: string;
  trustManifestVersion: string;
  trustManifestIntegritySha256: string;
  title: string;
  genre: string;
  aiFinalScore: number;
  aiRawScore: number;
  aiVerdict: RecommendationTier;
  pillarScores: PillarScore[];
  calibrationProfileVersionId: string | null;
}

export interface ProducerAssessment {
  schemaVersion: typeof PRODUCER_ASSESSMENT_SCHEMA_VERSION;
  assessmentId: string;
  producerUid: string;
  producerEmail: string;
  producerDisplayName: string;
  revision: number;
  supersedesAssessmentId: string | null;
  publishedAt: string;
  analysis: ProducerAnalysisSnapshot;
  judgment: ProducerJudgment;
}

export interface ProducerAssessmentHead {
  producerUid: string;
  projectId: string;
  latestAssessmentId: string;
  revision: number;
  versionId: string;
  title: string;
  aiFinalScore: number;
  aiVerdict: RecommendationTier;
  producerScore: number;
  producerVerdict: RecommendationTier;
  pursuit: ProducerPursuit;
  includeInCalibration: boolean;
  updatedAt: string;
}

export interface CalibrationPolicy {
  thesis: string;
  principles: string[];
  scoringInstructions: string[];
  developmentUpsideRules: string[];
  fixableWeaknessRules: string[];
  dealbreakers: string[];
  genreCautions: string[];
}

export interface CalibrationDecisionReplay {
  assessmentId: string;
  projectId: string;
  versionId: string;
  title: string;
  producerScore: number;
  producerVerdict: RecommendationTier;
  baselineScore: number;
  baselineVerdict: RecommendationTier;
  candidateScore: number;
  candidateVerdict: RecommendationTier;
  rationale: string;
}

export interface CalibrationBenchmark {
  holdoutAssessmentIds: string[];
  baselineMeanAbsoluteError: number;
  candidateMeanAbsoluteError: number;
  baselineVerdictAgreement: number;
  candidateVerdictAgreement: number;
  baselineFalsePasses: number;
  candidateFalsePasses: number;
  baselineFalseRecommendations: number;
  candidateFalseRecommendations: number;
  passed: boolean;
  reasons: string[];
  replays: CalibrationDecisionReplay[];
}

export interface CalibrationCandidate {
  schemaVersion: typeof CALIBRATION_PROFILE_SCHEMA_VERSION;
  candidateId: string;
  profileId: 'admin';
  status: 'candidate';
  confidence: 'early_signal' | 'developing' | 'reliable';
  compilerModelId: string;
  compilerResponseId: string;
  sourceAssessmentIds: string[];
  sourceAssessmentSetSha256: string;
  calibrationPrompt: string;
  promptSha256: string;
  policy: CalibrationPolicy;
  benchmark: CalibrationBenchmark;
  createdAt: string;
  createdByUid: string;
}

export interface ActiveCalibrationProfile {
  displayName: string;
  enabled: boolean;
  activeVersionId: string | null;
  totalReviews: number;
  lastCalibrated: string;
  calibrationPrompt: string;
  promptSha256: string | null;
  sourceAssessmentSetSha256: string | null;
  compilerModelId: string | null;
  previousVersionId: string | null;
}
