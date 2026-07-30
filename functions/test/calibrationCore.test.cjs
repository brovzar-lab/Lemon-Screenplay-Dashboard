const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildActiveCalibrationProfile,
  buildCalibrationCandidate,
  buildCompilerPrompt,
  buildCompatibilityProjections,
  buildDecisionReplayPrompt,
  buildProducerAssessment,
  calculateCalibrationBenchmark,
  extractProducerAnalysisSnapshot,
  parseCalibrationPolicy,
} = require("../lib/calibrationCore");

const CONTENT_HASH = "ab".repeat(32);
const MANIFEST_HASH = "cd".repeat(32);
const VERSION_ID = `${CONTENT_HASH}_1000`;

function rawVersion() {
  return {
    project_id: "will-2010",
    version_id: VERSION_ID,
    content_hash: CONTENT_HASH,
    identity_status: "verified",
    trust_manifest_version: "lemon-trust-manifest-v4",
    trust_manifest: {
      integrity_sha256: MANIFEST_HASH,
      score_lineage: { final_verdict: "CONSIDER" },
    },
    analysis: {
      title: "WILL 2010",
      weighted_score: 5.2,
      weighted_score_adjusted: 4.7,
      verdict: "PASS",
      genre_classification: { external_genre: "Comedy" },
      pillar_scores: {
        structure: { score: 5.1 },
        character: { score: 4.4 },
        craft_scene: { score: 6.2 },
        concept: { score: 6.5 },
        emotional_resonance: { score: 5.0 },
      },
    },
    calibration_profile: { applied: false },
  };
}

function judgment(overrides = {}) {
  return {
    producerScore: 8.5,
    producerVerdict: "recommend",
    pursuit: "yes",
    fixability: "high",
    confidence: "high",
    tasteSignals: ["comedy", "reading_pleasure", "development_upside"],
    aiMissed: "The comic engine and pleasure of the read outweigh a fixable agency problem.",
    aiGotRight: "The protagonist needs a more active final choice.",
    pillarOverrides: { character: 6.5 },
    includeInCalibration: true,
    ...overrides,
  };
}

function assessment(id = "assessment-1", revision = 1) {
  return buildProducerAssessment({
    producerUid: "billy-uid",
    producerEmail: "billy@lemonfilms.com",
    producerDisplayName: "Billy Rovzar",
    judgment: judgment(),
    analysis: extractProducerAnalysisSnapshot(
      "will-2010",
      VERSION_ID,
      rawVersion(),
    ),
    nowIso: "2026-07-30T12:00:00.000Z",
    assessmentId: id,
    ...(revision > 1
      ? {
          prior: {
            ...assessment("assessment-previous", revision - 1),
            revision: revision - 1,
          },
        }
      : {}),
  });
}

test("producer assessment binds Billy's take to the exact sealed analysis", () => {
  const result = assessment();

  assert.equal(result.analysis.versionId, VERSION_ID);
  assert.equal(result.analysis.trustManifestIntegritySha256, MANIFEST_HASH);
  assert.equal(result.analysis.aiFinalScore, 4.7);
  assert.equal(result.judgment.producerScore, 8.5);
  assert.equal(result.judgment.producerVerdict, "recommend");
});

test("a changed producer take creates a new revision instead of overwriting history", () => {
  const first = assessment();
  const second = buildProducerAssessment({
    producerUid: "billy-uid",
    producerEmail: "billy@lemonfilms.com",
    producerDisplayName: "Billy Rovzar",
    judgment: judgment({ producerScore: 9 }),
    analysis: first.analysis,
    prior: first,
    nowIso: "2026-07-31T12:00:00.000Z",
    assessmentId: "assessment-2",
  });

  assert.equal(second.revision, 2);
  assert.equal(second.supersedesAssessmentId, first.assessmentId);
  assert.equal(first.judgment.producerScore, 8.5);
});

test("canonical assessment produces the legacy Brain and feedback projections", () => {
  const projections = buildCompatibilityProjections(assessment());

  assert.equal(projections.brainVerdict.billyVerdict, "recommend");
  assert.equal(projections.brainVerdict.weightedScore, 4.7);
  assert.equal(projections.feedback.userScore, 8.5);
  assert.equal(
    projections.feedback.dimensionOverrides.character.userScore,
    6.5,
  );
});

test("the candidate compiler sees training judgments while holdout replay stays blind", () => {
  const training = assessment();
  const policy = parseCalibrationPolicy({
    thesis: "Reward durable entertainment value without ignoring execution.",
    principles: ["Separate fixable weaknesses from terminal concept problems."],
    scoring_instructions: ["Do not use a global score offset."],
    development_upside_rules: ["Credit specific, achievable development upside."],
    fixable_weakness_rules: ["Distinguish repairable agency from a broken engine."],
    dealbreakers: ["Do not excuse incoherent causality."],
    genre_cautions: ["Do not generalize from one comedy."],
  });

  const compilerPrompt = buildCompilerPrompt([
    training,
    assessment("a2"),
    assessment("a3"),
    assessment("a4"),
  ]);
  assert.match(compilerPrompt, /8\.5/);
  assert.match(compilerPrompt, /comic engine/);

  const replayPrompt = buildDecisionReplayPrompt(
    policy,
    training,
    rawVersion(),
  );
  assert.doesNotMatch(replayPrompt, /8\.5/);
  assert.doesNotMatch(replayPrompt, /comic engine/);
  assert.doesNotMatch(replayPrompt, /more active final choice/);
});

test("benchmark passes only when it avoids new severe mistakes and does not regress", () => {
  const passed = calculateCalibrationBenchmark([
    {
      assessmentId: "holdout-1",
      projectId: "will-2010",
      versionId: VERSION_ID,
      title: "WILL 2010",
      producerScore: 8.5,
      producerVerdict: "recommend",
      baselineScore: 4.7,
      baselineVerdict: "pass",
      candidateScore: 8.1,
      candidateVerdict: "recommend",
      rationale: "Recognizes the durable comic engine.",
    },
  ]);
  assert.equal(passed.passed, true);
  assert.equal(passed.baselineFalsePasses, 1);
  assert.equal(passed.candidateFalsePasses, 0);
  assert.equal(passed.baselineVerdictAgreement, 0);
  assert.equal(passed.candidateVerdictAgreement, 1);
  assert.deepEqual(passed.reasons, []);

  const failed = calculateCalibrationBenchmark([
    {
      ...passed.replays[0],
      producerScore: 3,
      producerVerdict: "pass",
      baselineScore: 3.2,
      baselineVerdict: "pass",
      candidateScore: 8,
      candidateVerdict: "recommend",
    },
  ]);
  assert.equal(failed.passed, false);
  assert.equal(failed.candidateFalseRecommendations, 1);
});

test("a failed holdout benchmark cannot become the active profile", () => {
  const policy = parseCalibrationPolicy({
    thesis: "Reward durable entertainment value without ignoring execution.",
    principles: ["Separate fixable weaknesses from terminal concept problems."],
    scoring_instructions: ["Do not use a global score offset."],
    development_upside_rules: ["Credit specific, achievable development upside."],
    fixable_weakness_rules: ["Treat passive agency as fixable only when the engine survives."],
    dealbreakers: ["Do not excuse incoherent causality."],
    genre_cautions: ["Do not generalize from one comedy."],
  });
  const candidate = buildCalibrationCandidate({
    policy,
    training: [assessment("a1"), assessment("a2"), assessment("a3"), assessment("a4")],
    benchmark: calculateCalibrationBenchmark([
      {
        assessmentId: "holdout-1",
        projectId: "will-2010",
        versionId: VERSION_ID,
        title: "WILL 2010",
        producerScore: 3,
        producerVerdict: "pass",
        baselineScore: 3.2,
        baselineVerdict: "pass",
        candidateScore: 8,
        candidateVerdict: "recommend",
        rationale: "Incorrectly overcorrected.",
      },
    ]),
    compilerResponseId: "msg-1",
    createdByUid: "billy-uid",
    createdAt: "2026-07-30T12:00:00.000Z",
    candidateId: "candidate-1",
  });

  assert.throws(
    () => buildActiveCalibrationProfile(candidate, {}),
    /failing calibration benchmark/i,
  );
});

test("publication keeps exact candidate provenance and a rollback pointer", () => {
  const policy = parseCalibrationPolicy({
    thesis: "Reward durable entertainment value without ignoring execution.",
    principles: ["Separate fixable weaknesses from terminal concept problems."],
    scoring_instructions: ["Do not use a global score offset."],
    development_upside_rules: ["Credit specific, achievable development upside."],
    fixable_weakness_rules: ["Distinguish repairable agency from a broken engine."],
    dealbreakers: ["Do not excuse incoherent causality."],
    genre_cautions: ["Do not generalize from one comedy."],
  });
  const candidate = buildCalibrationCandidate({
    policy,
    training: [assessment("a1"), assessment("a2"), assessment("a3"), assessment("a4")],
    benchmark: calculateCalibrationBenchmark([
      {
        assessmentId: "holdout-1",
        projectId: "will-2010",
        versionId: VERSION_ID,
        title: "WILL 2010",
        producerScore: 8.5,
        producerVerdict: "recommend",
        baselineScore: 4.7,
        baselineVerdict: "pass",
        candidateScore: 8.1,
        candidateVerdict: "recommend",
        rationale: "Recognizes the durable comic engine.",
      },
    ]),
    compilerResponseId: "msg-1",
    createdByUid: "billy-uid",
    createdAt: "2026-07-30T12:00:00.000Z",
    candidateId: "candidate-2",
  });

  const profile = buildActiveCalibrationProfile(candidate, {
    activeVersionId: "candidate-1",
  });
  assert.equal(profile.activeVersionId, "candidate-2");
  assert.equal(profile.previousVersionId, "candidate-1");
  assert.equal(profile.promptSha256, candidate.promptSha256);
  assert.equal(
    profile.sourceAssessmentSetSha256,
    candidate.sourceAssessmentSetSha256,
  );
  assert.equal(profile.compilerModelId, "claude-opus-4-7");
});
