import { onRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { randomUUID } from "node:crypto";
import cors from "cors";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { authenticateProxyRequest } from "./proxyAuth";
import { READER_CHAT_MODEL, READER_CHAT_MODEL_VERIFIED_AT } from "./modelRegistry";
import {
  READER_REPLY_TOOL,
  buildConversationHistory,
  buildReaderSystemPrompt,
  conversationId,
  loadReaderCharter,
  parseReaderKey,
  parseReaderReply,
  readerIdentity,
  readerReportFromVersion,
  screenplayStoragePointer,
  type ConversationMessage,
  type ReaderCitation,
  type ReaderKey,
  type ReaderPosition,
} from "./readerChatCore";

const proxyServiceKey = defineString("PROXY_SERVICE_KEY");
const readerChatEnabled = defineString("READER_CHAT_ENABLED", { default: "false" });

const corsMiddleware = cors({
  origin: [
    "https://lemon-screenplay-dashboard.web.app",
    "https://lemon-screenplay-dashboard.firebaseapp.com",
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ],
});

type UnknownRecord = Record<string, unknown>;
type ReaderChatAction = "load_conversation" | "send_message";

interface StoredMessage extends ConversationMessage {
  messageId: string;
  sequence: number;
  createdAt: Timestamp;
  modelId?: string;
  modelResponseId?: string;
  reconsideredPosition?: {
    summary: string;
    suggestedScore?: number;
  };
}

interface LlmProxyResult {
  response_id?: string;
  model?: string;
  stop_reason?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    actual_cost_microusd?: number;
    actual_cost_usd?: number;
  };
  tool_uses?: Array<{
    name?: string;
    input?: unknown;
  }>;
  error?: string;
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

function producerMessage(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 4_000) {
    throw new Error("Message must be between 1 and 4,000 characters.");
  }
  return normalized;
}

async function requireLemonUser(req: Parameters<typeof authenticateProxyRequest>[0]) {
  const auth = await authenticateProxyRequest(req, "");
  if (!auth.ok || auth.kind !== "user") {
    throw Object.assign(new Error("Lemon Studios sign-in required."), { status: 401 });
  }
  if (!auth.emailVerified || !auth.email.toLowerCase().endsWith("@lemonfilms.com")) {
    throw Object.assign(
      new Error("A verified Lemon Studios account is required."),
      { status: 403 },
    );
  }
  return { uid: auth.uid, email: auth.email.toLowerCase() };
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

function sharedSynthesis(version: UnknownRecord): UnknownRecord {
  const analysis = asRecord(version.analysis);
  return {
    title: analysis.title,
    weighted_score: analysis.weighted_score,
    weighted_score_adjusted: analysis.weighted_score_adjusted,
    verdict: analysis.verdict,
    recommendation_rationale: analysis.recommendation_rationale,
    verdict_statement: analysis.verdict_statement,
    reader_disagreements: analysis.reader_disagreements,
  };
}

function pageCount(version: UnknownRecord): number | undefined {
  const value = asRecord(version.metadata).page_count;
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

async function loadVersion(projectId: string, versionId: string): Promise<UnknownRecord> {
  const snapshot = await getFirestore()
    .collection("uploaded_analyses")
    .doc(projectId)
    .collection("versions")
    .doc(versionId)
    .get();
  if (!snapshot.exists) throw new Error("The exact sealed analysis version does not exist.");
  const version = snapshot.data() as UnknownRecord;
  if (version.project_id !== projectId || version.version_id !== versionId) {
    throw new Error("The sealed analysis identity does not match this project.");
  }
  return version;
}

async function loadPdf(version: UnknownRecord): Promise<Buffer> {
  const pointer = screenplayStoragePointer(version);
  const bucket = pointer.bucket
    ? getStorage().bucket(pointer.bucket)
    : getStorage().bucket();
  const file = bucket.file(
    pointer.objectName,
    pointer.generation ? { generation: Number(pointer.generation) } : undefined,
  );
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size ?? 0);
  if (!Number.isFinite(size) || size < 1 || size > 50 * 1024 * 1024) {
    throw new Error("The source PDF is missing or exceeds the 50 MB conversation limit.");
  }
  const [pdf] = await file.download();
  return pdf;
}

function storedConversationMessage(data: UnknownRecord): ConversationMessage {
  const role = data.role === "reader" ? "reader" : "producer";
  const citations = Array.isArray(data.citations)
    ? data.citations.flatMap((value) => {
        const citation = asRecord(value);
        return typeof citation.page === "number" && typeof citation.note === "string"
          ? [{ page: citation.page, note: citation.note }]
          : [];
      })
    : [];
  return {
    role,
    text: typeof data.text === "string" ? data.text : "",
    citations,
    ...(data.position === "unchanged" || data.position === "clarified" || data.position === "reconsidered"
      ? { position: data.position }
      : {}),
  };
}

function serializeMessage(snapshot: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = snapshot.data() as StoredMessage;
  return {
    id: snapshot.id,
    role: data.role,
    text: data.text,
    citations: data.citations ?? [],
    position: data.position,
    reconsideredPosition: data.reconsideredPosition,
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate().toISOString()
      : null,
  };
}

async function loadConversation(input: {
  uid: string;
  projectId: string;
  versionId: string;
  reader: ReaderKey;
}) {
  const threadId = conversationId(input);
  const threadRef = getFirestore().collection("reader_conversations").doc(threadId);
  const [threadSnapshot, messageSnapshots] = await Promise.all([
    threadRef.get(),
    threadRef.collection("messages").orderBy("sequence", "asc").limit(100).get(),
  ]);
  return {
    threadId,
    exists: threadSnapshot.exists,
    messages: messageSnapshots.docs.map(serializeMessage),
    provenance: threadSnapshot.exists ? threadSnapshot.get("provenance") : null,
  };
}

async function callReader(input: {
  system: string;
  pdf: Buffer;
  history: string;
  question: string;
}): Promise<{ replyInput: unknown; response: LlmProxyResult }> {
  const response = await fetch(llmProxyUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lemon-Service-Key": proxyServiceKey.value(),
    },
    body: JSON.stringify({
      model: READER_CHAT_MODEL,
      system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: input.pdf.toString("base64"),
            },
            cache_control: { type: "ephemeral" },
            citations: { enabled: true },
          },
          {
            type: "text",
            text: `PRIVATE CONVERSATION SO FAR:\n${input.history}\n\nPRODUCER'S NEW QUESTION:\n${input.question}`,
          },
        ],
      }],
      // Fable 5 uses adaptive thinking inside this hard limit. Use the
      // proxy's full approved allowance so reasoning cannot crowd out the
      // structured answer on a difficult screenplay question.
      max_tokens: 24_000,
      tools: [READER_REPLY_TOOL],
      tool_choice: { type: "tool", name: READER_REPLY_TOOL.name },
    }),
  });
  const body = await response.json() as LlmProxyResult;
  if (!response.ok) {
    throw Object.assign(
      new Error(body.error || `Private reader failed (${response.status}).`),
      { status: response.status >= 500 ? 503 : response.status },
    );
  }
  if (body.stop_reason === "refusal") {
    throw Object.assign(
      new Error("This reader could not answer that question. Rephrase it and try again."),
      { status: 422 },
    );
  }
  const tool = body.tool_uses?.find((item) => item.name === READER_REPLY_TOOL.name);
  if (!tool) throw new Error("The reader returned no grounded answer.");
  return { replyInput: tool.input, response: body };
}

async function saveExchange(input: {
  uid: string;
  email: string;
  projectId: string;
  versionId: string;
  reader: ReaderKey;
  title: string;
  originalScore: number | null;
  question: string;
  answer: string;
  citations: ReaderCitation[];
  position: ReaderPosition;
  reconsideredPosition?: { summary: string; suggestedScore?: number };
  charterVersion: string;
  charterSha256: string;
  response: LlmProxyResult;
}) {
  const db = getFirestore();
  const threadId = conversationId(input);
  const threadRef = db.collection("reader_conversations").doc(threadId);
  const producerRef = threadRef.collection("messages").doc(randomUUID());
  const readerRef = threadRef.collection("messages").doc(randomUUID());
  const now = FieldValue.serverTimestamp();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(threadRef);
    const nextSequence = snapshot.exists && Number.isInteger(snapshot.get("nextSequence"))
      ? Number(snapshot.get("nextSequence"))
      : 0;
    transaction.set(threadRef, {
      threadId,
      ownerUid: input.uid,
      ownerEmail: input.email,
      projectId: input.projectId,
      versionId: input.versionId,
      title: input.title,
      reader: input.reader,
      readerIdentity: readerIdentity(input.reader),
      originalSealedScore: input.originalScore,
      nextSequence: nextSequence + 2,
      updatedAt: now,
      ...(snapshot.exists ? {} : { createdAt: now }),
      provenance: {
        charterVersion: input.charterVersion,
        charterSha256: input.charterSha256,
        modelId: input.response.model ?? READER_CHAT_MODEL,
        modelRegistryVerifiedAt: READER_CHAT_MODEL_VERIFIED_AT,
        sealedProjectId: input.projectId,
        sealedVersionId: input.versionId,
      },
    }, { merge: true });
    transaction.create(producerRef, {
      messageId: producerRef.id,
      role: "producer",
      text: input.question,
      citations: [],
      sequence: nextSequence,
      createdAt: now,
    });
    transaction.create(readerRef, {
      messageId: readerRef.id,
      role: "reader",
      text: input.answer,
      citations: input.citations,
      position: input.position,
      ...(input.reconsideredPosition ? { reconsideredPosition: input.reconsideredPosition } : {}),
      modelId: input.response.model ?? READER_CHAT_MODEL,
      modelResponseId: input.response.response_id ?? null,
      usage: input.response.usage ?? null,
      sequence: nextSequence + 1,
      createdAt: now,
    });
  });
  return threadId;
}

async function sendMessage(input: {
  uid: string;
  email: string;
  projectId: string;
  versionId: string;
  reader: ReaderKey;
  question: string;
}) {
  if (readerChatEnabled.value().toLowerCase() !== "true") {
    throw Object.assign(
      new Error("Private Reader Chat is built but live model calls are not activated."),
      { status: 409, code: "READER_CHAT_NOT_ACTIVATED" },
    );
  }
  const version = await loadVersion(input.projectId, input.versionId);
  const report = readerReportFromVersion(version, input.reader);
  const charter = loadReaderCharter(input.reader);
  const existing = await loadConversation(input);
  const historyMessages = existing.messages.map((message) => storedConversationMessage(message));
  const title = typeof asRecord(version.analysis).title === "string"
    ? String(asRecord(version.analysis).title)
    : input.projectId;
  const system = buildReaderSystemPrompt({
    reader: input.reader,
    charter: charter.text,
    charterSha256: charter.sha256,
    sealedReport: report,
    sharedSynthesis: sharedSynthesis(version),
    projectId: input.projectId,
    versionId: input.versionId,
    title,
  });
  const pdf = await loadPdf(version);
  const result = await callReader({
    system,
    pdf,
    history: buildConversationHistory(historyMessages),
    question: input.question,
  });
  const reply = parseReaderReply(result.replyInput, pageCount(version));
  const originalScore = typeof report.pillar_score === "number" ? report.pillar_score : null;
  const threadId = await saveExchange({
    ...input,
    title,
    originalScore,
    question: input.question,
    answer: reply.answer,
    citations: reply.citations,
    position: reply.position,
    ...(reply.reconsideredPosition ? { reconsideredPosition: reply.reconsideredPosition } : {}),
    charterVersion: charter.version,
    charterSha256: charter.sha256,
    response: result.response,
  });
  return { threadId, reply };
}

export const readerChat = onRequest(
  {
    region: "us-central1",
    timeoutSeconds: 3600,
    memory: "1GiB",
    concurrency: 1,
  },
  (req, res) => {
    corsMiddleware(req, res, async () => {
      try {
        if (req.method !== "POST") {
          res.status(405).json({ error: "Method not allowed." });
          return;
        }
        const user = await requireLemonUser(req);
        const body = asRecord(req.body);
        const action = body.action as ReaderChatAction;
        const projectId = documentId(body.projectId, "Project");
        const versionId = documentId(body.versionId, "Analysis version");
        const reader = parseReaderKey(body.reader);
        const result = action === "load_conversation"
          ? await loadConversation({ uid: user.uid, projectId, versionId, reader })
          : action === "send_message"
            ? await sendMessage({
                uid: user.uid,
                email: user.email,
                projectId,
                versionId,
                reader,
                question: producerMessage(body.message),
              })
            : (() => { throw new Error("Unknown private reader action."); })();
        res.status(200).json({ result });
      } catch (error) {
        const candidate = error as { status?: unknown; code?: unknown };
        const status = typeof candidate.status === "number" ? candidate.status : 400;
        res.status(status).json({
          error: error instanceof Error ? error.message : "Private Reader Chat failed.",
          ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
        });
      }
    });
  },
);
