import type {
  AnalysisQuality,
  BoundaryStabilityProjection,
  ProducerProjectionWarning,
  RecommendationTier,
  VerdictGateProjection,
} from '@/types';

type UnknownRecord = Record<string, unknown>;

const PUBLIC_SHARE_MANIFEST_VERSION = 'lemon-public-share-manifest-v1';
const PUBLIC_SHARE_ATTESTATION_VERSION = 'lemon-public-share-attestation-v1';

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function nonNegative(value: unknown): number | undefined {
  const number = finiteNumber(value);
  return number === undefined ? undefined : Math.abs(number);
}

export function canonicalCriticalFailurePenalty(
  severity: unknown,
): number | undefined {
  const normalized = String(severity || '').toLowerCase();
  const penalties: Record<string, number> = {
    minor: 0.3,
    moderate: 0.5,
    major: 0.8,
    critical: 1.2,
  };
  return penalties[normalized];
}

/** The only analyses that may drive scores, verdicts, rankings, or exports. */
export function isDecisionReady(
  screenplay: { producerProjection?: { rankable?: boolean; trustStatus?: string } },
): boolean {
  return screenplay.producerProjection?.rankable === true
    && screenplay.producerProjection.trustStatus === 'verified';
}

export function isCoverageV1Screenplay(
  screenplay: { producerProjection?: { scoreSource?: string } },
): boolean {
  return screenplay.producerProjection?.scoreSource === 'coverage_unscored';
}

export function decisionReadyScreenplays<T extends {
  producerProjection?: { rankable?: boolean; trustStatus?: string };
}>(screenplays: T[]): T[] {
  return screenplays.filter(isDecisionReady);
}

export function requireDecisionReady(
  screenplays: Array<{ producerProjection?: { rankable?: boolean; trustStatus?: string } }>,
): void {
  if (screenplays.length === 0 || screenplays.some((screenplay) => !isDecisionReady(screenplay))) {
    throw new Error('Only verified, rankable analyses can drive this decision output.');
  }
}

function penaltyFromCriticalFailures(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return Math.round(
    value.reduce((total, failure) => {
      const record = asRecord(failure);
      if (!record) return total + 0.8;
      const canonical = canonicalCriticalFailurePenalty(record.severity);
      return total + (canonical ?? 0.8);
    }, 0) * 100,
  ) / 100;
}

function normalizeTier(value: unknown, score: number): RecommendationTier {
  const normalized = String(value || '').trim().toLowerCase().replaceAll(' ', '_');
  if (normalized === 'film_now' || normalized === 'filmnow') return 'film_now';
  if (normalized === 'recommend') return 'recommend';
  if (normalized === 'consider') return 'consider';
  if (normalized === 'pass') return 'pass';
  if (score >= 8.5) return 'film_now';
  if (score >= 7.5) return 'recommend';
  if (score >= 5.5) return 'consider';
  return 'pass';
}

function humanizeReader(reader: string): string {
  return reader.replaceAll('_', ' ');
}

export function buildIncompleteReaderWarning(
  quality: AnalysisQuality | undefined,
): ProducerProjectionWarning | undefined {
  if (quality?.status !== 'partial') return undefined;
  const missing = quality.failedReaders.map(humanizeReader);
  return {
    code: 'incomplete_readers',
    severity: 'blocking',
    title: 'Incomplete reader panel',
    detail: `${quality.completedReaders} of ${quality.expectedReaders} readers completed${
      missing.length > 0 ? `. Missing: ${missing.join(', ')}` : ''
    }. This analysis should not drive a ranking decision.`,
    params: {
      completed: quality.completedReaders,
      expected: quality.expectedReaders,
      missing: missing.join(', '),
    },
  };
}

function readAnalysisQuality(
  analysis: UnknownRecord,
  raw: UnknownRecord,
): AnalysisQuality | undefined {
  const rawQuality = asRecord(analysis.analysis_quality);
  const trustManifest = asRecord(raw.trust_manifest);
  const trustReaders = asRecord(trustManifest?.readers);
  const source = rawQuality ?? trustReaders;
  if (!source) {
    if (!Object.prototype.hasOwnProperty.call(analysis, 'failed_readers')) {
      return undefined;
    }
    const legacyFailedReaders = Array.isArray(analysis.failed_readers)
      ? analysis.failed_readers.map(String)
      : [];
    return {
      status: legacyFailedReaders.length > 0 ? 'partial' : 'complete',
      completedReaders: Math.max(0, 5 - legacyFailedReaders.length),
      expectedReaders: 5,
      failedReaders: legacyFailedReaders,
    };
  }

  const expected = finiteNumber(
    source.expected_readers ?? source.expected_specialist_readers,
  );
  const completed = finiteNumber(
    source.completed_readers ?? source.completed_specialist_readers,
  );
  const failedReaders = Array.isArray(source.failed_readers)
    ? source.failed_readers.map(String)
    : [];
  const sourceStatus = String(source.status ?? source.quality_status ?? '');
  const hasQualitySignal =
    sourceStatus === 'partial' ||
    sourceStatus === 'complete' ||
    Object.prototype.hasOwnProperty.call(source, 'failed_readers');
  if (
    (expected === undefined || completed === undefined) &&
    !hasQualitySignal
  ) {
    return undefined;
  }

  const expectedReaders = Math.max(0, Math.round(expected ?? 5));
  const completedReaders = Math.max(
    0,
    Math.round(completed ?? expectedReaders - failedReaders.length),
  );
  const partial =
    sourceStatus === 'partial' ||
    failedReaders.length > 0 ||
    completedReaders < expectedReaders;

  return {
    status: partial ? 'partial' : 'complete',
    completedReaders,
    expectedReaders,
    failedReaders,
  };
}

function readBoundary(
  analysis: UnknownRecord,
  finalVerdict: RecommendationTier,
): BoundaryStabilityProjection {
  const rawBoundary = asRecord(analysis._boundary_reruns);
  if (!rawBoundary) {
    return {
      checked: false,
      runCount: 0,
      failedRunCount: 0,
      scoreSpread: 0,
      verdicts: [],
      stable: true,
    };
  }

  const runs = Array.isArray(rawBoundary.runs)
    ? rawBoundary.runs.flatMap((run) => {
        const record = asRecord(run);
        return record ? [record] : [];
      })
    : [];
  const verdicts = runs.map((run) =>
    normalizeTier(run.verdict, finiteNumber(run.adjusted_score) ?? 0),
  );
  const failedRuns = Array.isArray(rawBoundary.failed_runs)
    ? rawBoundary.failed_runs.length
    : 0;
  const scoreSpread = Math.max(0, finiteNumber(rawBoundary.score_spread) ?? 0);
  const checked = rawBoundary.triggered === true;
  const runCount = Math.max(
    runs.length,
    Math.round(finiteNumber(rawBoundary.completed_runs) ?? 0),
  );
  const verdictSet = new Set(verdicts.length > 0 ? verdicts : [finalVerdict]);
  const stable = !checked || (
    failedRuns === 0 &&
    scoreSpread <= 0.5 &&
    verdictSet.size === 1
  );

  return {
    checked,
    runCount,
    failedRunCount: failedRuns,
    scoreSpread,
    verdicts,
    stable,
  };
}

function buildGates(
  analysis: UnknownRecord,
  verdictAdjustments: string[],
): VerdictGateProjection[] {
  const story = asRecord(analysis.story_vs_situation) ?? {};
  const storyVerdict = String(story.verdict || '').toLowerCase();
  const storyTriggered =
    story.gate_applied === true ||
    storyVerdict === 'situation' ||
    storyVerdict === 'borderline';
  const storyApplied =
    story.gate_applied === true ||
    verdictAdjustments.some((adjustment) => adjustment.includes('story_vs_situation'));

  const falsePositive = asRecord(analysis.false_positive_check) ?? {};
  const traps = Array.isArray(falsePositive.traps_evaluated)
    ? falsePositive.traps_evaluated.flatMap((trap) => {
        const record = asRecord(trap);
        return record ? [record] : [];
      })
    : [];
  const triggeredTraps = traps.filter((trap) => trap.triggered === true);
  const weightedTrapScore = Math.max(
    0,
    finiteNumber(falsePositive.weighted_trap_score) ?? 0,
  );
  const trapAdjustment = String(falsePositive.verdict_adjustment || 'none');
  const falsePositiveApplied =
    trapAdjustment !== 'none' ||
    verdictAdjustments.some((adjustment) => adjustment.includes('trap score'));

  const truncation = asRecord(analysis._truncation) ?? {};
  const context = asRecord(analysis._context_policy) ?? {};
  const sourceTruncated =
    truncation.truncated === true ||
    context.source_truncated === true;
  const truncationApplied = verdictAdjustments.some(
    (adjustment) => adjustment.includes('truncated script'),
  );

  return [
    {
      key: 'story_vs_situation',
      label: 'Story versus situation',
      triggered: storyTriggered,
      applied: storyApplied,
      detail: storyTriggered
        ? `${storyVerdict || 'flagged'} (${String(story.score ?? 'no score')}/5)${
            storyApplied ? ', verdict cap applied' : ', no verdict change'
          }`
        : 'Story gate cleared',
    },
    {
      key: 'false_positive',
      label: 'False-positive traps',
      triggered: triggeredTraps.length > 0 || weightedTrapScore > 0,
      applied: falsePositiveApplied,
      detail: triggeredTraps.length > 0 || weightedTrapScore > 0
        ? `${triggeredTraps.length} trap${triggeredTraps.length === 1 ? '' : 's'} triggered, weighted score ${weightedTrapScore.toFixed(1)}${
            falsePositiveApplied ? ', verdict adjustment applied' : ', no verdict change'
          }`
        : 'No weighted traps triggered',
    },
    {
      key: 'truncation',
      label: 'Complete screenplay evidence',
      triggered: sourceTruncated,
      applied: truncationApplied,
      detail: sourceTruncated
        ? `Source was truncated${truncationApplied ? ', verdict cap applied' : ''}`
        : 'Full screenplay reached the evaluation',
    },
  ];
}

/**
 * Convert a stored analysis into the one score and warning contract every
 * producer-facing surface uses. This function never invents an adjusted score
 * for legacy documents that did not record one.
 */
export function buildProducerProjection(
  raw: UnknownRecord,
  analysis: UnknownRecord,
) {
  const rawScore = finiteNumber(analysis.weighted_score)
    ?? finiteNumber(analysis.triage_score)
    ?? 0;
  const adjustedScore = finiteNumber(analysis.weighted_score_adjusted);
  const isTriage = String(raw.analysis_version || '').endsWith('_triage');
  const finalScore = adjustedScore ?? rawScore;
  const scoreSource = adjustedScore !== undefined
    ? 'adjusted' as const
    : isTriage
      ? 'triage' as const
      : 'legacy_raw' as const;

  const explicitPenalty = nonNegative(analysis.critical_failure_penalty_applied);
  const derivedPenalty = adjustedScore !== undefined
    ? Math.max(0, Math.round((rawScore - adjustedScore) * 100) / 100)
    : undefined;
  const reportedPenalty =
    nonNegative(analysis.critical_failure_total_penalty) ??
    explicitPenalty ??
    derivedPenalty ??
    penaltyFromCriticalFailures(analysis.critical_failures);
  const penaltyApplied = explicitPenalty ?? derivedPenalty ?? 0;

  const finalVerdict = normalizeTier(analysis.verdict, finalScore);
  const beforeGateValue =
    analysis.verdict_before_gates ?? analysis.verdict_before_adjustments;
  const verdictBeforeGates = beforeGateValue
    ? normalizeTier(beforeGateValue, rawScore)
    : undefined;
  const verdictAdjustments = Array.isArray(analysis.verdict_adjustments)
    ? analysis.verdict_adjustments.map(String)
    : [];
  const gates = buildGates(analysis, verdictAdjustments);
  const boundary = readBoundary(analysis, finalVerdict);
  const analysisQuality = readAnalysisQuality(analysis, raw);
  const readerDisagreementCount = Array.isArray(analysis.reader_disagreements)
    ? analysis.reader_disagreements.length
    : 0;

  const warnings: ProducerProjectionWarning[] = [];
  const incomplete =
    analysisQuality?.status === 'partial' ||
    Boolean(
      analysisQuality &&
      analysisQuality.completedReaders < analysisQuality.expectedReaders,
    );
  const incompleteWarning = buildIncompleteReaderWarning(analysisQuality);
  if (incompleteWarning) warnings.push(incompleteWarning);

  const sourceTruncated = gates.find((gate) => gate.key === 'truncation')?.triggered === true;
  if (sourceTruncated) {
    warnings.push({
      code: 'truncated_source',
      severity: 'blocking',
      title: 'Screenplay evidence is incomplete',
      detail: 'The saved analysis says part of the screenplay was not read. Treat its score and verdict as unfit for ranking.',
      params: {},
    });
  }

  if (boundary.checked && !boundary.stable) {
    warnings.push({
      code: 'unstable_boundary',
      severity: 'warning',
      title: 'Verdict stability warning',
      detail: `${boundary.runCount} scoring runs varied by ${boundary.scoreSpread.toFixed(2)} points${
        boundary.failedRunCount > 0 ? `, with ${boundary.failedRunCount} failed run${boundary.failedRunCount === 1 ? '' : 's'}` : ''
      }. Review the underlying evidence before advancing or passing.`,
      params: {
        runs: boundary.runCount,
        spread: boundary.scoreSpread.toFixed(2),
        failed: boundary.failedRunCount,
      },
    });
  }

  if (readerDisagreementCount > 0) {
    warnings.push({
      code: 'reader_disagreement',
      severity: 'warning',
      title: 'Specialist readers disagreed',
      detail: `${readerDisagreementCount} material disagreement${readerDisagreementCount === 1 ? '' : 's'} were recorded and should be reviewed in the reader evidence.`,
      params: { count: readerDisagreementCount },
    });
  }

  const trustManifest = asRecord(raw.trust_manifest);
  const trustManifestVersion = String(
    raw.trust_manifest_version ?? trustManifest?.manifest_version ?? '',
  ).trim() || undefined;
  if (!trustManifestVersion) {
    warnings.push({
      code: 'legacy_unverified',
      severity: 'information',
      title: 'Legacy analysis',
      detail: 'This record predates the immutable trust manifest. Its history and model lineage cannot be verified to the current standard.',
      params: {},
    });
  }
  if (scoreSource === 'legacy_raw') {
    warnings.push({
      code: 'legacy_raw_score',
      severity: 'information',
      title: 'No recorded adjusted score',
      detail: 'The app is showing the stored raw score because this older analysis did not preserve a separate final adjusted score.',
      params: {},
    });
  }

  const source = asRecord(trustManifest?.source);
  const origin = asRecord(trustManifest?.origin);
  const engine = asRecord(trustManifest?.engine);
  const models = asRecord(trustManifest?.models);
  const attestation = asRecord(raw.server_trust_attestation);
  const versionId = raw.latest_version_id ?? raw.version_id;
  const currentServerSealedAnalysis = raw.analysis_version === 'v9_archaeology'
    && raw._trust_authority === 'immutable_server'
    && trustManifestVersion === 'lemon-trust-manifest-v6'
    && trustManifest?.manifest_version === trustManifestVersion
    && /^[a-f0-9]{64}$/.test(String(trustManifest.integrity_sha256 ?? ''))
    && /^[a-f0-9]{64}$/.test(String(trustManifest.analysis_payload_sha256 ?? ''))
    && source?.content_sha256 === raw.content_hash
    && source?.source_file === (raw.latest_source_file ?? raw.source_file)
    && origin?.project_id === raw.project_id
    && origin?.version_id === (raw.latest_version_id ?? raw.version_id)
    && engine?.analysis_version === raw.analysis_version
    && Array.isArray(models?.calls)
    && models.calls.length > 0
    && attestation?.attestation_version === 'lemon-server-trust-attestation-v1'
    && attestation.writer === 'firebase_admin'
    && attestation.project_id === raw.project_id
    && attestation.version_id === versionId
    && attestation.content_sha256 === raw.content_hash
    && attestation.trust_manifest_integrity_sha256
      === trustManifest.integrity_sha256
    && attestation.analysis_payload_sha256
      === trustManifest.analysis_payload_sha256;
  const claims = asRecord(trustManifest?.claim_verification);
  const readers = asRecord(trustManifest?.readers);
  const scoreLineage = asRecord(trustManifest?.score_lineage);
  const currentPublicSharedAnalysis = raw.analysis_version === 'v9_archaeology'
    && raw._trust_authority === 'immutable_public_share'
    && trustManifestVersion === PUBLIC_SHARE_MANIFEST_VERSION
    && trustManifest?.manifest_version === trustManifestVersion
    && /^[a-f0-9]{64}$/.test(String(trustManifest.integrity_sha256 ?? ''))
    && /^[a-f0-9]{64}$/.test(String(
      trustManifest.canonical_manifest_integrity_sha256 ?? '',
    ))
    && /^[a-f0-9]{64}$/.test(String(
      trustManifest.canonical_analysis_payload_sha256 ?? '',
    ))
    && /^[a-f0-9]{64}$/.test(String(trustManifest.analysis_payload_sha256 ?? ''))
    && trustManifest.public_payload_scope === 'analysis_and_localized_analysis'
    && source?.content_sha256 === raw.content_hash
    && source?.source_file === (raw.latest_source_file ?? raw.source_file)
    && origin?.project_id === raw.project_id
    && origin?.version_id === versionId
    && engine?.analysis_version === raw.analysis_version
    && typeof models?.call_count === 'number'
    && models.call_count > 0
    && /^[a-f0-9]{64}$/.test(String(models.provenance_sha256 ?? ''))
    && readers?.quality_status === 'complete'
    && readers.expected_specialist_readers === 5
    && readers.completed_specialist_readers === 5
    && readers.failed_reader_count === 0
    && claims?.status === 'passed_independent_model_review'
    && claims.verification_scope
      === 'semantic_support_against_full_physical_page_source'
    && typeof claims.claim_count === 'number'
    && claims.claim_count >= 10
    && typeof claims.factual_support_rate === 'number'
    && claims.factual_support_rate >= 0.95
    && /^[a-f0-9]{64}$/.test(String(claims.claims_sha256 ?? ''))
    && scoreLineage?.adjusted_score === finalScore
    && normalizeTier(scoreLineage.final_verdict, finalScore) === finalVerdict
    && attestation?.attestation_version === PUBLIC_SHARE_ATTESTATION_VERSION
    && attestation.writer === 'share_manager'
    && attestation.project_id === raw.project_id
    && attestation.version_id === versionId
    && attestation.content_sha256 === raw.content_hash
    && attestation.canonical_trust_manifest_integrity_sha256
      === trustManifest.canonical_manifest_integrity_sha256
    && attestation.canonical_analysis_payload_sha256
      === trustManifest.canonical_analysis_payload_sha256
    && attestation.trust_manifest_integrity_sha256
      === trustManifest.integrity_sha256
    && attestation.analysis_payload_sha256
      === trustManifest.analysis_payload_sha256
    && attestation.public_payload_scope === trustManifest.public_payload_scope;
  const currentSealedAnalysis = currentServerSealedAnalysis || currentPublicSharedAnalysis;
  if (raw.analysis_version === 'v9_archaeology' && !currentSealedAnalysis) {
    warnings.push({
      code: 'unsealed_current_analysis',
      severity: 'blocking',
      title: 'Current analysis is not server-verified',
      detail: 'This V9 result was not reconstructed from its immutable server version. Its score and verdict must not drive a decision.',
      params: {},
    });
  }
  const rankable = !incomplete && !sourceTruncated && currentSealedAnalysis;
  const trustStatus = incomplete || sourceTruncated
    ? 'incomplete' as const
    : currentSealedAnalysis
      ? 'verified' as const
      : 'legacy_unverified' as const;

  return {
    analysisQuality,
    projection: {
      rawScore,
      finalScore,
      scoreSource,
      penaltyApplied,
      reportedPenalty,
      finalVerdict,
      verdictBeforeGates,
      verdictAdjustments,
      gates,
      warnings,
      rankable,
      trustStatus,
      trustManifestVersion,
      boundary,
      readerDisagreementCount,
    },
  };
}
