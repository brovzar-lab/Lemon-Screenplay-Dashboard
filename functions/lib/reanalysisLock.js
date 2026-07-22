"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFirestoreReanalysisLockRepository = createFirestoreReanalysisLockRepository;
exports.acquireReanalysisLock = acquireReanalysisLock;
exports.markReanalysisLockQueued = markReanalysisLockQueued;
exports.releasePreparingReanalysisLock = releasePreparingReanalysisLock;
const firestore_1 = require("firebase-admin/firestore");
const ingestQueue_1 = require("./ingestQueue");
const REANALYSIS_LOCKS_COLLECTION = "reanalysis_locks";
const PREPARING_LOCK_TTL_MS = 5 * 60 * 1_000;
const QUEUED_LOCK_TTL_MS = 10 * 60 * 1_000;
const ACTIVE_JOB_STATUSES = new Set(["pending", "processing", "waiting_for_budget"]);
const TERMINAL_JOB_STATUSES = new Set(["complete", "failed", "skipped"]);
function readLockRecord(value) {
    if (!value)
        return null;
    const projectId = typeof value.project_id === "string" ? value.project_id : "";
    const uploadId = typeof value.upload_id === "string" ? value.upload_id : "";
    const storagePath = typeof value.storage_path === "string" ? value.storage_path : "";
    const state = value.state === "preparing" || value.state === "queued" ? value.state : null;
    const createdAtMs = typeof value.created_at_ms === "number"
        && Number.isInteger(value.created_at_ms)
        && value.created_at_ms > 0
        ? value.created_at_ms
        : 0;
    if (!projectId || !uploadId || !storagePath.startsWith("gs://") || !state || !createdAtMs) {
        return null;
    }
    return { projectId, uploadId, storagePath, state, createdAtMs };
}
function writeLockRecord(record) {
    return {
        project_id: record.projectId,
        upload_id: record.uploadId,
        storage_path: record.storagePath,
        state: record.state,
        created_at_ms: record.createdAtMs,
        updated_at: firestore_1.FieldValue.serverTimestamp(),
    };
}
function createFirestoreReanalysisLockRepository(db) {
    return {
        async transact(projectId, update) {
            const lockRef = db.collection(REANALYSIS_LOCKS_COLLECTION).doc(projectId);
            return db.runTransaction(async (transaction) => {
                const lockSnapshot = await transaction.get(lockRef);
                const current = readLockRecord(lockSnapshot.exists ? lockSnapshot.data() : undefined);
                let jobStatus = null;
                if (current) {
                    const jobQuery = db.collection(ingestQueue_1.INGEST_QUEUE_COLLECTION)
                        .where("storage_path", "==", current.storagePath)
                        .limit(1);
                    const jobSnapshot = await transaction.get(jobQuery);
                    if (!jobSnapshot.empty) {
                        const status = jobSnapshot.docs[0]?.get("status");
                        jobStatus = typeof status === "string" ? status : null;
                    }
                }
                const transition = update(current, jobStatus);
                if (transition.next === null) {
                    transaction.delete(lockRef);
                }
                else if (transition.next) {
                    transaction.set(lockRef, writeLockRecord(transition.next));
                }
                return transition.result;
            });
        },
    };
}
function acquireReanalysisLock(repository, candidate, nowMs = Date.now()) {
    return repository.transact(candidate.projectId, (current, jobStatus) => {
        if (!current || current.projectId !== candidate.projectId) {
            return {
                result: { kind: "acquired", storagePath: candidate.storagePath },
                next: candidate,
            };
        }
        if (jobStatus && TERMINAL_JOB_STATUSES.has(jobStatus)) {
            return {
                result: { kind: "acquired", storagePath: candidate.storagePath },
                next: candidate,
            };
        }
        if (jobStatus && ACTIVE_JOB_STATUSES.has(jobStatus)) {
            return {
                result: { kind: "coalesced", storagePath: current.storagePath },
            };
        }
        const ageMs = Math.max(0, nowMs - current.createdAtMs);
        if (jobStatus === null && current.state === "queued" && ageMs < QUEUED_LOCK_TTL_MS) {
            return {
                result: { kind: "coalesced", storagePath: current.storagePath },
            };
        }
        if (jobStatus === null && current.state === "preparing" && ageMs < PREPARING_LOCK_TTL_MS) {
            return {
                result: { kind: "busy", storagePath: current.storagePath },
            };
        }
        if (jobStatus !== null && !TERMINAL_JOB_STATUSES.has(jobStatus)) {
            return {
                result: { kind: "busy", storagePath: current.storagePath },
            };
        }
        return {
            result: { kind: "acquired", storagePath: candidate.storagePath },
            next: candidate,
        };
    });
}
function markReanalysisLockQueued(repository, projectId, uploadId) {
    return repository.transact(projectId, (current) => {
        if (!current || current.uploadId !== uploadId)
            return { result: false };
        return {
            result: true,
            next: { ...current, state: "queued" },
        };
    });
}
function releasePreparingReanalysisLock(repository, projectId, uploadId) {
    return repository.transact(projectId, (current) => {
        if (!current || current.uploadId !== uploadId || current.state !== "preparing") {
            return { result: false };
        }
        return { result: true, next: null };
    });
}
//# sourceMappingURL=reanalysisLock.js.map