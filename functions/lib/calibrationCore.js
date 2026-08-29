"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DECISION_REPLAY_TOOL = exports.CALIBRATION_POLICY_TOOL = exports.CALIBRATION_COMPILER_MODEL = exports.CALIBRATION_PROFILE_SCHEMA_VERSION = exports.PRODUCER_ASSESSMENT_SCHEMA_VERSION = void 0;
exports.validateProducerJudgment = validateProducerJudgment;
exports.extractProducerAnalysisSnapshot = extractProducerAnalysisSnapshot;
exports.buildProducerAssessment = buildProducerAssessment;
exports.assessmentHeadId = assessmentHeadId;
exports.buildAssessmentHead = buildAssessmentHead;
exports.buildCompatibilityProjections = buildCompatibilityProjections;
exports.assessmentSetSha256 = assessmentSetSha256;
exports.parseCalibrationPolicy = parseCalibrationPolicy;
exports.renderCalibrationPrompt = renderCalibrationPrompt;
exports.buildCompilerPrompt = buildCompilerPrompt;
exports.buildDecisionReplayPrompt = buildDecisionReplayPrompt;
exports.parseDecisionReplay = parseDecisionReplay;
exports.calculateCalibrationBenchmark = calculateCalibrationBenchmark;
exports.confidenceForAssessmentCount = confidenceForAssessmentCount;
exports.buildCalibrationCandidate = buildCalibrationCandidate;
exports.buildActiveCalibrationProfile = buildActiveCalibrationProfile;
const node_crypto_1 = require("node:crypto");
const analysisVersionAuthority_1 = require("./analysisVersionAuthority");
exports.PRODUCER_ASSESSMENT_SCHEMA_VERSION = "lemon-producer-assessment-v1";
exports.CALIBRATION_PROFILE_SCHEMA_VERSION = "lemon-calibration-profile-v1";
exports.CALIBRATION_COMPILER_MODEL = "claude-opus-4-7";
const VERDICTS = ["pass", "consider", "recommend", "film_now"];
const PURSUITS = ["no", "maybe", "yes"];
const FIXABILITY = ["low", "medium", "high", "not_applicable"];
const CONFIDENCE = ["low", "medium", "high"];
const TASTE_SIGNALS = [
    "reading_pleasure",
    "comedy",
    "voice",
    "emotional_impact",
    "actor_appeal",
    "commercial_instinct",
    "originality",
    "cultural_specificity",
    "development_upside",
    "character_agency",
    "genre_delivery",
];
const PILLARS = [
    "structure",
    "character",
    "craft_scene",
    "concept",
    "emotional_resonance",
];
const TRUST_MANIFEST_VERSION = "lemon-trust-manifest-v6";
const SERVER_TRUST_ATTESTATION_VERSION = "lemon-server-trust-attestation-v1";
function asRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function text(value, max = 5_000) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function finiteScore(value, label) {
    if (typeof value !== "number"
        || !Number.isFinite(value)
        || value < 1
        || value > 10) {
        throw new Error(`${label} must be between 1 and 10.`);
    }
    return Math.round(value * 10) / 10;
}
function finiteAnalysisScore(value, label) {
    if (typeof value !== "number"
        || !Number.isFinite(value)
        || value < 1
        || value > 10) {
        throw new Error(`${label} must be between 1 and 10.`);
    }
    return value;
}
function enumValue(value, allowed, label) {
    if (typeof value !== "string" || !allowed.includes(value)) {
        throw new Error(`${label} is invalid.`);
    }
    return value;
}
function documentId(value, label) {
    const normalized = text(value, 500);
    if (!normalized || normalized.includes("/")) {
        throw new Error(`${label} is not a valid document ID.`);
    }
    return normalized;
}
function validateProducerJudgment(raw) {
    const judgment = asRecord(raw);
    const aiMissed = text(judgment.aiMissed);
    const aiGotRight = text(judgment.aiGotRight);
    if (!aiMissed && !aiGotRight) {
        throw new Error("Add one short note about what the analysis missed or got right.");
    }
    const tasteSignals = Array.isArray(judgment.tasteSignals)
        ? [...new Set(judgment.tasteSignals.map((item) => enumValue(item, TASTE_SIGNALS, "Taste signal")))].slice(0, TASTE_SIGNALS.length)
        : [];
    const rawOverrides = asRecord(judgment.pillarOverrides);
    const pillarOverrides = {};
    for (const pillar of PILLARS) {
        if (rawOverrides[pillar] !== undefined) {
            pillarOverrides[pillar] = finiteScore(rawOverrides[pillar], `${pillar} override`);
        }
    }
    return {
        producerScore: finiteScore(judgment.producerScore, "Producer score"),
        producerVerdict: enumValue(judgment.producerVerdict, VERDICTS, "Producer verdict"),
        pursuit: enumValue(judgment.pursuit, PURSUITS, "Pursuit decision"),
        fixability: enumValue(judgment.fixability, FIXABILITY, "Fixability"),
        confidence: enumValue(judgment.confidence, CONFIDENCE, "Producer confidence"),
        tasteSignals,
        aiMissed,
        aiGotRight,
        pillarOverrides,
        includeInCalibration: judgment.includeInCalibration === true,
    };
}
function sha256(value) {
    return (0, node_crypto_1.createHash)("sha256").update(value, "utf8").digest("hex");
}
function stableJson(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableJson).join(",")}]`;
    }
    if (value !== null && typeof value === "object") {
        const record = value;
        return `{${Object.keys(record)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
            .join(",")}}`;
    }
    return JSON.stringify(value);
}
function normalizeVerdict(value) {
    const normalized = text(value).toLowerCase().replaceAll(" ", "_");
    return enumValue(normalized, VERDICTS, "AI verdict");
}
function extractProducerAnalysisSnapshot(projectIdValue, versionIdValue, rawVersion, rawAuthority) {
    const projectId = documentId(projectIdValue, "Project");
    const versionId = documentId(versionIdValue, "Analysis version");
    const version = asRecord(rawVersion);
    (0, analysisVersionAuthority_1.validateAnalysisVersionAuthority)(projectId, versionId, version, rawAuthority);
    if (version.project_id !== projectId || version.version_id !== versionId) {
        throw new Error("The stored analysis identity does not match the request.");
    }
    if (version.identity_status !== "verified") {
        throw new Error("Producer calibration requires a verified analysis.");
    }
    if (version.analysis_version !== "v9_archaeology"
        || version.trust_manifest_version !== TRUST_MANIFEST_VERSION) {
        throw new Error("Producer calibration requires a current sealed V9 analysis.");
    }
    const contentHash = text(version.content_hash, 64);
    if (!/^[a-f0-9]{64}$/.test(contentHash)) {
        throw new Error("Producer calibration requires a verified content hash.");
    }
    const manifest = asRecord(version.trust_manifest);
    if (manifest.manifest_version !== TRUST_MANIFEST_VERSION) {
        throw new Error("Producer calibration requires a V6 trust manifest.");
    }
    const integrity = text(manifest.integrity_sha256, 64);
    if (!/^[a-f0-9]{64}$/.test(integrity)) {
        throw new Error("Producer calibration requires a sealed trust manifest.");
    }
    const analysis = asRecord(version.analysis);
    const analysisHash = text(manifest.analysis_payload_sha256, 64);
    const attestation = asRecord(version.server_trust_attestation);
    if (!/^[a-f0-9]{64}$/.test(analysisHash)
        || attestation.attestation_version !== SERVER_TRUST_ATTESTATION_VERSION
        || attestation.writer !== "firebase_admin"
        || attestation.project_id !== projectId
        || attestation.version_id !== versionId
        || attestation.content_sha256 !== contentHash
        || attestation.trust_manifest_integrity_sha256 !== integrity
        || attestation.analysis_payload_sha256 !== analysisHash) {
        throw new Error("Producer calibration requires an Admin-attested analysis version.");
    }
    const source = asRecord(manifest.source);
    const origin = asRecord(manifest.origin);
    const engine = asRecord(manifest.engine);
    if (source.content_sha256 !== contentHash
        || origin.project_id !== projectId
        || origin.version_id !== versionId
        || engine.analysis_version !== "v9_archaeology") {
        throw new Error("Producer calibration trust lineage does not match the analysis.");
    }
    const readerNames = [...PILLARS].sort();
    const readers = asRecord(manifest.readers);
    const quality = asRecord(analysis.analysis_quality);
    const reports = asRecord(analysis.reader_reports);
    const manifestReportNames = Array.isArray(readers.report_names)
        ? readers.report_names.map(String).sort()
        : [];
    if (readers.quality_status !== "complete"
        || readers.expected_specialist_readers !== PILLARS.length
        || readers.completed_specialist_readers !== PILLARS.length
        || !Array.isArray(readers.failed_readers)
        || readers.failed_readers.length !== 0
        || JSON.stringify(manifestReportNames) !== JSON.stringify(readerNames)
        || quality.status !== "complete"
        || quality.expected_readers !== PILLARS.length
        || quality.completed_readers !== PILLARS.length
        || !Array.isArray(quality.failed_readers)
        || quality.failed_readers.length !== 0
        || JSON.stringify(Object.keys(reports).sort()) !== JSON.stringify(readerNames)) {
        throw new Error("Producer calibration requires all five validated specialist readers.");
    }
    const claimVerification = asRecord(manifest.claim_verification);
    if (claimVerification.status !== "passed_independent_model_review"
        || claimVerification.verification_scope
            !== "semantic_support_against_full_physical_page_source"
        || typeof claimVerification.claim_count !== "number"
        || claimVerification.claim_count < 10
        || typeof claimVerification.factual_support_rate !== "number"
        || claimVerification.factual_support_rate < 0.95
        || !Array.isArray(claimVerification.response_ids)
        || claimVerification.response_ids.length === 0
        || !/^[a-f0-9]{64}$/.test(text(claimVerification.claims_sha256, 64))) {
        throw new Error("Producer calibration requires passed independent claim verification.");
    }
    const modelCalls = asRecord(manifest.models).calls;
    if (!Array.isArray(modelCalls) || modelCalls.length === 0) {
        throw new Error("Producer calibration requires complete model provenance.");
    }
    const metadata = asRecord(version.metadata);
    const rawPillars = asRecord(analysis.pillar_scores);
    const pillarScores = PILLARS.map((name) => {
        const raw = asRecord(rawPillars[name]);
        const score = finiteAnalysisScore(raw.score, `${name} score`);
        return { name, score, weight: 0.2 };
    });
    const rawScore = finiteAnalysisScore(analysis.weighted_score, "Raw reader score");
    const finalScore = finiteAnalysisScore(analysis.weighted_score_adjusted ?? analysis.weighted_score, "Final score");
    const scoreLineage = asRecord(manifest.score_lineage);
    if (scoreLineage.adjusted_score !== finalScore
        || normalizeVerdict(scoreLineage.final_verdict)
            !== normalizeVerdict(analysis.verdict)) {
        throw new Error("Producer calibration score lineage does not match the analysis.");
    }
    const calibration = asRecord(version.calibration_profile);
    return {
        projectId,
        versionId,
        contentHash,
        trustManifestVersion: text(version.trust_manifest_version, 100),
        trustManifestIntegritySha256: integrity,
        title: text(analysis.title ?? metadata.title ?? version.source_file, 500),
        genre: text(asRecord(analysis.genre_classification).external_genre
            ?? analysis.genre
            ?? "Unspecified", 200),
        aiFinalScore: finalScore,
        aiRawScore: rawScore,
        aiVerdict: normalizeVerdict(analysis.verdict
            ?? asRecord(manifest.score_lineage).final_verdict),
        pillarScores,
        calibrationProfileVersionId: text(calibration.profile_version_id, 500) || null,
    };
}
function buildProducerAssessment(input) {
    const producerUid = documentId(input.producerUid, "Producer");
    const producerEmail = text(input.producerEmail, 320).toLowerCase();
    if (!producerEmail.endsWith("@lemonfilms.com")) {
        throw new Error("A Lemon Studios producer identity is required.");
    }
    return {
        schemaVersion: exports.PRODUCER_ASSESSMENT_SCHEMA_VERSION,
        assessmentId: input.assessmentId ?? (0, node_crypto_1.randomUUID)(),
        producerUid,
        producerEmail,
        producerDisplayName: text(input.producerDisplayName, 200) || producerEmail,
        revision: (input.prior?.revision ?? 0) + 1,
        supersedesAssessmentId: input.prior?.assessmentId ?? null,
        publishedAt: input.nowIso,
        analysis: input.analysis,
        judgment: validateProducerJudgment(input.judgment),
    };
}
function assessmentHeadId(producerUid, projectId) {
    return `${documentId(producerUid, "Producer")}__${documentId(projectId, "Project")}`;
}
function buildAssessmentHead(assessment) {
    return {
        producerUid: assessment.producerUid,
        projectId: assessment.analysis.projectId,
        latestAssessmentId: assessment.assessmentId,
        revision: assessment.revision,
        versionId: assessment.analysis.versionId,
        title: assessment.analysis.title,
        aiFinalScore: assessment.analysis.aiFinalScore,
        aiVerdict: assessment.analysis.aiVerdict,
        producerScore: assessment.judgment.producerScore,
        producerVerdict: assessment.judgment.producerVerdict,
        pursuit: assessment.judgment.pursuit,
        includeInCalibration: assessment.judgment.includeInCalibration,
        updatedAt: assessment.publishedAt,
    };
}
function buildCompatibilityProjections(assessment) {
    const { analysis, judgment } = assessment;
    return {
        brainVerdict: {
            screenplayId: analysis.projectId,
            screenplayTitle: analysis.title,
            billyVerdict: judgment.producerVerdict,
            aiVerdict: analysis.aiVerdict,
            note: judgment.aiMissed || judgment.aiGotRight,
            genre: analysis.genre,
            subgenres: [],
            weightedScore: analysis.aiFinalScore,
            source: "screenplay-dashboard",
            producerAssessmentId: assessment.assessmentId,
            updatedAt: assessment.publishedAt,
        },
        feedback: {
            screenplayId: analysis.projectId,
            screenplayTitle: analysis.title,
            userScore: judgment.producerScore,
            userVerdict: judgment.producerVerdict,
            dimensionOverrides: Object.fromEntries(analysis.pillarScores.map((pillar) => [
                pillar.name,
                {
                    aiScore: pillar.score,
                    userScore: judgment.pillarOverrides[pillar.name]
                        ?? pillar.score,
                },
            ])),
            aiMissed: judgment.aiMissed,
            aiGotRight: judgment.aiGotRight,
            greenlight: judgment.pursuit === "yes"
                ? "yes"
                : judgment.pursuit === "no"
                    ? "no"
                    : "maybe",
            aiWeightedScore: analysis.aiFinalScore,
            aiVerdict: analysis.aiVerdict,
            producerAssessmentId: assessment.assessmentId,
            updatedAt: assessment.publishedAt,
        },
    };
}
function assessmentSetSha256(assessments) {
    const evidence = assessments
        .map((assessment) => ({
        assessmentId: assessment.assessmentId,
        analysisSeal: assessment.analysis.trustManifestIntegritySha256,
        judgment: assessment.judgment,
    }))
        .sort((a, b) => a.assessmentId.localeCompare(b.assessmentId));
    return sha256(stableJson(evidence));
}
function list(value, label, maxItems) {
    if (!Array.isArray(value))
        throw new Error(`${label} must be a list.`);
    const values = value
        .map((item) => text(item, 1_000))
        .filter(Boolean)
        .slice(0, maxItems);
    if (!values.length)
        throw new Error(`${label} cannot be empty.`);
    return values;
}
function parseCalibrationPolicy(value) {
    const policy = asRecord(value);
    return {
        thesis: text(policy.thesis, 1_500),
        principles: list(policy.principles, "Principles", 12),
        scoringInstructions: list(policy.scoring_instructions ?? policy.scoringInstructions, "Scoring instructions", 12),
        developmentUpsideRules: list(policy.development_upside_rules ?? policy.developmentUpsideRules, "Development-upside rules", 10),
        fixableWeaknessRules: list(policy.fixable_weakness_rules ?? policy.fixableWeaknessRules, "Fixable-weakness rules", 10),
        dealbreakers: list(policy.dealbreakers, "Dealbreakers", 10),
        genreCautions: list(policy.genre_cautions ?? policy.genreCautions, "Genre cautions", 10),
    };
}
function renderCalibrationPrompt(policy) {
    const section = (title, values) => `${title}\n${values.map((item) => `- ${item}`).join("\n")}`;
    return [
        "LEMON STUDIOS PRODUCER CALIBRATION",
        "Apply this only in the final studio decision synthesis. Preserve the five specialist readers' evidence and raw scores.",
        "",
        `Taste thesis\n${policy.thesis}`,
        section("Decision principles", policy.principles),
        section("Scoring instructions", policy.scoringInstructions),
        section("Development upside", policy.developmentUpsideRules),
        section("Fixable weaknesses", policy.fixableWeaknessRules),
        section("Dealbreakers", policy.dealbreakers),
        section("Genre cautions", policy.genreCautions),
        "",
        "Do not force agreement with the producer examples. Use them as decision calibration, cite the screenplay evidence, and preserve uncertainty.",
    ].join("\n\n").slice(0, 12_000);
}
function buildCompilerPrompt(assessments) {
    if (assessments.length < 4) {
        throw new Error("At least four training assessments are required.");
    }
    const examples = assessments.map((assessment) => ({
        title: assessment.analysis.title,
        genre: assessment.analysis.genre,
        ai: {
            score: assessment.analysis.aiFinalScore,
            verdict: assessment.analysis.aiVerdict,
            pillars: assessment.analysis.pillarScores,
        },
        producer: assessment.judgment,
    }));
    return [
        "Derive a conservative studio decision policy from these producer assessments.",
        "The goal is not to add a global score offset or imitate individual answers.",
        "Learn durable principles about reading pleasure, development upside, fixability, dealbreakers, and decision thresholds.",
        "Never recalibrate factual evidence or the five specialist readers' raw scores.",
        "Do not infer a genre-wide preference from a single example.",
        "",
        JSON.stringify(examples),
    ].join("\n");
}
exports.CALIBRATION_POLICY_TOOL = {
    name: "publish_calibration_policy",
    description: "Return a structured, conservative producer calibration policy.",
    input_schema: {
        type: "object",
        additionalProperties: false,
        required: [
            "thesis",
            "principles",
            "scoring_instructions",
            "development_upside_rules",
            "fixable_weakness_rules",
            "dealbreakers",
            "genre_cautions",
        ],
        properties: {
            thesis: { type: "string" },
            principles: { type: "array", items: { type: "string" } },
            scoring_instructions: { type: "array", items: { type: "string" } },
            development_upside_rules: {
                type: "array",
                items: { type: "string" },
            },
            fixable_weakness_rules: {
                type: "array",
                items: { type: "string" },
            },
            dealbreakers: { type: "array", items: { type: "string" } },
            genre_cautions: { type: "array", items: { type: "string" } },
        },
    },
};
function buildDecisionReplayPrompt(policy, assessment, version) {
    const analysis = asRecord(asRecord(version).analysis);
    return [
        "Apply the candidate Lemon Studios calibration policy to this sealed reader evidence.",
        "Do not use or infer the producer's hidden assessment.",
        "Return a calibrated final score, verdict, and concise rationale.",
        "",
        "CANDIDATE POLICY",
        renderCalibrationPrompt(policy),
        "",
        "SEALED READER EVIDENCE",
        JSON.stringify({
            title: assessment.analysis.title,
            genre: assessment.analysis.genre,
            rawScore: assessment.analysis.aiRawScore,
            priorFinalScore: assessment.analysis.aiFinalScore,
            priorVerdict: assessment.analysis.aiVerdict,
            pillarScores: analysis.pillar_scores,
            readerReports: analysis.reader_reports,
            criticalFailures: analysis.critical_failures,
            verdictGates: {
                storyVsSituation: analysis.story_vs_situation,
                falsePositive: analysis.false_positive_check,
            },
        }),
    ].join("\n");
}
exports.DECISION_REPLAY_TOOL = {
    name: "publish_calibrated_decision",
    description: "Return one calibrated studio decision from sealed reader evidence.",
    input_schema: {
        type: "object",
        additionalProperties: false,
        required: ["score", "verdict", "rationale"],
        properties: {
            score: { type: "number", minimum: 1, maximum: 10 },
            verdict: { type: "string", enum: [...VERDICTS] },
            rationale: { type: "string" },
        },
    },
};
function parseDecisionReplay(assessment, value) {
    const replay = asRecord(value);
    return {
        assessmentId: assessment.assessmentId,
        projectId: assessment.analysis.projectId,
        versionId: assessment.analysis.versionId,
        title: assessment.analysis.title,
        producerScore: assessment.judgment.producerScore,
        producerVerdict: assessment.judgment.producerVerdict,
        baselineScore: assessment.analysis.aiFinalScore,
        baselineVerdict: assessment.analysis.aiVerdict,
        candidateScore: finiteScore(replay.score, "Candidate score"),
        candidateVerdict: enumValue(replay.verdict, VERDICTS, "Candidate verdict"),
        rationale: text(replay.rationale, 2_000),
    };
}
function average(values) {
    return values.length
        ? values.reduce((total, value) => total + value, 0) / values.length
        : 0;
}
function isPositiveVerdict(verdict) {
    return verdict === "recommend" || verdict === "film_now";
}
function isFalsePass(predicted, actual) {
    return predicted === "pass" && isPositiveVerdict(actual);
}
function isFalseRecommendation(predicted, actual) {
    return isPositiveVerdict(predicted) && actual === "pass";
}
function calculateCalibrationBenchmark(replays) {
    if (!replays.length) {
        throw new Error("At least one holdout decision replay is required.");
    }
    const baselineErrors = replays.map((item) => Math.abs(item.baselineScore - item.producerScore));
    const candidateErrors = replays.map((item) => Math.abs(item.candidateScore - item.producerScore));
    const baselineAgreement = average(replays.map((item) => item.baselineVerdict === item.producerVerdict ? 1 : 0));
    const candidateAgreement = average(replays.map((item) => item.candidateVerdict === item.producerVerdict ? 1 : 0));
    const baselineFalsePasses = replays.filter((item) => isFalsePass(item.baselineVerdict, item.producerVerdict)).length;
    const candidateFalsePasses = replays.filter((item) => isFalsePass(item.candidateVerdict, item.producerVerdict)).length;
    const baselineFalseRecommendations = replays.filter((item) => isFalseRecommendation(item.baselineVerdict, item.producerVerdict)).length;
    const candidateFalseRecommendations = replays.filter((item) => isFalseRecommendation(item.candidateVerdict, item.producerVerdict)).length;
    const baselineMae = average(baselineErrors);
    const candidateMae = average(candidateErrors);
    const reasons = [];
    if (candidateFalsePasses > baselineFalsePasses) {
        reasons.push("Candidate creates more serious false passes.");
    }
    if (candidateFalseRecommendations > baselineFalseRecommendations) {
        reasons.push("Candidate creates more serious false recommendations.");
    }
    if (candidateMae > baselineMae + 0.05) {
        reasons.push("Candidate increases average score error.");
    }
    if (candidateAgreement < baselineAgreement) {
        reasons.push("Candidate reduces exact verdict agreement.");
    }
    return {
        holdoutAssessmentIds: replays.map((item) => item.assessmentId),
        baselineMeanAbsoluteError: Math.round(baselineMae * 100) / 100,
        candidateMeanAbsoluteError: Math.round(candidateMae * 100) / 100,
        baselineVerdictAgreement: Math.round(baselineAgreement * 100) / 100,
        candidateVerdictAgreement: Math.round(candidateAgreement * 100) / 100,
        baselineFalsePasses,
        candidateFalsePasses,
        baselineFalseRecommendations,
        candidateFalseRecommendations,
        passed: candidateFalsePasses <= baselineFalsePasses
            && candidateFalseRecommendations <= baselineFalseRecommendations
            && candidateMae <= baselineMae + 0.05
            && candidateAgreement >= baselineAgreement,
        reasons,
        replays,
    };
}
function confidenceForAssessmentCount(count) {
    if (count >= 12)
        return "reliable";
    if (count >= 8)
        return "developing";
    return "early_signal";
}
function buildCalibrationCandidate(input) {
    const calibrationPrompt = renderCalibrationPrompt(input.policy);
    return {
        schemaVersion: exports.CALIBRATION_PROFILE_SCHEMA_VERSION,
        candidateId: input.candidateId ?? (0, node_crypto_1.randomUUID)(),
        profileId: "admin",
        status: "candidate",
        confidence: confidenceForAssessmentCount(input.training.length + input.benchmark.replays.length),
        compilerModelId: exports.CALIBRATION_COMPILER_MODEL,
        compilerResponseId: text(input.compilerResponseId, 500),
        sourceAssessmentIds: input.training.map((item) => item.assessmentId),
        sourceAssessmentSetSha256: assessmentSetSha256(input.training),
        calibrationPrompt,
        promptSha256: sha256(calibrationPrompt),
        policy: input.policy,
        benchmark: input.benchmark,
        createdAt: input.createdAt,
        createdByUid: input.createdByUid,
    };
}
function buildActiveCalibrationProfile(candidate, prior) {
    if (!candidate.benchmark.passed) {
        throw new Error("A failing calibration benchmark cannot be activated.");
    }
    return {
        displayName: "Billy Rovzar",
        enabled: true,
        activeVersionId: candidate.candidateId,
        totalReviews: candidate.sourceAssessmentIds.length
            + candidate.benchmark.holdoutAssessmentIds.length,
        lastCalibrated: candidate.createdAt,
        calibrationPrompt: candidate.calibrationPrompt,
        promptSha256: candidate.promptSha256,
        sourceAssessmentSetSha256: candidate.sourceAssessmentSetSha256,
        compilerModelId: candidate.compilerModelId,
        previousVersionId: text(prior.activeVersionId, 500) || null,
    };
}
//# sourceMappingURL=calibrationCore.js.map