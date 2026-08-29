import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { useFilterStore } from '@/stores/filterStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useSelectionStore } from '@/stores/selectionStore';
import { useShareStore } from '@/stores/shareStore';
import { useSortStore } from '@/stores/sortStore';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const hookState = vi.hoisted(() => ({
  screenplays: [] as unknown[],
}));

const shareMocks = vi.hoisted(() => ({
  createShareToken: vi.fn(),
  revokeShareToken: vi.fn(),
  updateShareNotes: vi.fn(),
  getExistingShareToken: vi.fn(),
  getAllSharedViews: vi.fn(),
  isScreenplaySynced: vi.fn(),
}));

const coverageMocks = vi.hoisted(() => ({
  downloadCoveragePdf: vi.fn(),
}));

const pdfMocks = vi.hoisted(() => ({
  pdf: vi.fn(),
}));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({
    data: hookState.screenplays,
    isLoading: false,
    error: null,
  }),
  useLiveScreenplaySync: vi.fn(),
  useDeleteScreenplays: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/shareService', () => shareMocks);
vi.mock('@/components/export/exportCoverage', () => coverageMocks);
vi.mock('@react-pdf/renderer', () => ({ pdf: pdfMocks.pdf }));
vi.mock('@/components/export/PdfDocument', () => ({ PdfDocument: () => null }));

import DiscoverPage from '@/pages/DiscoverPage';

function screenplay(id: string, title: string, weightedScore: number): Screenplay {
  return createTestScreenplay({
    id,
    projectId: id,
    sourceFile: `${id}.pdf`,
    title,
    weightedScore,
    recommendation: 'recommend',
    genre: 'Drama',
    logline: `${title} follows a producer facing an impossible choice.`,
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/discover?ui=classic&preview=drawer']}>
        <Routes>
          <Route path="/discover/:projectId?" element={<DiscoverPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function select(user: ReturnType<typeof userEvent.setup>, title: string) {
  if (!screen.queryByRole('button', { name: /Done selecting/ })) {
    await user.click(screen.getByRole('button', { name: /Select projects/ }));
  }
  await user.click(await screen.findByRole('button', { name: `Select ${title}` }));
}

describe('Discovery PDF exports', () => {
  beforeEach(() => {
    window.localStorage.clear();
    hookState.screenplays = [
      screenplay('atlas', 'Atlas Fall', 9.5),
      screenplay('bravo', 'Bravo Room', 8.5),
    ];
    shareMocks.createShareToken.mockReset();
    shareMocks.revokeShareToken.mockReset();
    shareMocks.getExistingShareToken.mockReset().mockResolvedValue(null);
    shareMocks.getAllSharedViews.mockReset().mockResolvedValue([]);
    shareMocks.isScreenplaySynced.mockReset().mockResolvedValue(true);
    coverageMocks.downloadCoveragePdf.mockReset().mockResolvedValue(undefined);
    pdfMocks.pdf.mockReset().mockImplementation(() => ({
      toBlob: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
    }));
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    usePdfStatusStore.getState().clearStatuses();
    useSelectionStore.getState().deselectAll();
    useShareStore.getState().clearAll();
    useFavoritesStore.setState({ lists: [], quickFavorites: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads formal coverage from the drawer through the existing generator', async () => {
    const user = userEvent.setup();
    let finishCoverage!: () => void;
    coverageMocks.downloadCoveragePdf.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishCoverage = resolve;
        }),
    );
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Open Atlas Fall details' }));
    const coverageButton = await screen.findByRole('button', {
      name: 'Download coverage PDF',
    });

    await user.click(coverageButton);

    expect(screen.getByRole('button', { name: 'Generating coverage PDF' })).toBeDisabled();
    expect(coverageMocks.downloadCoveragePdf).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'atlas', title: 'Atlas Fall' }),
    );

    await act(async () => finishCoverage());
    await waitFor(() => expect(coverageButton).toBeEnabled());
  });

  it('exports pitch-deck PDFs for a multi-selection through the existing modal', async () => {
    const user = userEvent.setup();
    let finishFirstPdf!: (blob: Blob) => void;
    const firstPdf = new Promise<Blob>((resolve) => {
      finishFirstPdf = resolve;
    });
    pdfMocks.pdf.mockReturnValueOnce({ toBlob: vi.fn(() => firstPdf) }).mockReturnValueOnce({
      toBlob: vi.fn().mockResolvedValue(new Blob(['bravo'], { type: 'application/pdf' })),
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-pitch-deck');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const downloadClick = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderPage();
    await select(user, 'Atlas Fall');
    await select(user, 'Bravo Room');

    await user.click(screen.getByRole('button', { name: 'Pitch-deck PDFs' }));

    expect(await screen.findByText('Exporting 2 selected screenplays')).toBeInTheDocument();
    expect(screen.queryByText('CSV Spreadsheet')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Export 2 Screenplays' }));
    expect(screen.getByRole('button', { name: 'Exporting...' })).toBeDisabled();

    await act(async () => finishFirstPdf(new Blob(['atlas'], { type: 'application/pdf' })));
    await waitFor(() => expect(pdfMocks.pdf).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(downloadClick).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('status', { name: 'Pitch deck downloaded' })).toHaveTextContent(
      '2 pitch-deck PDFs are in your Downloads folder.',
    );
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('export-modal')).not.toBeInTheDocument();
  });

  it('renders a graceful pitch-deck failure message', async () => {
    const user = userEvent.setup();
    pdfMocks.pdf.mockReturnValue({
      toBlob: vi.fn().mockRejectedValue(new Error('renderer unavailable')),
    });
    renderPage();
    await select(user, 'Atlas Fall');
    await user.click(screen.getByRole('button', { name: 'Pitch-deck PDFs' }));
    await user.click(await screen.findByRole('button', { name: 'Export 1 Screenplay' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Pitch-deck PDF generation failed. Please try again.',
    );
    expect(screen.getByRole('button', { name: 'Export 1 Screenplay' })).toBeEnabled();
  });
});
