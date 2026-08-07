import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';

import { auth, authReady, db } from '@/lib/firebase';
import { getProxyAuthHeaders } from '@/lib/proxyClient';
import type {
  ActiveCalibrationProfile,
  CalibrationCandidate,
  ProducerAssessment,
  ProducerAssessmentHead,
  ProducerJudgment,
  RecommendationTier,
  SubmitProducerAssessmentInput,
} from '@/types';

const CALIBRATION_URL = import.meta.env.DEV
  ? 'http://127.0.0.1:5001/lemon-screenplay-dashboard/us-central1/calibrationManager'
  : '/api/calibration';
const LOCAL_PRODUCER_TAKES_KEY = 'lemon-local-producer-takes-v1';
const LOCAL_PRODUCER_WORKING_DRAFTS_KEY = 'lemon-local-producer-working-drafts-v1';

export interface LocalProducerTakeDraft {
  schemaVersion: 'lemon-local-producer-take-v1';
  projectId: string;
  versionId: string;
  title: string;
  aiFinalScore: number;
  aiVerdict: RecommendationTier;
  judgment: ProducerJudgment;
  revision: number;
  savedAt: string;
}

export interface LocalProducerWorkingDraft {
  schemaVersion: 'lemon-local-producer-working-draft-v1';
  projectId: string;
  versionId: string;
  judgment: ProducerJudgment;
  savedAt: string;
}

export const TASTE_SIGNAL_LABELS = {
  reading_pleasure: 'Reading pleasure',
  comedy: 'Comedy',
  voice: 'Voice',
  emotional_impact: 'Emotional impact',
  actor_appeal: 'Actor appeal',
  commercial_instinct: 'Commercial instinct',
  originality: 'Originality',
  cultural_specificity: 'Cultural specificity',
  development_upside: 'Development upside',
  character_agency: 'Character agency',
  genre_delivery: 'Genre delivery',
} as const;

export const EMPTY_PRODUCER_JUDGMENT: ProducerJudgment = {
  producerScore: 5,
  producerVerdict: 'consider',
  pursuit: 'maybe',
  fixability: 'medium',
  confidence: 'low',
  tasteSignals: [],
  aiMissed: '',
  aiGotRight: '',
  pillarOverrides: {},
  includeInCalibration: false,
};

interface CalibrationResponse<T> {
  result?: T;
  error?: string;
}

export function isExpectedLocalCalibrationPredeployError(
  error: unknown,
): boolean {
  if (!import.meta.env.DEV || typeof error !== 'object' || error === null) {
    return false;
  }
  const code =
    'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === 'permission-denied' || code === 'firestore/permission-denied';
}

export function isLocalCalibrationPreviewMode(): boolean {
  return import.meta.env.DEV;
}

function readLocalProducerTakes(): Record<string, LocalProducerTakeDraft> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(LOCAL_PRODUCER_TAKES_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    return parsed as Record<string, LocalProducerTakeDraft>;
  } catch {
    return {};
  }
}

function readLocalProducerWorkingDrafts(): Record<string, LocalProducerWorkingDraft> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(LOCAL_PRODUCER_WORKING_DRAFTS_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, LocalProducerWorkingDraft>;
  } catch {
    return {};
  }
}

export function loadLocalProducerWorkingDraft(
  projectId: string,
): LocalProducerWorkingDraft | null {
  return readLocalProducerWorkingDrafts()[requireDocumentId(projectId, 'Project')] ?? null;
}

export function saveLocalProducerWorkingDraft(input: {
  projectId: string;
  versionId: string;
  judgment: ProducerJudgment;
}): LocalProducerWorkingDraft {
  if (typeof window === 'undefined') {
    throw new Error('Producer Take drafts require a browser session.');
  }
  const projectId = requireDocumentId(input.projectId, 'Project');
  const current = readLocalProducerWorkingDrafts();
  const draft: LocalProducerWorkingDraft = {
    schemaVersion: 'lemon-local-producer-working-draft-v1',
    projectId,
    versionId: requireDocumentId(input.versionId, 'Analysis version'),
    judgment: {
      ...input.judgment,
      includeInCalibration:
        input.judgment.confidence === 'low' ? false : input.judgment.includeInCalibration,
    },
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    LOCAL_PRODUCER_WORKING_DRAFTS_KEY,
    JSON.stringify({ ...current, [projectId]: draft }),
  );
  return draft;
}

export function clearLocalProducerWorkingDraft(projectId: string): void {
  if (typeof window === 'undefined') return;
  const normalizedProjectId = requireDocumentId(projectId, 'Project');
  const current = readLocalProducerWorkingDrafts();
  if (!(normalizedProjectId in current)) return;
  delete current[normalizedProjectId];
  window.localStorage.setItem(LOCAL_PRODUCER_WORKING_DRAFTS_KEY, JSON.stringify(current));
}

export function loadLocalProducerTakeDraft(
  projectId: string,
): LocalProducerTakeDraft | null {
  return (
    readLocalProducerTakes()[requireDocumentId(projectId, 'Project')] ?? null
  );
}

export function saveLocalProducerTakeDraft(input: {
  projectId: string;
  versionId: string;
  title: string;
  aiFinalScore: number;
  aiVerdict: RecommendationTier;
  judgment: ProducerJudgment;
}): LocalProducerTakeDraft {
  if (typeof window === 'undefined') {
    throw new Error('Local Producer Take drafts require a browser session.');
  }

  const projectId = requireDocumentId(input.projectId, 'Project');
  const current = readLocalProducerTakes();
  const previous = current[projectId];
  const draft: LocalProducerTakeDraft = {
    schemaVersion: 'lemon-local-producer-take-v1',
    projectId,
    versionId: requireDocumentId(input.versionId, 'Analysis version'),
    title: input.title.trim() || 'Untitled screenplay',
    aiFinalScore: input.aiFinalScore,
    aiVerdict: input.aiVerdict,
    judgment: validateProducerJudgment(input.judgment),
    revision: (previous?.revision ?? 0) + 1,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(
    LOCAL_PRODUCER_TAKES_KEY,
    JSON.stringify({ ...current, [projectId]: draft }),
  );
  return draft;
}

export function loadLocalProducerAssessmentHeads(): ProducerAssessmentHead[] {
  if (!isLocalCalibrationPreviewMode()) return [];
  return Object.values(readLocalProducerTakes())
    .map((draft) => ({
      producerUid: 'local-preview',
      projectId: draft.projectId,
      latestAssessmentId: `local-preview__${draft.projectId}`,
      revision: draft.revision,
      versionId: draft.versionId,
      title: draft.title,
      aiFinalScore: draft.aiFinalScore,
      aiVerdict: draft.aiVerdict,
      producerScore: draft.judgment.producerScore,
      producerVerdict: draft.judgment.producerVerdict,
      pursuit: draft.judgment.pursuit,
      includeInCalibration: draft.judgment.includeInCalibration,
      updatedAt: draft.savedAt,
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function requireDocumentId(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.includes('/') || normalized.length > 500) {
    throw new Error(`${label} is not a valid screenplay identity.`);
  }
  return normalized;
}

export function producerAssessmentHeadId(
  producerUid: string,
  projectId: string,
): string {
  return `${requireDocumentId(producerUid, 'Producer')}__${requireDocumentId(
    projectId,
    'Project',
  )}`;
}

export function validateProducerJudgment(
  judgment: ProducerJudgment,
): ProducerJudgment {
  if (
    !Number.isFinite(judgment.producerScore) ||
    judgment.producerScore < 1 ||
    judgment.producerScore > 10
  ) {
    throw new Error('Producer score must be between 1 and 10.');
  }
  if (!judgment.aiMissed.trim() && !judgment.aiGotRight.trim()) {
    throw new Error(
      'Add one short note about what the analysis missed or got right.',
    );
  }
  return {
    ...judgment,
    producerScore: Math.round(judgment.producerScore * 10) / 10,
    tasteSignals: [...new Set(judgment.tasteSignals)].slice(0, 11),
    aiMissed: judgment.aiMissed.trim().slice(0, 5_000),
    aiGotRight: judgment.aiGotRight.trim().slice(0, 5_000),
    includeInCalibration:
      judgment.confidence === 'low' ? false : judgment.includeInCalibration,
  };
}

async function callCalibrationManager<T>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(CALIBRATION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getProxyAuthHeaders()),
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = (await response.json()) as CalibrationResponse<T>;
  if (!response.ok || body.result === undefined) {
    throw new Error(
      body.error || `Calibration request failed (${response.status}).`,
    );
  }
  return body.result;
}

export async function submitProducerAssessment(
  input: SubmitProducerAssessmentInput,
): Promise<ProducerAssessment> {
  return callCalibrationManager<ProducerAssessment>('submit_assessment', {
    projectId: requireDocumentId(input.projectId, 'Project'),
    versionId: requireDocumentId(input.versionId, 'Analysis version'),
    judgment: validateProducerJudgment(input.judgment),
  });
}

export async function loadProducerAssessmentHead(
  projectId: string,
): Promise<ProducerAssessmentHead | null> {
  await authReady;
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const reference = doc(
    db,
    'producer_assessment_heads',
    producerAssessmentHeadId(uid, projectId),
  );
  const snapshot = await getDoc(reference);
  return snapshot.exists() ? (snapshot.data() as ProducerAssessmentHead) : null;
}

export async function loadProducerAssessment(
  projectId: string,
): Promise<ProducerAssessment | null> {
  const head = await loadProducerAssessmentHead(projectId);
  if (!head) return null;
  const snapshot = await getDoc(
    doc(db, 'producer_assessments', head.latestAssessmentId),
  );
  return snapshot.exists() ? (snapshot.data() as ProducerAssessment) : null;
}

export async function loadProducerAssessmentHeads(): Promise<
  ProducerAssessmentHead[]
> {
  await authReady;
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const snapshot = await getDocs(
    query(
      collection(db, 'producer_assessment_heads'),
      orderBy('updatedAt', 'desc'),
    ),
  );
  return snapshot.docs
    .map((item) => item.data() as ProducerAssessmentHead)
    .filter((item) => item.producerUid === uid);
}

export async function buildCalibrationCandidate(input: {
  trainingAssessmentIds: string[];
  holdoutAssessmentIds: string[];
}): Promise<CalibrationCandidate> {
  return callCalibrationManager<CalibrationCandidate>('build_candidate', input);
}

export async function activateCalibrationCandidate(
  candidateId: string,
): Promise<ActiveCalibrationProfile> {
  return callCalibrationManager<ActiveCalibrationProfile>(
    'activate_candidate',
    {
      candidateId: requireDocumentId(candidateId, 'Candidate'),
    },
  );
}

export async function rollbackCalibrationProfile(
  candidateId: string,
): Promise<ActiveCalibrationProfile> {
  return callCalibrationManager<ActiveCalibrationProfile>('rollback_profile', {
    candidateId: requireDocumentId(candidateId, 'Candidate'),
  });
}

export async function loadCalibrationCandidates(): Promise<
  CalibrationCandidate[]
> {
  const snapshot = await getDocs(
    query(
      collection(db, 'producer_profiles', 'admin', 'versions'),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snapshot.docs.map((item) => item.data() as CalibrationCandidate);
}

export async function loadActiveCalibrationProfile(): Promise<ActiveCalibrationProfile | null> {
  const snapshot = await getDoc(doc(db, 'producer_profiles', 'admin'));
  return snapshot.exists()
    ? (snapshot.data() as ActiveCalibrationProfile)
    : null;
}
