import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatedNavigation } from './AuthenticatedNavigation';

const authState = vi.hoisted(() => ({ isAdmin: true }));

vi.mock('@/stores/authStore', () => ({
  useIsAdmin: () => authState.isAdmin,
}));

function renderNavigation(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthenticatedNavigation />
    </MemoryRouter>,
  );
}

describe('AuthenticatedNavigation', () => {
  beforeEach(() => {
    authState.isAdmin = true;
  });

  it('uses Studio Pulse as Home and keeps Discovery separate', () => {
    renderNavigation('/');

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Discovery' })).toHaveAttribute('href', '/discover');
  });

  it('keeps Discover active throughout project workspaces', () => {
    renderNavigation('/projects/matadero/reader-room?workspace=screenplay');

    expect(screen.getByRole('link', { name: 'Discovery' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Discovery' })).toHaveAttribute(
      'href',
      '/discover',
    );
  });

  it('marks Settings active for settings and intake compatibility routes', () => {
    const { unmount } = renderNavigation('/settings?tab=analysis');

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    unmount();
    renderNavigation('/intake');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not expose Settings to non-admin users', () => {
    authState.isAdmin = false;
    renderNavigation('/discover?ui=screenplay');

    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });
});
