import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';

const testState = vi.hoisted(() => ({
  liveSync: vi.fn(),
  screenplays: [] as unknown[],
}));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({
    data: testState.screenplays,
    isLoading: false,
  }),
  useLiveScreenplaySync: () => testState.liveSync(),
}));

vi.mock('@/components/settings/UploadPanel', () => ({
  UploadPanel: ({
    presentation,
    initialModel,
    onOpenAnalysis,
  }: {
    presentation: string;
    initialModel: string;
    onOpenAnalysis: (projectId: string) => void;
  }) => (
    <div data-testid="upload-panel" data-presentation={presentation} data-model={initialModel}>
      <button type="button" onClick={() => onOpenAnalysis('finished-project')}>Open finished analysis</button>
    </div>
  ),
}));

vi.mock('@/components/layout/SyncStatusIndicator', () => ({
  SyncStatusIndicator: () => <span>Live sync</span>,
}));

vi.mock('@/components/auth', () => ({
  UserMenu: () => <button type="button">Account</button>,
}));

vi.mock('@/stores/authStore', () => ({
  useIsAdmin: () => true,
}));

import IntakePage from '@/pages/IntakePage';

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/intake']}>
        <Routes>
          <Route path="/intake" element={<IntakePage />} />
          <Route path="/discover/:projectId" element={<output>Opened project</output>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Intake page', () => {
  beforeEach(() => {
    testState.liveSync.mockClear();
    testState.screenplays = [
      createTestScreenplay({ id: 'will', projectId: 'will', weightedScore: 7.2 }),
    ];
  });

  it('presents the existing upload machinery as the quality-first intake desk', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Intake' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Discovery navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intake' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Intake stages')).toHaveTextContent('File verified');
    expect(screen.getByLabelText('Intake stages')).toHaveTextContent('Readers working');
    expect(screen.getByLabelText('Intake stages')).toHaveTextContent('Slate ready');
    expect(screen.getByTestId('upload-panel')).toHaveAttribute('data-presentation', 'intake');
    expect(screen.getByTestId('upload-panel')).toHaveAttribute('data-model', 'hybrid');
    expect(testState.liveSync).toHaveBeenCalled();
  });

  it('opens a completed queue result in its Discovery project route', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Open finished analysis' }));

    expect(screen.getByText('Opened project')).toBeInTheDocument();
  });
});
