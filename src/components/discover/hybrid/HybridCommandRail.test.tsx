import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFilterStore } from '@/stores/filterStore';
import { useLensStore } from '@/stores/lensStore';
import { useSortStore } from '@/stores/sortStore';
import { HybridCommandRail } from '@/components/discover/hybrid/HybridCommandRail';
import { createTestScreenplay } from '@/test/factories';

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

  it('makes project selection an intentional mode', async () => {
    const user = userEvent.setup();
    const onToggleSelectionMode = vi.fn();
    const { rerender } = render(
      <HybridCommandRail
        allScreenplays={[]}
        genres={[]}
        themes={[]}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        onToggleSelectionMode={onToggleSelectionMode}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Select projects' }));
    expect(onToggleSelectionMode).toHaveBeenCalledOnce();

    rerender(
      <HybridCommandRail
        allScreenplays={[]}
        genres={[]}
        themes={[]}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        selectionMode
        selectionCount={2}
        onToggleSelectionMode={onToggleSelectionMode}
      />,
    );

    expect(
      screen.getByRole('button', { name: /Done selecting 2/i, pressed: true }),
    ).toBeInTheDocument();
  });

  it('keeps secondary slate tools inside the mobile filter sheet', async () => {
    const user = userEvent.setup();
    render(
      <HybridCommandRail
        allScreenplays={[]}
        genres={[]}
        themes={[]}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
        onOpenScreenplay={vi.fn()}
        onToggleSelectionMode={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Filters' }));

    expect(screen.getByRole('button', { name: 'Saved Views' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Favorites' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sort screenplays' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Select projects' })).toHaveLength(2);
  });

  it('does not count an unverified stored verdict in the decision shortcuts', () => {
    render(
      <HybridCommandRail
        allScreenplays={[
          createTestScreenplay({ recommendation: 'consider' }),
          createTestScreenplay({
            id: 'unverified',
            recommendation: 'film_now',
            producerProjection: undefined,
          }),
        ]}
        genres={[]}
        themes={[]}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^All 1$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^FILM NOW 0$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Consider 1$/i })).toBeInTheDocument();
  });
});
