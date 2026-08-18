import { defineSecret } from 'firebase-functions/params';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { generatePosterForProject } from './posterService';

const googleApiKey = defineSecret('GEMINI_API_KEY');

type QueueRecord = Record<string, unknown> | undefined;

export function completedIngestProjectId(before: QueueRecord, after: QueueRecord): string | null {
  if (before?.status === 'complete' || after?.status !== 'complete') return null;
  return typeof after.screenplay_doc_id === 'string' ? after.screenplay_doc_id : '';
}

export async function runAutomaticPoster(
  request: Parameters<typeof generatePosterForProject>[0],
  generate: typeof generatePosterForProject = generatePosterForProject,
): Promise<void> {
  try {
    await generate(request);
  } catch (error) {
    console.error('[poster] Automatic poster failed without changing ingest success:', error);
  }
}

export const onIngestCompleted = onDocumentUpdated(
  {
    document: 'ingest-queue/{jobId}',
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [googleApiKey],
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const projectId = completedIngestProjectId(before, after);
    if (projectId === null) return;
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
  },
);
