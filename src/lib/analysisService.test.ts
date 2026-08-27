import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';

const {
  mockComputeContentHash,
  mockLoadCalibrationProfile,
  mockAnalyzeV9,
  mockParsePDF,
  mockRunTriage,
  mockQueueScreenplayReanalysis,
  mockWaitForQueuedReanalysis,
} = vi.hoisted(() => ({
  mockComputeContentHash: vi.fn(),
  mockLoadCalibrationProfile: vi.fn(),
  mockAnalyzeV9: vi.fn(),
  mockParsePDF: vi.fn(),
  mockRunTriage: vi.fn(),
  mockQueueScreenplayReanalysis: vi.fn(),
  mockWaitForQueuedReanalysis: vi.fn(),
}));

vi.mock('./pdfParser', () => ({ parsePDF: mockParsePDF }));

vi.mock('./multiPassAnalysis', () => ({
  analyzeV9: mockAnalyzeV9,
  runTriage: mockRunTriage,
}));

vi.mock('./feedbackStore', () => ({
  loadCalibrationProfile: mockLoadCalibrationProfile,
}));

vi.mock('./analysisIdentity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./analysisIdentity')>();
  return { ...actual, computeContentHash: mockComputeContentHash };
});

vi.mock('./reanalysisQueue', () => ({
  queueScreenplayReanalysis: mockQueueScreenplayReanalysis,
  waitForQueuedReanalysis: mockWaitForQueuedReanalysis,
}));

import { analyzeScreenplay, reanalyzeFromStorage } from './analysisService';

const CONTENT_HASH = 'ef'.repeat(32);
const QUEUED_AT_MS = 1_784_588_800_123;

beforeEach(() => {
  vi.clearAllMocks();
  mockComputeContentHash.mockResolvedValue(CONTENT_HASH);
  mockLoadCalibrationProfile.mockResolvedValue(null);
  mockRunTriage.mockResolvedValue({
    triage_score: 7,
    verdict: 'CONSIDER',
    genre: 'Society',
    genre_detection: {},
    logline: 'A family confronts a buried secret.',
    should_deep_analyze: true,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      actual_cost_microusd: 25,
      actual_cost_usd: 0.000025,
    },
    provenance: {
      responseId: 'msg_triage',
      requestedModel: 'claude-haiku-4-5-20251001',
      returnedModel: 'claude-haiku-4-5-20251001',
      stopReason: 'end_turn',
    },
  });
  mockParsePDF.mockResolvedValue({
    title: 'Writer Parity',
    text: 'INT. TEST - DAY',
    pageCount: 100,
    wordCount: 20_000,
    truncated: false,
  });
  mockAnalyzeV9.mockResolvedValue({
    analysis: { title: 'Writer Parity' },
    readerResults: [],
    totalUsage: { input_tokens: 10, output_tokens: 5 },
    totalDurationMs: 1_000,
    mode: 'full',
    modelId: 'claude-sonnet-4-6',
    provenance: [{
      responseId: 'msg_test',
      requestedModel: 'claude-sonnet-4-6',
      returnedModel: 'claude-sonnet-4-6',
      stopReason: 'end_turn',
      stage: 'synthesis',
      reader_name: null,
      attempt: 1,
      disposition: 'used',
      usage: { input_tokens: 10, output_tokens: 5 },
    }],
  });
  mockQueueScreenplayReanalysis.mockResolvedValue({
    screenplayId: 'Writer_Parity.pdf',
    storagePath: 'gs://bucket/ingest-queue/LEMON/upload-id/Writer_Parity.pdf',
  });
  mockWaitForQueuedReanalysis.mockResolvedValue({
    status: 'complete',
    jobId: 'job-1',
    analysisVersion: 'v9_archaeology',
  });
});

describe('browser writer identity', () => {
  it('binds a triage-only response to its exact stage, attempt, usage, and cost', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'Writer Parity.pdf', {
      type: 'application/pdf',
    });

    const result = await analyzeScreenplay(file, 'LEMON', {
      model: 'haiku',
      v9Mode: 'triage',
    });

    expect(result.raw.model_provenance).toEqual([expect.objectContaining({
      responseId: 'msg_triage',
      stage: 'triage',
      reader_name: null,
      attempt: 1,
      disposition: 'used',
      usage: expect.objectContaining({
        input_tokens: 10,
        output_tokens: 5,
        actual_cost_microusd: 25,
      }),
    })]);
  });

  it('adds the verified content identity to a full V9 analysis', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(QUEUED_AT_MS);
    const file = new File([new Uint8Array([1, 2, 3])], 'Writer Parity.pdf', {
      type: 'application/pdf',
    });

    const result = await analyzeScreenplay(file, 'LEMON', { model: 'sonnet' });
    now.mockRestore();

    expect(mockComputeContentHash).toHaveBeenCalledWith(file);
    expect(result.raw).toEqual(
      expect.objectContaining({
        content_hash: CONTENT_HASH,
        identity_status: 'verified',
        analysis_version: 'v9_archaeology',
        analysis_model: 'claude-sonnet-4-6',
        model_provenance: [expect.objectContaining({ responseId: 'msg_test' })],
        queued_at_ms: QUEUED_AT_MS,
      }),
    );
  });

  it('rejects an unknown runtime model instead of silently using Sonnet', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'Writer Parity.pdf', {
      type: 'application/pdf',
    });

    await expect(analyzeScreenplay(
      file,
      'LEMON',
      { model: 'unknown-route' as 'sonnet' },
    )).rejects.toThrow(/unknown analysis route/i);

    expect(mockAnalyzeV9).not.toHaveBeenCalled();
  });

  it('records Haiku as a composite selection while routing the full panel to Sonnet', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'Writer Parity.pdf', {
      type: 'application/pdf',
    });

    const result = await analyzeScreenplay(file, 'LEMON', { model: 'haiku' });

    expect(mockAnalyzeV9).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ model: 'sonnet', mode: 'full' }),
      expect.any(Function),
    );
    expect(result.raw).toMatchObject({
      selection_request: 'haiku',
      pipeline_model_tier: 'sonnet',
      analysis_model: 'claude-sonnet-4-6',
    });
  });
});

describe('reanalysis persistence safety', () => {
  it('preserves a Haiku composite selection into the authoritative queue', async () => {
    await reanalyzeFromStorage(
      createTestScreenplay({ projectId: 'Writer_Parity.pdf' }),
      'haiku',
    );
    expect(mockQueueScreenplayReanalysis).toHaveBeenCalledWith(
      expect.any(String),
      'haiku',
    );
  });

  it('refuses to replace full coverage with a triage-only result', async () => {
    await expect(
      reanalyzeFromStorage(
        createTestScreenplay(),
        'haiku',
        undefined,
        { v9Mode: 'triage' },
      ),
    ).rejects.toThrow(/triage-only results cannot replace full V9 coverage/i);

  });

  it('routes a permanent re-analysis through the VPS queue', async () => {
    const screenplay = createTestScreenplay({ projectId: 'Writer_Parity.pdf' });

    await reanalyzeFromStorage(screenplay, 'opus');

    expect(mockQueueScreenplayReanalysis).toHaveBeenCalledWith('Writer_Parity.pdf', 'opus');
    expect(mockWaitForQueuedReanalysis).toHaveBeenCalledWith(
      expect.stringContaining('/ingest-queue/'),
      expect.any(Function),
      { signal: undefined, timeoutMs: undefined },
    );
    expect(mockAnalyzeV9).not.toHaveBeenCalled();
  });

  it('keeps the complete-V9 guard on the daemon result', async () => {
    mockWaitForQueuedReanalysis.mockResolvedValue({
      status: 'complete',
      jobId: 'job-1',
      analysisVersion: 'v9_triage',
    });

    await expect(reanalyzeFromStorage(
      createTestScreenplay({ projectId: 'Writer_Parity.pdf' }),
      'sonnet',
    )).rejects.toThrow(/only complete V9 coverage/i);
  });

  it('coalesces two simultaneous re-analysis requests for one project', async () => {
    let releaseQueue: ((value: {
      screenplayId: string;
      storagePath: string;
    }) => void) | undefined;
    mockQueueScreenplayReanalysis.mockImplementation(() => new Promise((resolve) => {
      releaseQueue = resolve;
    }));
    const screenplay = createTestScreenplay({ projectId: 'Double_Click.pdf' });

    const first = reanalyzeFromStorage(screenplay, 'sonnet');
    const second = reanalyzeFromStorage(screenplay, 'opus');

    expect(first).toBe(second);
    expect(mockQueueScreenplayReanalysis).toHaveBeenCalledOnce();
    releaseQueue?.({
      screenplayId: 'Double_Click.pdf',
      storagePath: 'gs://bucket/ingest-queue/LEMON/upload-id/Double_Click.pdf',
    });
    await Promise.all([first, second]);
    expect(mockWaitForQueuedReanalysis).toHaveBeenCalledOnce();
  });

  it('allows a new re-analysis after the prior one settles', async () => {
    const screenplay = createTestScreenplay({ projectId: 'Repeat_Later.pdf' });

    await reanalyzeFromStorage(screenplay, 'sonnet');
    await reanalyzeFromStorage(screenplay, 'sonnet');

    expect(mockQueueScreenplayReanalysis).toHaveBeenCalledTimes(2);
  });
});
