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
  it('fails closed before parsing or inference because fresh comparison bypasses the trust pipeline', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'Writer Parity.pdf', {
      type: 'application/pdf',
    });

    await expect(analyzeScreenplay(file, 'LEMON', { model: 'sonnet' }))
      .rejects.toThrow(/authoritative V9 trust pipeline/i);
    expect(mockComputeContentHash).not.toHaveBeenCalled();
    expect(mockParsePDF).not.toHaveBeenCalled();
    expect(mockAnalyzeV9).not.toHaveBeenCalled();
    expect(mockRunTriage).not.toHaveBeenCalled();
  });
});

describe('reanalysis persistence safety', () => {
  it('cannot silently reanalyze a Coverage report through V9', async () => {
    await expect(reanalyzeFromStorage(createTestScreenplay({ analysisVersion: 'coverage_v1' }), 'sonnet'))
      .rejects.toThrow('Coverage reanalysis uses Intake');
    expect(mockQueueScreenplayReanalysis).not.toHaveBeenCalled();
  });
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
