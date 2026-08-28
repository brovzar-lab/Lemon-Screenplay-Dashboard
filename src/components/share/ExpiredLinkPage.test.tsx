import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExpiredLinkPage } from '@/components/share/ExpiredLinkPage';

describe('ExpiredLinkPage', () => {
  it('keeps Lemon branding visible and gives recipients a recovery step', () => {
    render(<ExpiredLinkPage />);

    expect(screen.getByText('Lemon Studios')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'This link is no longer available' })).toBeInTheDocument();
    expect(screen.getByText('Ask the sender for a new link to this screenplay.')).toBeInTheDocument();
  });
});
