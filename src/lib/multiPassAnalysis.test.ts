/**
 * Tests for code-side verdict derivation (deriveVerdict / computeFailurePenalty).
 * Mirrors execution/test_verdict.py — the two implementations must agree.
 */

import { describe, it, expect } from 'vitest';
import {
  computeFailurePenalty,
  computeWeightedScoreFromSynthesis,
  deriveVerdict,
  QualityStageExhaustedError,
  ReaderPanelIncompleteError,
  requireCompleteReaderPanel,
  runQualityStageWithRecovery,
  UnusableQualityOutputError,
  validateBrowserSynthesis,
} from './multiPassAnalysis';

describe('Q3 five-reader reliability', () => {
  it('retries only the failed quality stage and returns the recovered result', async () => {
    let attempt = 0;
    const result = await runQualityStageWithRecovery(
      'character reader',
      async () => {
        attempt += 1;
        if (attempt === 1) {
          throw new UnusableQualityOutputError(
            'malformed report',
            { input_tokens: 100, output_tokens: 20 },
          );
        }
        return {
          value: 'complete',
          usage: { input_tokens: 110, output_tokens: 25 },
        };
      },
      { delay: async () => undefined },
    );

    expect(result.value).toBe('complete');
    expect(result.attempts).toBe(2);
    expect(result.failures).toEqual(['malformed report']);
    expect(result.usage).toEqual({ input_tokens: 210, output_tokens: 45 });
  });

  it('fails closed after three unusable results', async () => {
    const run = runQualityStageWithRecovery(
      'concept reader',
      async () => {
        throw new UnusableQualityOutputError(
          'missing structured report',
          { input_tokens: 10, output_tokens: 1 },
        );
      },
      { delay: async () => undefined },
    );

    await expect(run).rejects.toMatchObject({
      name: 'QualityStageExhaustedError',
      stage: 'concept reader',
      attempts: 3,
      failures: [
        'missing structured report',
        'missing structured report',
        'missing structured report',
      ],
      usage: { input_tokens: 30, output_tokens: 3 },
    } satisfies Partial<QualityStageExhaustedError>);
  });

  it('does not repeat a transport, authentication, or budget error', async () => {
    let attempts = 0;
    const run = runQualityStageWithRecovery(
      'structure reader',
      async () => {
        attempts += 1;
        throw new Error('Rate limited');
      },
      { delay: async () => undefined },
    );

    await expect(run).rejects.toThrow('Rate limited');
    expect(attempts).toBe(1);
  });

  it('does not allow synthesis from fewer than all five canonical readers', () => {
    const run = () => requireCompleteReaderPanel(
      [
        'structure',
        'character',
        'craft_scene',
        'concept',
      ],
      {
        emotional_resonance: {
          attempts: 3,
          failures: ['missing structured report'],
        },
      },
      { input_tokens: 300, output_tokens: 60 },
    );

    expect(run).toThrow(/5\/5 readers/i);
    try {
      run();
    } catch (error) {
      expect(error).toMatchObject({
        name: 'ReaderPanelIncompleteError',
        completedReaders: [
          'structure',
          'character',
          'craft_scene',
          'concept',
        ],
        failedReaders: ['emotional_resonance'],
        usage: { input_tokens: 300, output_tokens: 60 },
      } satisfies Partial<ReaderPanelIncompleteError>);
    }

    expect(() => requireCompleteReaderPanel([
      'structure',
      'character',
      'craft_scene',
      'concept',
      'emotional_resonance',
    ])).not.toThrow();
  });

  it('requires the critical-failure and story gate inputs before synthesis', () => {
    const synthesis = {
      analysis_version: 'v9_archaeology',
      pillar_scores: {
        structure: { score: 8 },
        character: { score: 7 },
        craft_scene: { score: 7 },
        concept: { score: 8 },
        emotional_resonance: { score: 7 },
      },
      weighted_score: 7.45,
      verdict: 'CONSIDER',
      verdict_before_adjustments: 'CONSIDER',
      critical_failures: [],
      story_vs_situation: { verdict: 'story' },
      false_positive_check: { weighted_trap_score: 0 },
    };

    expect(() => validateBrowserSynthesis(synthesis)).not.toThrow();
    expect(() => validateBrowserSynthesis({
      ...synthesis,
      critical_failures: undefined,
    })).toThrow(/critical failures/i);
    expect(() => validateBrowserSynthesis({
      ...synthesis,
      story_vs_situation: { verdict: 'unknown' },
    })).toThrow(/story-vs-situation verdict/i);
  });
});

describe('complete-panel score integrity', () => {
  it('computes the canonical score only across all five readers', () => {
    const synthesis = {
      pillar_scores: {
        structure: { score: 8 },
        character: { score: 6 },
        craft_scene: { score: 7 },
        concept: { score: 9 },
        emotional_resonance: { score: 5 },
      },
    };

    expect(computeWeightedScoreFromSynthesis(synthesis)).toBe(7.1);
  });

  it('rejects missing reader scores instead of reweighting a partial panel', () => {
    expect(() => computeWeightedScoreFromSynthesis({
      pillar_scores: {
        structure: { score: 8 },
        character: { score: 6 },
        craft_scene: { score: 7 },
        concept: { score: 9 },
      },
    })).toThrow(/emotional_resonance/);
  });
});

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
