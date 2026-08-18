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

describe('ApplicationHeader', () => {
  beforeEach(() => {
    state.isAdmin = true;
    state.setDesignSystem.mockClear();
    state.setTheme.mockClear();
  });

  it('renders the complete canonical signed-in chrome and preserves the selected visual system', () => {
    render(
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
    expect(screen.getByRole('link', { name: 'Discovery' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Synced')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
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

    expect(screen.getByRole('link', { name: 'Discovery' })).toHaveAttribute('aria-current', 'page');
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

    expect(screen.getByRole('link', { name: 'Descubrimiento' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'es');
    expect(window.localStorage.getItem('lemon-ui-language')).toBe('es');
  });
});
