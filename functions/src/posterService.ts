import { randomUUID } from 'node:crypto';
import { GoogleGenAI, Modality } from '@google/genai';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { buildSimplePosterPrompt } from './posterPrompt';
import { reservePosterBudget, settlePosterBudget } from './posterBudget';
import { loadAuthorizedAnalysisVersion } from './analysisVersionAuthority';
import {
  POSTER_MODELS,
  canClaimPosterRequest,
  isCurrentV9Analysis,
  isPosterEligible,
  isPosterVersionCurrent,
  normalizePosterVerdict,
  posterDisposition,
  type PosterModelKey,
} from './posterCore';

const ANALYSES = 'uploaded_analyses';
const JOBS = 'poster_jobs';

export interface PosterGenerationResult {
  status: 'ready' | 'withheld' | 'skipped';
  model?: string;
  costMicrousd?: number;
  url?: string;
}

export interface PosterGenerationRequest {
  apiKey: string;
  projectId: string;
  requestId: string;
  sourceId: string;
  model: PosterModelKey;
}

function safePart(value: string): string {
  if (!value || value.includes('/')) throw new Error('Poster identity is invalid.');
  return value;
}

function downloadUrl(bucket: string, path: string, token: string): string {
  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}` +
    `?alt=media&token=${token}`
  );
}

export async function generatePosterForProject(
  request: PosterGenerationRequest,
): Promise<PosterGenerationResult> {
  const db = getFirestore();
  const projectId = safePart(request.projectId);
  const requestId = safePart(request.requestId);
  const projectRef = db.collection(ANALYSES).doc(projectId);
  const jobRef = db.collection(JOBS).doc(requestId);
  const snapshot = await projectRef.get();
  if (!snapshot.exists) throw new Error('Screenplay project not found.');

  const parent = snapshot.data() ?? {};
  const versionId = safePart(String(parent.latest_version_id ?? ''));
  const { version: document } = await loadAuthorizedAnalysisVersion(
    db,
    projectId,
    versionId,
  );
  if (!isCurrentV9Analysis(document.analysis_version)) {
    throw new Error('Posters are available only for completed V9 analyses.');
  }
  const analysis =
    document.analysis && typeof document.analysis === 'object'
      ? (document.analysis as Record<string, unknown>)
      : {};
  const verdict = normalizePosterVerdict(analysis.verdict);
  const disposition = posterDisposition(verdict);

  const claimed = await db.runTransaction(async (transaction) => {
    const prior = await transaction.get(jobRef);
    const current = await transaction.get(projectRef);
    const requestedAt = current.get('poster_requested_at') as { toMillis?: () => number } | null;
    if (
      !current.exists ||
      !canClaimPosterRequest({
        priorJobExists: prior.exists,
        currentVersion: current.get('latest_version_id'),
        expectedVersion: versionId,
        posterStatus: current.get('poster_status'),
        posterVersion: current.get('poster_version_id'),
        posterRequestedAtMs:
          typeof requestedAt?.toMillis === 'function' ? requestedAt.toMillis() : null,
        nowMs: Date.now(),
      })
    )
      return false;
    transaction.create(jobRef, {
      project_id: projectId,
      version_id: versionId,
      request_id: requestId,
      source_id: request.sourceId,
      model_key: request.model,
      model: POSTER_MODELS[request.model].id,
      status:
        disposition === 'withhold'
          ? 'withheld'
          : disposition === 'generate'
            ? 'generating'
            : 'skipped',
      created_at: FieldValue.serverTimestamp(),
    });
    transaction.update(
      projectRef,
      disposition === 'withhold'
        ? {
            poster_status: 'withheld',
            poster_version_id: versionId,
            poster_url: FieldValue.delete(),
            poster_model: FieldValue.delete(),
            poster_cost_microusd: FieldValue.delete(),
            poster_generated_at: FieldValue.delete(),
            poster_requested_at: FieldValue.delete(),
            poster_request_id: requestId,
            poster_last_error: FieldValue.delete(),
          }
        : {
            poster_status: disposition === 'generate' ? 'generating' : 'skipped',
            poster_version_id: versionId,
            poster_url: FieldValue.delete(),
            poster_model: POSTER_MODELS[request.model].id,
            poster_cost_microusd: FieldValue.delete(),
            poster_generated_at: FieldValue.delete(),
            poster_requested_at:
              disposition === 'generate' ? FieldValue.serverTimestamp() : FieldValue.delete(),
            poster_request_id: requestId,
            poster_last_error: FieldValue.delete(),
          },
    );
    return true;
  });

  if (!claimed) return { status: 'skipped' };
  if (disposition === 'withhold') return { status: 'withheld' };
  if (!isPosterEligible(verdict)) {
    await jobRef.update({ status: 'skipped', reason: 'unknown_verdict' });
    return { status: 'skipped' };
  }

  let paidCallStarted = false;
  let budgetDate: string | null = null;
  try {
    const prompt = buildSimplePosterPrompt(
      String(analysis.title ?? 'Untitled'),
      String(analysis.logline ?? ''),
      String(analysis.genre ?? 'drama'),
    );
    const ai = new GoogleGenAI({ apiKey: request.apiKey });
    budgetDate = await reservePosterBudget(requestId, request.model, request.sourceId);
    paidCallStarted = true;
    const response = await ai.models.generateContent({
      model: POSTER_MODELS[request.model].id,
      contents: prompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        imageConfig: { aspectRatio: '2:3', imageSize: '1K' },
      },
    });
    const image = (response.candidates?.[0]?.content?.parts ?? []).find(
      (part) => part.inlineData?.mimeType?.startsWith('image/') && part.inlineData.data,
    )?.inlineData;
    if (!image?.data) throw new Error('Google AI returned no poster image.');
    await settlePosterBudget(requestId, request.model, false, budgetDate);
    paidCallStarted = false;

    const token = randomUUID();
    const path = `Posters/${projectId}/${versionId}/${requestId}.png`;
    const bucket = getStorage().bucket();
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
          model: POSTER_MODELS[request.model].id,
        },
      },
    });
    const url = downloadUrl(bucket.name, path, token);

    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(projectRef);
      if (isPosterVersionCurrent(current.get('latest_version_id'), versionId)) {
        transaction.update(projectRef, {
          poster_url: url,
          poster_status: 'ready',
          poster_model: POSTER_MODELS[request.model].id,
          poster_version_id: versionId,
          poster_cost_microusd: POSTER_MODELS[request.model].costMicrousd,
          poster_generated_at: FieldValue.serverTimestamp(),
          poster_requested_at: FieldValue.delete(),
          poster_request_id: requestId,
          poster_last_error: FieldValue.delete(),
        });
      }
      transaction.update(jobRef, {
        status: 'ready',
        storage_path: path,
        url,
        cost_microusd: POSTER_MODELS[request.model].costMicrousd,
        completed_at: FieldValue.serverTimestamp(),
      });
    });
    return {
      status: 'ready',
      model: POSTER_MODELS[request.model].id,
      costMicrousd: POSTER_MODELS[request.model].costMicrousd,
      url,
    };
  } catch (error) {
    if (paidCallStarted && budgetDate) {
      try {
        await settlePosterBudget(requestId, request.model, true, budgetDate);
      } catch (budgetError) {
        console.error('[poster] Could not settle uncertain poster cost:', budgetError);
      }
    }
    const message = error instanceof Error ? error.message : 'Poster generation failed.';
    await jobRef.update({
      status: 'error',
      last_error: message.slice(0, 1000),
      completed_at: FieldValue.serverTimestamp(),
    });
    const current = await projectRef.get();
    if (isPosterVersionCurrent(current.get('latest_version_id'), versionId)) {
      await projectRef.update({
        poster_status: 'error',
        poster_last_error: message.slice(0, 500),
        poster_requested_at: FieldValue.delete(),
      });
    }
    throw error;
  }
}
