import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
});
