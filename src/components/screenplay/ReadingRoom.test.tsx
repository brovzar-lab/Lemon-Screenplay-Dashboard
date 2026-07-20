import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createTestScreenplay } from '@/test/factories';
import { ReadingRoom } from './ReadingRoom';

const mockToggleFavorite = vi.fn();
let mockFavorites: string[] = [];

vi.mock('@/stores/favoritesStore', () => ({
  useFavoritesStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ quickFavorites: mockFavorites, toggleQuickFavorite: mockToggleFavorite }),
}));

vi.mock('@/stores/authStore', () => ({
  useIsAdmin: () => true,
}));

vi.mock('./modal', () => ({
  AlertBanners: ({ screenplay }: { screenplay: { title: string } }) => (
    <p>Alert {screenplay.title}</p>
  ),
  ContentDetails: ({ screenplay }: { screenplay: { title: string } }) => (
    <p>Details {screenplay.title}</p>
  ),
  FeedbackSection: ({ screenplay }: { screenplay: { title: string } }) => (
    <p>Feedback {screenplay.title}</p>
  ),
  FieldPositionPanel: () => <p>Field Position</p>,
  NotesSection: ({ screenplayId }: { screenplayId: string }) => (
    <label>
      Notes <textarea aria-label={`Notes ${screenplayId}`} />
    </label>
  ),
  ScoresPanel: ({ screenplay }: { screenplay: { title: string } }) => (
    <p>Scores {screenplay.title}</p>
  ),
}));

describe('ReadingRoom', () => {
  const screenplays = [
    createTestScreenplay({ id: 'first', title: 'First Script' }),
    createTestScreenplay({ id: 'second', title: 'Second Script' }),
    createTestScreenplay({ id: 'third', title: 'Third Script' }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockFavorites = [];
  });

  it('opens on the first screenplay in the current filtered order', () => {
    render(<ReadingRoom screenplays={screenplays} percentileRanks={new Map()} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'First Script' })).toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('moves through screenplays with controls and arrow keys', () => {
    render(<ReadingRoom screenplays={screenplays} percentileRanks={new Map()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Next screenplay' }));
    expect(screen.getByRole('heading', { name: 'Second Script' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: 'Third Script' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { name: 'Second Script' })).toBeInTheDocument();
  });

  it('toggles the current screenplay favorite with F', () => {
    render(
      <ReadingRoom
        screenplays={screenplays}
        initialScreenplayId="second"
        percentileRanks={new Map()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.keyDown(document, { key: 'f' });

    expect(mockToggleFavorite).toHaveBeenCalledWith('second');
  });

  it('does not navigate while the user is writing a note', () => {
    render(<ReadingRoom screenplays={screenplays} percentileRanks={new Map()} onClose={vi.fn()} />);
    const notes = screen.getByLabelText('Notes first');

    fireEvent.keyDown(notes, { key: 'ArrowRight' });

    expect(screen.getByRole('heading', { name: 'First Script' })).toBeInTheDocument();
  });

  it('exits with Escape and restores page scrolling on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <ReadingRoom screenplays={screenplays} percentileRanks={new Map()} onClose={onClose} />,
    );

    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();

    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
