"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueManager = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const node_crypto_1 = require("node:crypto");
const cors_1 = __importDefault(require("cors"));
const proxyAuth_1 = require("./proxyAuth");
const reanalysisQueue_1 = require("./reanalysisQueue");
const reanalysisLock_1 = require("./reanalysisLock");
const queueActions_1 = require("./queueActions");
const corsMiddleware = (0, cors_1.default)({
    origin: [
        "https://lemon-screenplay-dashboard.web.app",
        "https://lemon-screenplay-dashboard.firebaseapp.com",
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
    ],
});
const MODELS = new Set(["haiku", "sonnet", "opus", "hybrid", "auto"]);
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET
    ?? "lemon-screenplay-dashboard.firebasestorage.app";
exports.queueManager = (0, https_1.onRequest)({ region: "us-central1", timeoutSeconds: 30, memory: "256MiB" }, (req, res) => {
    corsMiddleware(req, res, async () => {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Method not allowed." });
            return;
        }
        const auth = await (0, proxyAuth_1.authenticateProxyRequest)(req, "");
        if (!auth.ok || auth.kind !== "user") {
            res.status(auth.ok ? 403 : auth.status).json({ error: "Admin sign-in required." });
            return;
        }
        const db = (0, firestore_1.getFirestore)();
        const profile = await db.collection("users").doc(auth.uid).get();
        if (!profile.exists || profile.get("role") !== "admin") {
            res.status(403).json({ error: "Admin access required." });
            return;
        }
        const body = (req.body ?? {});
        const action = body.action;
        const jobIds = Array.isArray(body.jobIds)
            ? body.jobIds.filter((id) => typeof id === "string" && id.length > 0).slice(0, 100)
            : [];
        const model = typeof body.model === "string" && MODELS.has(body.model) ? body.model : "sonnet";
        if (action === "reanalyze") {
            const screenplayIds = Array.isArray(body.screenplayIds)
                ? body.screenplayIds
                    .filter((id) => typeof id === "string" && id.length > 0)
                    .slice(0, 25)
                : [];
            if (!screenplayIds.length) {
                res.status(400).json({ error: "At least one screenplay is required for re-analysis." });
                return;
            }
            const refs = screenplayIds.map((id) => db.collection("uploaded_analyses").doc(id));
            const snapshots = await db.getAll(...refs);
            const storage = (0, storage_1.getStorage)();
            const lockRepository = (0, reanalysisLock_1.createFirestoreReanalysisLockRepository)(db);
            const queued = [];
            const failed = [];
            for (const snapshot of snapshots) {
                try {
                    if (!snapshot.exists)
                        throw new Error("Screenplay project not found.");
                    const uploadId = (0, node_crypto_1.randomUUID)();
                    const plan = (0, reanalysisQueue_1.buildReanalysisCopyPlan)({
                        screenplayId: snapshot.id,
                        screenplay: snapshot.data() ?? {},
                        requestedModel: model,
                        uploadId,
                        destinationBucket: STORAGE_BUCKET,
                    });
                    const storagePath = `gs://${plan.destination.bucket}/${plan.destination.objectName}`;
                    const lock = await (0, reanalysisLock_1.acquireReanalysisLock)(lockRepository, {
                        projectId: snapshot.id,
                        uploadId,
                        storagePath,
                        state: "preparing",
                        createdAtMs: Date.now(),
                    });
                    if (lock.kind === "coalesced") {
                        queued.push({
                            screenplayId: snapshot.id,
                            storagePath: lock.storagePath,
                            coalesced: true,
                        });
                        continue;
                    }
                    if (lock.kind === "busy") {
                        throw new Error("A re-analysis for this project is already being queued. It will continue independently.");
                    }
                    const sourceBucket = storage.bucket(plan.source.bucket);
                    const sourceFile = sourceBucket.file(plan.source.objectName, {
                        generation: plan.source.generation,
                    });
                    const destinationBucket = storage.bucket(plan.destination.bucket);
                    const destinationFile = destinationBucket.file(plan.destination.objectName);
                    try {
                        await sourceFile.copy(destinationFile, {
                            contentType: "application/pdf",
                            metadata: plan.destination.metadata,
                            preconditionOpts: { ifGenerationMatch: 0 },
                        });
                    }
                    catch (error) {
                        try {
                            await (0, reanalysisLock_1.releasePreparingReanalysisLock)(lockRepository, snapshot.id, uploadId);
                        }
                        catch (releaseError) {
                            console.error(`[queueManager] Could not release failed re-analysis lock for ${snapshot.id}:`, releaseError);
                        }
                        throw error;
                    }
                    try {
                        await (0, reanalysisLock_1.markReanalysisLockQueued)(lockRepository, snapshot.id, uploadId);
                    }
                    catch (error) {
                        console.error(`[queueManager] Re-analysis lock stayed in preparing state for ${snapshot.id}:`, error);
                    }
                    queued.push({
                        screenplayId: snapshot.id,
                        storagePath,
                    });
                }
                catch (error) {
                    failed.push({
                        screenplayId: snapshot.id,
                        error: error instanceof Error ? error.message : "Re-analysis could not be queued.",
                    });
                }
            }
            res.status(queued.length ? 200 : 400).json({ queued, failed });
            return;
        }
        if (!jobIds.length || !["retry", "dismiss", "analyze_anyway"].includes(action)) {
            res.status(400).json({ error: "A valid action and at least one job are required." });
            return;
        }
        const refs = jobIds.map((id) => db.collection("ingest-queue").doc(id));
        const snapshots = await db.getAll(...refs);
        const batch = db.batch();
        let updated = 0;
        snapshots.forEach((snapshot) => {
            if (!snapshot.exists)
                return;
            const data = snapshot.data() ?? {};
            const status = data.status;
            const reason = data.skip_reason;
            if (action === "retry" && (0, queueActions_1.canRetryQueueJob)(data)) {
                batch.update(snapshot.ref, {
                    status: "pending",
                    attempt_count: 0,
                    requested_model: model,
                    last_error: null,
                    worker_id: null,
                    processing_started_at: null,
                    processing_completed_at: null,
                    last_heartbeat_at: null,
                    resolution_dismissed: false,
                    resolution_updated_at: firestore_1.FieldValue.serverTimestamp(),
                });
                updated += 1;
            }
            else if (action === "dismiss" && ["failed", "skipped"].includes(status)) {
                batch.update(snapshot.ref, {
                    resolution_dismissed: true,
                    resolution_updated_at: firestore_1.FieldValue.serverTimestamp(),
                });
                updated += 1;
            }
            else if (action === "analyze_anyway" &&
                status === "skipped" &&
                ["tmdb_already_produced", "already_complete"].includes(reason)) {
                batch.update(snapshot.ref, {
                    status: "pending",
                    attempt_count: 0,
                    requested_model: model,
                    last_error: null,
                    worker_id: null,
                    processing_started_at: null,
                    processing_completed_at: null,
                    last_heartbeat_at: null,
                    resolution_dismissed: false,
                    bypass_tmdb: reason === "tmdb_already_produced",
                    bypass_duplicate: reason === "already_complete",
                    resolution_updated_at: firestore_1.FieldValue.serverTimestamp(),
                });
                updated += 1;
            }
        });
        if (updated)
            await batch.commit();
        res.status(200).json({ updated });
    });
});
//# sourceMappingURL=queueManager.js.map