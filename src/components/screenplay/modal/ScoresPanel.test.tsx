import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createTestScreenplay } from '@/test/factories';
import { ScoresPanel } from '@/components/screenplay/modal/ScoresPanel';

describe('ScoresPanel producer projection', () => {
  it('shows the real V9 pillars and transparent adjusted-score lineage', () => {
    const screenplay = createTestScreenplay({
      analysisVersion: 'v9_archaeology',
      weightedScore: 6.9,
      pillarScores: [
        { name: 'structure', score: 7.2, weight: 0.2 },
        { name: 'character', score: 7.4, weight: 0.2 },
        { name: 'craft_scene', score: 6.8, weight: 0.2 },
        { name: 'concept', score: 7.8, weight: 0.2 },
        { name: 'emotional_resonance', score: 7.1, weight: 0.2 },
      ],
      producerProjection: {
        rawScore: 7.2,
        finalScore: 6.9,
        scoreSource: 'adjusted',
        penaltyApplied: 0.3,
        reportedPenalty: 0.5,
        finalVerdict: 'consider',
        verdictBeforeGates: 'recommend',
        verdictAdjustments: ['critical_failure_penalty: -0.3'],
        gates: [
          {
            key: 'story_vs_situation',
            label: 'Story versus situation',
            triggered: true,
            applied: true,
            detail: 'borderline, verdict cap applied',
          },
        ],
        warnings: [],
        rankable: true,
        trustStatus: 'verified',
        trustManifestVersion: 'lemon-trust-manifest-v3',
        boundary: {
          checked: false,
          runCount: 0,
          failedRunCount: 0,
          scoreSpread: 0,
          verdicts: [],
          stable: true,
        },
        readerDisagreementCount: 0,
      },
    });

    render(<ScoresPanel screenplay={screenplay} />);

    expect(screen.getByText('Five-Pillar Reader Evidence')).toBeInTheDocument();
    expect(screen.getAllByText(/Craft & Scene/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Supporting Cast/)).not.toBeInTheDocument();

    const lineage = screen.getByTestId('score-lineage');
    expect(within(lineage).getByText('7.20')).toBeInTheDocument();
    expect(within(lineage).getByText('−0.30')).toBeInTheDocument();
    expect(
      within(lineage).getByText('Critical-failure issues reported'),
    ).toBeInTheDocument();
    expect(within(lineage).getByText('0.50')).toBeInTheDocument();
    expect(within(lineage).getByText('6.90')).toBeInTheDocument();
    expect(screen.getByText('Final adjusted score')).toBeInTheDocument();
    expect(screen.getByText('Story versus situation')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('labels pre-V9 dimensions as legacy', () => {
    render(<ScoresPanel screenplay={createTestScreenplay()} />);

    expect(screen.getByText('Legacy Dimension Scores')).toBeInTheDocument();
    expect(screen.getByText('Stored score')).toBeInTheDocument();
  });

  it('labels a triage score without claiming five-reader scoring', () => {
    const screenplay = createTestScreenplay({
      analysisVersion: 'v9_triage',
      weightedScore: 6.2,
      producerProjection: {
        rawScore: 6.2,
        finalScore: 6.2,
        scoreSource: 'triage',
        penaltyApplied: 0,
        reportedPenalty: 0,
        finalVerdict: 'consider',
        verdictAdjustments: [],
        gates: [],
        warnings: [],
        rankable: true,
        trustStatus: 'legacy_unverified',
        boundary: {
          checked: false,
          runCount: 0,
          failedRunCount: 0,
          scoreSpread: 0,
          verdicts: [],
          stable: true,
        },
        readerDisagreementCount: 0,
      },
    });

    render(<ScoresPanel screenplay={screenplay} />);

    expect(screen.getByText('Triage score')).toBeInTheDocument();
    expect(screen.getByText('Raw triage score')).toBeInTheDocument();
    expect(screen.queryByText('Raw five-pillar score')).not.toBeInTheDocument();
  });
});
