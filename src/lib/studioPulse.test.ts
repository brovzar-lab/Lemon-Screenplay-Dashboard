import { describe, expect, it } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { buildStudioPulse, STUDIO_PULSE_MARKET_SNAPSHOT } from '@/lib/studioPulse';

describe('buildStudioPulse', () => {
  it('keeps live Lemon status separate from the dated market snapshot', () => {
    const screenplays = [
      createTestScreenplay({
        id: 'thriller',
        analysisVersion: 'V9 Archaeology',
        analysisQuality: { status: 'complete', completedReaders: 5, expectedReaders: 5, failedReaders: [] },
        recommendation: 'recommend',
        genre: 'Thriller',
      }),
      createTestScreenplay({
        id: 'comedy',
        analysisVersion: 'V9 Archaeology',
        analysisQuality: { status: 'partial', completedReaders: 4, expectedReaders: 5, failedReaders: ['emotion'] },
        recommendation: 'consider',
        genre: 'Comedy',
      }),
      createTestScreenplay({
        id: 'pass',
        analysisVersion: 'V9 Archaeology',
        analysisQuality: { status: 'complete', completedReaders: 5, expectedReaders: 5, failedReaders: [] },
        recommendation: 'pass',
        genre: 'Drama',
      }),
    ];
    const mexico = STUDIO_PULSE_MARKET_SNAPSHOT.territories[0];

    const pulse = buildStudioPulse(screenplays, mexico);

    expect(pulse).toMatchObject({
      activeProjects: 3,
      v9Complete: 2,
      v9CompletePercent: 67,
      readyForReview: 1,
      needsAttention: 1,
    });
    expect(STUDIO_PULSE_MARKET_SNAPSHOT).toMatchObject({
      asOf: '2026-08-19',
      status: 'research_snapshot',
    });
    expect(pulse.demandFits.find(({ id }) => id === 'elevated-action-thriller')?.fitCount).toBe(1);
    expect(pulse.demandFits.find(({ id }) => id === 'true-crime')?.fitCount).toBe(0);
  });
});
