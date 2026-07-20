import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FILTER_STATE, DEFAULT_SORT_STATE } from '@/types';
import { useFilterStore } from '@/stores/filterStore';
import { useSortStore } from '@/stores/sortStore';
import { useLensStore } from '@/stores/lensStore';
import { LensMenu } from './LensMenu';

describe('LensMenu', () => {
  beforeEach(() => {
    useFilterStore.setState(DEFAULT_FILTER_STATE);
    useSortStore.setState(DEFAULT_SORT_STATE);
    useLensStore.setState({ lenses: [], activeLensId: null });
  });

  it('saves the current filters and sorting', () => {
    useFilterStore.getState().setGenres(['Horror']);
    useSortStore.getState().setSortConfigs([{ field: 'weightedScore', direction: 'desc' }]);
    render(<LensMenu />);

    fireEvent.click(screen.getByTitle('Saved Lenses'));
    fireEvent.change(screen.getByLabelText('Lens name'), { target: { value: 'Top Horror' } });
    fireEvent.click(screen.getByText('Save current'));

    const saved = useLensStore.getState().lenses[0];
    expect(saved.name).toBe('Top Horror');
    expect(saved.snapshot.filters.genres).toEqual(['Horror']);
    expect(saved.snapshot.sort.sortConfigs[0].field).toBe('weightedScore');
  });

  it('restores and deletes a saved Lens', () => {
    useLensStore.getState().saveLens('Recommend only', {
      filters: { ...structuredClone(DEFAULT_FILTER_STATE), recommendationTiers: ['recommend'] },
      sort: structuredClone(DEFAULT_SORT_STATE),
    });
    useFilterStore.getState().setRecommendationTiers(['pass']);
    render(<LensMenu />);

    fireEvent.click(screen.getByTitle('Saved Lenses'));
    fireEvent.click(screen.getByText('Recommend only'));
    expect(useFilterStore.getState().recommendationTiers).toEqual(['recommend']);

    fireEvent.click(screen.getByTitle('Saved Lenses'));
    fireEvent.click(screen.getByLabelText('Delete Recommend only'));
    expect(useLensStore.getState().lenses).toHaveLength(0);
  });
});
