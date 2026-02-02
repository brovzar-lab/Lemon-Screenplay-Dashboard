/**
 * TypeScript interfaces for V3 Screenplay Analysis Data
 * Lemon Screenplay Dashboard
 */

// ============================================
// CORE TYPES
// ============================================

export type Collection =
  | '2005 Black List'
  | '2006 Black List'
  | '2007 Black List'
  | '2020 Black List'
  | 'Randoms';

export type RecommendationTier = 'film_now' | 'recommend' | 'consider' | 'pass';

export type BudgetCategory = 'micro' | 'low' | 'medium' | 'high' | 'unknown';

export type FormatQuality = 'professional' | 'amateur' | 'needs_work';

export type Marketability = 'high' | 'medium' | 'low';

export type GenderSkew = 'male' | 'female' | 'neutral';

export type BoxOfficeRelevance = 'success' | 'mixed' | 'failure';

export type ProductionRisk = 'Low' | 'Medium' | 'High';

export type USPStrength = 'Weak' | 'Moderate' | 'Strong';

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
  critical_failures: string[];
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

export interface RawScreenplayAnalysis {
  source_file: string;
  analysis_model: string;
  analysis_version: string;
  metadata: RawMetadata;
  analysis: RawAnalysis;
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
// PRODUCER METRICS (calculated)
// ============================================

export interface ProducerMetrics {
  marketPotential: number;       // 1-10
  productionRisk: ProductionRisk;
  starVehiclePotential: number;  // 1-10
  festivalAppeal: number;        // 1-10
  roiIndicator: number;          // 1-5 (stars)
  uspStrength: USPStrength;
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
  sourceFile: string;

  // Analysis Metadata
  analysisModel: string;
  analysisVersion: string;

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
  criticalFailures: string[];
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
  key: keyof Omit<CommercialViability, 'cvsTotal'>;
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
  '2005 Black List': { folder: 'analysis_v3_2005', displayName: '2005 Black List' },
  '2006 Black List': { folder: 'analysis_v3_2006', displayName: '2006 Black List' },
  '2007 Black List': { folder: 'analysis_v3_2007', displayName: '2007 Black List' },
  '2020 Black List': { folder: 'analysis_v3_2020', displayName: '2020 Black List' },
  'Randoms': { folder: 'analysis_v3_Randoms', displayName: 'Random Collection' },
};
