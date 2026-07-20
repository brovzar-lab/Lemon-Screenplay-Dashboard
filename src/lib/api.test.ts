import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToastStore } from '@/stores/toastStore';

const mockQuarantineAnalysis = vi.fn(() => Promise.resolve());

vi.mock('./analysisStore', () => ({
  loadAllAnalyses: vi.fn(() => Promise.resolve([])),
  quarantineAnalysis: (...args: unknown[]) => mockQuarantineAnalysis(...args),
}));

import { normalizeAnalyses } from './api';

describe('normalizeAnalyses quarantine visibility', () => {
  beforeEach(() => {
    mockQuarantineAnalysis.mockClear();
    useToastStore.getState().clearToasts();
  });

  it('quarantines malformed data and tells the user where to review it', async () => {
    const result = await normalizeAnalyses([
      { source_file: 'broken-item-7.pdf', analysis_version: 'v9_archaeology' },
    ]);

    expect(result).toEqual([]);
    expect(mockQuarantineAnalysis).toHaveBeenCalledOnce();
    expect(useToastStore.getState().toasts[0]).toEqual(
      expect.objectContaining({
        severity: 'warning',
        message: expect.stringContaining('Review Settings > Data'),
      }),
    );
  });
});
