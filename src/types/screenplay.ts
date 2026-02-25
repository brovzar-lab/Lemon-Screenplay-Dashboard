/**
 * TypeScript interfaces for Screenplay Analysis Data
 * Lemon Screenplay Dashboard
 * V6 analysis format
 */

// ============================================
// CORE TYPES
// ============================================

export type Collection = 'V6 Analysis';

export type RecommendationTier = 'film_now' | 'recommend' | 'consider' | 'pass';

export type BudgetCategory = 'micro' | 'low' | 'medium' | 'high' | 'unknown';

export type FormatQuality = 'professional' | 'amateur' | 'needs_work';

export type Marketability = 'high' | 'medium' | 'low';

export type GenderSkew = 'male' | 'female' | 'neutral';

export type BoxOfficeRelevance = 'success' | 'mixed' | 'failure';

export type USPStrength = 'Weak' | 'Moderate' | 'Strong';

export type CriticalFailureSeverity = 'minor' | 'moderate' | 'major' | 'critical';

// V6 detailed critical failure with penalty
export interface CriticalFailureDetail {
  failure: string;
  severity: CriticalFailureSeverity;
  penalty: number; // -0.3, -0.5, -0.8, or -1.2
  evidence: string;
}

// ============================================
// RAW JSON TYPES (from analysis files)
// ============================================

export interface RawDimensionScore {
  score: number;
  justification: string;
}

export interface RawDimensionScores {
  concept: RawDimensionScore;
  structure: RawDimensionScore;
  protagonist: RawDimensionScore;
  supporting_cast: RawDimensionScore;
  dialogue: RawDimensionScore;
  genre_execution: RawDimensionScore;
  originality: RawDimensionScore;
  weighted_score: number;
}

export interface RawCVSFactor {
  score: number;
  note: string;
}

export interface RawCommercialViability {
  target_audience: RawCVSFactor;
  high_concept: RawCVSFactor;
  cast_attachability: RawCVSFactor;
  marketing_hook: RawCVSFactor;
  budget_return_ratio: RawCVSFactor;
  comparable_success: RawCVSFactor;
  cvs_total: number | string; // Can be string in some JSON files
}

export interface RawStructureAnalysis {
  format_quality: FormatQuality;
  act_breaks: string;
  pacing: string;
}

export interface RawCharacters {
  protagonist: string;
  antagonist: string;
  supporting: string[];
}

export interface RawStandoutScene {
  scene: string;
  why: string;
}

export interface RawComparableFilm {
  title: string;
  similarity: string;
  box_office_relevance: BoxOfficeRelevance;
}

export interface RawTargetAudience {
  primary_demographic: string;
  gender_skew: GenderSkew;
  interests: string[];
}

export interface RawBudgetTier {
  category: string; // May include dollar amounts like "low ($10-50M)"
  justification: string;
}

export interface RawFilmNowAssessment {
  qualifies: boolean;
  lightning_test: string | null;
  goosebumps_moments: string[];
  career_risk_test: string;
  legacy_potential: string;
  disqualifying_factors: string[];
}

export interface RawAssessment {
  strengths: string[];
  weaknesses: string[];
  development_notes: string[];
  marketability: Marketability;
  recommendation: string;
  recommendation_rationale: string;
}

export interface RawAnalysis {
  title: string;
  author: string;
  logline: string;
  genre: string;
  subgenres: string[];
  themes: string[];
  tone: string;
  dimension_scores: RawDimensionScores;
  critical_failures: string[] | CriticalFailureDetail[];
  critical_failure_total_penalty?: number;
  major_weaknesses: string[];
  commercial_viability: RawCommercialViability;
  structure_analysis: RawStructureAnalysis;
  characters: RawCharacters;
  standout_scenes: RawStandoutScene[];
  comparable_films: RawComparableFilm[];
  target_audience: RawTargetAudience;
  budget_tier: RawBudgetTier;
  assessment: RawAssessment;
  film_now_assessment?: RawFilmNowAssessment;
  verdict_statement: string;
}

export interface RawMetadata {
  filename: string;
  page_count: number;
  word_count: number;
}

// ============================================
// TMDB STATUS (raw JSON format)
// ============================================

export interface RawTmdbStatus {
  is_produced: boolean;
  tmdb_id: number | null;
  tmdb_title: string | null;
  release_date: string | null;
  status: string | null;
  checked_at: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface RawScreenplayAnalysis {
  source_file: string;
  analysis_model: string;
  analysis_version: string;
  metadata: RawMetadata;
  analysis: RawAnalysis;
  tmdb_status?: RawTmdbStatus;
}

// ============================================
// NORMALIZED TYPES (for app use)
// ============================================

export interface DimensionScores {
  concept: number;
  structure: number;
  protagonist: number;
  supportingCast: number;
  dialogue: number;
  genreExecution: number;
  originality: number;
  weightedScore: number;
}

export interface DimensionJustifications {
  concept: string;
  structure: string;
  protagonist: string;
  supportingCast: string;
  dialogue: string;
  genreExecution: string;
  originality: string;
}

export interface CVSFactor {
  score: number;
  note: string;
}

export interface CommercialViability {
  targetAudience: CVSFactor;
  highConcept: CVSFactor;
  castAttachability: CVSFactor;
  marketingHook: CVSFactor;
  budgetReturnRatio: CVSFactor;
  comparableSuccess: CVSFactor;
  cvsTotal: number;
  /** False when V6 commercial lens was disabled — scores are placeholder zeros */
  cvsAssessed: boolean;
}

export interface StructureAnalysis {
  formatQuality: FormatQuality;
  actBreaks: string;
  pacing: string;
}

export interface Characters {
  protagonist: string;
  antagonist: string;
  supporting: string[];
}

export interface StandoutScene {
  scene: string;
  why: string;
}

export interface ComparableFilm {
  title: string;
  similarity: string;
  boxOfficeRelevance: BoxOfficeRelevance;
}

export interface TargetAudience {
  primaryDemographic: string;
  genderSkew: GenderSkew;
  interests: string[];
}

export interface FilmNowAssessment {
  qualifies: boolean;
  lightningTest: string | null;
  goosebumpsMoments: string[];
  careerRiskTest: string;
  legacyPotential: string;
  disqualifyingFactors: string[];
}

export interface FileMetadata {
  filename: string;
  pageCount: number;
  wordCount: number;
}

// ============================================
// TMDB STATUS (normalized)
// ============================================

export interface TmdbStatus {
  isProduced: boolean;
  tmdbId: number | null;
  tmdbTitle: string | null;
  releaseDate: string | null;
  status: string | null;
  checkedAt: string;
  confidence: 'high' | 'medium' | 'low';
}

// ============================================
// PRODUCER METRICS (AI-analyzed)
// ============================================

export interface ProducerMetrics {
  marketPotential: number | null;         // 1-10, null = not yet AI-analyzed
  marketPotentialRationale: string | null;
  uspStrength: USPStrength | null;        // AI assessment, null = not yet analyzed
  uspStrengthRationale: string | null;
}

// ============================================
// MAIN SCREENPLAY TYPE
// ============================================

export interface Screenplay {
  // Unique identifier (generated from filename)
  id: string;

  // Basic Info
  title: string;
  author: string;
  collection: Collection;
  category?: string;  // 'BLKLST', 'LEMON', 'SUBMISSION', etc.
  sourceFile: string;

  // Analysis Metadata
  analysisModel: string;
  analysisVersion: string;

  // Poster Generation
  posterUrl?: string; // URL to the generated poster in Firebase Storage
  posterStatus?: 'pending' | 'generating' | 'ready' | 'error'; // Status tracking

  // Core Scores
  weightedScore: number;
  cvsTotal: number;

  // Classification
  genre: string;
  subgenres: string[];
  themes: string[];
  logline: string;
  tone: string;

  // Recommendation
  recommendation: RecommendationTier;
  recommendationRationale: string;
  verdictStatement: string;
  isFilmNow: boolean;
  filmNowAssessment: FilmNowAssessment | null;

  // Detailed Scores
  dimensionScores: DimensionScores;
  dimensionJustifications: DimensionJustifications;

  // Commercial Analysis
  commercialViability: CommercialViability;

  // Critical Assessment
  criticalFailures: string[]; // Display-friendly list (flattened from detail objects)
  criticalFailureDetails: CriticalFailureDetail[]; // V6+ detailed failures with severity/penalty
  criticalFailureTotalPenalty: number; // Sum of penalties (max -3.0)
  majorWeaknesses: string[];
  strengths: string[];
  weaknesses: string[];
  developmentNotes: string[];
  marketability: Marketability;

  // Production Details
  budgetCategory: BudgetCategory;
  budgetJustification: string;

  // Character & Structure
  characters: Characters;
  structureAnalysis: StructureAnalysis;

  // Supporting Data
  comparableFilms: ComparableFilm[];
  standoutScenes: StandoutScene[];
  targetAudience: TargetAudience;

  // File Metadata
  metadata: FileMetadata;

  // Calculated Producer Metrics
  producerMetrics: ProducerMetrics;

  // TMDB Production Status
  tmdbStatus: TmdbStatus | null;
}

// ============================================
// DIMENSION CONFIG
// ============================================

export interface DimensionConfig {
  key: keyof Omit<DimensionScores, 'weightedScore'>;
  label: string;
  weight: number;
}

export const DIMENSION_CONFIG: DimensionConfig[] = [
  { key: 'concept', label: 'Concept', weight: 0.20 },
  { key: 'structure', label: 'Structure', weight: 0.15 },
  { key: 'protagonist', label: 'Protagonist', weight: 0.15 },
  { key: 'supportingCast', label: 'Supporting Cast', weight: 0.10 },
  { key: 'dialogue', label: 'Dialogue', weight: 0.10 },
  { key: 'genreExecution', label: 'Genre Execution', weight: 0.15 },
  { key: 'originality', label: 'Originality', weight: 0.15 },
];

// ============================================
// CVS CONFIG
// ============================================

export interface CVSConfig {
  key: keyof Omit<CommercialViability, 'cvsTotal' | 'cvsAssessed'>;
  label: string;
  maxScore: number;
}

export const CVS_CONFIG: CVSConfig[] = [
  { key: 'targetAudience', label: 'Target Audience', maxScore: 3 },
  { key: 'highConcept', label: 'High Concept', maxScore: 3 },
  { key: 'castAttachability', label: 'Cast Attachability', maxScore: 3 },
  { key: 'marketingHook', label: 'Marketing Hook', maxScore: 3 },
  { key: 'budgetReturnRatio', label: 'Budget/Return Ratio', maxScore: 3 },
  { key: 'comparableSuccess', label: 'Comparable Success', maxScore: 3 },
];

// ============================================
// BUDGET TIER CONFIG
// ============================================

export const BUDGET_TIERS: Record<BudgetCategory, { label: string; range: string; level: number }> = {
  micro: { label: 'Micro', range: '<$1M', level: 1 },
  low: { label: 'Low', range: '$1-10M', level: 2 },
  medium: { label: 'Medium', range: '$10-50M', level: 3 },
  high: { label: 'High', range: '$50M+', level: 4 },
  unknown: { label: 'Unknown', range: 'TBD', level: 2 },
};

// ============================================
// RECOMMENDATION CONFIG
// ============================================

export const RECOMMENDATION_CONFIG: Record<RecommendationTier, {
  label: string;
  color: string;
  description: string;
}> = {
  film_now: {
    label: 'FILM NOW',
    color: 'gold',
    description: 'Elite tier - immediate greenlight consideration'
  },
  recommend: {
    label: 'RECOMMEND',
    color: 'emerald',
    description: 'Best-in-class material ready for development'
  },
  consider: {
    label: 'CONSIDER',
    color: 'amber',
    description: 'Development-ready with clear improvement path'
  },
  pass: {
    label: 'PASS',
    color: 'red',
    description: 'Does not meet minimum quality thresholds'
  },
};

// ============================================
// COLLECTION CONFIG
// ============================================

export const COLLECTION_CONFIG: Record<Collection, {
  folder: string;
  displayName: string;
}> = {
  'V6 Analysis': { folder: 'analysis_v6', displayName: 'V6 Core + Lenses Analysis' },
};


