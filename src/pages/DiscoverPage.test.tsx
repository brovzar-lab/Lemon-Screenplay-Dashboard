import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockOnSnapshot, mockUnsubscribe, mockGetDocFromServer } = vi.hoisted(() => ({
  mockOnSnapshot: vi.fn(),
  mockUnsubscribe: vi.fn(),
  mockGetDocFromServer: vi.fn(),
}));

const immutableRecords = new Map<string, Record<string, unknown>>();

let emitSnapshot:
  | ((snapshot: { docs: Array<{ data: () => Record<string, unknown> }> }) => void)
  | undefined;

vi.mock('@/lib/firebase', () => ({
  authReady: Promise.resolve(),
  db: {},
}));

vi.mock('@/lib/shareService', () => ({
  getAllSharedViews: vi.fn().mockResolvedValue([]),
  getExistingShareToken: vi.fn().mockResolvedValue(null),
  isScreenplaySynced: vi.fn().mockResolvedValue(true),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'uploaded-analyses'),
  query: vi.fn((reference: unknown) => reference),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  doc: vi.fn((...segments: unknown[]) => segments),
  getDocFromServer: (...args: unknown[]) => mockGetDocFromServer(...args),
  setDoc: vi.fn(),
  runTransaction: vi.fn(),
  Timestamp: { fromMillis: vi.fn() },
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  deleteField: vi.fn(),
  where: vi.fn(),
  getCountFromServer: vi.fn(),
}));

import DiscoverPage from '@/pages/DiscoverPage';

function rawAnalysis(title: string, score: number, sourceFile: string, verdict = 'RECOMMEND') {
  const contentHash = 'a'.repeat(64);
  const projectId = sourceFile.replace('.pdf', '').toLowerCase();
  const versionId = `${projectId}-version-1`;
  const result = {
    project_id: projectId,
    version_id: versionId,
    source_file: sourceFile,
    content_hash: contentHash,
    _trust_authority: 'immutable_server',
    trust_manifest_version: 'lemon-trust-manifest-v6',
    trust_manifest: {
      manifest_version: 'lemon-trust-manifest-v6',
      integrity_sha256: contentHash,
      analysis_payload_sha256: contentHash,
      source: { content_sha256: contentHash, source_file: sourceFile },
      origin: { project_id: projectId, version_id: versionId },
      engine: { analysis_version: 'v9_archaeology' },
      models: { calls: [{ response_id: 'msg_1' }] },
    },
    server_trust_attestation: {
      attestation_version: 'lemon-server-trust-attestation-v1',
      writer: 'firebase_admin',
      project_id: projectId,
      version_id: versionId,
      content_sha256: contentHash,
      trust_manifest_integrity_sha256: contentHash,
      analysis_payload_sha256: contentHash,
    },
    analysis_model: 'claude-sonnet-4',
    analysis_version: 'v9_archaeology',
    collection: 'LEMON',
    metadata: {
      filename: sourceFile,
      page_count: 104,
      word_count: 18_000,
    },
    analysis: {
      title,
      author: 'A. Writer',
      genre: 'Drama',
      subgenres: ['Mystery'],
      themes: ['Identity'],
      logline: `${title} comes from the Firestore analysis collection.`,
      tone: 'Tense',
      verdict,
      weighted_score: score,
      pillar_scores: {
        structure: { score, evidence: 'Strong structure.' },
        character: { score, evidence: 'Strong characters.' },
        craft_scene: { score, evidence: 'Strong craft.' },
        concept: { score, evidence: 'Strong concept.' },
        emotional_resonance: { score, evidence: 'Strong emotion.' },
      },
      strengths: ['Distinct voice'],
      weaknesses: [],
      development_notes: [],
      critical_failures: [],
      red_flags: [],
    },
  };
  immutableRecords.set(projectId, result);
  return result;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/discover?ui=classic']}>
        <DiscoverPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DiscoverPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      'lemon-local-analyses',
      JSON.stringify([rawAnalysis('Cactus Season', 7.4, 'Cactus Season.pdf')]),
    );

    emitSnapshot = undefined;
    immutableRecords.clear();
    mockUnsubscribe.mockReset();
    mockOnSnapshot.mockReset().mockImplementation((_query, onChange) => {
      emitSnapshot = onChange;
      return mockUnsubscribe;
    });
    mockGetDocFromServer.mockReset().mockImplementation(async (reference: unknown[]) => {
      const projectId = String(reference[2]);
      const collectionName = String(reference[3]);
      const version = immutableRecords.get(projectId);
      const manifest = version?.trust_manifest as Record<string, unknown> | undefined;
      const authority = version && manifest ? {
        authorityVersion: 'lemon-analysis-version-authority-v1',
        writer: 'firebase_admin',
        projectId,
        versionId: version.version_id,
        contentHash: version.content_hash,
        trustManifestIntegritySha256: manifest.integrity_sha256,
        analysisPayloadSha256: manifest.analysis_payload_sha256,
      } : undefined;
      const data = collectionName === 'version_authorities' ? authority : version;
      return { exists: () => Boolean(data), data: () => data };
    });
  });

  it('replaces normalized startup data with the live Firestore snapshot', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Cactus Season' })).toBeInTheDocument();
    expect(mockOnSnapshot).toHaveBeenCalledOnce();

    act(() => {
      emitSnapshot?.({
        docs: [
          {
            data: () => rawAnalysis('Midnight Orchard', 8.8, 'Midnight Orchard.pdf', 'FILM_NOW'),
          },
        ],
      });
    });

    expect(await screen.findByRole('heading', { name: 'Midnight Orchard' })).toBeInTheDocument();
    expect(screen.getAllByText('8.8').length).toBeGreaterThan(0);
    expect(
      within(await screen.findByTestId('discovery-featured')).getByText('FILM NOW'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Cactus Season')).not.toBeInTheDocument();
  });
});
