import { describe, expect, it } from 'vitest';
import { normalizeV9Screenplay } from '@/lib/normalizers/normalizeV9';

describe('V9 Development Opportunity normalization', () => {
  it('preserves structured routing evidence without changing score or verdict', () => {
    const raw = {
      source_file: 'will.pdf',
      project_id: 'will',
      analysis_version: 'v9_archaeology',
      analysis: {
        title: 'WILL',
        verdict: 'PASS',
        weighted_score: 5.2,
        weighted_score_adjusted: 4.7,
        pillar_scores: {
          structure: { score: 4.8, weight: 0.3 },
          character: { score: 4.4, weight: 0.3 },
          craft_scene: { score: 5, weight: 0.15 },
          concept: { score: 6.1, weight: 0.15 },
          emotional_resonance: { score: 6, weight: 0.1 },
        },
        development_opportunity: {
          schema_version: 1,
          level: 'producer_review',
          fixability: 'high',
          evidence_confidence: 'verified',
          strongest_signal: 'high_concept',
          rationale: 'A producer should see this before dismissal.',
          evidence: [
            {
              signal: 'high_concept',
              label: 'High-concept hook',
              score: 8.6,
              detail: 'The life-writer device is immediately pitchable.',
              source: 'structured_v9',
              page_citations: [1, 4],
            },
          ],
          risks: ['Passive protagonist'],
          source: 'structured_v9',
          requires_producer_look: true,
          opportunity_score: 8.6,
        },
      },
    };

    const screenplay = normalizeV9Screenplay(raw, 'LEMON');

    expect(screenplay.weightedScore).toBe(4.7);
    expect(screenplay.recommendation).toBe('pass');
    expect(screenplay.developmentOpportunity).toMatchObject({
      level: 'producer_review',
      fixability: 'high',
      requiresProducerLook: true,
      opportunityScore: 8.6,
    });
    expect(screenplay.developmentOpportunity?.evidence[0].pageCitations).toEqual([1, 4]);
  });
});
