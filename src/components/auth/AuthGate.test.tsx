import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from './AuthGate';

const mockInitialize = vi.fn();
const mockSignIn = vi.fn();
let mockState: Record<string, unknown>;

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockState),
}));

function renderGate(requireAdmin = false) {
  return render(
    <MemoryRouter>
      <AuthGate requireAdmin={requireAdmin}>
        <div>Protected dashboard</div>
      </AuthGate>
    </MemoryRouter>,
  );
}

describe('AuthGate', () => {
  beforeEach(() => {
    mockInitialize.mockClear();
    mockState = {
      initialize: mockInitialize,
      signIn: mockSignIn,
      isSigningIn: false,
      error: null,
      status: 'initializing',
      profile: null,
    };
  });

  it('waits while Firebase restores the session', () => {
    renderGate();
    expect(screen.getByRole('status')).toHaveTextContent('Opening Lemon Studios');
    expect(mockInitialize).toHaveBeenCalledOnce();
  });

  it('shows Google sign-in when signed out', () => {
    mockState.status = 'signed_out';
    renderGate();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('allows a reader into the dashboard', () => {
    mockState.status = 'ready';
    mockState.profile = { role: 'reader' };
    renderGate();
    expect(screen.getByText('Protected dashboard')).toBeInTheDocument();
  });

  it('blocks a reader from an admin-only route', () => {
    mockState.status = 'ready';
    mockState.profile = { role: 'reader' };
    renderGate(true);
    expect(screen.getByRole('heading', { name: 'Admin access required' })).toBeInTheDocument();
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();
  });

  it('allows an admin into an admin-only route', () => {
    mockState.status = 'ready';
    mockState.profile = { role: 'admin' };
    renderGate(true);
    expect(screen.getByText('Protected dashboard')).toBeInTheDocument();
  });
});
