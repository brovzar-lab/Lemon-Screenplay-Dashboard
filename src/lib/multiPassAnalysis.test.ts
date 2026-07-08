/**
 * Tests for code-side verdict derivation (deriveVerdict / computeFailurePenalty).
 * Mirrors execution/test_verdict.py — the two implementations must agree.
 */

import { describe, it, expect } from 'vitest';
import { computeFailurePenalty, deriveVerdict } from './multiPassAnalysis';

function failures(...severities: string[]) {
  return severities.map((s) => ({ description: 'x', severity: s, penalty: 0 }));
}

describe('computeFailurePenalty', () => {
  it('returns 0 for empty or malformed input', () => {
    expect(computeFailurePenalty(null)).toBe(0);
    expect(computeFailurePenalty([])).toBe(0);
    expect(computeFailurePenalty('nope')).toBe(0);
    expect(computeFailurePenalty(['not-an-object', 42])).toBe(0);
  });

  it('maps severities to prompt penalties', () => {
    expect(computeFailurePenalty(failures('minor'))).toBe(0.3);
    expect(computeFailurePenalty(failures('moderate'))).toBe(0.5);
    expect(computeFailurePenalty(failures('major'))).toBe(0.8);
    expect(computeFailurePenalty(failures('critical'))).toBe(1.2);
    expect(computeFailurePenalty(failures('CRITICAL'))).toBe(1.2);
  });

  it('sums and caps at 3.0', () => {
    expect(computeFailurePenalty(failures('critical', 'major'))).toBe(2.0);
    expect(computeFailurePenalty(failures('critical', 'critical', 'critical'))).toBe(3.0);
  });

  it('ignores unknown severities', () => {
    expect(computeFailurePenalty(failures('catastrophic'))).toBe(0);
  });
});

describe('deriveVerdict thresholds', () => {
  const tier = (score: number) => deriveVerdict({ weightedScore: score }).verdict;

  it('applies the synthesis-prompt boundaries', () => {
    expect(tier(5.49)).toBe('PASS');
    expect(tier(5.5)).toBe('CONSIDER');
    expect(tier(7.49)).toBe('CONSIDER');
    expect(tier(7.5)).toBe('RECOMMEND');
    expect(tier(8.49)).toBe('RECOMMEND');
    expect(tier(8.5)).toBe('FILM_NOW');
    expect(tier(0)).toBe('PASS');
  });
});

describe('deriveVerdict — the penalty-restored bug', () => {
  it('a critical failure pulls a borderline RECOMMEND down to CONSIDER', () => {
    const result = deriveVerdict({
      weightedScore: 7.5,
      criticalFailures: failures('critical'),
    });
    expect(result.adjustedScore).toBe(6.3);
    expect(result.verdict).toBe('CONSIDER');
    expect(result.penalty).toBe(1.2);
    expect(result.adjustments.some((a) => a.includes('critical_failure_penalty'))).toBe(true);
  });

  it('no failures leaves the score untouched', () => {
    const result = deriveVerdict({ weightedScore: 7.5 });
    expect(result.adjustedScore).toBe(7.5);
    expect(result.verdict).toBe('RECOMMEND');
    expect(result.adjustments).toEqual([]);
  });
});

describe('deriveVerdict gates', () => {
  it('situation verdict caps at CONSIDER', () => {
    const result = deriveVerdict({ weightedScore: 9.0, situationVerdict: 'situation' });
    expect(result.verdict).toBe('CONSIDER');
    expect(result.verdictBeforeGates).toBe('FILM_NOW');
  });

  it('situation never raises a PASS', () => {
    expect(deriveVerdict({ weightedScore: 4.0, situationVerdict: 'situation' }).verdict).toBe('PASS');
  });

  it('story verdict applies no gate', () => {
    expect(deriveVerdict({ weightedScore: 9.0, situationVerdict: 'story' }).verdict).toBe('FILM_NOW');
  });

  it('trap score >= 2.0 downgrades one tier', () => {
    expect(deriveVerdict({ weightedScore: 9.0, weightedTrapScore: 2.0 }).verdict).toBe('RECOMMEND');
    expect(deriveVerdict({ weightedScore: 7.6, weightedTrapScore: 2.5 }).verdict).toBe('CONSIDER');
    expect(deriveVerdict({ weightedScore: 4.0, weightedTrapScore: 2.0 }).verdict).toBe('PASS');
  });

  it('trap score >= 3.0 caps at CONSIDER', () => {
    expect(deriveVerdict({ weightedScore: 9.0, weightedTrapScore: 3.0 }).verdict).toBe('CONSIDER');
    expect(deriveVerdict({ weightedScore: 9.0, weightedTrapScore: 3.5 }).verdict).toBe('CONSIDER');
  });

  it('truncation caps at CONSIDER — never promote an unread Act 3', () => {
    const result = deriveVerdict({ weightedScore: 9.0, truncated: true });
    expect(result.verdict).toBe('CONSIDER');
    expect(result.adjustments.some((a) => a.includes('truncated'))).toBe(true);
  });

  it('truncation leaves a PASS alone', () => {
    const result = deriveVerdict({ weightedScore: 4.0, truncated: true });
    expect(result.verdict).toBe('PASS');
    expect(result.adjustments).toEqual([]);
  });
});

describe('deriveVerdict combined', () => {
  it('penalty applies before gates', () => {
    // 8.6 - 0.8 (major) = 7.8 RECOMMEND, then trap 2.0 downgrades → CONSIDER
    const result = deriveVerdict({
      weightedScore: 8.6,
      criticalFailures: failures('major'),
      weightedTrapScore: 2.0,
    });
    expect(result.adjustedScore).toBe(7.8);
    expect(result.verdict).toBe('CONSIDER');
    expect(result.adjustments).toHaveLength(2);
  });
});
