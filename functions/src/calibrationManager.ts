import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";
import cors from "cors";

import { authenticateProxyRequest } from "./proxyAuth";
import { loadAuthorizedAnalysisVersion } from "./analysisVersionAuthority";
import {
  CALIBRATION_COMPILER_MODEL,
  CALIBRATION_POLICY_TOOL,
  DECISION_REPLAY_TOOL,
  assessmentHeadId,
  buildActiveCalibrationProfile,
  buildAssessmentHead,
  buildCalibrationCandidate,
  buildCompatibilityProjections,
  buildCompilerPrompt,
  buildDecisionReplayPrompt,
  buildProducerAssessment,
  calculateCalibrationBenchmark,
  extractProducerAnalysisSnapshot,
  parseCalibrationPolicy,
  parseDecisionReplay,
  validateProducerJudgment,
  type ProducerAssessment,
} from "./calibrationCore";

const proxyServiceKey = defineSecret("PROXY_SERVICE_KEY");

const corsMiddleware = cors({
  origin: [
    "https://lemon-screenplay-dashboard.web.app",
    "https://lemon-screenplay-dashboard.firebaseapp.com",
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
});

type CalibrationAction =
  | "submit_assessment"
  | "build_candidate"
  | "activate_candidate"
  | "rollback_profile";

type UnknownRecord = Record<string, unknown>;

interface ToolUse {
  name: string;
  input: UnknownRecord;
}

interface LlmProxyResult {
  response_id: string;
  model: string;
  tool_uses: ToolUse[];
}

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

function documentId(value: unknown, label: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.includes("/") || normalized.length > 500) {
    throw new Error(`${label} is not a valid document ID.`);
  }
  return normalized;
}

function documentIds(
  value: unknown,
  label: string,
  max: number,
): string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a list.`);
  const values = [...new Set(
    value.map((item) => documentId(item, label)),
  )].slice(0, max);
  if (!values.length) throw new Error(`${label} cannot be empty.`);
  return values;
}

function llmProxyUrl(): string {
  const projectId = process.env.GCLOUD_PROJECT
    ?? process.env.GCP_PROJECT
    ?? "lemon-screenplay-dashboard";
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    return `http://127.0.0.1:5001/${projectId}/us-central1/llmProxy`;
  }
  return `https://us-central1-${projectId}.cloudfunctions.net/llmProxy`;
}

async function callCalibrationLlm(input: {
  prompt: string;
  tool: typeof CALIBRATION_POLICY_TOOL | typeof DECISION_REPLAY_TOOL;
}): Promise<{ input: UnknownRecord; responseId: string }> {
  const response = await fetch(llmProxyUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lemon-Service-Key": proxyServiceKey.value(),
    },
    body: JSON.stringify({
      model: CALIBRATION_COMPILER_MODEL,
      system: [
        {
          type: "text",
          text:
            "You are the Lemon Studios calibration compiler. "
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
  const body = await response.json() as Partial<LlmProxyResult> & {
    error?: string;
  };
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
  if (body.model !== CALIBRATION_COMPILER_MODEL) {
    throw new Error("Calibration compiler returned a different model than requested.");
  }
  return { input: toolUse.input, responseId: body.response_id };
}

async function requireAdmin(req: Parameters<typeof authenticateProxyRequest>[0]) {
  const auth = await authenticateProxyRequest(req, "");
  if (!auth.ok || auth.kind !== "user") {
    throw Object.assign(new Error("Admin sign-in required."), { status: 401 });
  }
  if (
    !auth.emailVerified
    || !auth.email.toLowerCase().endsWith("@lemonfilms.com")
  ) {
    throw Object.assign(
      new Error("A verified Lemon Studios account is required."),
      { status: 403 },
    );
  }
  const profile = await getFirestore().collection("users").doc(auth.uid).get();
  const bootstrapAdmin = auth.email.toLowerCase() === "billy@lemonfilms.com";
  if (!bootstrapAdmin && (!profile.exists || profile.get("role") !== "admin")) {
    throw Object.assign(new Error("Admin access required."), { status: 403 });
  }
  return {
    uid: auth.uid,
    email: auth.email.toLowerCase(),
    displayName:
      (profile.exists && typeof profile.get("displayName") === "string"
        ? profile.get("displayName")
        : auth.email) as string,
  };
}

async function submitAssessment(
  producer: { uid: string; email: string; displayName: string },
  body: UnknownRecord,
) {
  const db = getFirestore();
  const projectId = documentId(body.projectId, "Project");
  const versionId = documentId(body.versionId, "Analysis version");
  const versionRef = db
    .collection("uploaded_analyses")
    .doc(projectId)
    .collection("versions")
    .doc(versionId);
  const authorityRef = db
    .collection("uploaded_analyses")
    .doc(projectId)
    .collection("version_authorities")
    .doc(versionId);
  const headRef = db
    .collection("producer_assessment_heads")
    .doc(assessmentHeadId(producer.uid, projectId));
  return db.runTransaction(async (transaction) => {
    const [versionSnapshot, authoritySnapshot, headSnapshot] = await Promise.all([
      transaction.get(versionRef),
      transaction.get(authorityRef),
      transaction.get(headRef),
    ]);
    if (!versionSnapshot.exists || !authoritySnapshot.exists) {
      throw new Error("The exact trusted analysis version does not exist.");
    }

    let prior: ProducerAssessment | undefined;
    if (headSnapshot.exists) {
      const priorId = documentId(
        headSnapshot.get("latestAssessmentId"),
        "Prior assessment",
      );
      const priorSnapshot = await transaction.get(
        db.collection("producer_assessments").doc(priorId),
      );
      if (!priorSnapshot.exists) {
        throw new Error("The prior assessment revision is missing.");
      }
      prior = priorSnapshot.data() as ProducerAssessment;
    }

    const assessment = buildProducerAssessment({
      producerUid: producer.uid,
      producerEmail: producer.email,
      producerDisplayName: producer.displayName,
      judgment: validateProducerJudgment(body.judgment),
      analysis: extractProducerAnalysisSnapshot(
        projectId,
        versionId,
        versionSnapshot.data(),
        authoritySnapshot.data(),
      ),
      prior,
      nowIso: new Date().toISOString(),
    });
    const assessmentRef = db
      .collection("producer_assessments")
      .doc(assessment.assessmentId);
    const compatibility = buildCompatibilityProjections(assessment);
    transaction.create(assessmentRef, assessment);
    transaction.set(headRef, buildAssessmentHead(assessment));
    transaction.set(
      db.collection("brain_verdicts").doc(projectId),
      compatibility.brainVerdict,
    );
    transaction.set(
      db.collection("screenplay_feedback").doc(projectId),
      compatibility.feedback,
    );
    return assessment;
  });
}

async function loadAssessments(
  ids: string[],
  producerUid: string,
): Promise<ProducerAssessment[]> {
  const db = getFirestore();
  const snapshots = await db.getAll(
    ...ids.map((id) => db.collection("producer_assessments").doc(id)),
  );
  return snapshots.map((snapshot) => {
    if (!snapshot.exists) {
      throw new Error(`Producer assessment ${snapshot.id} does not exist.`);
    }
    const assessment = snapshot.data() as ProducerAssessment;
    if (assessment.producerUid !== producerUid) {
      throw new Error("Calibration cannot use another producer's assessment.");
    }
    if (!assessment.judgment.includeInCalibration) {
      throw new Error(
        `Assessment ${assessment.assessmentId} is excluded from calibration.`,
      );
    }
    return assessment;
  });
}

async function buildCandidate(
  producer: { uid: string },
  body: UnknownRecord,
) {
  const trainingIds = documentIds(
    body.trainingAssessmentIds,
    "Training assessment",
    50,
  );
  const holdoutIds = documentIds(
    body.holdoutAssessmentIds,
    "Holdout assessment",
    20,
  );
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
  const db = getFirestore();
  const authorizedVersions = new Map<string, UnknownRecord>();
  await Promise.all([...training, ...holdouts].map(async (assessment) => {
    const { projectId, versionId } = assessment.analysis;
    const authorized = await loadAuthorizedAnalysisVersion(db, projectId, versionId);
    const current = extractProducerAnalysisSnapshot(
      projectId,
      versionId,
      authorized.version,
      authorized.authority,
    );
    if (
      current.contentHash !== assessment.analysis.contentHash
      || current.trustManifestIntegritySha256
        !== assessment.analysis.trustManifestIntegritySha256
    ) {
      throw new Error("A calibration assessment no longer matches its authorized analysis.");
    }
    authorizedVersions.set(`${projectId}\n${versionId}`, authorized.version);
  }));
  const compilation = await callCalibrationLlm({
    prompt: buildCompilerPrompt(training),
    tool: CALIBRATION_POLICY_TOOL,
  });
  const policy = parseCalibrationPolicy(compilation.input);
  const replayResults = [];
  for (const assessment of holdouts) {
    const version = authorizedVersions.get(
      `${assessment.analysis.projectId}\n${assessment.analysis.versionId}`,
    );
    if (!version) {
      throw new Error(
        `Holdout evidence for ${assessment.analysis.title} is missing.`,
      );
    }
    const replay = await callCalibrationLlm({
      prompt: buildDecisionReplayPrompt(
        policy,
        assessment,
        version,
      ),
      tool: DECISION_REPLAY_TOOL,
    });
    replayResults.push(parseDecisionReplay(assessment, replay.input));
  }

  const candidate = buildCalibrationCandidate({
    policy,
    training,
    benchmark: calculateCalibrationBenchmark(replayResults),
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

async function activateCandidate(
  producer: { uid: string },
  body: UnknownRecord,
  action: "activate" | "rollback",
) {
  const candidateId = documentId(body.candidateId, "Candidate");
  const db = getFirestore();
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
    const candidate = candidateSnapshot.data() as ReturnType<
      typeof buildCalibrationCandidate
    >;
    const profile = buildActiveCalibrationProfile(
      candidate,
      profileSnapshot.data() ?? {},
    );
    transaction.set(profileRef, {
      ...profile,
      activatedByUid: producer.uid,
      activatedAt: FieldValue.serverTimestamp(),
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
      publishedAt: FieldValue.serverTimestamp(),
    });
    return profile;
  });
}

export const calibrationManager = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 3600,
    memory: "512MiB",
    concurrency: 1,
    secrets: [proxyServiceKey],
  },
  (req, res) => {
    corsMiddleware(req, res, async () => {
      try {
        if (req.method !== "POST") {
          res.status(405).json({ error: "Method not allowed." });
          return;
        }
        const producer = await requireAdmin(req);
        const body = asRecord(req.body);
        const action = body.action as CalibrationAction;
        let result: unknown;
        if (action === "submit_assessment") {
          result = await submitAssessment(producer, body);
        } else if (action === "build_candidate") {
          result = await buildCandidate(producer, body);
        } else if (
          action === "activate_candidate"
          || action === "rollback_profile"
        ) {
          result = await activateCandidate(
            producer,
            body,
            action === "activate_candidate" ? "activate" : "rollback",
          );
        } else {
          res.status(400).json({ error: "Unknown calibration action." });
          return;
        }
        res.status(200).json({ result });
      } catch (error) {
        const status =
          typeof error === "object"
          && error !== null
          && "status" in error
          && typeof error.status === "number"
            ? error.status
            : 400;
        console.error("[calibrationManager]", error);
        res.status(status).json({
          error:
            error instanceof Error
              ? error.message
              : "Calibration request failed.",
        });
      }
    });
  },
);
