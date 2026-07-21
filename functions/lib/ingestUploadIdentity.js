"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIngestPath = parseIngestPath;
exports.buildIngestJobId = buildIngestJobId;
exports.readTargetProjectId = readTargetProjectId;
const node_crypto_1 = require("node:crypto");
const ingestQueue_1 = require("./ingestQueue");
/** Accept current upload-ID paths and legacy three-segment paths. */
function parseIngestPath(objectName) {
    const name = objectName.startsWith('/') ? objectName.slice(1) : objectName;
    const parts = name.split('/');
    const isLegacy = parts.length === 3;
    const isCurrent = parts.length === 4;
    if ((!isLegacy && !isCurrent) || parts[0] !== 'ingest-queue')
        return null;
    const rawCollection = parts[1].toUpperCase();
    if (!ingestQueue_1.VALID_COLLECTIONS.includes(rawCollection))
        return null;
    const uploadId = isCurrent ? parts[2] : null;
    const filename = isCurrent ? parts[3] : parts[2];
    if (!filename || !filename.toLowerCase().endsWith('.pdf'))
        return null;
    if (uploadId !== null && !/^[a-zA-Z0-9_-]{8,128}$/.test(uploadId))
        return null;
    return {
        collection_id: rawCollection,
        upload_id: uploadId,
        filename,
    };
}
/** One object generation maps to one deterministic queue document. */
function buildIngestJobId(objectName, storageGeneration) {
    if (!storageGeneration.trim()) {
        throw new Error('Storage generation is required for ingest idempotency.');
    }
    const digest = (0, node_crypto_1.createHash)('sha256')
        .update(objectName)
        .update('\0')
        .update(storageGeneration)
        .digest('hex');
    return `upload_${digest}`;
}
/** Read an optional stable parent ID from trusted upload metadata. */
function readTargetProjectId(metadata) {
    const raw = metadata.targetProjectId;
    if (!raw)
        return null;
    const targetProjectId = raw.trim();
    if (!targetProjectId ||
        targetProjectId.length > 200 ||
        targetProjectId.includes('/')) {
        throw new Error('Storage metadata targetProjectId is not a valid Firestore document ID.');
    }
    return targetProjectId;
}
//# sourceMappingURL=ingestUploadIdentity.js.map