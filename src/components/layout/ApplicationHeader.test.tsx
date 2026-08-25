import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

const state = vi.hoisted(() => ({
  isAdmin: true,
  setDesignSystem: vi.fn(),
  setTheme: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useIsAdmin: () => state.isAdmin,
}));
vi.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (value: Record<string, unknown>) => unknown) =>
    selector({
      theme: 'system',
      designSystem: 'instrument',
      setDesignSystem: state.setDesignSystem,
      setTheme: state.setTheme,
    }),
}));
vi.mock('@/components/auth', () => ({
  UserMenu: () => <button type="button">User menu</button>,
}));
vi.mock('@/components/layout/SyncStatusIndicator', () => ({
  SyncStatusIndicator: () => <span>Synced</span>,
}));

import { ApplicationHeader } from '@/components/layout/ApplicationHeader';
import i18n from '@/i18n';

describe('ApplicationHeader', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    state.isAdmin = true;
    state.setDesignSystem.mockClear();
    state.setTheme.mockClear();
  });

  it('renders the complete canonical signed-in chrome and preserves the selected visual system', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/settings?tab=analysis']}>
        <ApplicationHeader />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('application-header')).toHaveAttribute(
      'data-application-shell',
      'lemon',
    );
    expect(screen.getByRole('link', { name: 'Lemon Screenplay Dashboard home' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByText('v6.9.3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Screenplays' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Market' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Synced')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.queryByText('Instrument')).not.toBeInTheDocument();
    expect(container.querySelector('.application-header__divider')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'User menu' })).toBeInTheDocument();
    expect(state.setDesignSystem).not.toHaveBeenCalled();
  });

  it('keeps reader navigation free of administration controls', () => {
    state.isAdmin = false;
    render(
      <MemoryRouter initialEntries={['/']}>
        <ApplicationHeader />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Market' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('switches to Spanish and saves the choice', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <ApplicationHeader />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Spanish' }));

    expect(screen.getByRole('link', { name: 'Mercado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Guiones' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'es');
    expect(window.localStorage.getItem('lemon-ui-language')).toBe('es');
  });

  it('opens and closes the compact navigation and only shows real Settings issues', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter initialEntries={['/']}>
        <ApplicationHeader settingsIssueCount={0} />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText('0 issues need attention')).not.toBeInTheDocument();
    const menuButton = screen.getByRole('button', { name: 'Open navigation and preferences' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(menuButton);
    expect(
      screen.getByRole('button', { name: 'Close navigation and preferences' }),
    ).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Open navigation and preferences' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    rerender(
      <MemoryRouter initialEntries={['/']}>
        <ApplicationHeader settingsIssueCount={2} />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText('2 issues need attention')).toHaveTextContent('2');
  });
});
