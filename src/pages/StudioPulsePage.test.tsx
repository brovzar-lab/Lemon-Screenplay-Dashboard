import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { createTestScreenplay } from '@/test/factories';
import type { Screenplay } from '@/types';

const state = vi.hoisted(() => ({ screenplays: [] as Screenplay[] }));

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: state.screenplays, isLoading: false, error: null }),
  useLiveScreenplaySync: vi.fn(),
}));

vi.mock('@/components/layout/ApplicationHeader', () => ({
  ApplicationHeader: () => <header>Application header</header>,
}));

import StudioPulsePage from '@/pages/StudioPulsePage';

describe('StudioPulsePage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    state.screenplays = [
      createTestScreenplay({
        id: 'secret-thriller',
        title: 'Secret Thriller Title',
        analysisVersion: 'V9 Archaeology',
        analysisQuality: {
          status: 'complete',
          completedReaders: 5,
          expectedReaders: 5,
          failedReaders: [],
        },
        recommendation: 'recommend',
        genre: 'Thriller',
      }),
      createTestScreenplay({
        id: 'secret-comedy',
        title: 'Secret Comedy Title',
        analysisVersion: 'V9 Archaeology',
        analysisQuality: {
          status: 'partial',
          completedReaders: 4,
          expectedReaders: 5,
          failedReaders: ['craft'],
        },
        recommendation: 'consider',
        genre: 'Comedy',
      }),
      createTestScreenplay({
        id: 'secret-pass',
        title: 'Secret Pass Title',
        analysisVersion: 'V9 Archaeology',
        analysisQuality: {
          status: 'complete',
          completedReaders: 5,
          expectedReaders: 5,
          failedReaders: [],
        },
        recommendation: 'pass',
        genre: 'Drama',
      }),
    ];
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <StudioPulsePage />
      </MemoryRouter>,
    );
  }

  it('leads with the Mexico market brief and removes internal pipeline metrics', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Mexico Market Brief' })).toBeInTheDocument();
    expect(
      screen.getByText('What buyers want now, and where Lemon can compete.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Research updated August 19, 2026/)).toBeInTheDocument();
    expect(screen.getByText('What matters now')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'True crime and crime drama' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Active buyers in Mexico' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Where demand is strongest in Mexico' }),
    ).toBeInTheDocument();
    expect(document.querySelector('img[src="/brand/buyers/netflix.svg"]')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Screenplay Dashboard/ })).toHaveAttribute(
      'href',
      '/discover',
    );

    for (const removed of [
      'Active projects',
      'V9 complete',
      'Ready for review',
      'Need attention',
      'Lemon operating health',
      'New here?',
      'Studio command center',
      'Studio data is live',
    ]) {
      expect(screen.queryByText(removed, { exact: false })).not.toBeInTheDocument();
    }
  });

  it('switches territories without exposing individual screenplays', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Spain' }));

    expect(screen.getByRole('heading', { name: 'Spain Market Brief' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Active buyers in Spain' })).toBeInTheDocument();
    expect(screen.queryByText('Secret Thriller Title')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret Comedy Title')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret Pass Title')).not.toBeInTheDocument();
  });

  it('uses the correct action for zero matches and matching screenplays', () => {
    const { unmount } = renderPage();

    expect(screen.getByRole('link', { name: /Explore the opportunity/ })).toHaveAttribute(
      'href',
      '/discover?q=crime',
    );

    unmount();
    state.screenplays[0] = { ...state.screenplays[0], genre: 'Crime drama' };
    renderPage();

    expect(screen.getByRole('link', { name: /Review 1 matching screenplay/ })).toHaveAttribute(
      'href',
      '/discover?q=crime',
    );
  });

  it('renders the market brief in Spanish', async () => {
    await i18n.changeLanguage('es');
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Informe del mercado de México' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Lo más importante ahora')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Compradores activos en México' }),
    ).toBeInTheDocument();
  });
});
