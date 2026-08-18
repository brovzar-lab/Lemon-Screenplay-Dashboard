"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePosterForProject = generatePosterForProject;
const node_crypto_1 = require("node:crypto");
const genai_1 = require("@google/genai");
const firestore_1 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const posterPrompt_1 = require("./posterPrompt");
const posterBudget_1 = require("./posterBudget");
const posterCore_1 = require("./posterCore");
const ANALYSES = 'uploaded_analyses';
const JOBS = 'poster_jobs';
function safePart(value) {
    if (!value || value.includes('/'))
        throw new Error('Poster identity is invalid.');
    return value;
}
function downloadUrl(bucket, path, token) {
    return (`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}` +
        `?alt=media&token=${token}`);
}
async function generatePosterForProject(request) {
    const db = (0, firestore_1.getFirestore)();
    const projectId = safePart(request.projectId);
    const requestId = safePart(request.requestId);
    const projectRef = db.collection(ANALYSES).doc(projectId);
    const jobRef = db.collection(JOBS).doc(requestId);
    const snapshot = await projectRef.get();
    if (!snapshot.exists)
        throw new Error('Screenplay project not found.');
    const document = snapshot.data() ?? {};
    if (!(0, posterCore_1.isCurrentV9Analysis)(document.analysis_version)) {
        throw new Error('Posters are available only for completed V9 analyses.');
    }
    const versionId = safePart(String(document.latest_version_id ?? ''));
    const analysis = document.analysis && typeof document.analysis === 'object'
        ? document.analysis
        : {};
    const verdict = (0, posterCore_1.normalizePosterVerdict)(analysis.verdict);
    const disposition = (0, posterCore_1.posterDisposition)(verdict);
    const claimed = await db.runTransaction(async (transaction) => {
        const prior = await transaction.get(jobRef);
        const current = await transaction.get(projectRef);
        const requestedAt = current.get('poster_requested_at');
        if (!current.exists ||
            !(0, posterCore_1.canClaimPosterRequest)({
                priorJobExists: prior.exists,
                currentVersion: current.get('latest_version_id'),
                expectedVersion: versionId,
                posterStatus: current.get('poster_status'),
                posterVersion: current.get('poster_version_id'),
                posterRequestedAtMs: typeof requestedAt?.toMillis === 'function' ? requestedAt.toMillis() : null,
                nowMs: Date.now(),
            }))
            return false;
        transaction.create(jobRef, {
            project_id: projectId,
            version_id: versionId,
            request_id: requestId,
            source_id: request.sourceId,
            model_key: request.model,
            model: posterCore_1.POSTER_MODELS[request.model].id,
            status: disposition === 'withhold'
                ? 'withheld'
                : disposition === 'generate'
                    ? 'generating'
                    : 'skipped',
            created_at: firestore_1.FieldValue.serverTimestamp(),
        });
        transaction.update(projectRef, disposition === 'withhold'
            ? {
                poster_status: 'withheld',
                poster_version_id: versionId,
                poster_url: firestore_1.FieldValue.delete(),
                poster_model: firestore_1.FieldValue.delete(),
                poster_cost_microusd: firestore_1.FieldValue.delete(),
                poster_generated_at: firestore_1.FieldValue.delete(),
                poster_requested_at: firestore_1.FieldValue.delete(),
                poster_request_id: requestId,
                poster_last_error: firestore_1.FieldValue.delete(),
            }
            : {
                poster_status: disposition === 'generate' ? 'generating' : 'skipped',
                poster_version_id: versionId,
                poster_url: firestore_1.FieldValue.delete(),
                poster_model: posterCore_1.POSTER_MODELS[request.model].id,
                poster_cost_microusd: firestore_1.FieldValue.delete(),
                poster_generated_at: firestore_1.FieldValue.delete(),
                poster_requested_at: disposition === 'generate' ? firestore_1.FieldValue.serverTimestamp() : firestore_1.FieldValue.delete(),
                poster_request_id: requestId,
                poster_last_error: firestore_1.FieldValue.delete(),
            });
        return true;
    });
    if (!claimed)
        return { status: 'skipped' };
    if (disposition === 'withhold')
        return { status: 'withheld' };
    if (!(0, posterCore_1.isPosterEligible)(verdict)) {
        await jobRef.update({ status: 'skipped', reason: 'unknown_verdict' });
        return { status: 'skipped' };
    }
    let paidCallStarted = false;
    let budgetDate = null;
    try {
        const prompt = (0, posterPrompt_1.buildSimplePosterPrompt)(String(analysis.title ?? 'Untitled'), String(analysis.logline ?? ''), String(analysis.genre ?? 'drama'));
        const ai = new genai_1.GoogleGenAI({ apiKey: request.apiKey });
        budgetDate = await (0, posterBudget_1.reservePosterBudget)(requestId, request.model, request.sourceId);
        paidCallStarted = true;
        const response = await ai.models.generateContent({
            model: posterCore_1.POSTER_MODELS[request.model].id,
            contents: prompt,
            config: {
                responseModalities: [genai_1.Modality.TEXT, genai_1.Modality.IMAGE],
                imageConfig: { aspectRatio: '2:3', imageSize: '1K' },
            },
        });
        const image = (response.candidates?.[0]?.content?.parts ?? []).find((part) => part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data)?.inlineData;
        if (!image?.data)
            throw new Error('Google AI returned no poster image.');
        await (0, posterBudget_1.settlePosterBudget)(requestId, request.model, false, budgetDate);
        paidCallStarted = false;
        const token = (0, node_crypto_1.randomUUID)();
        const path = `Posters/${projectId}/${versionId}/${requestId}.png`;
        const bucket = (0, storage_1.getStorage)().bucket();
        await bucket.file(path).save(Buffer.from(image.data, 'base64'), {
            resumable: false,
            metadata: {
                contentType: image.mimeType ?? 'image/png',
                cacheControl: 'public,max-age=31536000,immutable',
                metadata: {
                    firebaseStorageDownloadTokens: token,
                    projectId,
                    versionId,
                    requestId,
                    model: posterCore_1.POSTER_MODELS[request.model].id,
                },
            },
        });
        const url = downloadUrl(bucket.name, path, token);
        await db.runTransaction(async (transaction) => {
            const current = await transaction.get(projectRef);
            if ((0, posterCore_1.isPosterVersionCurrent)(current.get('latest_version_id'), versionId)) {
                transaction.update(projectRef, {
                    poster_url: url,
                    poster_status: 'ready',
                    poster_model: posterCore_1.POSTER_MODELS[request.model].id,
                    poster_version_id: versionId,
                    poster_cost_microusd: posterCore_1.POSTER_MODELS[request.model].costMicrousd,
                    poster_generated_at: firestore_1.FieldValue.serverTimestamp(),
                    poster_requested_at: firestore_1.FieldValue.delete(),
                    poster_request_id: requestId,
                    poster_last_error: firestore_1.FieldValue.delete(),
                });
            }
            transaction.update(jobRef, {
                status: 'ready',
                storage_path: path,
                url,
                cost_microusd: posterCore_1.POSTER_MODELS[request.model].costMicrousd,
                completed_at: firestore_1.FieldValue.serverTimestamp(),
            });
        });
        return {
            status: 'ready',
            model: posterCore_1.POSTER_MODELS[request.model].id,
            costMicrousd: posterCore_1.POSTER_MODELS[request.model].costMicrousd,
            url,
        };
    }
    catch (error) {
        if (paidCallStarted && budgetDate) {
            try {
                await (0, posterBudget_1.settlePosterBudget)(requestId, request.model, true, budgetDate);
            }
            catch (budgetError) {
                console.error('[poster] Could not settle uncertain poster cost:', budgetError);
            }
        }
        const message = error instanceof Error ? error.message : 'Poster generation failed.';
        await jobRef.update({
            status: 'error',
            last_error: message.slice(0, 1000),
            completed_at: firestore_1.FieldValue.serverTimestamp(),
        });
        const current = await projectRef.get();
        if ((0, posterCore_1.isPosterVersionCurrent)(current.get('latest_version_id'), versionId)) {
            await projectRef.update({
                poster_status: 'error',
                poster_last_error: message.slice(0, 500),
                poster_requested_at: firestore_1.FieldValue.delete(),
            });
        }
        throw error;
    }
}
//# sourceMappingURL=posterService.js.map