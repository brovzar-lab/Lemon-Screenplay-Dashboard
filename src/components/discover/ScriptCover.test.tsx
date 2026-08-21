import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ScriptCover } from '@/components/discover/ScriptCover';
import i18n from '@/i18n';

describe('ScriptCover generated labels', () => {
  afterEach(async () => {
    await act(() => i18n.changeLanguage('en'));
  });

  it.each([
    ['Anonymized submission', 'Envío anonimizado'],
    ['Uncredited submission', 'Envío sin autor acreditado'],
  ])('translates the %s fallback without changing real titles', async (author, translated) => {
    await act(() => i18n.changeLanguage('es'));
    const { container } = render(<ScriptCover title="Original Title" author={author} />);

    expect(screen.getByText('Original Title')).toBeInTheDocument();
    expect(container.querySelector('.dsc-cover-author')).toHaveTextContent(translated);
    expect(screen.queryByText(author)).not.toBeInTheDocument();
  });
});
