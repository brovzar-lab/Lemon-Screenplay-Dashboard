import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BlueSpineScript } from '@/components/discover/screenplay/BlueSpineScript';
import { createTestScreenplay } from '@/test/factories';

describe('BlueSpineScript presentation', () => {
  const screenplay = createTestScreenplay({
    title: 'A Story With A Proper Cover',
    author: 'A Writer',
    analysisVersion: 'v9_archaeology',
  });

  it('keeps the complete title-page treatment as the default', () => {
    const { container } = render(<BlueSpineScript screenplay={screenplay} rank={2} />);

    expect(container.querySelector('.screenplay-object--compact')).not.toBeInTheDocument();
    expect(screen.getByText('Written by')).toBeInTheDocument();
    expect(screen.getByText('A Writer')).toBeInTheDocument();
    expect(screen.getByText('V9 Archaeology')).toBeInTheDocument();
  });

  it('renders only the cover essentials in compact mode', () => {
    const { container } = render(
      <BlueSpineScript screenplay={screenplay} rank={2} presentation="compact" />,
    );

    expect(container.querySelector('.screenplay-object--compact')).toBeInTheDocument();
    expect(screen.getByText('A Story with a Proper Cover')).toBeInTheDocument();
    expect(screen.queryByText('Written by')).not.toBeInTheDocument();
    expect(screen.queryByText('A Writer')).not.toBeInTheDocument();
    expect(screen.queryByText('V9 Archaeology')).not.toBeInTheDocument();
  });

  it('uses the archival cloth placeholder for Pass without a paid poster', () => {
    render(<BlueSpineScript screenplay={createTestScreenplay({ recommendation: 'pass' })} />);

    expect(screen.getByRole('img', { name: 'Poster withheld for a Pass verdict' })).toHaveAttribute(
      'src',
      '/pass-poster-gallery-drape.jpg',
    );
  });

  it('uses the generated poster for eligible projects when it is ready', () => {
    render(
      <BlueSpineScript
        screenplay={createTestScreenplay({
          title: 'Atlas Fall',
          recommendation: 'recommend',
          posterUrl: 'https://example.com/atlas-poster.png',
        })}
      />,
    );

    const poster = screen.getByRole('img', { name: 'Atlas Fall poster' });
    expect(poster).toHaveAttribute('src', 'https://example.com/atlas-poster.png');
    expect(poster).toHaveAttribute('loading', 'lazy');
    expect(poster).toHaveAttribute('decoding', 'async');
  });

  it('loads the single Featured poster eagerly', () => {
    render(
      <BlueSpineScript
        featured
        screenplay={createTestScreenplay({
          title: 'Atlas Fall',
          posterUrl: 'https://example.com/atlas-poster.png',
        })}
      />,
    );

    expect(screen.getByRole('img', { name: 'Atlas Fall poster' })).toHaveAttribute(
      'loading',
      'eager',
    );
  });
});
