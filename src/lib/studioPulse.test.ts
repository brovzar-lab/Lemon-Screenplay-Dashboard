import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifestData from '@/data/studio-pulse-market-snapshot.manifest.json';
import snapshotData from '@/data/studio-pulse-market-snapshot.json';
import { createTestScreenplay } from '@/test/factories';
import type { ProducerProjection, Screenplay } from '@/types';
import {
  buildPortfolioOpportunity,
  getSlateQueryState,
  INTELLIGENCE_BRIEFING_RESULT,
  matchesOpportunity,
  parseIntelligenceSnapshot,
  validatePublicationIntegrity,
  validateIntelligenceSnapshot,
  weakestEvidenceDimensions,
  type IntelligenceBriefingSnapshot,
  type MatchRule,
} from '@/lib/studioPulse';

function fixture(): IntelligenceBriefingSnapshot {
  return structuredClone(snapshotData) as IntelligenceBriefingSnapshot;
}

function projection(overrides: Partial<ProducerProjection> = {}): ProducerProjection {
  return {
    rawScore: 7.8,
    finalScore: 7.6,
    scoreSource: 'adjusted',
    penaltyApplied: 0.2,
    reportedPenalty: 0.2,
    finalVerdict: 'consider',
    verdictAdjustments: [],
    gates: [],
    warnings: [],
    rankable: true,
    trustStatus: 'verified',
    boundary: {
      checked: true,
      runCount: 1,
      failedRunCount: 0,
      scoreSpread: 0,
      verdicts: ['consider'],
      stable: true,
    },
    readerDisagreementCount: 0,
    ...overrides,
  };
}

describe('Intelligence Briefing V2 contract', () => {
  it('accepts the reviewed public-safe V2 artifact', () => {
    expect(INTELLIGENCE_BRIEFING_RESULT).toMatchObject({
      code: 'valid',
      snapshotId: 'lemon-intelligence-2026-08-19',
    });
    expect(validateIntelligenceSnapshot(fixture()).schemaVersion).toBe(2);
  });

  it('rejects unknown keys at nested object boundaries and future schema versions', () => {
    const unknown = fixture();
    (unknown.sources[0] as unknown as Record<string, unknown>).secretField = 'not allowed';
    expect(parseIntelligenceSnapshot(unknown).code).toBe('unknown_field');

    const upgraded = fixture() as unknown as { schemaVersion: number };
    upgraded.schemaVersion = 3;
    expect(parseIntelligenceSnapshot(upgraded).code).toBe('schema_version');
  });

  it.each([
    'http://example.com/source',
    'https://user:password@example.com/source',
    'https://localhost/source',
    'https://127.0.0.1/source',
    'https://192.168.1.4/source',
    'https://bit.ly/source',
    'https://www.bit.ly/source',
    'https://www.reddit.com/user/synthetic-handle',
    'https://x.com/synthetic_handle',
  ])('rejects unsafe source URL %s', (url) => {
    const value = fixture();
    value.sources[0].url = url;
    expect(parseIntelligenceSnapshot(value).code).toBe('invalid_url');
  });

  it('rejects invalid geography and bilingual gaps', () => {
    const geography = fixture();
    geography.claims[0].countryCodes = ['XX'];
    expect(parseIntelligenceSnapshot(geography).code).toBe('invalid_geography');

    const global = fixture();
    global.claims.find(({ scope }) => scope === 'global')!.countryCodes = ['MX'];
    expect(parseIntelligenceSnapshot(global).code).toBe('invalid_geography');

    for (const nonIsoCode of ['EU', 'UN', 'AC', 'QO']) {
      const nonIso = fixture();
      nonIso.claims[0].countryCodes = [nonIsoCode];
      expect(parseIntelligenceSnapshot(nonIso).code).toBe('invalid_geography');
    }

    const localization = fixture();
    localization.actions[0].title['es-MX'] = '';
    expect(parseIntelligenceSnapshot(localization).code).toBe('invalid_localization');

    const sourceFamily = fixture();
    sourceFamily.zeitgeistStories[0].sourceFamilies[0]['es-MX'] = '';
    expect(parseIntelligenceSnapshot(sourceFamily).code).toBe('invalid_localization');
  });

  it('rejects future evidence, broken references, and invalid timing intervals', () => {
    const future = fixture();
    future.sources[0].publishedAt = '2026-08-20';
    expect(parseIntelligenceSnapshot(future).code).toBe('invalid_date');

    const reference = fixture();
    reference.claims[0].sourceIds = ['missing-source'];
    expect(parseIntelligenceSnapshot(reference).code).toBe('invalid_reference');

    const timing = fixture();
    timing.opportunities[0].timingBand = ['immediate', 'active'];
    expect(parseIntelligenceSnapshot(timing).code).toBe('invalid_timing');

    const impossibleDate = fixture();
    impossibleDate.snapshot.asOf = '2026-02-31';
    expect(parseIntelligenceSnapshot(impossibleDate).code).toBe('invalid_date');

    const futureConnector = fixture();
    futureConnector.connectors[0].lastChecked = '2026-08-26';
    expect(parseIntelligenceSnapshot(futureConnector).code).toBe('invalid_date');
  });

  it('requires available conversation stories to pair correctly typed conversation and context claims', () => {
    const missingContext = fixture();
    const conversationClaim = missingContext.claims.find(({ id }) => id === 'claim-global-netflix-spend')!;
    conversationClaim.kind = 'conversation';
    missingContext.zeitgeistStories[0].state = 'available';
    missingContext.zeitgeistStories[0].signalClass = 'conversation';
    missingContext.zeitgeistStories[0].conversationClaimIds = [conversationClaim.id];
    missingContext.zeitgeistStories[0].contextClaimIds = [];
    expect(parseIntelligenceSnapshot(missingContext).code).toBe('invalid_evidence');

    missingContext.zeitgeistStories[0].contextClaimIds = ['claim-mexico-incentive'];
    expect(parseIntelligenceSnapshot(missingContext).code).toBe('valid');

    const mistypedContext = fixture();
    mistypedContext.zeitgeistStories[0].contextClaimIds = ['claim-mentiras-outcome'];
    expect(parseIntelligenceSnapshot(mistypedContext).code).toBe('invalid_evidence');
  });

  it('forces stale decision-critical evidence down to watch or insufficient', () => {
    const stale = fixture();
    stale.sources.find(({ id }) => id === 'MX-AMZN-001')!.expiresAt = '2026-01-01';
    expect(parseIntelligenceSnapshot(stale).code).toBe('invalid_action');

    stale.actions[0].action = 'watch';
    stale.opportunities[0].action = 'watch';
    stale.evidenceHealth.freshness.status = 'weak';
    expect(parseIntelligenceSnapshot(stale).code).toBe('valid');
  });

  it('requires the qualifying evidence kind itself to be current for a strong action', () => {
    const staleBuyer = fixture();
    staleBuyer.claims.find(({ id }) => id === 'claim-amazon-local-priorities')!.decisionCritical = false;
    staleBuyer.sources.find(({ id }) => id === 'MX-AMZN-001')!.expiresAt = '2026-01-01';
    staleBuyer.actions[0].supportClaimIds = ['claim-amazon-local-priorities', 'claim-mexico-incentive'];

    expect(parseIntelligenceSnapshot(staleBuyer).code).toBe('invalid_action');
  });

  it('applies action evidence restrictions to portfolio opportunities', () => {
    const conversationOnly = fixture();
    conversationOnly.claims.find(({ id }) => id === 'claim-netflix-mexico-investment')!.kind = 'conversation';
    conversationOnly.opportunities[0].claimIds = ['claim-netflix-mexico-investment'];

    expect(parseIntelligenceSnapshot(conversationOnly).code).toBe('invalid_action');
  });

  it('rejects evidence-health labels that do not match the deterministic dimensions', () => {
    const value = fixture();
    value.evidenceHealth.coverage.status = 'good';
    expect(parseIntelligenceSnapshot(value).code).toBe('invalid_evidence');
  });

  it('deduplicates critical source independence by source group, not by claim count', () => {
    expect(fixture().evidenceHealth.independence.status).toBe('good');
    expect(parseIntelligenceSnapshot(fixture()).code).toBe('valid');

    const value = fixture();
    value.claims.forEach((claim) => { claim.decisionCritical = false; });
    const claim = value.claims.find(({ id }) => id === 'claim-netflix-mexico-investment')!;
    claim.decisionCritical = true;
    const duplicate = structuredClone(value.sources.find(({ id }) => id === 'MX-NFLX-001')!);
    duplicate.id = 'MX-NFLX-001-DUPLICATE';
    value.sources.push(duplicate);
    claim.sourceIds.push(duplicate.id);
    value.evidenceHealth.independence.status = 'caution';

    expect(parseIntelligenceSnapshot(value).code).toBe('valid');
  });

  it('allows zero to three ranked actions and never ranks insufficient evidence', () => {
    const none = fixture();
    none.actions = [];
    expect(parseIntelligenceSnapshot(none).code).toBe('valid');

    const three = fixture();
    three.actions.push({ ...structuredClone(three.actions[1]), id: 'third-action', rank: 3 });
    expect(parseIntelligenceSnapshot(three).code).toBe('valid');

    const four = fixture();
    four.actions.push(
      { ...structuredClone(four.actions[1]), id: 'third-action', rank: 3 },
      { ...structuredClone(four.actions[1]), id: 'fourth-action', rank: 4 },
    );
    expect(parseIntelligenceSnapshot(four).code).toBe('invalid_action');

    const insufficient = fixture();
    insufficient.actions.at(-1)!.rank = 3;
    expect(parseIntelligenceSnapshot(insufficient).code).toBe('invalid_action');
  });

  it('limits conversation-only evidence to watch and requires two alternative explanations', () => {
    const conversation = fixture();
    conversation.claims[0].kind = 'conversation';
    conversation.actions[0].supportClaimIds = [conversation.claims[0].id];
    expect(parseIntelligenceSnapshot(conversation).code).toBe('invalid_action');

    const alternatives = fixture();
    alternatives.zeitgeistStories[0].alternativeExplanations = alternatives.zeitgeistStories[0].alternativeExplanations.slice(0, 1);
    expect(parseIntelligenceSnapshot(alternatives).code).toBe('invalid_evidence');
  });

  it('returns a stable validation code instead of throwing', () => {
    expect(() => parseIntelligenceSnapshot(null)).not.toThrow();
    expect(parseIntelligenceSnapshot(null)).toEqual({ code: 'invalid_object', snapshotId: undefined });
  });
});

describe('publication integrity manifest', () => {
  const snapshotPath = 'src/data/studio-pulse-market-snapshot.json';
  const evidencePath = 'public/research/studio-pulse-market-snapshot-2026-08-19.md';
  const artifacts = {
    [snapshotPath]: readFileSync(resolve(process.cwd(), snapshotPath)),
    [evidencePath]: readFileSync(resolve(process.cwd(), evidencePath)),
  };

  it('accepts exact bytes and rejects a one-byte change to either artifact', async () => {
    await expect(validatePublicationIntegrity(manifestData, artifacts)).resolves.toEqual({ code: 'valid' });
    await expect(validatePublicationIntegrity(manifestData, {
      ...artifacts,
      [snapshotPath]: Buffer.concat([artifacts[snapshotPath], Buffer.from(' ')]),
    })).resolves.toEqual({ code: 'manifest_mismatch' });
    await expect(validatePublicationIntegrity(manifestData, {
      ...artifacts,
      [evidencePath]: Buffer.concat([artifacts[evidencePath], Buffer.from(' ')]),
    })).resolves.toEqual({ code: 'manifest_mismatch' });
  });

  it('rejects invalid snapshot data even when its manifest hash matches', async () => {
    const invalidSnapshot = Buffer.from('{"schemaVersion":2}');
    const matchingManifest = structuredClone(manifestData);
    matchingManifest.artifacts.find(({ path }) => path === snapshotPath)!.sha256 = createHash('sha256')
      .update(invalidSnapshot)
      .digest('hex');

    await expect(validatePublicationIntegrity(matchingManifest, {
      ...artifacts,
      [snapshotPath]: invalidSnapshot,
    })).resolves.toEqual({ code: 'invalid_manifest' });
  });
});

describe('authorized local portfolio join', () => {
  const wordBoundaryRule: MatchRule = {
    all: [],
    any: [{ fields: ['genre', 'themes', 'logline'], terms: ['action', 'acción', 'policía'] }],
  };

  it('normalizes case and accents while preserving word boundaries', () => {
    expect(matchesOpportunity(createTestScreenplay({ genre: 'ACCIÓN' }), wordBoundaryRule)).toBe(true);
    expect(matchesOpportunity(createTestScreenplay({ themes: ['Policia corrupta'] }), wordBoundaryRule)).toBe(true);
    expect(matchesOpportunity(createTestScreenplay({ genre: 'Transaction drama' }), wordBoundaryRule)).toBe(false);
  });

  it('uses only verified producer scores, excludes verified PASS, and never falls back', () => {
    const verified = createTestScreenplay({
      id: 'verified',
      title: 'Synthetic Romance',
      genre: 'Romántico',
      weightedScore: 9.9,
      producerProjection: projection({ finalScore: 7.6 }),
    });
    const unverified = createTestScreenplay({
      id: 'unverified',
      title: 'Synthetic Legacy',
      genre: 'Romance',
      weightedScore: 9.8,
      producerProjection: projection({ rankable: false, trustStatus: 'legacy_unverified' }),
    });
    const pass = createTestScreenplay({
      id: 'pass',
      title: 'Synthetic Pass',
      genre: 'Romance',
      producerProjection: projection({ finalVerdict: 'pass' }),
    });

    const result = buildPortfolioOpportunity([verified, unverified, pass], fixture().opportunities);

    expect(result.matches).toEqual([
      expect.objectContaining({ id: 'verified', creativeScore: 7.6, rankable: true }),
    ]);
    expect(result.unrankable).toEqual([
      expect.objectContaining({ id: 'unverified', creativeScore: null, finalVerdict: null }),
    ]);
    expect([...result.matches, ...result.unmatched, ...result.unrankable]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'pass' })]),
    );
  });

  it.each([
    [undefined, true, null, 'loading'],
    [undefined, false, { code: 'permission-denied' }, 'authorization_error'],
    [undefined, false, new Error('network'), 'error'],
    [[], false, null, 'empty'],
    [[createTestScreenplay()] as Screenplay[], false, null, 'ready'],
  ] as const)('keeps slate state %s distinct', (screenplays, loading, error, expected) => {
    expect(getSlateQueryState(screenplays, loading, error)).toBe(expected);
  });

  it('returns every evidence dimension tied for weakest', () => {
    expect(weakestEvidenceDimensions(fixture().evidenceHealth)).toEqual(['coverage', 'knowledgeLimits']);
  });
});
