import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterStore } from '@/stores/filterStore';
import { useNotesStore } from '@/stores/notesStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useSortStore } from '@/stores/sortStore';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const hookState = vi.hoisted(() => ({
  screenplays: [] as unknown[],
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

import DiscoverPage from '@/pages/DiscoverPage';

function screenplay(
  id: string,
  title: string,
  weightedScore: number,
  overrides: Partial<Screenplay> = {},
): Screenplay {
  return createTestScreenplay({
    id,
    projectId: id,
    sourceFile: `${id}.pdf`,
    title,
    weightedScore,
    dimensionScores: {
      concept: weightedScore,
      structure: weightedScore - 0.1,
      protagonist: weightedScore - 0.2,
      supportingCast: weightedScore - 0.3,
      dialogue: weightedScore - 0.4,
      genreExecution: weightedScore - 0.5,
      originality: weightedScore - 0.6,
      weightedScore,
    },
    logline: `${title} carries its real analysis into the drawer.`,
    ...overrides,
  });
}

function buildScreenplays(): Screenplay[] {
  return [
    screenplay('atlas', 'Atlas Fall', 9.4, { recommendation: 'film_now' }),
    screenplay('bravo', 'Bravo Room', 8.25, { recommendation: 'recommend' }),
    screenplay('cinder', 'Cinder House', 7.8),
    screenplay('delta', 'Delta Run', 7.2),
    screenplay('echo', 'Echo Park', 6.9),
    screenplay('fjord', 'Fjord Line', 6.4),
    screenplay('garden', 'Garden State', 5.8),
  ];
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/discover']}>
      <DiscoverPage />
    </MemoryRouter>,
  );
}

async function waitForDiscovery() {
  await screen.findByRole('button', { name: 'Open Atlas Fall details' });
}

describe('Discovery detail drawer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    hookState.screenplays = buildScreenplays();
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    usePdfStatusStore.getState().clearStatuses();
    useNotesStore.getState().clearAllNotes();
    document.body.style.overflow = '';
  });

  it('opens the clicked screenplay from featured, shelf, and grid with its real scores', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiscovery();

    await user.click(screen.getByRole('button', { name: 'Open Atlas Fall details' }));
    let drawer = screen.getByRole('dialog', { name: 'Atlas Fall' });
    expect(within(drawer).getByText('9.40')).toBeInTheDocument();
    expect(within(drawer).getByText('9.4/10')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Open Bravo Room details' }));
    drawer = screen.getByRole('dialog', { name: 'Bravo Room' });
    expect(within(drawer).getByText('8.25')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Open Fjord Line details' }));
    expect(screen.getByRole('dialog', { name: 'Fjord Line' })).toBeInTheDocument();
  });

  it('persists private notes through the existing notes store path', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiscovery();

    const trigger = screen.getByRole('button', { name: 'Open Bravo Room details' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: '+ Add Note' }));
    await user.type(screen.getByPlaceholderText('Write your note...'), 'Call the writer Friday.');
    await user.click(screen.getByRole('button', { name: 'Save Note' }));

    expect(useNotesStore.getState().getNotesForScreenplay('bravo')[0]?.content).toBe(
      'Call the writer Friday.',
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(trigger);

    expect(
      within(screen.getByRole('dialog')).getByText('Call the writer Friday.'),
    ).toBeInTheDocument();
  });

  it('Escape closes, unlocks scrolling, and restores focus to the clicked card', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiscovery();

    const trigger = screen.getByRole('button', { name: 'Open Fjord Line details' });
    await user.click(trigger);
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe('');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('traps focus and renders no controls reserved for later phases', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitForDiscovery();

    await user.click(screen.getByRole('button', { name: 'Open Atlas Fall details' }));
    const drawer = screen.getByRole('dialog');
    const close = within(drawer).getByRole('button', { name: 'Close details' });
    await waitFor(() => expect(close).toHaveFocus());

    await user.tab({ shift: true });
    expect(within(drawer).getByRole('button', { name: '+ Add Note' })).toHaveFocus();

    expect(within(drawer).queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
    expect(within(drawer).queryByText('Coverage')).not.toBeInTheDocument();
    expect(within(drawer).queryByText('PDF')).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: /reanalyze/i })).not.toBeInTheDocument();
  });
});
