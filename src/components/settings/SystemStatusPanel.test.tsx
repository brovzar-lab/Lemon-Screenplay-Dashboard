import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

const getDoc = vi.hoisted(() => vi.fn());

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ path: 'system/llm-budget-test' })),
  getDoc,
}));
vi.mock('@/lib/firebase', () => ({ db: {} }));

import { SystemStatusPanel } from '@/components/settings/SystemStatusPanel';

describe('SystemStatusPanel', () => {
  it('shows server-owned services and the real daily ledger without key inputs', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        limit_microusd: 50_000_000,
        spent_microusd: 12_500_000,
        reserved_microusd: 1_250_000,
        call_count: 18,
      }),
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SystemStatusPanel />
      </QueryClientProvider>,
    );

    expect(screen.getAllByText('Server managed')).toHaveLength(2);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(await screen.findByText('$12.50')).toBeInTheDocument();
    expect(screen.getByText('spent of $50.00 today')).toBeInTheDocument();
    expect(screen.getByText('$1.25')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
  });
});
