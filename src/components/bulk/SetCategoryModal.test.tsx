/**
 * SetCategoryModal Tests
 * Tests rendering, category dropdown, apply logic, toast, and close behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SetCategoryModal } from './SetCategoryModal';

// Mock useCategories
const mockCategories = [
  { id: 'BLKLST', name: 'Black List', description: 'Annual Black List selections' },
  { id: 'LEMON', name: 'Lemon', description: 'Lemon internal submissions' },
];

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({
    categories: mockCategories,
    categoryIds: mockCategories.map((c) => c.id),
    getCategoryById: (id: string) => mockCategories.find((c) => c.id === id),
  }),
}));

// Mock selection store
let mockSelectedIds = new Set<string>(['sp-1', 'sp-2']);

vi.mock('@/stores/selectionStore', () => ({
  useSelectionStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ selectedIds: mockSelectedIds }),
}));

// Mock useScreenplays
const mockScreenplays = [
  { id: 'sp-1', title: 'Script A', sourceFile: 'scriptA.pdf' },
  { id: 'sp-2', title: 'Script B', sourceFile: 'scriptB.pdf' },
  { id: 'sp-3', title: 'Script C', sourceFile: 'scriptC.pdf' },
];

vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: mockScreenplays, isLoading: false }),
  SCREENPLAYS_QUERY_KEY: ['screenplays'],
}));

// Mock patchAnalysisField
const mockPatchAnalysisField = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/analysisStore', () => ({
  patchAnalysisField: (...args: unknown[]) => mockPatchAnalysisField(...args),
}));

// Mock toast store
const mockAddToast = vi.fn();

vi.mock('@/stores/toastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: mockAddToast }),
  },
}));

// Mock react-query
const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

describe('SetCategoryModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedIds = new Set(['sp-1', 'sp-2']);
  });

  it('returns null when not open', () => {
    const { container } = render(<SetCategoryModal isOpen={false} onClose={mockOnClose} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders modal title "Set Category"', () => {
    render(<SetCategoryModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Set Category', { selector: 'h3' })).toBeInTheDocument();
  });

  it('renders category dropdown with options from useCategories', () => {
    render(<SetCategoryModal isOpen={true} onClose={mockOnClose} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Check for category options
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3); // default + 2 categories
    expect(options[1]).toHaveTextContent('Black List');
    expect(options[2]).toHaveTextContent('Lemon');
  });

  it('Apply button is disabled when no category selected', () => {
    render(<SetCategoryModal isOpen={true} onClose={mockOnClose} />);
    const applyBtn = screen.getByText('Set Category', { selector: 'button' });
    expect(applyBtn).toBeDisabled();
  });

  it('Apply button calls patchAnalysisField for each selected screenplay', async () => {
    render(<SetCategoryModal isOpen={true} onClose={mockOnClose} />);

    // Select a category
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'BLKLST' } });

    // Click Apply
    const applyBtn = screen.getByText('Set Category', { selector: 'button' });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockPatchAnalysisField).toHaveBeenCalledTimes(2);
      expect(mockPatchAnalysisField).toHaveBeenCalledWith('scriptA.pdf', 'collection', 'BLKLST');
      expect(mockPatchAnalysisField).toHaveBeenCalledWith('scriptB.pdf', 'collection', 'BLKLST');
    });
  });

  it('shows success toast after applying', async () => {
    render(<SetCategoryModal isOpen={true} onClose={mockOnClose} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'BLKLST' } });

    const applyBtn = screen.getByText('Set Category', { selector: 'button' });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        'Category set to Black List for 2 screenplays',
        'success'
      );
    });
  });

  it('calls onClose after applying', async () => {
    render(<SetCategoryModal isOpen={true} onClose={mockOnClose} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'LEMON' } });

    const applyBtn = screen.getByText('Set Category', { selector: 'button' });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
