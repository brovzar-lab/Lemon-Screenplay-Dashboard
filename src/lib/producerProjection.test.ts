import { describe, expect, it } from 'vitest';

import { buildProducerProjection, isDecisionReady } from '@/lib/producerProjection';

const sha = 'a'.repeat(64);
function sealedRaw(overrides: Record<string, unknown> = {}) {
  return {
    analysis_version: 'v9_archaeology',
    trust_manifest_version: 'lemon-trust-manifest-v6',
    content_hash: sha,
    source_file: 'Test.pdf',
    project_id: 'Test.pdf',
    version_id: 'version-1',
    _trust_authority: 'immutable_server',
    trust_manifest: {
      manifest_version: 'lemon-trust-manifest-v6',
      integrity_sha256: sha,
      analysis_payload_sha256: sha,
      source: { content_sha256: sha, source_file: 'Test.pdf' },
      origin: { project_id: 'Test.pdf', version_id: 'version-1' },
      engine: { analysis_version: 'v9_archaeology' },
      models: { calls: [{ response_id: 'msg_1' }] },
    },
    server_trust_attestation: {
      attestation_version: 'lemon-server-trust-attestation-v1',
      writer: 'firebase_admin',
      project_id: 'Test.pdf',
      version_id: 'version-1',
      content_sha256: sha,
      trust_manifest_integrity_sha256: sha,
      analysis_payload_sha256: sha,
    },
    ...overrides,
  };
}

describe('buildProducerProjection', () => {
  it('uses the recorded adjusted score as the producer-facing score', () => {
    const result = buildProducerProjection(
      sealedRaw(),
      {
        weighted_score: 5.22,
        weighted_score_adjusted: 4.72,
        critical_failure_penalty_applied: 0.5,
        verdict_before_gates: 'CONSIDER',
        verdict: 'PASS',
        analysis_quality: {
          status: 'complete',
          completed_readers: 5,
          expected_readers: 5,
          failed_readers: [],
        },
      },
    );

    expect(result.projection).toMatchObject({
      rawScore: 5.22,
      finalScore: 4.72,
      penaltyApplied: 0.5,
      scoreSource: 'adjusted',
      finalVerdict: 'pass',
      verdictBeforeGates: 'consider',
      rankable: true,
      trustStatus: 'verified',
    });
  });

  it('does not invent a deduction for a legacy record', () => {
    const result = buildProducerProjection(
      { analysis_version: 'v8_archaeology' },
      {
        weighted_score: 6.8,
        critical_failure_total_penalty: -1.2,
        verdict: 'CONSIDER',
      },
    );

    expect(result.projection.finalScore).toBe(6.8);
    expect(result.projection.penaltyApplied).toBe(0);
    expect(result.projection.reportedPenalty).toBe(1.2);
    expect(result.projection.scoreSource).toBe('legacy_raw');
    expect(result.projection.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['legacy_unverified', 'legacy_raw_score']),
    );
  });

  it('keeps triage and self-declared manifest versions out of rankings', () => {
    for (const raw of [
      { analysis_version: 'v9_triage', trust_manifest_version: 'lemon-trust-manifest-v6' },
      { analysis_version: 'v9_archaeology', trust_manifest_version: 'lemon-trust-manifest-v6' },
    ]) {
      const result = buildProducerProjection(raw, {
        weighted_score: 8.8,
        weighted_score_adjusted: 8.8,
        verdict: 'FILM NOW',
      });
      expect(result.projection.rankable).toBe(false);
      expect(result.projection.trustStatus).toBe('legacy_unverified');
    }
  });

  it('keeps cached or self-declared attestations out of rankings', () => {
    for (const raw of [
      { ...sealedRaw(), _trust_authority: 'local_cache' },
      { ...sealedRaw(), _trust_authority: 'pending_overlay' },
      { ...sealedRaw(), server_trust_attestation: undefined },
    ]) {
      const result = buildProducerProjection(raw, {
        weighted_score: 8.8,
        weighted_score_adjusted: 8.8,
        verdict: 'RECOMMEND',
      });
      expect(result.projection.rankable).toBe(false);
      expect(result.projection.trustStatus).toBe('legacy_unverified');
      expect(result.projection.warnings).toContainEqual(expect.objectContaining({
        code: 'unsealed_current_analysis',
        severity: 'blocking',
      }));
    }
  });

  it('exposes one strict decision-ready predicate', () => {
    expect(isDecisionReady({
      producerProjection: { rankable: true, trustStatus: 'verified' },
    })).toBe(true);
    expect(isDecisionReady({
      producerProjection: { rankable: true, trustStatus: 'legacy_unverified' },
    })).toBe(false);
    expect(isDecisionReady({
      producerProjection: { rankable: false, trustStatus: 'verified' },
    })).toBe(false);
    expect(isDecisionReady({})).toBe(false);
  });

  it('blocks ranking when the specialist reader panel is incomplete', () => {
    const result = buildProducerProjection(
      sealedRaw(),
      {
        weighted_score: 7,
        weighted_score_adjusted: 6.5,
        verdict: 'CONSIDER',
        analysis_quality: {
          status: 'partial',
          completed_readers: 4,
          expected_readers: 5,
          failed_readers: ['craft_scene'],
        },
      },
    );

    expect(result.projection.rankable).toBe(false);
    expect(result.projection.trustStatus).toBe('incomplete');
    expect(result.projection.warnings).toContainEqual(
      expect.objectContaining({
        code: 'incomplete_readers',
        severity: 'blocking',
      }),
    );
  });

  it('blocks ranking when the source was truncated', () => {
    const result = buildProducerProjection(
      sealedRaw(),
      {
        weighted_score: 7,
        weighted_score_adjusted: 7,
        verdict: 'CONSIDER',
        _truncation: { truncated: true },
      },
    );

    expect(result.projection.rankable).toBe(false);
    expect(result.projection.warnings).toContainEqual(
      expect.objectContaining({
        code: 'truncated_source',
        severity: 'blocking',
      }),
    );
  });

  it('warns when boundary reruns do not agree', () => {
    const result = buildProducerProjection(
      sealedRaw(),
      {
        weighted_score: 7,
        weighted_score_adjusted: 6.8,
        verdict: 'CONSIDER',
        _boundary_reruns: {
          triggered: true,
          score_spread: 0.8,
          completed_runs: 3,
          failed_runs: [],
          runs: [
            { adjusted_score: 6.8, verdict: 'CONSIDER' },
            { adjusted_score: 7.2, verdict: 'CONSIDER' },
            { adjusted_score: 7.6, verdict: 'RECOMMEND' },
          ],
        },
      },
    );

    expect(result.projection.boundary.stable).toBe(false);
    expect(result.projection.warnings).toContainEqual(
      expect.objectContaining({
        code: 'unstable_boundary',
        severity: 'warning',
      }),
    );
  });

  it('surfaces recorded reader disagreements', () => {
    const result = buildProducerProjection(
      sealedRaw(),
      {
        weighted_score: 6,
        weighted_score_adjusted: 6,
        verdict: 'CONSIDER',
        reader_disagreements: [
          {
            topic: 'protagonist agency',
            reader_a: 'character',
            reader_b: 'structure',
          },
        ],
      },
    );

    expect(result.projection.readerDisagreementCount).toBe(1);
    expect(result.projection.warnings).toContainEqual(
      expect.objectContaining({
        code: 'reader_disagreement',
        severity: 'warning',
      }),
    );
  });

  it('reads quality from the immutable trust manifest when needed', () => {
    const result = buildProducerProjection(
      sealedRaw({
        trust_manifest: {
          ...sealedRaw().trust_manifest as Record<string, unknown>,
          readers: {
            quality_status: 'complete',
            completed_specialist_readers: 5,
            expected_specialist_readers: 5,
            failed_readers: [],
          },
        },
      }),
      {
        weighted_score: 6,
        weighted_score_adjusted: 6,
        verdict: 'CONSIDER',
      },
    );

    expect(result.analysisQuality).toEqual({
      status: 'complete',
      completedReaders: 5,
      expectedReaders: 5,
      failedReaders: [],
    });
  });

  it('keeps legacy failed-reader evidence blocking and visible', () => {
    const result = buildProducerProjection(
      { analysis_version: 'v8_archaeology' },
      {
        weighted_score: 7.8,
        verdict: 'RECOMMEND',
        failed_readers: ['craft_scene'],
      },
    );

    expect(result.analysisQuality).toEqual({
      status: 'partial',
      completedReaders: 4,
      expectedReaders: 5,
      failedReaders: ['craft_scene'],
    });
    expect(result.projection.rankable).toBe(false);
    expect(result.projection.warnings).toContainEqual(
      expect.objectContaining({ code: 'incomplete_readers' }),
    );
  });

  it('defaults missing legacy reader counts from an explicit partial status', () => {
    const result = buildProducerProjection(
      { analysis_version: 'v8_archaeology' },
      {
        weighted_score: 7.8,
        verdict: 'RECOMMEND',
        analysis_quality: {
          status: 'partial',
          failed_readers: ['emotion'],
        },
      },
    );

    expect(result.analysisQuality).toEqual({
      status: 'partial',
      completedReaders: 4,
      expectedReaders: 5,
      failedReaders: ['emotion'],
    });
    expect(result.projection.rankable).toBe(false);
  });

  it('uses the canonical default instead of an arbitrary declared penalty', () => {
    const result = buildProducerProjection(
      { analysis_version: 'v8_archaeology' },
      {
        weighted_score: 6,
        verdict: 'CONSIDER',
        critical_failures: [
          {
            severity: 'invented',
            penalty: 99,
          },
        ],
      },
    );

    expect(result.projection.reportedPenalty).toBe(0.8);
    expect(result.projection.penaltyApplied).toBe(0);
  });
});
