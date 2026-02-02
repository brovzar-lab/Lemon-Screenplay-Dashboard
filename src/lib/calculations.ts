/**
 * Producer Metrics Calculations
 * Ported from dashboard/app.js with TypeScript
 */

import type {
  Screenplay,
  ProducerMetrics,
  ProductionRisk,
  USPStrength,
  BudgetCategory,
} from '@/types';

// Commercial genres that typically perform well
const COMMERCIAL_GENRES = [
  'action',
  'thriller',
  'horror',
  'comedy',
  'sci-fi',
  'science fiction',
  'adventure',
  'superhero',
];

// Actor-friendly genres for star vehicles
const ACTOR_GENRES = [
  'drama',
  'thriller',
  'biopic',
  'biographical',
  'period',
  'psychological',
  'romance',
];

// Festival-friendly genres
const FESTIVAL_GENRES = [
  'drama',
  'indie',
  'independent',
  'psychological',
  'art',
  'experimental',
  'foreign',
  'arthouse',
];

// Complex production genres (higher risk)
const COMPLEX_GENRES = [
  'sci-fi',
  'science fiction',
  'fantasy',
  'period',
  'historical',
  'war',
  'epic',
  'action',
];

// Festival-friendly themes
const FESTIVAL_THEMES = [
  'identity',
  'social',
  'political',
  'existential',
  'philosophical',
  'cultural',
  'artistic',
  'psychological',
];

/**
 * Get budget level number for calculations
 */
function getBudgetLevel(category: BudgetCategory): number {
  switch (category) {
    case 'micro':
      return 1;
    case 'low':
      return 2;
    case 'medium':
      return 3;
    case 'high':
      return 4;
    default:
      return 2;
  }
}

/**
 * Check if genre matches any in list (case-insensitive)
 */
function genreMatches(genre: string, list: string[]): boolean {
  const lowerGenre = genre.toLowerCase();
  return list.some((g) => lowerGenre.includes(g.toLowerCase()));
}

/**
 * Check if any theme matches list
 */
function themesMatch(themes: string[], list: string[]): boolean {
  return themes.some((theme) =>
    list.some((t) => theme.toLowerCase().includes(t.toLowerCase()))
  );
}

/**
 * Check if any strength contains keyword
 */
function strengthContains(strengths: string[], keyword: string): boolean {
  return strengths.some((s) => s.toLowerCase().includes(keyword.toLowerCase()));
}

/**
 * Calculate Market Potential (1-10)
 * Based on genre, rating, recommendation, and comparables
 */
export function calculateMarketPotential(screenplay: Screenplay): number {
  let score = 5; // Base

  // +2 for commercial genre
  if (genreMatches(screenplay.genre, COMMERCIAL_GENRES)) {
    score += 2;
  }

  // +2 if rating >= 8, +1 if >= 7
  if (screenplay.weightedScore >= 8) {
    score += 2;
  } else if (screenplay.weightedScore >= 7) {
    score += 1;
  }

  // +2 for RECOMMEND/FILM NOW, +1 for CONSIDER
  if (
    screenplay.recommendation === 'recommend' ||
    screenplay.recommendation === 'film_now'
  ) {
    score += 2;
  } else if (screenplay.recommendation === 'consider') {
    score += 1;
  }

  // +1 if >= 3 comparable films
  if (screenplay.comparableFilms.length >= 3) {
    score += 1;
  }

  return Math.min(10, Math.max(1, score));
}

/**
 * Assess Production Risk (Low/Medium/High)
 * Based on budget tier, genre complexity, marketability
 */
export function assessProductionRisk(screenplay: Screenplay): ProductionRisk {
  let riskScore = 0;

  // Budget tier adds risk
  switch (screenplay.budgetCategory) {
    case 'high':
      riskScore += 3;
      break;
    case 'medium':
      riskScore += 2;
      break;
    case 'low':
    case 'micro':
      riskScore += 1;
      break;
  }

  // Complex genres add risk
  if (genreMatches(screenplay.genre, COMPLEX_GENRES)) {
    riskScore += 2;
  }

  // Low marketability adds risk
  if (screenplay.marketability === 'low') {
    riskScore += 2;
  } else if (screenplay.marketability === 'medium') {
    riskScore += 1;
  }

  if (riskScore >= 5) return 'High';
  if (riskScore >= 3) return 'Medium';
  return 'Low';
}

/**
 * Evaluate Star Vehicle Potential (1-10)
 * Based on character strength, actor-friendly genres, standout scenes
 */
export function evaluateStarVehiclePotential(screenplay: Screenplay): number {
  let score = 5; // Base

  // +2 if strengths mention character/protagonist
  if (
    strengthContains(screenplay.strengths, 'character') ||
    strengthContains(screenplay.strengths, 'protagonist')
  ) {
    score += 2;
  }

  // +2 for actor-friendly genres
  if (genreMatches(screenplay.genre, ACTOR_GENRES)) {
    score += 2;
  }

  // +1 if high protagonist score
  if (screenplay.dimensionScores.protagonist >= 8) {
    score += 1;
  }

  // +1 if >= 2 standout scenes
  if (screenplay.standoutScenes.length >= 2) {
    score += 1;
  }

  return Math.min(10, Math.max(1, score));
}

/**
 * Calculate Festival Appeal (1-10)
 * Based on genre, themes, rating, artistic elements
 */
export function calculateFestivalAppeal(screenplay: Screenplay): number {
  let score = 5; // Base

  // +2 for festival-friendly genres
  if (genreMatches(screenplay.genre, FESTIVAL_GENRES)) {
    score += 2;
  }

  // +2 for artistic/festival themes
  if (themesMatch(screenplay.themes, FESTIVAL_THEMES)) {
    score += 2;
  }

  // +2 if rating >= 8.5, +1 if >= 7.5
  if (screenplay.weightedScore >= 8.5) {
    score += 2;
  } else if (screenplay.weightedScore >= 7.5) {
    score += 1;
  }

  // +1 if strengths mention unique voice/original
  if (
    strengthContains(screenplay.strengths, 'unique') ||
    strengthContains(screenplay.strengths, 'original') ||
    strengthContains(screenplay.strengths, 'voice')
  ) {
    score += 1;
  }

  return Math.min(10, Math.max(1, score));
}

/**
 * Calculate ROI Indicator (1-5 stars)
 * Based on market potential vs budget
 */
export function calculateROIIndicator(
  marketPotential: number,
  budgetCategory: BudgetCategory
): number {
  const budgetLevel = getBudgetLevel(budgetCategory);
  const ratio = (marketPotential / budgetLevel) * 2;

  if (ratio >= 4) return 5;
  if (ratio >= 3) return 4;
  if (ratio >= 2) return 3;
  if (ratio >= 1) return 2;
  return 1;
}

/**
 * Assess USP Strength (Weak/Moderate/Strong)
 * Based on logline, originality, subgenres, standout elements
 */
export function assessUSPStrength(screenplay: Screenplay): USPStrength {
  let indicators = 0;

  // +1 if logline > 50 words (detailed premise)
  if (screenplay.logline.split(' ').length > 50) {
    indicators += 1;
  }

  // +2 if original/unique in strengths AND has comparables
  if (
    (strengthContains(screenplay.strengths, 'original') ||
      strengthContains(screenplay.strengths, 'unique')) &&
    screenplay.comparableFilms.length > 0
  ) {
    indicators += 2;
  }

  // +1 if >= 2 subgenres (genre blending)
  if (screenplay.subgenres.length >= 2) {
    indicators += 1;
  }

  // +1 if >= 3 standout scenes
  if (screenplay.standoutScenes.length >= 3) {
    indicators += 1;
  }

  // High originality score
  if (screenplay.dimensionScores.originality >= 8) {
    indicators += 1;
  }

  if (indicators >= 4) return 'Strong';
  if (indicators >= 2) return 'Moderate';
  return 'Weak';
}

/**
 * Calculate all producer metrics for a screenplay
 */
export function calculateProducerMetrics(screenplay: Screenplay): ProducerMetrics {
  const marketPotential = calculateMarketPotential(screenplay);

  return {
    marketPotential,
    productionRisk: assessProductionRisk(screenplay),
    starVehiclePotential: evaluateStarVehiclePotential(screenplay),
    festivalAppeal: calculateFestivalAppeal(screenplay),
    roiIndicator: calculateROIIndicator(marketPotential, screenplay.budgetCategory),
    uspStrength: assessUSPStrength(screenplay),
  };
}

/**
 * Get score color class based on value
 */
export function getScoreColorClass(score: number, max: number = 10): string {
  const percentage = score / max;
  if (percentage >= 0.7) return 'score-excellent';
  if (percentage >= 0.5) return 'score-good';
  return 'score-poor';
}

/**
 * Get score bar fill class based on value
 */
export function getScoreBarFillClass(score: number, max: number = 10): string {
  const percentage = score / max;
  if (percentage >= 0.7) return 'score-bar-fill-excellent';
  if (percentage >= 0.5) return 'score-bar-fill-good';
  return 'score-bar-fill-poor';
}
