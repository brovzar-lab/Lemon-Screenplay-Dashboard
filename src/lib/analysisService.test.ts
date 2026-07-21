import { describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';

const { mockSaveAnalysis } = vi.hoisted(() => ({
  mockSaveAnalysis: vi.fn(),
}));

vi.mock('./analysisStore', () => ({
  saveAnalysis: mockSaveAnalysis,
}));

import { reanalyzeFromStorage } from './analysisService';

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
