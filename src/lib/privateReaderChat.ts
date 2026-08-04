import { auth, authReady } from '@/lib/firebase';
import { getProxyAuthHeaders } from '@/lib/proxyClient';
import type {
  PrivateReaderConversation,
  PrivateReaderKey,
  PrivateReaderMessage,
  PrivateReaderModelChoice,
  ReaderReportEvidence,
} from '@/types';

const READER_CHAT_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/readerChat'
  : '/api/reader-chat';
const LOCAL_CHAT_KEY = 'lemon-local-private-reader-chat-v1';

interface ReaderChatResponse<T> {
  result?: T;
  error?: string;
  code?: string;
}

interface LocalConversationStore {
  [key: string]: PrivateReaderConversation;
}

export type PrivateReaderChatMode = 'local_review' | 'live' | 'not_activated';

export function privateReaderChatMode(): PrivateReaderChatMode {
  if (import.meta.env.VITE_READER_CHAT_LIVE === 'true') return 'live';
  return import.meta.env.DEV ? 'local_review' : 'not_activated';
}

function validateIdentity(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.includes('/') || normalized.length > 500) {
    throw new Error(`${label} is not valid.`);
  }
  return normalized;
}

function localConversationKey(input: {
  projectId: string;
  versionId: string;
  reader: PrivateReaderKey;
}): string {
  return JSON.stringify([input.projectId, input.versionId, input.reader]);
}

function readLocalStore(): LocalConversationStore {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_CHAT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as LocalConversationStore
      : {};
  } catch {
    return {};
  }
}

function emptyConversation(input: {
  key: string;
  projectId: string;
  versionId: string;
}): PrivateReaderConversation {
  return {
    threadId: `local-review::${input.key}`,
    exists: false,
    messages: [],
    routingAudits: [],
    provenance: {
      charterVersion: 'reader-charters-v1',
      modelId: 'No model called in local review',
      sealedProjectId: input.projectId,
      sealedVersionId: input.versionId,
    },
  };
}

async function request<T>(body: Record<string, unknown>): Promise<T> {
  await authReady;
  if (!auth.currentUser) throw new Error('Lemon Studios sign-in required.');
  let response: Response;
  try {
    response = await fetch(READER_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getProxyAuthHeaders()),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Private Reader Chat could not reach the secure service.');
  }
  const payload = await response.json() as ReaderChatResponse<T>;
  if (!response.ok || !payload.result) {
    throw new Error(payload.error || `Private Reader Chat failed (${response.status}).`);
  }
  return payload.result;
}

export async function loadPrivateReaderConversation(input: {
  projectId: string;
  versionId: string;
  reader: PrivateReaderKey;
}): Promise<PrivateReaderConversation> {
  const projectId = validateIdentity(input.projectId, 'Project');
  const versionId = validateIdentity(input.versionId, 'Analysis version');
  const mode = privateReaderChatMode();
  const key = localConversationKey({ ...input, projectId, versionId });
  if (mode === 'not_activated') {
    return emptyConversation({ key, projectId, versionId });
  }
  if (mode === 'local_review') {
    return readLocalStore()[key] ?? emptyConversation({ key, projectId, versionId });
  }
  return request<PrivateReaderConversation>({
    action: 'load_conversation',
    projectId,
    versionId,
    reader: input.reader,
  });
}

function localEvidenceReply(report: ReaderReportEvidence): {
  text: string;
  citations: Array<{ page: number; note: string }>;
} {
  const citations = report.subScores.flatMap((subScore) =>
    subScore.pageCitations.map((page) => ({
      page,
      note: `${subScore.label}: ${subScore.justification || 'Sealed reader evidence.'}`,
    })),
  ).slice(0, 6);
  return {
    text: [
      'This is the no-cost local review response, assembled only to test the private-conversation experience.',
      `My sealed position remains: ${report.oneSentenceVerdict || 'No summary verdict was preserved.'}`,
      'When live chat is separately activated, I will answer the exact question against the screenplay PDF and can clarify or reconsider my position with page citations.',
    ].join('\n\n'),
    citations,
  };
}

export async function sendPrivateReaderMessage(input: {
  projectId: string;
  versionId: string;
  reader: PrivateReaderKey;
  message: string;
  sealedReport: ReaderReportEvidence;
  modelChoice?: PrivateReaderModelChoice;
  deepReview?: boolean;
}): Promise<PrivateReaderConversation> {
  const projectId = validateIdentity(input.projectId, 'Project');
  const versionId = validateIdentity(input.versionId, 'Analysis version');
  const message = input.message.trim();
  if (!message || message.length > 4_000) {
    throw new Error('Your message must be between 1 and 4,000 characters.');
  }
  const mode = privateReaderChatMode();
  const modelChoice = input.deepReview ? 'fable' : (input.modelChoice ?? 'auto');
  if (mode === 'not_activated') {
    throw new Error('Private Reader Chat has not been activated for production.');
  }
  if (mode === 'live') {
    await request({
      action: 'send_message',
      projectId,
      versionId,
      reader: input.reader,
      message,
      modelChoice,
      deepReview: input.deepReview === true,
    });
    return loadPrivateReaderConversation({ ...input, projectId, versionId });
  }

  const existing = await loadPrivateReaderConversation({ ...input, projectId, versionId });
  const now = new Date().toISOString();
  const producerMessage: PrivateReaderMessage = {
    id: crypto.randomUUID(),
    role: 'producer',
    text: message,
    citations: [],
    createdAt: now,
  };
  const localReply = localEvidenceReply(input.sealedReport);
  const readerMessage: PrivateReaderMessage = {
    id: crypto.randomUUID(),
    role: 'reader',
    text: localReply.text,
    citations: localReply.citations,
    position: 'unchanged',
    modelId: modelChoice === 'fable' ? 'claude-fable-5' : 'claude-opus-5',
    effort: 'high',
    requestedModelChoice: modelChoice,
    routeReason: input.deepReview
      ? 'producer_deep_review'
      : modelChoice === 'fable'
        ? 'producer_selected_fable'
        : modelChoice === 'opus'
          ? 'producer_selected_opus'
          : 'auto_default_opus',
    routeLabel: input.deepReview
      ? 'Previewing a Fable deep review'
      : modelChoice === 'fable'
        ? 'Previewing your Fable 5 selection'
        : modelChoice === 'opus'
          ? 'Previewing your Opus 5 selection'
          : 'Previewing Auto with Opus 5',
    routingPolicyVersion: 'reader-chat-routing-v1',
    modelAttempts: [{
      modelId: modelChoice === 'fable' ? 'claude-fable-5' : 'claude-opus-5',
      outcome: 'success',
      usage: { actual_cost_usd: 0 },
    }],
    usage: { actual_cost_usd: 0 },
    simulated: true,
    createdAt: now,
  };
  const conversation: PrivateReaderConversation = {
    ...existing,
    exists: true,
    messages: [...existing.messages, producerMessage, readerMessage],
    provenance: {
      ...existing.provenance,
      modelId: readerMessage.modelId,
      effort: 'high',
      requestedModelChoice: modelChoice,
      routeReason: readerMessage.routeReason,
      routeLabel: readerMessage.routeLabel,
      routingPolicyVersion: 'reader-chat-routing-v1',
      modelAttempts: readerMessage.modelAttempts,
    },
  };
  const key = localConversationKey({ ...input, projectId, versionId });
  window.localStorage.setItem(
    LOCAL_CHAT_KEY,
    JSON.stringify({ ...readLocalStore(), [key]: conversation }),
  );
  return conversation;
}
