import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatedNavigation } from './AuthenticatedNavigation';

const authState = vi.hoisted(() => ({ isAdmin: true }));

vi.mock('@/stores/authStore', () => ({
  useIsAdmin: () => authState.isAdmin,
}));

function renderNavigation(path: string, settingsIssueCount = 0) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthenticatedNavigation settingsIssueCount={settingsIssueCount} />
    </MemoryRouter>,
  );
}

describe('AuthenticatedNavigation', () => {
  beforeEach(() => {
    authState.isAdmin = true;
  });

  it('uses Intelligence as home and keeps Screenplays separate', () => {
    renderNavigation('/');

    expect(screen.getByRole('link', { name: 'Intelligence' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Intelligence' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Screenplays' })).toHaveAttribute('href', '/discover');
  });

  it('keeps Screenplays active throughout project workspaces', () => {
    renderNavigation('/projects/matadero/reader-room?workspace=screenplay');

    expect(screen.getByRole('link', { name: 'Screenplays' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Screenplays' })).toHaveAttribute('href', '/discover');
  });

  it('marks Settings active for settings and intake compatibility routes', () => {
    const { unmount } = renderNavigation('/settings?tab=analysis');

    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');

    unmount();
    renderNavigation('/intake');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not expose Settings to non-admin users', () => {
    authState.isAdmin = false;
    renderNavigation('/discover?ui=screenplay');

    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('shows a Settings warning only for a real issue count', () => {
    const { unmount } = renderNavigation('/', 0);
    expect(screen.queryByLabelText(/issue.*attention/i)).not.toBeInTheDocument();

    unmount();
    renderNavigation('/', 3);
    expect(screen.getByLabelText('3 issues need attention')).toHaveTextContent('3');
  });
});
