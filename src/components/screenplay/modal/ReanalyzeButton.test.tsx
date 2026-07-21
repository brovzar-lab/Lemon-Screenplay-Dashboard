import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { ReanalyzeButton } from './ReanalyzeButton';

describe('ReanalyzeButton safety options', () => {
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
});
