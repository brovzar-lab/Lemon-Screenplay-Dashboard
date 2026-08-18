import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ContentDetails } from '@/components/screenplay/modal/ContentDetails';
import { createTestScreenplay } from '@/test/factories';

describe('ContentDetails workspace comparables', () => {
  it('shows at most three analysis-authored comps without browser credentials', () => {
    render(
      <ContentDetails
        presentation="workspace"
        screenplay={createTestScreenplay({
          comparableFilms: [
            { title: 'Arrival', similarity: 'Tone match', comparisonLens: 'tone' },
            { title: 'Michael Clayton', similarity: 'Structural match', comparisonLens: 'structure' },
            { title: 'Sicario', similarity: 'Market position', comparisonLens: 'market' },
            { title: 'A Fourth Film', similarity: 'Must not render', comparisonLens: 'tone' },
          ],
        })}
      />,
    );

    expect(screen.getByText('Arrival')).toBeInTheDocument();
    expect(screen.getByText('Michael Clayton')).toBeInTheDocument();
    expect(screen.getByText('Sicario')).toBeInTheDocument();
    expect(screen.queryByText('A Fourth Film')).not.toBeInTheDocument();
    expect(screen.getByText('Tone')).toBeInTheDocument();
    expect(screen.queryByText('mixed')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View film details' })).not.toBeInTheDocument();
  });
});
