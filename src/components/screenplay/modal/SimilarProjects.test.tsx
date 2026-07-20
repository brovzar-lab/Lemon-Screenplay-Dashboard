import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createTestScreenplay } from '@/test/factories';
import { SimilarProjects } from './SimilarProjects';

describe('SimilarProjects', () => {
  it('shows a meaningful match and opens it', () => {
    const target = createTestScreenplay({
      id: 'target',
      title: 'The Long Night',
      author: 'A Writer',
    });
    const match = createTestScreenplay({
      id: 'match',
      title: 'The Long Night',
      author: 'A Writer',
    });
    const onSelect = vi.fn();

    render(
      <SimilarProjects screenplay={target} allScreenplays={[target, match]} onSelect={onSelect} />,
    );

    expect(screen.getByText('Similar Projects')).toBeInTheDocument();
    fireEvent.click(screen.getByText('The Long Night'));
    expect(onSelect).toHaveBeenCalledWith(match);
  });

  it('stays hidden when no projects are meaningfully similar', () => {
    const target = createTestScreenplay({
      id: 'target',
      title: 'Space War',
      author: 'One Writer',
      logline: 'A pilot saves a distant galaxy from invasion.',
      genre: 'Science Fiction',
    });
    const other = createTestScreenplay({
      id: 'other',
      title: 'Quiet Kitchen',
      author: 'Another Writer',
      logline: 'A chef rebuilds her family restaurant after a loss.',
      genre: 'Drama',
    });

    const { container } = render(
      <SimilarProjects screenplay={target} allScreenplays={[target, other]} onSelect={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
