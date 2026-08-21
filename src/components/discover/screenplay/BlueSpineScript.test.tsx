import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BlueSpineScript } from '@/components/discover/screenplay/BlueSpineScript';
import i18n from '@/i18n';
import { createTestScreenplay } from '@/test/factories';

describe('BlueSpineScript presentation', () => {
  const screenplay = createTestScreenplay({
    title: 'A Story With A Proper Cover',
    author: 'A Writer',
    analysisVersion: 'v9_archaeology',
  });

  afterEach(async () => {
    await i18n.changeLanguage('en');
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

  it('always presents a screenplay cover even when poster art exists', () => {
    render(
      <BlueSpineScript
        screenplay={createTestScreenplay({
          title: 'Atlas Fall',
          recommendation: 'recommend',
          posterUrl: 'https://example.com/atlas-poster.png',
        })}
      />,
    );

    expect(screen.getByText('Atlas Fall')).toBeInTheDocument();
    expect(screen.getByText('Written by')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('translates generated fallback labels without changing the title', async () => {
    await i18n.changeLanguage('es');
    render(
      <BlueSpineScript
        screenplay={createTestScreenplay({
          title: 'Original Title',
          author: 'Anonymized submission',
          analysisVersion: undefined,
        })}
      />,
    );

    expect(screen.getByText('Original Title')).toBeInTheDocument();
    expect(screen.getByText('Envío anonimizado')).toBeInTheDocument();
    expect(screen.getByText('Versión del análisis no registrada')).toBeInTheDocument();
  });
});
