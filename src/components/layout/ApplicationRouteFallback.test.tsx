import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationRouteFallback } from '@/components/layout/ApplicationRouteFallback';

vi.stubGlobal('__APP_VERSION__', 'test');

describe('ApplicationRouteFallback', () => {
  it('keeps the application shell visible while a route is loading', () => {
    render(
      <MemoryRouter>
        <ApplicationRouteFallback />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('application-header')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading...');
    expect(screen.getByTestId('application-header')).not.toHaveAttribute('role', 'status');
  });
});
