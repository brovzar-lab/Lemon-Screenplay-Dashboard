import { describe, expect, it } from 'vitest';
import {
  evaluateDevelopmentOpportunity,
  selectProducerLookCandidates,
} from '@/lib/developmentOpportunity';
import { createTestScreenplay } from '@/test/factories';
import type { ProducerAssessmentHead } from '@/types';

function producerTake(projectId: string, producerScore = 7.6): ProducerAssessmentHead {
  return {
    producerUid: 'billy',
    projectId,
    latestAssessmentId: `${projectId}-take`,
    revision: 1,
    versionId: 'v1',
    title: projectId,
    aiFinalScore: 4.7,
    aiVerdict: 'pass',
    producerScore,
    producerVerdict: 'recommend',
    pursuit: 'yes',
    includeInCalibration: true,
    updatedAt: '2026-08-06T18:00:00.000Z',
  };
}

describe('Development Opportunity gate', () => {
  it('routes WILL for a Producer Look without changing its Pass or 4.7 score', () => {
    const will = createTestScreenplay({
      id: 'will',
      projectId: 'will',
      latestVersionId: 'v1',
      title: 'WILL',
      weightedScore: 4.7,
      recommendation: 'pass',
      dimensionScores: {
        concept: 6.1,
        structure: 4.8,
        protagonist: 4.4,
        supportingCast: 4.2,
        dialogue: 5.5,
        genreExecution: 6.1,
        originality: 5.0,
        weightedScore: 4.7,
      },
      commercialViability: {
        targetAudience: { score: 2, note: 'Clear adult comedy audience.' },
        highConcept: { score: 3, note: 'A genuinely pitchable high-concept hook.' },
        castAttachability: { score: 2, note: 'Two strong comic roles.' },
        marketingHook: { score: 3, note: 'The life-writer engine is easy to market.' },
        budgetReturnRatio: { score: 2, note: 'Contained fantasy comedy.' },
        comparableSuccess: { score: 2, note: 'Strong comedy comps.' },
        cvsTotal: 14,
        cvsAssessed: true,
      },
      strengths: [
        'Genuinely pitchable high-concept hook.',
        'Original genre engine with a distinctive comic voice.',
      ],
      weaknesses: [
        'The protagonist remains passive until the final act.',
        'The inciting incident arrives late.',
      ],
      developmentNotes: ['Give Will an active choice earlier and tighten the first act.'],
    });

    const opportunity = evaluateDevelopmentOpportunity(will);

    expect(opportunity.requiresProducerLook).toBe(true);
    expect(opportunity.level).toBe('producer_review');
    expect(opportunity.fixability).toMatch(/high|medium/);
    expect(opportunity.evidence.map((item) => item.signal)).toEqual(
      expect.arrayContaining(['high_concept', 'originality']),
    );
    expect(will.weightedScore).toBe(4.7);
    expect(will.recommendation).toBe('pass');
  });

  it('does not promote generic praise or a fundamentally weak premise', () => {
    const ordinaryPass = createTestScreenplay({
      id: 'ordinary',
      projectId: 'ordinary',
      weightedScore: 4.9,
      recommendation: 'pass',
      dimensionScores: {
        concept: 4.2,
        structure: 5,
        protagonist: 5,
        supportingCast: 5,
        dialogue: 5,
        genreExecution: 4.2,
        originality: 5,
        weightedScore: 4.9,
      },
      strengths: ['Some good moments and capable formatting.'],
      weaknesses: ['The premise is derivative and has no repeatable engine.'],
      developmentNotes: ['Reconsider the central premise.'],
      commercialViability: {
        targetAudience: { score: 1, note: '' },
        highConcept: { score: 1, note: 'Hard to pitch.' },
        castAttachability: { score: 1, note: '' },
        marketingHook: { score: 1, note: 'No clear hook.' },
        budgetReturnRatio: { score: 1, note: '' },
        comparableSuccess: { score: 1, note: '' },
        cvsTotal: 6,
        cvsAssessed: true,
      },
    });

    expect(evaluateDevelopmentOpportunity(ordinaryPass).requiresProducerLook).toBe(false);
  });

  it('treats a strong Producer Take as explicit routing evidence, not a rescore', () => {
    const screenplay = createTestScreenplay({
      id: 'will',
      projectId: 'will',
      latestVersionId: 'v1',
      weightedScore: 4.7,
      recommendation: 'pass',
      strengths: [],
      commercialViability: {
        ...createTestScreenplay().commercialViability,
        cvsAssessed: false,
      },
    });

    const opportunity = evaluateDevelopmentOpportunity(screenplay, producerTake('will'));

    expect(opportunity.requiresProducerLook).toBe(true);
    expect(opportunity.source).toBe('producer_take');
    expect(opportunity.evidenceConfidence).toBe('producer_override');
    expect(screenplay.weightedScore).toBe(4.7);
    expect(screenplay.recommendation).toBe('pass');
  });

  it('caps the intake alert to three ranked Producer Look projects', () => {
    const screenplays = Array.from({ length: 7 }, (_, index) =>
      createTestScreenplay({
        id: `project-${index}`,
        projectId: `project-${index}`,
        latestVersionId: 'v1',
        weightedScore: 4 + index / 10,
        recommendation: 'pass',
      }),
    );
    const assessments = new Map(
      screenplays.map((screenplay, index) => [
        screenplay.projectId!,
        producerTake(screenplay.projectId!, 8.5 - index / 10),
      ]),
    );

    const candidates = selectProducerLookCandidates(screenplays, assessments);

    expect(candidates).toHaveLength(3);
    expect(candidates.map(({ screenplay }) => screenplay.id)).toEqual([
      'project-0',
      'project-1',
      'project-2',
    ]);
  });
});
