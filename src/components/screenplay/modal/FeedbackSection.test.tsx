import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FeedbackSection } from '@/components/screenplay/modal/FeedbackSection';
import { createTestScreenplay } from '@/test/factories';

vi.mock('@/lib/feedbackStore', () => ({
  loadFeedback: vi.fn().mockResolvedValue({
    userScore: 7.4,
    userVerdict: 'consider',
    dimensionOverrides: {
      supportingCast: { aiScore: 6.1, userScore: 7.3 },
      dialogue: { aiScore: 6.4, userScore: 7.1 },
    },
    aiMissed: '',
    aiGotRight: '',
    greenlight: 'maybe',
  }),
  saveFeedback: vi.fn().mockResolvedValue(undefined),
}));

describe('FeedbackSection legacy override compatibility', () => {
  it('preserves and labels pre-Q4 dimension feedback beside current pillars', async () => {
    const screenplay = createTestScreenplay({
      id: 'project-with-history',
      analysisVersion: 'v9_archaeology',
      pillarScores: [
        { name: 'structure', score: 7.2, weight: 0.3 },
        { name: 'character', score: 7.1, weight: 0.3 },
        { name: 'craft_scene', score: 6.8, weight: 0.15 },
        { name: 'concept', score: 7.6, weight: 0.15 },
        { name: 'emotional_resonance', score: 7.4, weight: 0.1 },
      ],
    });

    render(<FeedbackSection screenplay={screenplay} />);

    expect(
      await screen.findByText('Previously Saved Legacy Dimension Overrides'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Supporting Cast legacy override'),
    ).toHaveValue('7.3');
    expect(screen.getByLabelText('Dialogue legacy override')).toHaveValue('7.1');
    expect(screen.getByText('Five-Pillar Score Overrides')).toBeInTheDocument();
  });
});
