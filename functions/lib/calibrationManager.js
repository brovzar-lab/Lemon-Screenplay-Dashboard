"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calibrationManager = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-admin/firestore");
const cors_1 = __importDefault(require("cors"));
const proxyAuth_1 = require("./proxyAuth");
const calibrationCore_1 = require("./calibrationCore");
const proxyServiceKey = (0, params_1.defineSecret)("PROXY_SERVICE_KEY");
const corsMiddleware = (0, cors_1.default)({
    origin: [
        "https://lemon-screenplay-dashboard.web.app",
        "https://lemon-screenplay-dashboard.firebaseapp.com",
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
    ],
});
function asRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}
function documentId(value, label) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized || normalized.includes("/") || normalized.length > 500) {
        throw new Error(`${label} is not a valid document ID.`);
    }
    return normalized;
}
function documentIds(value, label, max) {
    if (!Array.isArray(value))
        throw new Error(`${label} must be a list.`);
    const values = [...new Set(value.map((item) => documentId(item, label)))].slice(0, max);
    if (!values.length)
        throw new Error(`${label} cannot be empty.`);
    return values;
}
function llmProxyUrl() {
    const projectId = process.env.GCLOUD_PROJECT
        ?? process.env.GCP_PROJECT
        ?? "lemon-screenplay-dashboard";
    if (process.env.FUNCTIONS_EMULATOR === "true") {
        return `http://127.0.0.1:5001/${projectId}/us-central1/llmProxy`;
    }
    return `https://us-central1-${projectId}.cloudfunctions.net/llmProxy`;
}
async function callCalibrationLlm(input) {
    const response = await fetch(llmProxyUrl(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Lemon-Service-Key": proxyServiceKey.value(),
        },
        body: JSON.stringify({
            model: calibrationCore_1.CALIBRATION_COMPILER_MODEL,
            system: [
                {
                    type: "text",
                    text: "You are the Lemon Studios calibration compiler. "
                        + "Use only the supplied producer judgments and sealed analysis evidence. "
                        + "Never alter specialist-reader evidence. Return the required tool only.",
                    cache_control: { type: "ephemeral" },
                },
            ],
            messages: [{ role: "user", content: input.prompt }],
            max_tokens: 8_000,
            thinking: { type: "adaptive" },
            tools: [input.tool],
            tool_choice: { type: "auto" },
        }),
    });
    const body = await response.json();
    if (!response.ok) {
        throw new Error(body.error || `Calibration model failed (${response.status}).`);
    }
    const toolUse = body.tool_uses?.find((item) => item.name === input.tool.name);
    if (!toolUse) {
        throw new Error("Calibration model returned no strict tool result.");
    }
    if (!body.response_id) {
        throw new Error("Calibration model returned no response identity.");
    }
    if (body.model !== calibrationCore_1.CALIBRATION_COMPILER_MODEL) {
        throw new Error("Calibration compiler returned a different model than requested.");
    }
    return { input: toolUse.input, responseId: body.response_id };
}
async function requireAdmin(req) {
    const auth = await (0, proxyAuth_1.authenticateProxyRequest)(req, "");
    if (!auth.ok || auth.kind !== "user") {
        throw Object.assign(new Error("Admin sign-in required."), { status: 401 });
    }
    if (!auth.emailVerified
        || !auth.email.toLowerCase().endsWith("@lemonfilms.com")) {
        throw Object.assign(new Error("A verified Lemon Studios account is required."), { status: 403 });
    }
    const profile = await (0, firestore_1.getFirestore)().collection("users").doc(auth.uid).get();
    const bootstrapAdmin = auth.email.toLowerCase() === "billy@lemonfilms.com";
    if (!bootstrapAdmin && (!profile.exists || profile.get("role") !== "admin")) {
        throw Object.assign(new Error("Admin access required."), { status: 403 });
    }
    return {
        uid: auth.uid,
        email: auth.email.toLowerCase(),
        displayName: (profile.exists && typeof profile.get("displayName") === "string"
            ? profile.get("displayName")
            : auth.email),
    };
}
async function submitAssessment(producer, body) {
    const db = (0, firestore_1.getFirestore)();
    const projectId = documentId(body.projectId, "Project");
    const versionId = documentId(body.versionId, "Analysis version");
    const versionRef = db
        .collection("uploaded_analyses")
        .doc(projectId)
        .collection("versions")
        .doc(versionId);
    const headRef = db
        .collection("producer_assessment_heads")
        .doc((0, calibrationCore_1.assessmentHeadId)(producer.uid, projectId));
    return db.runTransaction(async (transaction) => {
        const [versionSnapshot, headSnapshot] = await Promise.all([
            transaction.get(versionRef),
            transaction.get(headRef),
        ]);
        if (!versionSnapshot.exists) {
            throw new Error("The exact trusted analysis version does not exist.");
        }
        let prior;
        if (headSnapshot.exists) {
            const priorId = documentId(headSnapshot.get("latestAssessmentId"), "Prior assessment");
            const priorSnapshot = await transaction.get(db.collection("producer_assessments").doc(priorId));
            if (!priorSnapshot.exists) {
                throw new Error("The prior assessment revision is missing.");
            }
            prior = priorSnapshot.data();
        }
        const assessment = (0, calibrationCore_1.buildProducerAssessment)({
            producerUid: producer.uid,
            producerEmail: producer.email,
            producerDisplayName: producer.displayName,
            judgment: (0, calibrationCore_1.validateProducerJudgment)(body.judgment),
            analysis: (0, calibrationCore_1.extractProducerAnalysisSnapshot)(projectId, versionId, versionSnapshot.data()),
            prior,
            nowIso: new Date().toISOString(),
        });
        const assessmentRef = db
            .collection("producer_assessments")
            .doc(assessment.assessmentId);
        const compatibility = (0, calibrationCore_1.buildCompatibilityProjections)(assessment);
        transaction.create(assessmentRef, assessment);
        transaction.set(headRef, (0, calibrationCore_1.buildAssessmentHead)(assessment));
        transaction.set(db.collection("brain_verdicts").doc(projectId), compatibility.brainVerdict);
        transaction.set(db.collection("screenplay_feedback").doc(projectId), compatibility.feedback);
        return assessment;
    });
}
async function loadAssessments(ids, producerUid) {
    const db = (0, firestore_1.getFirestore)();
    const snapshots = await db.getAll(...ids.map((id) => db.collection("producer_assessments").doc(id)));
    return snapshots.map((snapshot) => {
        if (!snapshot.exists) {
            throw new Error(`Producer assessment ${snapshot.id} does not exist.`);
        }
        const assessment = snapshot.data();
        if (assessment.producerUid !== producerUid) {
            throw new Error("Calibration cannot use another producer's assessment.");
        }
        if (!assessment.judgment.includeInCalibration) {
            throw new Error(`Assessment ${assessment.assessmentId} is excluded from calibration.`);
        }
        return assessment;
    });
}
async function buildCandidate(producer, body) {
    const trainingIds = documentIds(body.trainingAssessmentIds, "Training assessment", 50);
    const holdoutIds = documentIds(body.holdoutAssessmentIds, "Holdout assessment", 20);
    if (trainingIds.length < 4) {
        throw new Error("At least four training assessments are required.");
    }
    if (holdoutIds.length < 1) {
        throw new Error("At least one sealed holdout assessment is required.");
    }
    if (holdoutIds.some((id) => trainingIds.includes(id))) {
        throw new Error("Training and holdout assessments must be different.");
    }
    const [training, holdouts] = await Promise.all([
        loadAssessments(trainingIds, producer.uid),
        loadAssessments(holdoutIds, producer.uid),
    ]);
    const compilation = await callCalibrationLlm({
        prompt: (0, calibrationCore_1.buildCompilerPrompt)(training),
        tool: calibrationCore_1.CALIBRATION_POLICY_TOOL,
    });
    const policy = (0, calibrationCore_1.parseCalibrationPolicy)(compilation.input);
    const db = (0, firestore_1.getFirestore)();
    const replayResults = [];
    for (const assessment of holdouts) {
        const versionSnapshot = await db
            .collection("uploaded_analyses")
            .doc(assessment.analysis.projectId)
            .collection("versions")
            .doc(assessment.analysis.versionId)
            .get();
        if (!versionSnapshot.exists) {
            throw new Error(`Holdout evidence for ${assessment.analysis.title} is missing.`);
        }
        const replay = await callCalibrationLlm({
            prompt: (0, calibrationCore_1.buildDecisionReplayPrompt)(policy, assessment, versionSnapshot.data()),
            tool: calibrationCore_1.DECISION_REPLAY_TOOL,
        });
        replayResults.push((0, calibrationCore_1.parseDecisionReplay)(assessment, replay.input));
    }
    const candidate = (0, calibrationCore_1.buildCalibrationCandidate)({
        policy,
        training,
        benchmark: (0, calibrationCore_1.calculateCalibrationBenchmark)(replayResults),
        compilerResponseId: compilation.responseId,
        createdByUid: producer.uid,
        createdAt: new Date().toISOString(),
    });
    await db
        .collection("producer_profiles")
        .doc("admin")
        .collection("versions")
        .doc(candidate.candidateId)
        .create(candidate);
    return candidate;
}
async function activateCandidate(producer, body, action) {
    const candidateId = documentId(body.candidateId, "Candidate");
    const db = (0, firestore_1.getFirestore)();
    const profileRef = db.collection("producer_profiles").doc("admin");
    const candidateRef = profileRef.collection("versions").doc(candidateId);
    const publicationRef = profileRef.collection("publications").doc();
    return db.runTransaction(async (transaction) => {
        const [candidateSnapshot, profileSnapshot] = await Promise.all([
            transaction.get(candidateRef),
            transaction.get(profileRef),
        ]);
        if (!candidateSnapshot.exists) {
            throw new Error("Calibration candidate does not exist.");
        }
        const candidate = candidateSnapshot.data();
        const profile = (0, calibrationCore_1.buildActiveCalibrationProfile)(candidate, profileSnapshot.data() ?? {});
        transaction.set(profileRef, {
            ...profile,
            activatedByUid: producer.uid,
            activatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        transaction.create(publicationRef, {
            publicationId: publicationRef.id,
            action,
            candidateId,
            previousVersionId: profile.previousVersionId,
            benchmarkPassed: candidate.benchmark.passed,
            promptSha256: candidate.promptSha256,
            sourceAssessmentSetSha256: candidate.sourceAssessmentSetSha256,
            compilerModelId: candidate.compilerModelId,
            publishedByUid: producer.uid,
            publishedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return profile;
    });
}
exports.calibrationManager = (0, https_1.onRequest)({
    region: "us-central1",
    timeoutSeconds: 3600,
    memory: "512MiB",
    concurrency: 1,
    secrets: [proxyServiceKey],
}, (req, res) => {
    corsMiddleware(req, res, async () => {
        try {
            if (req.method !== "POST") {
                res.status(405).json({ error: "Method not allowed." });
                return;
            }
            const producer = await requireAdmin(req);
            const body = asRecord(req.body);
            const action = body.action;
            let result;
            if (action === "submit_assessment") {
                result = await submitAssessment(producer, body);
            }
            else if (action === "build_candidate") {
                result = await buildCandidate(producer, body);
            }
            else if (action === "activate_candidate"
                || action === "rollback_profile") {
                result = await activateCandidate(producer, body, action === "activate_candidate" ? "activate" : "rollback");
            }
            else {
                res.status(400).json({ error: "Unknown calibration action." });
                return;
            }
            res.status(200).json({ result });
        }
        catch (error) {
            const status = typeof error === "object"
                && error !== null
                && "status" in error
                && typeof error.status === "number"
                ? error.status
                : 400;
            console.error("[calibrationManager]", error);
            res.status(status).json({
                error: error instanceof Error
                    ? error.message
                    : "Calibration request failed.",
            });
        }
    });
});
//# sourceMappingURL=calibrationManager.js.map