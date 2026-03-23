/**
 * BulkActionBar Component Tests
 * Tests visibility, count display, clear/select actions, and disabled button shell.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionBar } from './BulkActionBar';

// Mock the selection store
const mockDeselectAll = vi.fn();
const mockSelectAll = vi.fn();

let mockHasSelection = false;
let mockSelectionCount = 0;

vi.mock('@/stores/selectionStore', () => ({
  useSelectionStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      selectAll: mockSelectAll,
      deselectAll: mockDeselectAll,
      selectedIds: new Set(),
      toggle: vi.fn(),
    }),
  useSelectionCount: () => mockSelectionCount,
  useHasSelection: () => mockHasSelection,
  useIsSelected: () => false,
}));

// Mock useFilteredScreenplays
let mockFilteredScreenplays: Array<{ id: string }> = [];

vi.mock('@/hooks/useFilteredScreenplays', () => ({
  useFilteredScreenplays: () => ({
    screenplays: mockFilteredScreenplays,
    totalCount: mockFilteredScreenplays.length,
    filteredCount: mockFilteredScreenplays.length,
    isLoading: false,
    error: null,
  }),
}));

// Mock useScreenplays (dependency of useFilteredScreenplays)
vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [], isLoading: false }),
}));

describe('BulkActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasSelection = false;
    mockSelectionCount = 0;
    mockFilteredScreenplays = [];
  });

  it('returns null when nothing selected', () => {
    mockHasSelection = false;
    const { container } = render(<BulkActionBar />);
    expect(container.innerHTML).toBe('');
  });

  it('renders when selections exist', () => {
    mockHasSelection = true;
    mockSelectionCount = 3;
    render(<BulkActionBar />);
    expect(screen.getByText('3 screenplays selected')).toBeInTheDocument();
  });

  it('shows singular when count is 1', () => {
    mockHasSelection = true;
    mockSelectionCount = 1;
    render(<BulkActionBar />);
    expect(screen.getByText('1 screenplay selected')).toBeInTheDocument();
  });

  it('clear button calls deselectAll', () => {
    mockHasSelection = true;
    mockSelectionCount = 2;
    render(<BulkActionBar />);
    const clearBtn = screen.getByLabelText('Clear selection');
    fireEvent.click(clearBtn);
    expect(mockDeselectAll).toHaveBeenCalledTimes(1);
  });

  it('Select All calls selectAll with filtered IDs', () => {
    mockHasSelection = true;
    mockSelectionCount = 1;
    mockFilteredScreenplays = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    render(<BulkActionBar />);
    fireEvent.click(screen.getByText('Select All'));
    expect(mockSelectAll).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('six action buttons are rendered and disabled', () => {
    mockHasSelection = true;
    mockSelectionCount = 1;
    render(<BulkActionBar />);

    const expectedLabels = [
      'Export CSV',
      'Export PDF',
      'Compare',
      'Upload PDFs',
      'Collection',
      'Favorites',
    ];

    for (const label of expectedLabels) {
      const btn = screen.getByText(label);
      expect(btn).toBeInTheDocument();
      expect(btn).toBeDisabled();
    }
  });

  it('disabled buttons have title tooltips', () => {
    mockHasSelection = true;
    mockSelectionCount = 1;
    render(<BulkActionBar />);

    const disabledButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('disabled'));
    expect(disabledButtons.length).toBe(6);

    for (const btn of disabledButtons) {
      expect(btn.getAttribute('title')).toBeTruthy();
    }
  });
});
