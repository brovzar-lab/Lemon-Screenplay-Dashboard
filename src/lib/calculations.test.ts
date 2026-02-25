/**
 * Unit Tests for Calculation Functions
 *
 * After the producer metrics refactor, only these functions remain:
 * - createProducerMetrics (pass-through for AI data)
 * - canonicalizeGenre
 * - getScoreColorClass / getScoreBarFillClass
 */

import { describe, it, expect } from 'vitest';
import {
  createProducerMetrics,
  canonicalizeGenre,
  GENRE_CANONICAL_MAP,
  getScoreColorClass,
  getScoreBarFillClass,
} from './calculations';

// ─── createProducerMetrics ──────────────────────────────────

describe('createProducerMetrics', () => {
  it('returns all-null when called with no arguments', () => {
    const metrics = createProducerMetrics();

    expect(metrics.marketPotential).toBeNull();
    expect(metrics.marketPotentialRationale).toBeNull();
    expect(metrics.uspStrength).toBeNull();
    expect(metrics.uspStrengthRationale).toBeNull();
  });

  it('passes through AI-provided values', () => {
    const metrics = createProducerMetrics({
      marketPotential: 8,
      marketPotentialRationale: 'Strong commercial premise.',
      uspStrength: 'Strong',
      uspStrengthRationale: 'Unique dual-timeline structure.',
    });

    expect(metrics.marketPotential).toBe(8);
    expect(metrics.marketPotentialRationale).toBe('Strong commercial premise.');
    expect(metrics.uspStrength).toBe('Strong');
    expect(metrics.uspStrengthRationale).toBe('Unique dual-timeline structure.');
  });

  it('defaults missing fields to null', () => {
    const metrics = createProducerMetrics({ marketPotential: 5 });

    expect(metrics.marketPotential).toBe(5);
    expect(metrics.marketPotentialRationale).toBeNull();
    expect(metrics.uspStrength).toBeNull();
    expect(metrics.uspStrengthRationale).toBeNull();
  });

  it('preserves explicit null values', () => {
    const metrics = createProducerMetrics({
      marketPotential: null,
      uspStrength: null,
    });

    expect(metrics.marketPotential).toBeNull();
    expect(metrics.uspStrength).toBeNull();
  });
});

// ─── canonicalizeGenre ──────────────────────────────────────

describe('canonicalizeGenre', () => {
  it('maps known variants to canonical keys', () => {
    expect(canonicalizeGenre('Sci-Fi')).toBe('sci-fi');
    expect(canonicalizeGenre('Science Fiction')).toBe('sci-fi');
    expect(canonicalizeGenre('scifi')).toBe('sci-fi');
    expect(canonicalizeGenre('BIOGRAPHY')).toBe('biography');
    expect(canonicalizeGenre('Biopic')).toBe('biography');
    expect(canonicalizeGenre('Film Noir')).toBe('film-noir');
  });

  it('returns lowercased input for unknown genres', () => {
    expect(canonicalizeGenre('Action')).toBe('action');
    expect(canonicalizeGenre('THRILLER')).toBe('thriller');
  });

  it('handles empty/null input gracefully', () => {
    expect(canonicalizeGenre('')).toBe('');
    // @ts-expect-error — testing defensive coding
    expect(canonicalizeGenre(null)).toBe('');
    // @ts-expect-error — testing defensive coding
    expect(canonicalizeGenre(undefined)).toBe('');
  });

  it('covers all entries in GENRE_CANONICAL_MAP', () => {
    for (const [variant, canonical] of Object.entries(GENRE_CANONICAL_MAP)) {
      expect(canonicalizeGenre(variant)).toBe(canonical);
    }
  });
});

// ─── getScoreColorClass ─────────────────────────────────────

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

// ─── getScoreBarFillClass ───────────────────────────────────

describe('getScoreBarFillClass', () => {
  it('returns correct fill classes matching color classes', () => {
    expect(getScoreBarFillClass(8, 10)).toBe('score-bar-fill-excellent');
    expect(getScoreBarFillClass(6, 10)).toBe('score-bar-fill-good');
    expect(getScoreBarFillClass(3, 10)).toBe('score-bar-fill-poor');
  });
});
