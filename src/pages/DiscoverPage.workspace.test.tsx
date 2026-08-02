import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFilterStore } from '@/stores/filterStore';
import { usePdfStatusStore } from '@/stores/pdfStatusStore';
import { useSortStore } from '@/stores/sortStore';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const hookState = vi.hoisted(() => ({ screenplays: [] as Screenplay[] }));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: hookState.screenplays, isLoading: false, error: null }),
  useLiveScreenplaySync: vi.fn(),
}));

vi.mock('@/lib/shareService', () => ({
  getAllSharedViews: vi.fn().mockResolvedValue([]),
  getExistingShareToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/components/discover/DiscoverDrawer', () => ({
  DiscoverDrawer: ({ screenplay }: { screenplay: Screenplay }) => (
    <div role="dialog" aria-label={screenplay.title}>Legacy drawer for {screenplay.title}</div>
  ),
}));

import DiscoverPage from '@/pages/DiscoverPage';

function WorkspaceSentinel() {
  const { projectId } = useParams();
  return <div>Workspace route {projectId}</div>;
}

function renderRoute(entry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/discover/:projectId?" element={<DiscoverPage />} />
          <Route path="/projects/:projectId" element={<WorkspaceSentinel />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Discovery to Project Workspace navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    hookState.screenplays = [createTestScreenplay({
      id: 'atlas-file',
      projectId: 'atlas-project',
      title: 'Atlas Fall',
      sourceFile: 'atlas.pdf',
      weightedScore: 8.4,
    })];
    useFilterStore.getState().resetFilters();
    useSortStore.getState().resetSort();
    usePdfStatusStore.getState().clearStatuses();
  });

  it('opens the full Project Workspace from Cinema Browse', async () => {
    const user = userEvent.setup();
    renderRoute('/discover');

    await user.click(await screen.findByRole('button', { name: 'Open Atlas Fall details' }));
    expect(screen.getByText('Workspace route atlas-project')).toBeInTheDocument();
  });

  it('preserves the current drawer behind the explicit preview fallback', async () => {
    renderRoute('/discover/atlas-project?preview=drawer');

    expect(await screen.findByRole('dialog', { name: 'Atlas Fall' })).toHaveTextContent(
      'Legacy drawer for Atlas Fall',
    );
    expect(screen.queryByText(/Workspace route/)).not.toBeInTheDocument();
  });
});
