import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FEATURED_POLICY,
  selectFeaturedProject,
} from '@/lib/featuredProject';
import { createTestScreenplay } from '@/test/factories';
import type {
  DevelopmentOpportunity,
  FeaturedEngagement,
  FeaturedPolicy,
  Screenplay,
} from '@/types';

function project(
  id: string,
  score: number,
  overrides: Partial<Screenplay> = {},
): Screenplay {
  const base = createTestScreenplay({
    id,
    projectId: `${id}-project`,
    title: id,
    sourceFile: `${id}.pdf`,
    weightedScore: score,
    recommendation: 'consider',
    analysisQuality: {
      status: 'complete',
      completedReaders: 5,
      expectedReaders: 5,
      failedReaders: [],
    },
  });

  return {
    ...base,
    ...overrides,
    dimensionScores: {
      ...base.dimensionScores,
      weightedScore: score,
      ...overrides.dimensionScores,
    },
    producerMetrics: {
      ...base.producerMetrics,
      ...overrides.producerMetrics,
    },
    commercialViability: {
      ...base.commercialViability,
      ...overrides.commercialViability,
    },
    metadata: {
      ...base.metadata,
      ...overrides.metadata,
    },
  };
}

function opportunity(
  opportunityScore: number,
  fixability: DevelopmentOpportunity['fixability'] = 'medium',
): DevelopmentOpportunity {
  return {
    schemaVersion: 1,
    level: 'producer_review',
    fixability,
    evidenceConfidence: 'verified',
    strongestSignal: 'high_concept',
    rationale: 'A strong hook with addressable development work.',
    evidence: [],
    risks: [],
    source: 'structured_v9',
    requiresProducerLook: true,
    opportunityScore,
  };
}

function policy(overrides: Partial<FeaturedPolicy> = {}): FeaturedPolicy {
  return { ...DEFAULT_FEATURED_POLICY, ...overrides };
}

describe('Featured project selection', () => {
  it('honors a valid manual pin and safely explains an unavailable pin fallback', () => {
    const alpha = project('Alpha', 7.1);
    const bravo = project('Bravo', 8.6);

    const pinned = selectFeaturedProject(
      [alpha, bravo],
      policy({ pinnedProjectId: alpha.projectId ?? alpha.id }),
      { now: new Date('2026-08-09T12:00:00') },
    );
    expect(pinned.screenplay?.id).toBe('Alpha');
    expect(pinned.reason.code).toBe('manual_pin');

    const fallback = selectFeaturedProject(
      [alpha, bravo],
      policy({ pinnedProjectId: 'missing-project' }),
      { now: new Date('2026-08-09T12:00:00') },
    );
    expect(fallback.screenplay?.id).toBe('Bravo');
    expect(fallback.reason.code).toBe('invalid_pin_fallback');
    expect(fallback.reason.invalidPin).toBe(true);
  });

  it('enforces production, analysis, record-type, and verdict eligibility', () => {
    const eligible = project('Eligible', 6.8);
    const produced = project('Produced', 9.8, {
      tmdbStatus: { isProduced: true, matchConfidence: 'exact' },
    });
    const incomplete = project('Incomplete', 9.7, {
      analysisQuality: {
        status: 'partial',
        completedReaders: 4,
        expectedReaders: 5,
        failedReaders: ['craft_scene'],
      },
    });
    const report = project('Coverage Report', 9.6, {
      sourceFile: 'Coverage Report.pdf',
    });
    const ordinaryPass = project('Ordinary Pass', 9.5, { recommendation: 'pass' });
    const producerLookPass = project('Producer Look Pass', 9.9, {
      recommendation: 'pass',
      developmentOpportunity: opportunity(8.5, 'high'),
    });

    const result = selectFeaturedProject(
      [eligible, produced, incomplete, report, ordinaryPass, producerLookPass],
      policy(),
    );

    expect(result.screenplay?.id).toBe('Producer Look Pass');
    expect(result.screenplay?.recommendation).toBe('pass');
  });

  it('applies a studio mandate and discloses a no-match fallback', () => {
    const horror = project('Horror', 7.2, { genre: 'Horror' });
    const comedy = project('Comedy', 8.5, { genre: 'Comedy' });

    const matched = selectFeaturedProject(
      [horror, comedy],
      policy({ mandateGenres: ['Horror'] }),
    );
    expect(matched.screenplay?.id).toBe('Horror');
    expect(matched.reason.mandateFallback).toBe(false);

    const fallback = selectFeaturedProject(
      [horror, comedy],
      policy({ mandateGenres: ['Western'] }),
    );
    expect(fallback.screenplay?.id).toBe('Comedy');
    expect(fallback.reason.code).toBe('mandate_fallback');
    expect(fallback.reason.detail).toMatch(/No current mandate match/i);
  });

  it('resurfaces an unopened qualifying project before a recently opened one', () => {
    const dusty = project('Dusty', 7.1);
    const recent = project('Recent', 9.1);
    const engagements = new Map<string, FeaturedEngagement>([
      [
        recent.projectId ?? recent.id,
        {
          schemaVersion: 1,
          projectId: recent.projectId ?? recent.id,
          lastOpenedAt: '2026-08-05T12:00:00.000Z',
          openedByUid: 'producer',
          openedByRole: 'admin',
          openCount: 3,
        },
      ],
    ]);

    const result = selectFeaturedProject(
      [recent, dusty],
      policy({ dustEnabled: true, dustDays: 30, dustMinimumScore: 6.5 }),
      { engagements, now: new Date('2026-08-09T12:00:00') },
    );

    expect(result.screenplay?.id).toBe('Dusty');
    expect(result.reason.code).toBe('dust_resurfacing');
  });

  it.each([
    ['highest_overall', 'Score Lead'],
    ['strongest_structure', 'Structure Lead'],
    ['most_commercial', 'Commercial Lead'],
    ['fastest_read', 'Fast Read'],
    ['development_opportunity', 'Opportunity Lead'],
  ] as const)('supports the %s priority mode', (priorityMode, expectedId) => {
    const screenplays = [
      project('Score Lead', 9.1, {
        dimensionScores: { ...createTestScreenplay().dimensionScores, structure: 6.2 },
        producerMetrics: { ...createTestScreenplay().producerMetrics, marketPotential: 5 },
        metadata: { filename: 'score.pdf', pageCount: 110, wordCount: 20_000 },
        developmentOpportunity: opportunity(2),
      }),
      project('Structure Lead', 7.5, {
        dimensionScores: { ...createTestScreenplay().dimensionScores, structure: 9.7 },
        producerMetrics: { ...createTestScreenplay().producerMetrics, marketPotential: 4 },
        metadata: { filename: 'structure.pdf', pageCount: 105, wordCount: 19_000 },
        developmentOpportunity: opportunity(3),
      }),
      project('Commercial Lead', 7.4, {
        producerMetrics: { ...createTestScreenplay().producerMetrics, marketPotential: 10 },
        commercialViability: {
          ...createTestScreenplay().commercialViability,
          cvsAssessed: true,
          cvsTotal: 17,
        },
        cvsTotal: 17,
        metadata: { filename: 'commercial.pdf', pageCount: 101, wordCount: 18_000 },
        developmentOpportunity: opportunity(4),
      }),
      project('Fast Read', 7.2, {
        metadata: { filename: 'fast.pdf', pageCount: 82, wordCount: 14_000 },
        developmentOpportunity: opportunity(5),
      }),
      project('Opportunity Lead', 6.9, {
        metadata: { filename: 'opportunity.pdf', pageCount: 99, wordCount: 17_000 },
        developmentOpportunity: opportunity(9.8, 'high'),
      }),
    ];

    const result = selectFeaturedProject(
      screenplays,
      policy({ priorityMode, fastestReadMinimumScore: 6.5 }),
    );
    expect(result.screenplay?.id).toBe(expectedId);
  });

  it('handles absent commercial and page metrics without hiding a valid project', () => {
    const missing = project('Missing Metrics', 8.2, {
      producerMetrics: { ...createTestScreenplay().producerMetrics, marketPotential: undefined },
      commercialViability: {
        ...createTestScreenplay().commercialViability,
        cvsAssessed: false,
      },
      metadata: { filename: 'missing.pdf', pageCount: 0, wordCount: 0 },
    });

    expect(
      selectFeaturedProject([missing], policy({ priorityMode: 'most_commercial' })).screenplay?.id,
    ).toBe('Missing Metrics');
    expect(
      selectFeaturedProject([missing], policy({ priorityMode: 'fastest_read' })).screenplay?.id,
    ).toBe('Missing Metrics');
  });

  it('is deterministic within a local day and uses title then project ID for ties', () => {
    const zulu = project('Zulu', 8);
    const alphaB = project('Alpha B', 8, { title: 'Alpha' });
    const alphaA = project('Alpha A', 8, { title: 'Alpha' });
    const now = new Date('2026-08-09T23:30:00');

    const first = selectFeaturedProject([zulu, alphaB, alphaA], policy(), { now });
    const second = selectFeaturedProject([alphaA, zulu, alphaB], policy(), { now });

    expect(first.screenplay?.id).toBe('Alpha A');
    expect(second.screenplay?.id).toBe('Alpha A');
    expect(first.reason.selectedForDate).toBe('2026-08-09');
    expect(second.reason).toEqual(first.reason);
  });
});
