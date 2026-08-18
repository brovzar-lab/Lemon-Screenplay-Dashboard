"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onIngestCompleted = void 0;
exports.completedIngestProjectId = completedIngestProjectId;
exports.runAutomaticPoster = runAutomaticPoster;
const params_1 = require("firebase-functions/params");
const firestore_1 = require("firebase-functions/v2/firestore");
const posterService_1 = require("./posterService");
const googleApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
function completedIngestProjectId(before, after) {
    if (before?.status === 'complete' || after?.status !== 'complete')
        return null;
    return typeof after.screenplay_doc_id === 'string' ? after.screenplay_doc_id : '';
}
async function runAutomaticPoster(request, generate = posterService_1.generatePosterForProject) {
    try {
        await generate(request);
    }
    catch (error) {
        console.error('[poster] Automatic poster failed without changing ingest success:', error);
    }
}
exports.onIngestCompleted = (0, firestore_1.onDocumentUpdated)({
    document: 'ingest-queue/{jobId}',
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [googleApiKey],
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const projectId = completedIngestProjectId(before, after);
    if (projectId === null)
        return;
    if (!projectId) {
        console.error('[poster] Completed ingest has no screenplay_doc_id.', event.params.jobId);
        return;
    }
    await runAutomaticPoster({
        apiKey: googleApiKey.value(),
        projectId,
        requestId: `auto-${event.params.jobId}`,
        sourceId: event.params.jobId,
        model: 'economy',
    });
});
//# sourceMappingURL=onIngestCompleted.js.map