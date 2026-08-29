import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PosterControls } from '@/components/project/PosterControls';
import { createTestScreenplay } from '@/test/factories';

vi.mock('@/stores/authStore', () => ({ useIsAdmin: () => true }));
vi.mock('@/lib/googleProxyClient', () => ({ requestPoster: vi.fn() }));

describe('PosterControls', () => {
  it('blocks every paid control when the analysis is not verified', () => {
    render(
      <PosterControls
        screenplay={createTestScreenplay({
          producerProjection: undefined,
          recommendation: 'recommend',
        })}
      />,
    );

    expect(screen.getByText('Decision data unavailable until verification')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Poster model' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate poster' })).not.toBeInTheDocument();
  });

  it('blocks every paid control for a Pass verdict', () => {
    render(<PosterControls screenplay={createTestScreenplay({ recommendation: 'pass' })} />);

    expect(screen.getByText('Poster withheld for a Pass verdict')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Poster model' })).not.toBeInTheDocument();
  });

  it('blocks a second paid request while generation is active', () => {
    render(
      <PosterControls
        screenplay={createTestScreenplay({
          posterStatus: 'generating',
          posterRequestedAt: new Date().toISOString(),
        })}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Poster model' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Creating poster…' })).toBeDisabled();
  });

  it('allows recovery after a crashed generation lease expires', () => {
    render(
      <PosterControls
        screenplay={createTestScreenplay({
          posterStatus: 'generating',
          posterRequestedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'Generate poster' })).toBeEnabled();
  });

  it('offers only the three approved server model tiers', () => {
    render(<PosterControls screenplay={createTestScreenplay()} />);

    expect(
      screen.getByRole('combobox', { name: 'Poster model' }).querySelectorAll('option'),
    ).toHaveLength(3);
  });
});
