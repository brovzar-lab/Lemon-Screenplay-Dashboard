/**
 * V6 Analysis Types - Core + Lenses Architecture
 *
 * V6 separates CORE QUALITY (immutable, content-first) from
 * OPTIONAL LENSES (toggleable market/budget/regional filters).
 */

// ============================================
// CORE QUALITY TYPES
// ============================================

export type V6Verdict = 'PASS' | 'CONSIDER' | 'RECOMMEND' | 'FILM_NOW';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type VerdictAdjustment = 'none' | 'downgrade_one_tier' | 'cap_at_consider';

export interface V6SubCriterion {
  score: number;
  note: string;
}

export interface V6DimensionScore {
  score: number;
  sub_criteria: Record<string, V6SubCriterion>;
  justification: string;
  page_citations?: string[];
}

// Execution Craft (40% weight)
export interface ExecutionCraftScore {
  score: number;
  structure: V6DimensionScore;
  scene_writing: V6DimensionScore;
  dialogue: V6DimensionScore;
}

// Character System (30% weight)
export interface CharacterSystemScore {
  score: number;
  protagonist: V6DimensionScore;
  supporting_cast: V6DimensionScore;
  relationships: V6DimensionScore;
}

// Conceptual Strength (20% weight)
export interface ConceptualStrengthScore {
  score: number;
  premise: V6DimensionScore;
  theme: V6DimensionScore;
}

// Voice & Tone (10% weight)
export interface VoiceAndToneScore {
  score: number;
  sub_criteria: {
    authorial_voice: V6SubCriterion;
    tonal_consistency: V6SubCriterion;
    genre_awareness: V6SubCriterion;
    confidence: V6SubCriterion;
  };
  justification: string;
}

// False Positive Trap Detection
export interface FalsePositiveTrap {
  name: string;
  triggered: boolean;
  assessment: string;
  // Optional fields depending on trap type
  premise_score?: number;
  execution_average?: number;
  structure_score?: number;
  character_average?: number;
  dialogue_score?: number;
  scene_writing_score?: number;
  theme_complexity?: number;
  theme_clarity?: number;
  voice_score?: number;
  premise_freshness?: number;
  gap?: number;
}

export interface FalsePositiveCheck {
  traps_evaluated: FalsePositiveTrap[];
  traps_triggered_count: number;
  risk_level: RiskLevel;
  verdict_adjustment: VerdictAdjustment;
  adjusted_verdict: V6Verdict;
  adjustment_rationale: string;
}

// Complete Core Quality Assessment
export interface V6CoreQuality {
  execution_craft: ExecutionCraftScore;
  character_system: CharacterSystemScore;
  conceptual_strength: ConceptualStrengthScore;
  voice_and_tone: VoiceAndToneScore;
  weighted_score: number;
  false_positive_check: FalsePositiveCheck;
  critical_failures: string[] | import('./screenplay').CriticalFailureDetail[];
  critical_failure_total_penalty?: number;
  major_weaknesses: string[];
  verdict: V6Verdict;
  verdict_rationale: string;
}

// ============================================
// LENS TYPES
// ============================================

export type MarketFitClassification = 'universal' | 'english_speaking' | 'latam_friendly' | 'niche';
export type LatAmRecommendation = 'strong_fit' | 'moderate_fit' | 'weak_fit' | 'not_recommended';
export type CommercialOutlook = 'strong' | 'viable' | 'challenging' | 'difficult';
export type DistributionChannel = 'theatrical' | 'streaming' | 'hybrid';
export type V6BudgetCategory = 'micro' | 'low' | 'medium' | 'high';
export type ProductionComplexity = 'low' | 'medium' | 'high';

// LatAm Market Lens
export interface LatAmLensAssessment {
  cultural_resonance: { score: number; rationale: string };
  regional_casting_potential: { score: number; rationale: string };
  theatrical_appeal: { score: number; rationale: string };
  marketing_viability: { score: number; rationale: string };
  coproduction_potential: { score: number; rationale: string };
  overall_latam_score: number;
  market_fit_classification: MarketFitClassification;
  recommendation: LatAmRecommendation;
}

// Commercial Viability Lens
export interface CommercialLensAssessment {
  target_audience: { score: number; note: string };
  high_concept: { score: number; note: string };
  cast_attachability: { score: number; note: string };
  marketing_hook: { score: number; note: string };
  budget_return_ratio: { score: number; note: string };
  comparable_success: { score: number; note: string };
  cvs_total: number;
  commercial_outlook: CommercialOutlook;
}

// Budget Tier Lens
export interface BudgetLensAssessment {
  estimated_budget_low: number;
  estimated_budget_high: number;
  category: V6BudgetCategory;
  within_ceiling: boolean;
  key_cost_drivers: string[];
  potential_savings: string[];
  production_complexity: ProductionComplexity;
  justification: string;
}

// Theatrical vs Streaming Lens
export interface TheatricalStreamingAssessment {
  theatrical_score: number;
  streaming_score: number;
  recommended_primary: DistributionChannel;
  theatrical_indicators: string[];
  streaming_indicators: string[];
  rationale: string;
}

// Co-Production Lens
export interface CoproductionTerritoryAssessment {
  score: number;
  rationale: string;
  key_elements?: string[];
  territories?: string[];
}

export interface CoproductionAssessment {
  mexico_us: CoproductionTerritoryAssessment;
  mexico_spain: CoproductionTerritoryAssessment;
  other_territories: CoproductionTerritoryAssessment;
  best_structure: string;
  treaty_considerations: string[];
  overall_coproduction_score: number;
}

// Lens Container
export interface V6Lens<T> {
  enabled: boolean;
  assessment?: T;
}

export interface V6Lenses {
  latam_market: V6Lens<LatAmLensAssessment>;
  commercial_viability: V6Lens<CommercialLensAssessment>;
  budget_tier: V6Lens<BudgetLensAssessment> & { ceiling_used?: number };
  theatrical_streaming: V6Lens<TheatricalStreamingAssessment>;
  coproduction: V6Lens<CoproductionAssessment>;
}

// ============================================
// ANALYSIS CONTENT TYPES
// ============================================

export interface V6ComparableFilm {
  title: string;
  similarity: string;
  quality_comparison: 'better' | 'similar' | 'weaker';
}

export interface V6StandoutScene {
  page: string;
  scene: string;
  why: string;
}

export interface V6Characters {
  protagonist: string;
  antagonist: string;
  supporting: string[];
}

export interface V6StructureAnalysis {
  format_quality: 'professional' | 'amateur' | 'needs_work';
  act_breaks: string;
  pacing: string;
}

export interface V6Assessment {
  strengths: string[];
  weaknesses: string[];
  development_notes: string[];
}

export interface V6AnalysisContent {
  title: string;
  author: string;
  logline: string;
  genre: string;
  subgenres: string[];
  themes: string[];
  tone: string;
  core_quality: V6CoreQuality;
  characters: V6Characters;
  structure_analysis: V6StructureAnalysis;
  standout_scenes: V6StandoutScene[];
  comparable_films: V6ComparableFilm[];
  assessment: V6Assessment;
  executive_summary: string;
  lenses?: V6Lenses;
}

// ============================================
// MAIN V6 ANALYSIS TYPE
// ============================================

export interface V6ScreenplayAnalysis {
  source_file: string;
  analysis_model: string;
  analysis_version: 'v6_core_lenses';
  lenses_enabled: string[];
  budget_ceiling_used: number | null;
  metadata: {
    filename: string;
    page_count: number;
    word_count: number;
  };
  analysis: V6AnalysisContent;
  collection?: string;
}

// ============================================
// TYPE GUARDS
// ============================================

export function isV6Analysis(analysis: unknown): analysis is V6ScreenplayAnalysis {
  if (!analysis || typeof analysis !== 'object') return false;
  const a = analysis as Record<string, unknown>;
  return a.analysis_version === 'v6_core_lenses';
}

export function hasV6CoreQuality(analysis: unknown): analysis is { analysis: { core_quality: V6CoreQuality } } {
  if (!analysis || typeof analysis !== 'object') return false;
  const a = analysis as Record<string, unknown>;
  if (!a.analysis || typeof a.analysis !== 'object') return false;
  const inner = a.analysis as Record<string, unknown>;
  return inner.core_quality !== undefined;
}

export function hasV6Lenses(analysis: unknown): analysis is { analysis: { lenses: V6Lenses } } {
  if (!analysis || typeof analysis !== 'object') return false;
  const a = analysis as Record<string, unknown>;
  if (!a.analysis || typeof a.analysis !== 'object') return false;
  const inner = a.analysis as Record<string, unknown>;
  return inner.lenses !== undefined && typeof inner.lenses === 'object';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Map V6 verdict to standard recommendation tier
 */
export function mapV6VerdictToTier(verdict: V6Verdict): 'film_now' | 'recommend' | 'consider' | 'pass' {
  switch (verdict) {
    case 'FILM_NOW': return 'film_now';
    case 'RECOMMEND': return 'recommend';
    case 'CONSIDER': return 'consider';
    case 'PASS': return 'pass';
  }
}

/**
 * Get risk level color for UI display
 */
export function getRiskLevelColor(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case 'low': return 'green';
    case 'moderate': return 'yellow';
    case 'high': return 'orange';
    case 'critical': return 'red';
  }
}

/**
 * Format V6 weighted score breakdown for display
 */
export function formatV6ScoreBreakdown(coreQuality: V6CoreQuality): string {
  const ec = coreQuality.execution_craft.score;
  const cs = coreQuality.character_system.score;
  const co = coreQuality.conceptual_strength.score;
  const vt = coreQuality.voice_and_tone.score;

  return `Execution: ${ec.toFixed(1)} (40%) | Character: ${cs.toFixed(1)} (30%) | Concept: ${co.toFixed(1)} (20%) | Voice: ${vt.toFixed(1)} (10%)`;
}

/**
 * Get enabled lenses from V6 analysis
 */
export function getEnabledLenses(lenses: V6Lenses): string[] {
  const enabled: string[] = [];
  if (lenses.latam_market?.enabled) enabled.push('LatAm Market');
  if (lenses.commercial_viability?.enabled) enabled.push('Commercial');
  if (lenses.budget_tier?.enabled) enabled.push('Budget');
  if (lenses.theatrical_streaming?.enabled) enabled.push('Distribution');
  if (lenses.coproduction?.enabled) enabled.push('Co-Production');
  return enabled;
}
