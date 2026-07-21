import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';

const {
  mockComputeContentHash,
  mockLoadCalibrationProfile,
  mockParsePDF,
  mockRunMultiReaderAnalysis,
  mockRunTriage,
  mockSaveAnalysis,
  mockUploadScreenplayPdf,
} = vi.hoisted(() => ({
  mockComputeContentHash: vi.fn(),
  mockLoadCalibrationProfile: vi.fn(),
  mockParsePDF: vi.fn(),
  mockRunMultiReaderAnalysis: vi.fn(),
  mockRunTriage: vi.fn(),
  mockSaveAnalysis: vi.fn(),
  mockUploadScreenplayPdf: vi.fn(),
}));

vi.mock('./analysisStore', () => ({
  saveAnalysis: mockSaveAnalysis,
}));

vi.mock('./pdfParser', () => ({ parsePDF: mockParsePDF }));

vi.mock('./multiPassAnalysis', () => ({
  runMultiReaderAnalysis: mockRunMultiReaderAnalysis,
  runTriage: mockRunTriage,
}));

vi.mock('./feedbackStore', () => ({
  loadCalibrationProfile: mockLoadCalibrationProfile,
}));

vi.mock('./firebase', () => ({
  storage: {},
  uploadScreenplayPdf: mockUploadScreenplayPdf,
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  getBlob: vi.fn(),
}));

vi.mock('./analysisIdentity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./analysisIdentity')>();
  return { ...actual, computeContentHash: mockComputeContentHash };
});

import { analyzeScreenplay, reanalyzeFromStorage } from './analysisService';

const CONTENT_HASH = 'ef'.repeat(32);
const QUEUED_AT_MS = 1_784_588_800_123;

beforeEach(() => {
  vi.clearAllMocks();
  mockComputeContentHash.mockResolvedValue(CONTENT_HASH);
  mockLoadCalibrationProfile.mockResolvedValue(null);
  mockParsePDF.mockResolvedValue({
    title: 'Writer Parity',
    text: 'INT. TEST - DAY',
    pageCount: 100,
    wordCount: 20_000,
    truncated: false,
  });
  mockRunMultiReaderAnalysis.mockResolvedValue({
    analysis: { title: 'Writer Parity' },
    readerResults: [],
    totalUsage: { input_tokens: 10, output_tokens: 5 },
    totalDurationMs: 1_000,
    mode: 'full',
  });
  mockUploadScreenplayPdf.mockResolvedValue('screenplays/LEMON/Writer_Parity.pdf');
});

describe('browser writer identity', () => {
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
        queued_at_ms: QUEUED_AT_MS,
      }),
    );
  });
});

describe('reanalysis persistence safety', () => {
  it('refuses to replace full coverage with a triage-only result', async () => {
    await expect(
      reanalyzeFromStorage(
        createTestScreenplay(),
        'haiku',
        undefined,
        { v9Mode: 'triage' },
      ),
    ).rejects.toThrow(/triage-only results cannot replace full V9 coverage/i);

    expect(mockSaveAnalysis).not.toHaveBeenCalled();
  });
});
