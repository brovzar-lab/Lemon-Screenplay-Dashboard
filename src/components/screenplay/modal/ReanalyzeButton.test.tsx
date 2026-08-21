import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { createTestScreenplay } from '@/test/factories';
import { ReanalyzeButton } from './ReanalyzeButton';

describe('ReanalyzeButton safety options', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('offers only full-coverage reanalysis models', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ReanalyzeButton screenplay={createTestScreenplay()} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /re-analyze/i }));

    expect(screen.getByRole('button', { name: /sonnet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /opus/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hybrid/i })).not.toBeInTheDocument();
  });

  it('translates the generated legacy-version label', async () => {
    await i18n.changeLanguage('es');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ReanalyzeButton screenplay={createTestScreenplay({ pillarScores: [] })} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /volver a analizar/i }));

    expect(screen.getByText('Anterior (sin calificaciones por pilar)')).toBeInTheDocument();
  });
});
