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

vi.mock('./DiscoverPage', () => ({
  default: () => <div>Discovery experience</div>,
}));

import DiscoverPage from './DiscoverPage';

function renderDiscoverRoute() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/discover']}>
        <Routes>
          <Route
            path="/discover"
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

  it('shows sign-in instead of Discovery when signed out', () => {
    renderDiscoverRoute();

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(screen.queryByText('Discovery experience')).not.toBeInTheDocument();
  });

  it('allows a reader into Discovery without requiring admin access', () => {
    mockState.status = 'ready';
    mockState.profile = { role: 'reader' };

    renderDiscoverRoute();

    expect(screen.getByText('Discovery experience')).toBeInTheDocument();
  });
});
