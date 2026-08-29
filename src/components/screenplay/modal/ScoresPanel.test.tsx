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

  it('keeps pre-V9 dimension evidence visible without presenting a decision score', () => {
    render(<ScoresPanel screenplay={createTestScreenplay({ producerProjection: undefined })} />);

    expect(screen.getAllByText('Decision data unavailable until verification').length).toBeGreaterThan(0);
    expect(screen.getByText('Concept (20%)')).toBeInTheDocument();
    expect(screen.queryByText('Legacy Dimension Scores')).not.toBeInTheDocument();
    expect(screen.queryByText('Stored score')).not.toBeInTheDocument();
    expect(screen.queryByTestId('score-lineage')).not.toBeInTheDocument();
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
        rankable: false,
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

    expect(screen.getAllByText('Decision data unavailable until verification').length).toBeGreaterThan(0);
    expect(screen.queryByText('Triage score')).not.toBeInTheDocument();
    expect(screen.queryByText('Raw triage score')).not.toBeInTheDocument();
    expect(screen.queryByText('Raw five-pillar score')).not.toBeInTheDocument();
    expect(screen.queryByTestId('score-lineage')).not.toBeInTheDocument();
  });

  it('turns workspace scores into a decision-focused Development Signal Map', () => {
    const screenplay = createTestScreenplay({
      analysisVersion: 'v9_archaeology',
      weightedScore: 6.9,
      strengths: ['The concept has an immediate theatrical hook.'],
      weaknesses: ['The protagonist delays the final irreversible choice.'],
      pillarScores: [
        { name: 'structure', score: 6.2, weight: 0.2 },
        { name: 'character', score: 5.8, weight: 0.2 },
        { name: 'craft_scene', score: 7.1, weight: 0.2 },
        { name: 'concept', score: 8.4, weight: 0.2 },
        { name: 'emotional_resonance', score: 7.6, weight: 0.2 },
      ],
      analysisQuality: {
        status: 'complete',
        completedReaders: 5,
        expectedReaders: 5,
        failedReaders: [],
      },
      producerProjection: {
        rawScore: 7.0,
        finalScore: 6.9,
        scoreSource: 'adjusted',
        penaltyApplied: 0.1,
        reportedPenalty: 0.1,
        finalVerdict: 'consider',
        verdictAdjustments: [],
        gates: [],
        warnings: [],
        rankable: true,
        trustStatus: 'verified',
        trustManifestVersion: 'lemon-trust-manifest-v4',
        boundary: {
          checked: true,
          runCount: 3,
          failedRunCount: 0,
          scoreSpread: 0.2,
          verdicts: ['consider', 'consider', 'consider'],
          stable: true,
        },
        readerDisagreementCount: 1,
      },
    });

    render(<ScoresPanel screenplay={screenplay} presentation="workspace" />);

    expect(screen.getByRole('heading', { name: 'Development Signal Map' })).toBeInTheDocument();
    expect(screen.getByText('Verified evidence')).toBeInTheDocument();
    expect(screen.getByText('5 of 5 readers')).toBeInTheDocument();
    expect(screen.getByText('Stable boundary')).toBeInTheDocument();
    expect(screen.getByText('1 disagreement')).toBeInTheDocument();
    expect(screen.getByText('Strongest signal')).toBeInTheDocument();
    expect(screen.getByText(/Concept · 8.4/)).toBeInTheDocument();
    expect(screen.getByText('Primary development risk')).toBeInTheDocument();
    expect(screen.getByText(/Character · 5.8/)).toBeInTheDocument();
    expect(screen.getByText('The concept has an immediate theatrical hook.')).toBeInTheDocument();
    expect(screen.getByText('The protagonist delays the final irreversible choice.')).toBeInTheDocument();
  });
});
