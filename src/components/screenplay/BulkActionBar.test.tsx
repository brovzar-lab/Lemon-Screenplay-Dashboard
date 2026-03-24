/**
 * BulkActionBar Component Tests
 * Tests visibility, count display, clear/select actions, CSV export, Compare logic, and disabled buttons.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionBar } from './BulkActionBar';

// Mock the selection store
const mockDeselectAll = vi.fn();
const mockSelectAll = vi.fn();

let mockHasSelection = false;
let mockSelectionCount = 0;
let mockSelectedIds = new Set<string>();

vi.mock('@/stores/selectionStore', () => ({
  useSelectionStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      selectAll: mockSelectAll,
      deselectAll: mockDeselectAll,
      selectedIds: mockSelectedIds,
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

// Mock useScreenplays (used for resolving selected IDs to full objects)
vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: [], isLoading: false }),
}));

// Mock CSV export
vi.mock('@/components/export/csvExport', () => ({
  exportToCSV: vi.fn(),
}));

// Mock bulk PDF export
vi.mock('@/components/export/bulkPdfExport', () => ({
  bulkExportPdfs: vi.fn().mockResolvedValue(undefined),
}));

// Mock comparison store
vi.mock('@/stores/comparisonStore', () => ({
  useComparisonStore: {
    getState: () => ({ openComparison: vi.fn() }),
  },
}));

// Mock toast store
vi.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: vi.fn() }),
  },
}));

// Mock bulk modal components
vi.mock('@/components/bulk', () => ({
  SetCategoryModal: () => null,
  AddToFavoritesModal: () => null,
}));

describe('BulkActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasSelection = false;
    mockSelectionCount = 0;
    mockSelectedIds = new Set<string>();
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

  it('six action buttons are rendered with correct labels', () => {
    mockHasSelection = true;
    mockSelectionCount = 1;
    render(<BulkActionBar />);

    const expectedLabels = [
      'Export CSV',
      'Export PDF',
      'Compare',
      'Upload PDFs',
      'Set Category',
      'Favorites',
    ];

    for (const label of expectedLabels) {
      const btn = screen.getByText(label);
      expect(btn).toBeInTheDocument();
    }
  });

  it('disabled buttons have title tooltips (2 disabled when count=1)', () => {
    mockHasSelection = true;
    mockSelectionCount = 1;
    render(<BulkActionBar />);

    const disabledButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('disabled'));
    // 2 disabled: Compare (count=1), Upload PDFs
    // Not disabled: Export CSV, Export PDF, Set Category, Favorites, Clear selection, Select All, Deselect All
    expect(disabledButtons.length).toBe(2);

    for (const btn of disabledButtons) {
      expect(btn.getAttribute('title')).toBeTruthy();
    }
  });

  it('Export CSV button is enabled and clickable', () => {
    mockHasSelection = true;
    mockSelectionCount = 2;
    render(<BulkActionBar />);
    const btn = screen.getByText('Export CSV');
    expect(btn).not.toBeDisabled();
  });

  it('Compare button is disabled when count < 2', () => {
    mockHasSelection = true;
    mockSelectionCount = 1;
    render(<BulkActionBar />);
    const btn = screen.getByText('Compare');
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('title')).toBe('Select 2-3 to compare');
  });

  it('Compare button is disabled when count > 3', () => {
    mockHasSelection = true;
    mockSelectionCount = 4;
    render(<BulkActionBar />);
    const btn = screen.getByText('Compare');
    expect(btn).toBeDisabled();
  });

  it('Compare button is enabled when count is 2 or 3', () => {
    mockHasSelection = true;
    mockSelectionCount = 3;
    render(<BulkActionBar />);
    const btn = screen.getByText('Compare');
    expect(btn).not.toBeDisabled();
  });
});
