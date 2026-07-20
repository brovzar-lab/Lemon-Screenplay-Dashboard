/**
 * Component Tests for Header — Instrument Design System
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from './Header';

// Mock hooks that require QueryClientProvider / Firebase
vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplayStats: () => ({ data: null, isLoading: false }),
  useScreenplays: () => ({ data: [], isLoading: false }),
  SCREENPLAYS_QUERY_KEY: ['screenplays'],
}));

vi.mock('@/hooks/useFilteredScreenplays', () => ({
  useFilteredScreenplays: () => ({ filteredCount: 0, totalCount: 0, screenplays: [] }),
  useHasActiveFilters: () => false,
}));

vi.mock('@/stores/themeStore', () => ({
  useThemeStore: () => ({
    resolvedTheme: 'light' as const,
    isDark: false,
    setTheme: vi.fn(),
    setDesignSystem: vi.fn(),
    theme: 'system',
    designSystem: 'instrument',
  }),
  THEME_OPTIONS: [
    { id: 'light', label: 'Light', family: 'instrument', mode: 'light' },
    { id: 'dark', label: 'Dark', family: 'instrument', mode: 'dark' },
  ],
  DESIGN_SYSTEMS: [
    { id: 'instrument', label: 'Instrument', description: 'Cool cobalt', lightThemeId: 'light', darkThemeId: 'dark', accentLight: '#2B54F0', accentDark: '#6E8BFF', fontHint: 'Playfair Display' },
  ],
}));

// DevExecToggle needs its own store — mock it as a no-op
vi.mock('@/components/devexec', () => ({
  DevExecToggle: () => null,
  DevExecChat: () => null,
}));

vi.mock('@/stores/authStore', () => ({
  useIsAdmin: () => true,
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      profile: { displayName: 'Billy Rovzar', email: 'billy@lemonfilms.com' },
      signOut: vi.fn(),
    }),
}));

// SyncStatusIndicator has its own store deps — mock as no-op
vi.mock('./SyncStatusIndicator', () => ({
  SyncStatusIndicator: () => null,
}));

// ThemeSwitcher — mock as simple render since it uses the same theme store
vi.mock('@/components/ui/ThemeSwitcher', () => ({
  ThemeSwitcher: () => <button aria-label="Switch design system">Instrument</button>,
}));

describe('Header', () => {
  it('renders the dashboard title', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByText('LEMON')).toBeInTheDocument();
    expect(screen.getByText('Screenplay Dashboard')).toBeInTheDocument();
  });

  it('renders as a header landmark', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('renders the settings navigation link', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
  });
});
