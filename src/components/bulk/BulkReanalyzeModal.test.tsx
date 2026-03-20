import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/analysisService', () => ({
  reanalyzeFromStorage: vi.fn(),
}));
vi.mock('@/stores/exportSelectionStore', () => ({
  useExportSelectionStore: { getState: () => ({ deselectAll: vi.fn() }) },
}));
vi.mock('@/stores/apiConfigStore', () => ({
  useApiConfigStore: { getState: () => ({ apiKey: 'test-key' }) },
}));

// QueryClient mock
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

import { BulkReanalyzeModal } from './BulkReanalyzeModal';
import { reanalyzeFromStorage } from '@/lib/analysisService';

const spWithPdf = { id: 'sp-pdf', title: 'Eligible Screenplay', hasPdf: true };
const spWithoutPdf = { id: 'sp-nopdf', title: 'Ineligible Screenplay', hasPdf: false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BulkReanalyzeModal — BULK-02', () => {
  it('excludes ineligible items (hasPdf=false) and header notes eligible count', () => {
    render(
      <BulkReanalyzeModal
        isOpen
        onClose={vi.fn()}
        screenplays={[spWithPdf, spWithoutPdf] as any[]}
      />
    );

    expect(screen.getByText(/1 of 2 selected are eligible/i)).toBeInTheDocument();
    expect(screen.getByText(spWithPdf.title)).toBeInTheDocument();
    expect(screen.queryByText(spWithoutPdf.title)).not.toBeInTheDocument();
  });

  it('cancel flag stops loop after current in-flight item', async () => {
    let resolveFirst: () => void;
    const firstPromise = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });

    (reanalyzeFromStorage as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValue(undefined);

    const sp2 = { id: 'sp-2', title: 'Second Screenplay', hasPdf: true };

    render(
      <BulkReanalyzeModal
        isOpen
        onClose={vi.fn()}
        screenplays={[spWithPdf, sp2] as any[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Resolve the first promise to unblock
    resolveFirst!();

    await waitFor(() => {
      // Second item should never have started
      expect(reanalyzeFromStorage).toHaveBeenCalledTimes(1);
    });
  });

  it('auto-retries once on failure; marks failed after second failure', async () => {
    (reanalyzeFromStorage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    render(
      <BulkReanalyzeModal
        isOpen
        onClose={vi.fn()}
        screenplays={[spWithPdf] as any[]}
      />
    );

    await waitFor(() => {
      // Called twice: original attempt + 1 retry
      expect(reanalyzeFromStorage).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });

  it('React Query invalidated when modal closes after completion', async () => {
    const invalidateQueries = vi.fn();
    vi.mocked(vi.importMock('@tanstack/react-query')).then;

    // Override the mock for this test
    const { useQueryClient } = await import('@tanstack/react-query');
    const mockQC = useQueryClient();
    (mockQC.invalidateQueries as ReturnType<typeof vi.fn>) = invalidateQueries;

    (reanalyzeFromStorage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(
      <BulkReanalyzeModal
        isOpen
        onClose={vi.fn()}
        screenplays={[spWithPdf] as any[]}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['screenplays']) })
    );
  });

  it('deselectAll called when modal closes', async () => {
    const deselectAll = vi.fn();
    vi.mock('@/stores/exportSelectionStore', () => ({
      useExportSelectionStore: { getState: () => ({ deselectAll }) },
    }));

    (reanalyzeFromStorage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(
      <BulkReanalyzeModal
        isOpen
        onClose={vi.fn()}
        screenplays={[spWithPdf] as any[]}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(deselectAll).toHaveBeenCalled();
  });
});
