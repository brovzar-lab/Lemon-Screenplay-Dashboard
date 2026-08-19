import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from '@/components/auth';

const mockInitialize = vi.fn();
let mockState: Record<string, unknown>;

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockState),
}));

vi.mock('@/pages/DiscoverPage', () => ({
  default: () => <div>Discovery experience</div>,
}));

import DiscoverPage from '@/pages/DiscoverPage';

function renderDiscoverRoute() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/discover']}>
        <Routes>
          <Route
            path="/discover/:projectId?"
            element={
              <AuthGate>
                <DiscoverPage />
              </AuthGate>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('/discover authentication', () => {
  beforeEach(() => {
    mockInitialize.mockClear();
    mockState = {
      initialize: mockInitialize,
      signIn: vi.fn(),
      isSigningIn: false,
      error: null,
      status: 'signed_out',
      profile: null,
    };
  });

  it('shows sign-in instead of Discovery when signed out', async () => {
    renderDiscoverRoute();

    expect(await screen.findByRole('button', { name: 'Continue as Billy' })).toBeInTheDocument();
    expect(screen.queryByText('Discovery experience')).not.toBeInTheDocument();
  });

  it('keeps the production route lazy, error-bounded, and reader-authenticated', () => {
    const mainSource = readFileSync(resolve(process.cwd(), 'src/main.tsx'), 'utf8');
    const rootRoute = mainSource.slice(
      mainSource.indexOf('path="/"'),
      mainSource.indexOf('path="/dashboard-classic"'),
    );

    expect(mainSource).toContain(
      "importWithReload('discover', () => import('./pages/DiscoverPage'))",
    );
    expect(mainSource).toContain('path="/discover/:projectId?"');
    expect(mainSource).toContain('path="/dashboard-classic"');
    expect(mainSource).toContain('areaName="Discovery"');
    expect(mainSource).toMatch(/<AuthGate>\s*<DiscoverPage \/>\s*<\/AuthGate>/);
    expect(rootRoute).toContain('areaName="Studio Pulse"');
    expect(rootRoute).toContain('<StudioPulsePage />');
    expect(rootRoute).not.toContain('<App />');
    expect(mainSource).toMatch(/path="\/dashboard-classic"\s+element=\{<Navigate to="\/discover" replace \/>\}/);
    expect(mainSource).not.toContain("import App from './App'");
    expect(mainSource).not.toMatch(/<AuthGate requireAdmin>\s*<DiscoverPage \/>\s*<\/AuthGate>/);
  });

  it('allows a reader into Discovery without requiring admin access', () => {
    mockState.status = 'ready';
    mockState.profile = { role: 'reader' };

    renderDiscoverRoute();

    expect(screen.getByText('Discovery experience')).toBeInTheDocument();
  });
});
