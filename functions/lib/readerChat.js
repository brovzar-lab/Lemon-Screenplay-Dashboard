"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readerChat = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const node_crypto_1 = require("node:crypto");
const cors_1 = __importDefault(require("cors"));
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const proxyAuth_1 = require("./proxyAuth");
const modelRegistry_1 = require("./modelRegistry");
const readerChatCore_1 = require("./readerChatCore");
const proxyServiceKey = (0, params_1.defineString)("PROXY_SERVICE_KEY");
const readerChatEnabled = (0, params_1.defineString)("READER_CHAT_ENABLED", { default: "false" });
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
function producerMessage(value) {
    const normalized = typeof value === "string" ? value.trim() : "";
    if (!normalized || normalized.length > 4_000) {
        throw new Error("Message must be between 1 and 4,000 characters.");
    }
    return normalized;
}
async function requireLemonUser(req) {
    const auth = await (0, proxyAuth_1.authenticateProxyRequest)(req, "");
    if (!auth.ok || auth.kind !== "user") {
        throw Object.assign(new Error("Lemon Studios sign-in required."), { status: 401 });
    }
    if (!auth.emailVerified || !auth.email.toLowerCase().endsWith("@lemonfilms.com")) {
        throw Object.assign(new Error("A verified Lemon Studios account is required."), { status: 403 });
    }
    return { uid: auth.uid, email: auth.email.toLowerCase() };
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
function sharedSynthesis(version) {
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
function pageCount(version) {
    const value = asRecord(version.metadata).page_count;
    return typeof value === "number" && Number.isInteger(value) && value > 0
        ? value
        : undefined;
}
async function loadVersion(projectId, versionId) {
    const snapshot = await (0, firestore_1.getFirestore)()
        .collection("uploaded_analyses")
        .doc(projectId)
        .collection("versions")
        .doc(versionId)
        .get();
    if (!snapshot.exists)
        throw new Error("The exact sealed analysis version does not exist.");
    const version = snapshot.data();
    if (version.project_id !== projectId || version.version_id !== versionId) {
        throw new Error("The sealed analysis identity does not match this project.");
    }
    return version;
}
async function loadPdf(version) {
    const pointer = (0, readerChatCore_1.screenplayStoragePointer)(version);
    const bucket = pointer.bucket
        ? (0, storage_1.getStorage)().bucket(pointer.bucket)
        : (0, storage_1.getStorage)().bucket();
    const file = bucket.file(pointer.objectName, pointer.generation ? { generation: Number(pointer.generation) } : undefined);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    if (!Number.isFinite(size) || size < 1 || size > 50 * 1024 * 1024) {
        throw new Error("The source PDF is missing or exceeds the 50 MB conversation limit.");
    }
    const [pdf] = await file.download();
    return pdf;
}
function storedConversationMessage(data) {
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
function serializeMessage(snapshot) {
    const data = snapshot.data();
    return {
        id: snapshot.id,
        role: data.role,
        text: data.text,
        citations: data.citations ?? [],
        position: data.position,
        reconsideredPosition: data.reconsideredPosition,
        createdAt: data.createdAt instanceof firestore_1.Timestamp
            ? data.createdAt.toDate().toISOString()
            : null,
    };
}
async function loadConversation(input) {
    const threadId = (0, readerChatCore_1.conversationId)(input);
    const threadRef = (0, firestore_1.getFirestore)().collection("reader_conversations").doc(threadId);
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
async function callReader(input) {
    const response = await fetch(llmProxyUrl(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Lemon-Service-Key": proxyServiceKey.value(),
        },
        body: JSON.stringify({
            model: modelRegistry_1.READER_CHAT_MODEL,
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
            tools: [readerChatCore_1.READER_REPLY_TOOL],
            tool_choice: { type: "tool", name: readerChatCore_1.READER_REPLY_TOOL.name },
        }),
    });
    const body = await response.json();
    if (!response.ok) {
        throw Object.assign(new Error(body.error || `Private reader failed (${response.status}).`), { status: response.status >= 500 ? 503 : response.status });
    }
    if (body.stop_reason === "refusal") {
        throw Object.assign(new Error("This reader could not answer that question. Rephrase it and try again."), { status: 422 });
    }
    const tool = body.tool_uses?.find((item) => item.name === readerChatCore_1.READER_REPLY_TOOL.name);
    if (!tool)
        throw new Error("The reader returned no grounded answer.");
    return { replyInput: tool.input, response: body };
}
async function saveExchange(input) {
    const db = (0, firestore_1.getFirestore)();
    const threadId = (0, readerChatCore_1.conversationId)(input);
    const threadRef = db.collection("reader_conversations").doc(threadId);
    const producerRef = threadRef.collection("messages").doc((0, node_crypto_1.randomUUID)());
    const readerRef = threadRef.collection("messages").doc((0, node_crypto_1.randomUUID)());
    const now = firestore_1.FieldValue.serverTimestamp();
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
            readerIdentity: (0, readerChatCore_1.readerIdentity)(input.reader),
            originalSealedScore: input.originalScore,
            nextSequence: nextSequence + 2,
            updatedAt: now,
            ...(snapshot.exists ? {} : { createdAt: now }),
            provenance: {
                charterVersion: input.charterVersion,
                charterSha256: input.charterSha256,
                modelId: input.response.model ?? modelRegistry_1.READER_CHAT_MODEL,
                modelRegistryVerifiedAt: modelRegistry_1.READER_CHAT_MODEL_VERIFIED_AT,
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
            modelId: input.response.model ?? modelRegistry_1.READER_CHAT_MODEL,
            modelResponseId: input.response.response_id ?? null,
            usage: input.response.usage ?? null,
            sequence: nextSequence + 1,
            createdAt: now,
        });
    });
    return threadId;
}
async function sendMessage(input) {
    if (readerChatEnabled.value().toLowerCase() !== "true") {
        throw Object.assign(new Error("Private Reader Chat is built but live model calls are not activated."), { status: 409, code: "READER_CHAT_NOT_ACTIVATED" });
    }
    const version = await loadVersion(input.projectId, input.versionId);
    const report = (0, readerChatCore_1.readerReportFromVersion)(version, input.reader);
    const charter = (0, readerChatCore_1.loadReaderCharter)(input.reader);
    const existing = await loadConversation(input);
    const historyMessages = existing.messages.map((message) => storedConversationMessage(message));
    const title = typeof asRecord(version.analysis).title === "string"
        ? String(asRecord(version.analysis).title)
        : input.projectId;
    const system = (0, readerChatCore_1.buildReaderSystemPrompt)({
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
        history: (0, readerChatCore_1.buildConversationHistory)(historyMessages),
        question: input.question,
    });
    const reply = (0, readerChatCore_1.parseReaderReply)(result.replyInput, pageCount(version));
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
exports.readerChat = (0, https_1.onRequest)({
    region: "us-central1",
    timeoutSeconds: 3600,
    memory: "1GiB",
    concurrency: 1,
}, (req, res) => {
    corsMiddleware(req, res, async () => {
        try {
            if (req.method !== "POST") {
                res.status(405).json({ error: "Method not allowed." });
                return;
            }
            const user = await requireLemonUser(req);
            const body = asRecord(req.body);
            const action = body.action;
            const projectId = documentId(body.projectId, "Project");
            const versionId = documentId(body.versionId, "Analysis version");
            const reader = (0, readerChatCore_1.parseReaderKey)(body.reader);
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
        }
        catch (error) {
            const candidate = error;
            const status = typeof candidate.status === "number" ? candidate.status : 400;
            res.status(status).json({
                error: error instanceof Error ? error.message : "Private Reader Chat failed.",
                ...(typeof candidate.code === "string" ? { code: candidate.code } : {}),
            });
        }
    });
});
//# sourceMappingURL=readerChat.js.map