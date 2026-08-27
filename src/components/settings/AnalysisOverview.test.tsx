import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import i18n from '@/i18n';
import { useScreenplays } from '@/hooks/useScreenplays';
import { createTestScreenplay } from '@/test/factories';
import { AnalysisOverview } from '@/components/settings/AnalysisOverview';

vi.mock('@/hooks/useScreenplays', () => ({ useScreenplays: vi.fn() }));

describe('AnalysisOverview localized issues', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
    vi.mocked(useScreenplays).mockReset();
  });

  it('renders the partial-reader count in Spanish from a stable key', async () => {
    await i18n.changeLanguage('es');
    vi.mocked(useScreenplays).mockReturnValue({
      data: [
        createTestScreenplay({
          title: 'Título original',
          analysisQuality: {
            status: 'partial',
            completedReaders: 3,
            expectedReaders: 5,
            failedReaders: ['concept', 'emotion'],
          },
        }),
      ],
    } as ReturnType<typeof useScreenplays>);

    render(<AnalysisOverview />);

    expect(screen.getByText('2 informes de lectores incompletos')).toBeInTheDocument();
    expect(screen.queryByText(/reader reports incomplete/i)).not.toBeInTheDocument();
  });

  it('turns an empty slate into one clear next action instead of zero-value reports', () => {
    vi.mocked(useScreenplays).mockReturnValue({ data: [] } as ReturnType<typeof useScreenplays>);

    render(<AnalysisOverview />, { wrapper: MemoryRouter });

    expect(screen.getByRole('heading', { name: 'No analyzed screenplays yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload Screenplays' })).toHaveAttribute(
      'href',
      '/settings?tab=intake',
    );
    expect(screen.queryByText('Complete reader panels')).not.toBeInTheDocument();
  });

  it('keeps the loading state distinct from an empty slate', () => {
    vi.mocked(useScreenplays).mockReturnValue({
      data: [],
      isLoading: true,
    } as ReturnType<typeof useScreenplays>);

    render(<AnalysisOverview />, { wrapper: MemoryRouter });

    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
    expect(screen.queryByText('No analyzed screenplays yet')).not.toBeInTheDocument();
  });

  it('offers a retry instead of describing a failed query as an empty slate', () => {
    const refetch = vi.fn();
    vi.mocked(useScreenplays).mockReturnValue({
      data: [],
      isError: true,
      refetch,
    } as unknown as ReturnType<typeof useScreenplays>);

    render(<AnalysisOverview />, { wrapper: MemoryRouter });

    expect(
      screen.getByRole('heading', { name: 'Analysis data is temporarily unavailable' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.queryByText('No analyzed screenplays yet')).not.toBeInTheDocument();
  });
});
