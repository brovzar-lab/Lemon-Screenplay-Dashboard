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
        analysisQuality: { status: 'complete', completedReaders: 5, expectedReaders: 5, failedReaders: [] },
        recommendation: 'recommend',
        genre: 'Thriller',
      }),
      createTestScreenplay({
        id: 'secret-comedy',
        title: 'Secret Comedy Title',
        analysisVersion: 'V9 Archaeology',
        analysisQuality: { status: 'partial', completedReaders: 4, expectedReaders: 5, failedReaders: ['craft'] },
        recommendation: 'consider',
        genre: 'Comedy',
      }),
      createTestScreenplay({
        id: 'secret-pass',
        title: 'Secret Pass Title',
        analysisVersion: 'V9 Archaeology',
        analysisQuality: { status: 'complete', completedReaders: 5, expectedReaders: 5, failedReaders: [] },
        recommendation: 'pass',
        genre: 'Drama',
      }),
    ];
  });

  it('shows aggregate Lemon status and dated market research without screenplay titles', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><StudioPulsePage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Studio Pulse' })).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getAllByText(/Research snapshot/i).length).toBeGreaterThan(1);
    expect(screen.queryByText(/Sample data/i)).not.toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Netflix' })).toBeInTheDocument();
    expect(screen.queryByText('Secret Thriller Title')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Screenplay Dashboard' })).toHaveAttribute('href', '/discover');

    await user.click(screen.getByRole('tab', { name: 'Spain' }));
    expect(screen.getByText('Spain', { selector: '.studio-pulse__territory-title strong' })).toBeInTheDocument();
  });
});
