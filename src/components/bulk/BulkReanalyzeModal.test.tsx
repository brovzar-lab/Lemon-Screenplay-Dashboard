import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Shared mock functions for assertions across tests
const mockDeselectAll = vi.fn();
const mockInvalidateQueries = vi.fn();
const { mockApiConfig, mockUseApiConfigStore } = vi.hoisted(() => {
  const state = {
    getBudgetRemaining: vi.fn(() => 50),
    getDailyRequestsRemaining: vi.fn(() => 100),
    incrementUsage: vi.fn(),
    checkAndResetIfNeeded: vi.fn(),
  };
  const useStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => state },
  );
  return { mockApiConfig: state, mockUseApiConfigStore: useStore };
});

vi.mock('@/lib/analysisService', () => ({
  reanalyzeFromStorage: vi.fn(),
}));
vi.mock('@/stores/exportSelectionStore', () => ({
  useExportSelectionStore: { getState: () => ({ deselectAll: mockDeselectAll }) },
}));
vi.mock('@/stores/apiConfigStore', () => ({
  useApiConfigStore: mockUseApiConfigStore,
}));

// QueryClient mock
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

import { BulkReanalyzeModal } from './BulkReanalyzeModal';
import { reanalyzeFromStorage } from '@/lib/analysisService';

const spWithPdf = { id: 'sp-pdf', title: 'Eligible Screenplay', hasPdf: true };
const spWithoutPdf = { id: 'sp-nopdf', title: 'Ineligible Screenplay', hasPdf: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockApiConfig.getBudgetRemaining.mockReturnValue(50);
  mockApiConfig.getDailyRequestsRemaining.mockReturnValue(100);
});

describe('BulkReanalyzeModal — BULK-02', () => {
  it('excludes ineligible items and shows the eligible count before starting', () => {
    render(
      <BulkReanalyzeModal
        isOpen
        onClose={vi.fn()}
        screenplays={[spWithPdf, spWithoutPdf] as any[]}
      />
    );

    expect(screen.getByText(/1 eligible screenplay ready for review/i)).toBeInTheDocument();
    expect(screen.getByText(spWithPdf.title)).toBeInTheDocument();
    expect(screen.queryByText(spWithoutPdf.title)).not.toBeInTheDocument();
    expect(reanalyzeFromStorage).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /start reanalysis/i })).toBeInTheDocument();
  });

  it('does not start paid work until the user confirms', () => {
    render(
      <BulkReanalyzeModal isOpen onClose={vi.fn()} screenplays={[spWithPdf] as any[]} />
    );

    expect(reanalyzeFromStorage).not.toHaveBeenCalled();
    expect(screen.getByText(/estimated maximum cost: \$1.00/i)).toBeInTheDocument();
  });

  it('stop watching leaves the queued VPS job running and starts no later items', async () => {
    (reanalyzeFromStorage as ReturnType<typeof vi.fn>).mockImplementation(
      (_screenplay, _model, _progress, options) => new Promise<void>((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          const error = new Error('Stopped watching. The queued VPS job may continue.');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      })
    );

    const sp2 = { id: 'sp-2', title: 'Second Screenplay', hasPdf: true };

    render(
      <BulkReanalyzeModal
        isOpen
        onClose={vi.fn()}
        screenplays={[spWithPdf, sp2] as any[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start reanalysis/i }));

    fireEvent.click(screen.getByRole('button', { name: /stop watching/i }));
    expect(
      (reanalyzeFromStorage as ReturnType<typeof vi.fn>).mock.calls[0]?.[3]?.signal.aborted
    ).toBe(true);

    await waitFor(() => {
      expect(reanalyzeFromStorage).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/queued analysis continues.*remaining.*not started/i)).toBeInTheDocument();
    });
  });

  it('does not automatically retry a failed paid analysis', async () => {
    (reanalyzeFromStorage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

    render(
      <BulkReanalyzeModal
        isOpen
        onClose={vi.fn()}
        screenplays={[spWithPdf] as any[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start reanalysis/i }));

    await waitFor(() => {
      expect(reanalyzeFromStorage).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText(/failed/i)).toBeInTheDocument();
    expect(mockApiConfig.incrementUsage).toHaveBeenCalledWith(1);
  });

  it('blocks a batch that exceeds the configured budget', () => {
    mockApiConfig.getBudgetRemaining.mockReturnValue(0);

    render(
      <BulkReanalyzeModal isOpen onClose={vi.fn()} screenplays={[spWithPdf] as any[]} />
    );

    expect(screen.getByRole('button', { name: /start reanalysis/i })).toBeDisabled();
    expect(screen.getByText(/exceeds your current budget/i)).toBeInTheDocument();
    expect(reanalyzeFromStorage).not.toHaveBeenCalled();
  });

  it('React Query invalidated when modal closes after completion', async () => {
    (reanalyzeFromStorage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(
      <BulkReanalyzeModal
        isOpen
        onClose={vi.fn()}
        screenplays={[spWithPdf] as any[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start reanalysis/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(mockInvalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['screenplays']) })
    );
  });

  it('deselectAll called when modal closes', async () => {
    (reanalyzeFromStorage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    render(
      <BulkReanalyzeModal
        isOpen
        onClose={vi.fn()}
        screenplays={[spWithPdf] as any[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start reanalysis/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(mockDeselectAll).toHaveBeenCalled();
  });
});
