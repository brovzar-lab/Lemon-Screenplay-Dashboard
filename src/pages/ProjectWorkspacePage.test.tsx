import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const hookState = vi.hoisted(() => ({
  screenplays: [] as Screenplay[],
  isLoading: false,
  error: null as Error | null,
}));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({
    data: hookState.screenplays,
    isLoading: hookState.isLoading,
    error: hookState.error,
  }),
  useLiveScreenplaySync: vi.fn(),
}));

vi.mock('@/hooks/useProducerAssessments', () => ({
  useProducerAssessmentHeads: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock('@/stores/authStore', () => ({
  useIsAdmin: () => true,
}));

vi.mock('@/components/project', () => ({
  ProjectWorkspace: ({
    screenplay,
    activeTab,
    onSelectTab,
    onBack,
  }: {
    screenplay: Screenplay;
    activeTab: string;
    onSelectTab: (tab: string) => void;
    onBack: () => void;
  }) => (
    <div data-testid="project-workspace">
      <h1>{screenplay.title}</h1>
      <span>Active tab: {activeTab}</span>
      <button type="button" onClick={() => onSelectTab('reader-room')}>
        Open Reader Room
      </button>
      <button type="button" onClick={onBack}>
        Back to Discovery
      </button>
    </div>
  ),
  ProjectWorkspaceState: ({ title }: { title: string }) => <div>{title}</div>,
  ScreenplayFileWorkspace: ({
    screenplay,
    activeTab,
    onSelectTab,
    onBack,
  }: {
    screenplay: Screenplay;
    activeTab: string;
    onSelectTab: (tab: string) => void;
    onBack: () => void;
  }) => (
    <div data-testid="screenplay-file-workspace">
      <h1>{screenplay.title}</h1>
      <span>File tab: {activeTab}</span>
      <button type="button" onClick={() => onSelectTab('scores')}>
        Open Scores
      </button>
      <button type="button" onClick={onBack}>
        Back to slate
      </button>
    </div>
  ),
}));

import ProjectWorkspacePage from '@/pages/ProjectWorkspacePage';

function screenplay(overrides: Partial<Screenplay> = {}): Screenplay {
  return createTestScreenplay({
    id: 'atlas-file',
    projectId: 'atlas-project',
    title: 'Atlas Fall',
    sourceFile: 'atlas.pdf',
    latestVersionId: 'atlas-version-2',
    ...overrides,
  });
}

function DiscoveryLocationProbe() {
  const location = useLocation();
  return <div>Discovery restored at {location.pathname}{location.search}</div>;
}

function renderRoute(entry: string | { pathname: string; state?: Record<string, unknown> }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/projects/:projectId/:section?" element={<ProjectWorkspacePage />} />
          <Route path="/discover" element={<DiscoveryLocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Project Workspace route', () => {
  beforeEach(() => {
    hookState.screenplays = [screenplay()];
    hookState.isLoading = false;
    hookState.error = null;
  });

  it('uses a lazy, authenticated, error-bounded production route', () => {
    const mainSource = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');

    expect(mainSource).toContain(
      "importWithReload('project-workspace', () => import('@/pages/ProjectWorkspacePage'))",
    );
    expect(mainSource).toContain('path="/projects/:projectId/:section?"');
    expect(mainSource).toContain('areaName="Project Workspace"');
    expect(mainSource).toMatch(/<AuthGate>\s*<ProjectWorkspacePage \/>\s*<\/AuthGate>/);
  });

  it('opens and switches deep-linkable replacement tabs', async () => {
    const user = userEvent.setup();
    renderRoute('/projects/atlas-project/story-x-ray');

    expect(screen.getByText('Active tab: story-x-ray')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Reader Room' }));
    expect(screen.getByText('Active tab: reader-room')).toBeInTheDocument();
  });

  it('opens the additive Screenplay File workspace and preserves its query across tabs', async () => {
    const user = userEvent.setup();
    renderRoute('/projects/atlas-project/reader-room?workspace=screenplay');

    expect(screen.getByTestId('screenplay-file-workspace')).toBeInTheDocument();
    expect(screen.getByText('File tab: reader-room')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Scores' }));
    expect(screen.getByText('File tab: scores')).toBeInTheDocument();
  });

  it('opens the project poster as a screenplay file tab', () => {
    renderRoute('/projects/atlas-project/poster?workspace=screenplay');

    expect(screen.getByText('File tab: poster')).toBeInTheDocument();
  });

  it('falls back to Overview for an unknown section', () => {
    renderRoute('/projects/atlas-project/not-a-real-tab');
    expect(screen.getByText('Active tab: overview')).toBeInTheDocument();
  });

  it('resolves a direct link by authoritative project id', () => {
    renderRoute('/projects/atlas-project');

    expect(screen.getByTestId('project-workspace')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atlas Fall' })).toBeInTheDocument();
  });

  it('falls back to the stable normalized id for legacy projects', () => {
    hookState.screenplays = [screenplay({ projectId: undefined })];
    renderRoute('/projects/atlas-file');

    expect(screen.getByRole('heading', { name: 'Atlas Fall' })).toBeInTheDocument();
  });

  it('returns safely to Discovery when opened as a direct link', async () => {
    const user = userEvent.setup();
    renderRoute('/projects/atlas-project');

    await user.click(screen.getByRole('button', { name: 'Back to Discovery' }));
    expect(screen.getByText('Discovery restored at /discover')).toBeInTheDocument();
  });

  it('returns the Screenplay File workspace to the approved slate presentation', async () => {
    const user = userEvent.setup();
    renderRoute('/projects/atlas-project/reader-room?workspace=screenplay');

    await user.click(screen.getByRole('button', { name: 'Back to slate' }));
    expect(screen.getByText('Discovery restored at /discover')).toBeInTheDocument();
  });

  it('shows honest loading, unavailable, and error states', () => {
    hookState.isLoading = true;
    const loading = renderRoute('/projects/atlas-project');
    expect(screen.getByText('Opening the project workspace')).toBeInTheDocument();
    loading.unmount();

    hookState.isLoading = false;
    hookState.error = new Error('Firestore unavailable');
    const failed = renderRoute('/projects/atlas-project');
    expect(screen.getByText('The project could not be loaded')).toBeInTheDocument();
    failed.unmount();

    hookState.error = null;
    hookState.screenplays = [];
    renderRoute('/projects/missing');
    expect(screen.getByText('This project is not in the slate')).toBeInTheDocument();
  });
});
