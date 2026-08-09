import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterStore } from '@/stores/filterStore';
import { useLensStore } from '@/stores/lensStore';
import { useSortStore } from '@/stores/sortStore';
import { HybridCommandRail } from '@/components/discover/hybrid/HybridCommandRail';

describe('HybridCommandRail Producer Look view', () => {
  beforeEach(() => {
    useFilterStore.getState().resetFilters();
    useLensStore.setState({ lenses: [], activeLensId: null });
    useSortStore.getState().resetSort();
  });

  it('shows the bounded queue as a built-in saved view', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(
      <HybridCommandRail
        allScreenplays={[]}
        genres={[]}
        themes={[]}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        producerLookCount={3}
        producerLookActive={false}
        onToggleProducerLook={onToggle}
      />,
    );

    const view = screen.getByRole('button', { name: /All screenplays 3 need your look/i });
    await user.click(view);
    expect(onToggle).toHaveBeenCalledOnce();

    rerender(
      <HybridCommandRail
        allScreenplays={[]}
        genres={[]}
        themes={[]}
        hasActiveFilters
        onClearFilters={vi.fn()}
        producerLookCount={3}
        producerLookActive
        onToggleProducerLook={onToggle}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Producer Look 3 routed/i, pressed: true }),
    ).toHaveTextContent('Producer Look');
    expect(screen.getByText('3 routed · built-in view')).toBeInTheDocument();
  });
});
