/**
 * AddToFavoritesModal Tests
 * Tests rendering, list selection, apply logic, toast, and close behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddToFavoritesModal } from './AddToFavoritesModal';

// Mock favorites store
const mockToggleQuickFavorite = vi.fn();
const mockAddToList = vi.fn();
const mockIsQuickFavorite = vi.fn().mockReturnValue(false);
const mockLists = [
  { id: 'list-1', name: 'Action Scripts', screenplayIds: [], createdAt: '', updatedAt: '' },
  { id: 'list-2', name: 'Comedies', screenplayIds: [], createdAt: '', updatedAt: '' },
];

vi.mock('@/stores/favoritesStore', () => ({
  useFavoritesStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ lists: mockLists }),
    {
      getState: () => ({
        toggleQuickFavorite: mockToggleQuickFavorite,
        addToList: mockAddToList,
        isQuickFavorite: mockIsQuickFavorite,
        lists: mockLists,
      }),
    }
  ),
}));

// Mock selection store
let mockSelectedIds = new Set<string>(['sp-1', 'sp-2', 'sp-3']);

vi.mock('@/stores/selectionStore', () => ({
  useSelectionStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ selectedIds: mockSelectedIds }),
}));

// Mock toast store
const mockAddToast = vi.fn();

vi.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: mockAddToast }),
  },
}));

describe('AddToFavoritesModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedIds = new Set(['sp-1', 'sp-2', 'sp-3']);
    mockIsQuickFavorite.mockReturnValue(false);
  });

  it('returns null when not open', () => {
    const { container } = render(<AddToFavoritesModal isOpen={false} onClose={mockOnClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal title "Add to Favorites"', () => {
    render(<AddToFavoritesModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Add to Favorites', { selector: 'h3' })).toBeInTheDocument();
  });

  it('renders Quick Favorites option', () => {
    render(<AddToFavoritesModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Quick Favorites')).toBeInTheDocument();
  });

  it('renders named lists from favoritesStore', () => {
    render(<AddToFavoritesModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Action Scripts')).toBeInTheDocument();
    expect(screen.getByText('Comedies')).toBeInTheDocument();
  });

  it('calls toggleQuickFavorite for each selected ID when Quick Favorites chosen', () => {
    render(<AddToFavoritesModal isOpen={true} onClose={mockOnClose} />);

    // Quick Favorites is selected by default
    const applyBtn = screen.getByText('Add to Favorites', { selector: 'button' });
    fireEvent.click(applyBtn);

    expect(mockToggleQuickFavorite).toHaveBeenCalledTimes(3);
    expect(mockToggleQuickFavorite).toHaveBeenCalledWith('sp-1');
    expect(mockToggleQuickFavorite).toHaveBeenCalledWith('sp-2');
    expect(mockToggleQuickFavorite).toHaveBeenCalledWith('sp-3');
  });

  it('calls addToList for each selected ID when named list chosen', () => {
    render(<AddToFavoritesModal isOpen={true} onClose={mockOnClose} />);

    // Click on the "Action Scripts" list row
    fireEvent.click(screen.getByText('Action Scripts'));

    const applyBtn = screen.getByText('Add to Favorites', { selector: 'button' });
    fireEvent.click(applyBtn);

    expect(mockAddToList).toHaveBeenCalledTimes(3);
    expect(mockAddToList).toHaveBeenCalledWith('list-1', 'sp-1');
    expect(mockAddToList).toHaveBeenCalledWith('list-1', 'sp-2');
    expect(mockAddToList).toHaveBeenCalledWith('list-1', 'sp-3');
  });

  it('shows success toast after adding', () => {
    render(<AddToFavoritesModal isOpen={true} onClose={mockOnClose} />);

    const applyBtn = screen.getByText('Add to Favorites', { selector: 'button' });
    fireEvent.click(applyBtn);

    expect(mockAddToast).toHaveBeenCalledWith(
      'Added 3 to Quick Favorites',
      'success'
    );
  });

  it('calls onClose after applying', () => {
    render(<AddToFavoritesModal isOpen={true} onClose={mockOnClose} />);

    const applyBtn = screen.getByText('Add to Favorites', { selector: 'button' });
    fireEvent.click(applyBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
