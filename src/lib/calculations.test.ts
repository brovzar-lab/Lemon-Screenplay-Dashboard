/**
 * Unit Tests for Calculation Functions
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMarketPotential,
  assessProductionRisk,
  evaluateStarVehiclePotential,
  calculateFestivalAppeal,
  calculateROIIndicator,
  assessUSPStrength,
  calculateProducerMetrics,
  getScoreColorClass,
  getScoreBarFillClass,
} from './calculations';
import type { Screenplay } from '@/types';

// Mock screenplay factory for tests
function createMockScreenplay(overrides: Partial<Screenplay> = {}): Screenplay {
  return {
    id: 'test-id',
    title: 'Test Screenplay',
    author: 'Test Author',
    logline: 'A short logline for testing purposes.',
    genre: 'Drama',
    subgenres: ['Indie'],
    themes: ['Identity', 'Family'],
    budgetCategory: 'low',
    collection: '2020 Black List',
    recommendation: 'recommend',
    isFilmNow: false,
    weightedScore: 7.5,
    cvsTotal: 12,
    marketability: 'medium',
    dimensionScores: {
      concept: 7,
      structure: 7,
      protagonist: 7,
      supportingCast: 7,
      dialogue: 7,
      genreExecution: 7,
      originality: 7,
      weightedScore: 7.5,
    },
    cvsFactors: {
      targetAudience: { score: 2, note: 'Good audience' },
      highConcept: { score: 2, note: 'Solid concept' },
      castAttachability: { score: 2, note: 'Castable' },
      marketingHook: { score: 2, note: 'Has hook' },
      budgetReturn: { score: 2, note: 'Good ratio' },
      comparableSuccess: { score: 2, note: 'Has comps' },
    },
    producerMetrics: {
      marketPotential: 7,
      productionRisk: 'Medium',
      starVehiclePotential: 7,
      festivalAppeal: 7,
      roiIndicator: 3,
      uspStrength: 'Moderate',
    },
    strengths: ['Strong characters', 'Unique voice'],
    weaknesses: ['Pacing issues'],
    comparableFilms: ['Film A', 'Film B'],
    standoutScenes: ['Opening sequence'],
    developmentNotes: ['Polish dialogue'],
    criticalFailures: [],
    characters: [],
    verdictStatement: 'A solid screenplay with potential.',
    metadata: {
      sourceFile: 'test.pdf',
      pageCount: 110,
      wordCount: 20000,
      analysisVersion: 'v3',
    },
    sourceFile: 'test.pdf',
    ...overrides,
  };
}

describe('calculateMarketPotential', () => {
  it('returns base score of 5 for neutral screenplay', () => {
    const screenplay = createMockScreenplay({
      genre: 'Documentary', // Non-commercial
      weightedScore: 5, // Low
      recommendation: 'pass',
      comparableFilms: [],
    });
    expect(calculateMarketPotential(screenplay)).toBe(5);
  });

  it('adds +2 for commercial genres', () => {
    const screenplay = createMockScreenplay({
      genre: 'Action',
      weightedScore: 5,
      recommendation: 'pass',
      comparableFilms: [],
    });
    expect(calculateMarketPotential(screenplay)).toBe(7);
  });

  it('adds +2 for high ratings (>= 8)', () => {
    const screenplay = createMockScreenplay({
      genre: 'Documentary',
      weightedScore: 8.5,
      recommendation: 'pass',
      comparableFilms: [],
    });
    expect(calculateMarketPotential(screenplay)).toBe(7);
  });

  it('adds +1 for good ratings (>= 7)', () => {
    const screenplay = createMockScreenplay({
      genre: 'Documentary',
      weightedScore: 7.2,
      recommendation: 'pass',
      comparableFilms: [],
    });
    expect(calculateMarketPotential(screenplay)).toBe(6);
  });

  it('adds +2 for recommend/film_now tiers', () => {
    const screenplay = createMockScreenplay({
      genre: 'Documentary',
      weightedScore: 5,
      recommendation: 'film_now',
      comparableFilms: [],
    });
    expect(calculateMarketPotential(screenplay)).toBe(7);
  });

  it('adds +1 for consider tier', () => {
    const screenplay = createMockScreenplay({
      genre: 'Documentary',
      weightedScore: 5,
      recommendation: 'consider',
      comparableFilms: [],
    });
    expect(calculateMarketPotential(screenplay)).toBe(6);
  });

  it('adds +1 for 3+ comparable films', () => {
    const screenplay = createMockScreenplay({
      genre: 'Documentary',
      weightedScore: 5,
      recommendation: 'pass',
      comparableFilms: ['A', 'B', 'C'],
    });
    expect(calculateMarketPotential(screenplay)).toBe(6);
  });

  it('caps score at 10', () => {
    const screenplay = createMockScreenplay({
      genre: 'Thriller', // Commercial
      weightedScore: 9, // High
      recommendation: 'film_now',
      comparableFilms: ['A', 'B', 'C'],
    });
    expect(calculateMarketPotential(screenplay)).toBe(10);
  });

  it('ensures minimum score of 1', () => {
    // This should never happen with the current logic, but test the safety
    const screenplay = createMockScreenplay();
    const score = calculateMarketPotential(screenplay);
    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(10);
  });
});

describe('assessProductionRisk', () => {
  it('returns Low for micro budget, simple genre, high marketability', () => {
    const screenplay = createMockScreenplay({
      budgetCategory: 'micro',
      genre: 'Drama',
      marketability: 'high',
    });
    expect(assessProductionRisk(screenplay)).toBe('Low');
  });

  it('returns Low for medium budget with simple genre and high marketability', () => {
    const screenplay = createMockScreenplay({
      budgetCategory: 'medium',
      genre: 'Drama',
      marketability: 'high',
    });
    // medium budget (+2), simple genre (+0), high marketability (+0) = 2, which is Low
    expect(assessProductionRisk(screenplay)).toBe('Low');
  });

  it('returns Medium for medium budget with medium marketability', () => {
    const screenplay = createMockScreenplay({
      budgetCategory: 'medium',
      genre: 'Drama',
      marketability: 'medium',
    });
    // medium budget (+2), simple genre (+0), medium marketability (+1) = 3, which is Medium
    expect(assessProductionRisk(screenplay)).toBe('Medium');
  });

  it('returns High for high budget + complex genre', () => {
    const screenplay = createMockScreenplay({
      budgetCategory: 'high',
      genre: 'Sci-Fi',
      marketability: 'medium',
    });
    expect(assessProductionRisk(screenplay)).toBe('High');
  });

  it('adds risk for complex genres', () => {
    const lowRisk = createMockScreenplay({
      budgetCategory: 'low',
      genre: 'Drama',
      marketability: 'high',
    });
    const complexGenre = createMockScreenplay({
      budgetCategory: 'low',
      genre: 'Fantasy',
      marketability: 'high',
    });
    expect(assessProductionRisk(lowRisk)).toBe('Low');
    expect(assessProductionRisk(complexGenre)).toBe('Medium');
  });

  it('adds risk for low marketability', () => {
    const screenplay = createMockScreenplay({
      budgetCategory: 'low',
      genre: 'Drama',
      marketability: 'low',
    });
    expect(assessProductionRisk(screenplay)).toBe('Medium');
  });
});

describe('evaluateStarVehiclePotential', () => {
  it('returns base score of 5 for neutral screenplay', () => {
    const screenplay = createMockScreenplay({
      genre: 'Documentary',
      strengths: ['Good pacing'],
      dimensionScores: { ...createMockScreenplay().dimensionScores, protagonist: 5 },
      standoutScenes: [],
    });
    expect(evaluateStarVehiclePotential(screenplay)).toBe(5);
  });

  it('adds +2 for character/protagonist strengths', () => {
    const screenplay = createMockScreenplay({
      genre: 'Documentary',
      strengths: ['Compelling character study'],
      dimensionScores: { ...createMockScreenplay().dimensionScores, protagonist: 5 },
      standoutScenes: [],
    });
    expect(evaluateStarVehiclePotential(screenplay)).toBe(7);
  });

  it('adds +2 for actor-friendly genres', () => {
    const screenplay = createMockScreenplay({
      genre: 'Drama',
      strengths: ['Good pacing'],
      dimensionScores: { ...createMockScreenplay().dimensionScores, protagonist: 5 },
      standoutScenes: [],
    });
    expect(evaluateStarVehiclePotential(screenplay)).toBe(7);
  });

  it('adds +1 for high protagonist score', () => {
    const screenplay = createMockScreenplay({
      genre: 'Documentary',
      strengths: ['Good pacing'],
      dimensionScores: { ...createMockScreenplay().dimensionScores, protagonist: 9 },
      standoutScenes: [],
    });
    expect(evaluateStarVehiclePotential(screenplay)).toBe(6);
  });

  it('adds +1 for 2+ standout scenes', () => {
    const screenplay = createMockScreenplay({
      genre: 'Documentary',
      strengths: ['Good pacing'],
      dimensionScores: { ...createMockScreenplay().dimensionScores, protagonist: 5 },
      standoutScenes: ['Scene A', 'Scene B'],
    });
    expect(evaluateStarVehiclePotential(screenplay)).toBe(6);
  });
});

describe('calculateFestivalAppeal', () => {
  it('returns base score of 5 for neutral screenplay', () => {
    const screenplay = createMockScreenplay({
      genre: 'Action',
      themes: ['Adventure'],
      weightedScore: 5,
      strengths: ['Good action'],
    });
    expect(calculateFestivalAppeal(screenplay)).toBe(5);
  });

  it('adds +2 for festival-friendly genres', () => {
    const screenplay = createMockScreenplay({
      genre: 'Drama',
      themes: ['Adventure'],
      weightedScore: 5,
      strengths: ['Good action'],
    });
    expect(calculateFestivalAppeal(screenplay)).toBe(7);
  });

  it('adds +2 for festival themes', () => {
    const screenplay = createMockScreenplay({
      genre: 'Action',
      themes: ['Identity crisis', 'Social commentary'],
      weightedScore: 5,
      strengths: ['Good action'],
    });
    expect(calculateFestivalAppeal(screenplay)).toBe(7);
  });

  it('adds +2 for exceptional rating >= 8.5', () => {
    const screenplay = createMockScreenplay({
      genre: 'Action',
      themes: ['Adventure'],
      weightedScore: 9,
      strengths: ['Good action'],
    });
    expect(calculateFestivalAppeal(screenplay)).toBe(7);
  });

  it('adds +1 for unique voice in strengths', () => {
    const screenplay = createMockScreenplay({
      genre: 'Action',
      themes: ['Adventure'],
      weightedScore: 5,
      strengths: ['Unique directorial voice'],
    });
    expect(calculateFestivalAppeal(screenplay)).toBe(6);
  });
});

describe('calculateROIIndicator', () => {
  // Formula: ratio = (marketPotential / budgetLevel) * 2
  // budgetLevel: micro=1, low=2, medium=3, high=4
  // ratio >= 4 → 5 stars, >= 3 → 4 stars, >= 2 → 3 stars, >= 1 → 2 stars, else 1 star

  it('returns 5 stars for high potential, micro budget', () => {
    // 10 / 1 * 2 = 20 >= 4 → 5 stars
    expect(calculateROIIndicator(10, 'micro')).toBe(5);
  });

  it('returns 5 stars for good potential with low budget', () => {
    // 8 / 2 * 2 = 8 >= 4 → 5 stars
    expect(calculateROIIndicator(8, 'low')).toBe(5);
  });

  it('returns 5 stars for medium potential with medium budget', () => {
    // 6 / 3 * 2 = 4 >= 4 → 5 stars
    expect(calculateROIIndicator(6, 'medium')).toBe(5);
  });

  it('returns 4 stars for moderate ratio', () => {
    // 5 / 3 * 2 = 3.33 >= 3 → 4 stars
    expect(calculateROIIndicator(5, 'medium')).toBe(4);
  });

  it('returns 3 stars for fair ratio', () => {
    // 4 / 4 * 2 = 2 >= 2 → 3 stars
    expect(calculateROIIndicator(4, 'high')).toBe(3);
  });

  it('returns 2 stars for poor ratio', () => {
    // 3 / 4 * 2 = 1.5 >= 1 → 2 stars
    expect(calculateROIIndicator(3, 'high')).toBe(2);
  });

  it('returns 1 star for very poor ratio', () => {
    // 1 / 4 * 2 = 0.5 < 1 → 1 star
    expect(calculateROIIndicator(1, 'high')).toBe(1);
  });
});

describe('assessUSPStrength', () => {
  it('returns Weak for minimal USP indicators', () => {
    const screenplay = createMockScreenplay({
      logline: 'Short logline.',
      strengths: ['Good pacing'],
      comparableFilms: [],
      subgenres: [],
      standoutScenes: [],
      dimensionScores: { ...createMockScreenplay().dimensionScores, originality: 5 },
    });
    expect(assessUSPStrength(screenplay)).toBe('Weak');
  });

  it('returns Moderate for some USP indicators', () => {
    const screenplay = createMockScreenplay({
      logline: 'A decent logline.',
      strengths: ['Good pacing'],
      comparableFilms: ['Film A'],
      subgenres: ['Thriller', 'Mystery'],
      standoutScenes: [],
      dimensionScores: { ...createMockScreenplay().dimensionScores, originality: 5 },
    });
    expect(assessUSPStrength(screenplay)).toBe('Moderate');
  });

  it('returns Strong for many USP indicators', () => {
    const screenplay = createMockScreenplay({
      logline: 'A very detailed and elaborate logline that goes on and on and on and on and on and on and on and on and on and on and on and on and on and provides lots of context.',
      strengths: ['Highly original concept with unique voice'],
      comparableFilms: ['Film A', 'Film B'],
      subgenres: ['Thriller', 'Mystery', 'Noir'],
      standoutScenes: ['Scene A', 'Scene B', 'Scene C'],
      dimensionScores: { ...createMockScreenplay().dimensionScores, originality: 9 },
    });
    expect(assessUSPStrength(screenplay)).toBe('Strong');
  });
});

describe('calculateProducerMetrics', () => {
  it('calculates all metrics for a screenplay', () => {
    const screenplay = createMockScreenplay();
    const metrics = calculateProducerMetrics(screenplay);

    expect(metrics).toHaveProperty('marketPotential');
    expect(metrics).toHaveProperty('productionRisk');
    expect(metrics).toHaveProperty('starVehiclePotential');
    expect(metrics).toHaveProperty('festivalAppeal');
    expect(metrics).toHaveProperty('roiIndicator');
    expect(metrics).toHaveProperty('uspStrength');

    // Check ranges
    expect(metrics.marketPotential).toBeGreaterThanOrEqual(1);
    expect(metrics.marketPotential).toBeLessThanOrEqual(10);
    expect(['Low', 'Medium', 'High']).toContain(metrics.productionRisk);
    expect(metrics.starVehiclePotential).toBeGreaterThanOrEqual(1);
    expect(metrics.starVehiclePotential).toBeLessThanOrEqual(10);
    expect(metrics.festivalAppeal).toBeGreaterThanOrEqual(1);
    expect(metrics.festivalAppeal).toBeLessThanOrEqual(10);
    expect(metrics.roiIndicator).toBeGreaterThanOrEqual(1);
    expect(metrics.roiIndicator).toBeLessThanOrEqual(5);
    expect(['Weak', 'Moderate', 'Strong']).toContain(metrics.uspStrength);
  });
});

describe('getScoreColorClass', () => {
  it('returns excellent for scores >= 70%', () => {
    expect(getScoreColorClass(7, 10)).toBe('score-excellent');
    expect(getScoreColorClass(8, 10)).toBe('score-excellent');
    expect(getScoreColorClass(14, 18)).toBe('score-excellent'); // CVS
  });

  it('returns good for scores 50-69%', () => {
    expect(getScoreColorClass(5, 10)).toBe('score-good');
    expect(getScoreColorClass(6, 10)).toBe('score-good');
    expect(getScoreColorClass(10, 18)).toBe('score-good'); // CVS
  });

  it('returns poor for scores < 50%', () => {
    expect(getScoreColorClass(4, 10)).toBe('score-poor');
    expect(getScoreColorClass(2, 10)).toBe('score-poor');
    expect(getScoreColorClass(8, 18)).toBe('score-poor'); // CVS
  });
});

describe('getScoreBarFillClass', () => {
  it('returns correct fill classes matching color classes', () => {
    expect(getScoreBarFillClass(8, 10)).toBe('score-bar-fill-excellent');
    expect(getScoreBarFillClass(6, 10)).toBe('score-bar-fill-good');
    expect(getScoreBarFillClass(3, 10)).toBe('score-bar-fill-poor');
  });
});
