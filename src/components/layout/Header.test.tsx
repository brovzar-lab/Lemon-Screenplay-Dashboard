/**
 * Component Tests for Header
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
    resolvedTheme: 'dark',
    setTheme: vi.fn(),
  }),
}));

// DevExecToggle needs its own store — mock it as a no-op
vi.mock('@/components/devexec', () => ({
  DevExecToggle: () => null,
  DevExecChat: () => null,
}));

// SyncStatusIndicator has its own store deps — mock as no-op
vi.mock('./SyncStatusIndicator', () => ({
  SyncStatusIndicator: () => null,
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
