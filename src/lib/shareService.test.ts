import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Note, Screenplay } from '@/types';
import { createTestScreenplay } from '@/test/factories';

const mockGetDoc = vi.fn();
const mockDoc = vi.fn((_db: unknown, col: string, id: string) => ({ id, path: `${col}/${id}` }));

vi.mock('firebase/firestore', () => ({
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
}));

vi.mock('./firebase', () => ({ authReady: Promise.resolve(), db: {} }));
vi.mock('./proxyClient', () => ({
  getProxyAuthHeaders: vi.fn(async () => ({ Authorization: 'Bearer test-token' })),
}));
vi.mock('./analysisStore', () => ({
  toDocId: (value: string) => value.replaceAll('/', '_'),
}));
vi.mock('@/stores/shareStore', () => ({
  useShareStore: { getState: () => ({ removeToken: vi.fn() }) },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  createShareToken,
  getAllSharedViews,
  getExistingShareToken,
  isScreenplaySynced,
  resolveShareToken,
  revokeShareToken,
  updateShareNotes,
} from './shareService';

const sha = 'a'.repeat(64);
const versionId = 'version-1';

function trustedScreenplay(overrides: Partial<Screenplay> = {}) {
  return createTestScreenplay({
    id: 'sp-001',
    projectId: 'project-001',
    latestVersionId: versionId,
    sourceFile: 'Guión Ñ.pdf',
    title: 'Guión Ñ',
    ...overrides,
  });
}

function sealedShare(token = 'sealed-token') {
  return {
    token,
    screenplayId: 'Guión Ñ.pdf',
    screenplayTitle: 'Guión Ñ',
    includeNotes: false,
    createdAt: '2026-08-28T12:00:00Z',
    expiresAt: '2099-09-27T12:00:00Z',
    expiresAtMillis: Date.parse('2099-09-27T12:00:00Z'),
    pdfUrl: null,
    posterUrl: null,
    sealedVersion: {
      project_id: 'project-001',
      version_id: versionId,
      latest_version_id: versionId,
      source_file: 'Guión Ñ.pdf',
      latest_source_file: 'Guión Ñ.pdf',
      content_hash: sha,
      identity_status: 'verified',
      analysis_version: 'v9_archaeology',
      trust_manifest_version: 'lemon-public-share-manifest-v1',
      analysis: {
        title: 'Guión Ñ',
        weighted_score: 7.5,
        weighted_score_adjusted: 7.5,
        verdict: 'RECOMMEND',
        pillar_scores: {
          structure: { score: 7.5 },
          character: { score: 7.5 },
          craft_scene: { score: 7.5 },
          concept: { score: 7.5 },
          emotional_resonance: { score: 7.5 },
        },
      },
      metadata: { page_count: 100, word_count: 20_000 },
      trust_manifest: {
        manifest_version: 'lemon-public-share-manifest-v1',
        integrity_sha256: sha,
        canonical_manifest_integrity_sha256: sha,
        canonical_analysis_payload_sha256: sha,
        public_payload_scope: 'analysis_and_localized_analysis',
        analysis_payload_sha256: sha,
        source: { content_sha256: sha, source_file: 'Guión Ñ.pdf' },
        origin: { project_id: 'project-001', version_id: versionId },
        engine: { analysis_version: 'v9_archaeology' },
        models: { call_count: 1, provenance_sha256: sha },
        readers: {
          quality_status: 'complete',
          expected_specialist_readers: 5,
          completed_specialist_readers: 5,
          failed_reader_count: 0,
        },
        claim_verification: {
          status: 'passed_independent_model_review',
          verification_scope: 'semantic_support_against_full_physical_page_source',
          claim_count: 10,
          factual_support_rate: 1,
          claims_sha256: sha,
        },
        score_lineage: { adjusted_score: 7.5, final_verdict: 'RECOMMEND' },
      },
      server_trust_attestation: {
        attestation_version: 'lemon-public-share-attestation-v1',
        writer: 'share_manager',
        project_id: 'project-001',
        version_id: versionId,
        content_sha256: sha,
        canonical_trust_manifest_integrity_sha256: sha,
        canonical_analysis_payload_sha256: sha,
        trust_manifest_integrity_sha256: sha,
        analysis_payload_sha256: sha,
        public_payload_scope: 'analysis_and_localized_analysis',
      },
    },
  };
}

describe('shareService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        token: 'server-share-token',
        expiresAt: '2026-09-27T00:00:00.000Z',
      }),
    });
  });

  it('asks the server to create a share from the exact immutable version', async () => {
    const note: Note = {
      id: 'note-1',
      screenplayId: 'sp-001',
      author: 'Producer',
      content: 'Producer note',
      createdAt: '2026-08-28T12:00:00Z',
      updatedAt: '2026-08-28T12:05:00Z',
    };
    const result = await createShareToken('Guión Ñ.pdf', trustedScreenplay(), true, [note]);

    expect(result.token).toBe('server-share-token');
    expect(result.url).toContain('/share/server-share-token');
    const request = mockFetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      projectId: 'project-001',
      versionId,
      screenplayId: 'Guión Ñ.pdf',
      includeNotes: true,
      notes: [{ content: 'Producer note', createdAt: '2026-08-28T12:00:00Z' }],
    });
  });

  it('blocks unverified, versionless, failed, or custom-lifetime shares', async () => {
    await expect(createShareToken('sp', trustedScreenplay({
      producerProjection: undefined,
    }), false)).rejects.toThrow(/verified, rankable/);
    await expect(createShareToken('sp', createTestScreenplay({
      projectId: undefined,
      latestVersionId: undefined,
    }), false)).rejects.toThrow(
      /exact immutable/,
    );
    await expect(createShareToken('sp', trustedScreenplay(), false, undefined, 7)).rejects.toThrow(
      /30-day/,
    );
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'The exact analysis version does not exist.' }),
    });
    await expect(createShareToken('sp', trustedScreenplay(), false)).rejects.toThrow(
      /does not exist/,
    );
  });

  it('resolves only a token-bound Admin-authored sealed share', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sealedShare(),
    });
    const result = await resolveShareToken('sealed-token');
    expect(result?.analysis.title).toBe('Guión Ñ');
    expect(result?.analysis.producerProjection).toMatchObject({
      rankable: true,
      trustStatus: 'verified',
    });

    const staleLocalized = sealedShare();
    staleLocalized.sealedVersion.localized_analysis = {
      es: {
        sourceVersionId: 'older-version',
        generatedAt: '2026-08-28T12:00:00Z',
        model: 'claude-sonnet-4-6',
        content: { strengths: ['Stale translation'] },
      },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => staleLocalized,
    });
    await expect(resolveShareToken('sealed-token')).resolves.toMatchObject({
      localizedAnalysis: undefined,
    });

    const tampered = sealedShare();
    tampered.sealedVersion.server_trust_attestation.trust_manifest_integrity_sha256 = 'b'.repeat(64);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => tampered,
    });
    await expect(resolveShareToken('sealed-token')).rejects.toThrow(/verified, rankable/);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 'legacy-token', expiresAt: '2099-01-01T00:00:00Z' }),
    });
    await expect(resolveShareToken('legacy-token')).resolves.toBeNull();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sealedShare('other'),
    });
    await expect(resolveShareToken('sealed-token')).resolves.toBeNull();
  });

  it('returns null for missing or expired shares', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(resolveShareToken('missing')).resolves.toBeNull();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        ...sealedShare('expired'),
        expiresAt: '2020-01-01T00:00:00Z',
      }),
    });
    await expect(resolveShareToken('expired')).resolves.toBeNull();
  });

  it('revokes and lists share metadata for authenticated dashboard users', async () => {
    await revokeShareToken('some-token', 'sp-001');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ token: 'some-token', screenplayId: 'sp-001' }),
      }),
    );

    const view = {
      authorityVersion: 'lemon-share-authority-v1',
      token: 'existing-token',
      screenplayId: 'sp-001',
      screenplayTitle: 'Test',
      includeNotes: false,
      createdAt: '2026-01-01T00:00:00Z',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ views: [view] }),
    });
    await expect(getExistingShareToken('sp-001')).resolves.toEqual(view);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ views: [view] }),
    });
    await expect(getAllSharedViews()).resolves.toEqual([view]);
  });

  it('updates note exposure through the authenticated server manager', async () => {
    const note: Note = {
      id: 'note-1',
      screenplayId: 'sp-001',
      author: 'Producer',
      content: 'Current note',
      createdAt: '2026-08-28T12:00:00Z',
      updatedAt: '2026-08-28T12:05:00Z',
    };
    await updateShareNotes('sealed-token', 'sp-001', true, [note]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          token: 'sealed-token',
          screenplayId: 'sp-001',
          includeNotes: true,
          notes: [{ content: 'Current note', createdAt: '2026-08-28T12:00:00Z' }],
        }),
      }),
    );
  });

  it('ignores historical browser-authored share documents', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        views: [{ token: 'legacy', screenplayId: 'sp-001' }],
      }),
    });
    await expect(getExistingShareToken('sp-001')).resolves.toBeNull();
  });

  it('checks whether the source analysis parent exists', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true });
    await expect(isScreenplaySynced('scripts/my_film.pdf')).resolves.toBe(true);
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    await expect(isScreenplaySynced('scripts/missing.pdf')).resolves.toBe(false);
  });
});
