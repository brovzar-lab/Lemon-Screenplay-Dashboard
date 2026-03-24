/**
 * BulkPdfUploadModal Tests
 * Tests rendering, missing-PDF filtering, info note, summary, Done button behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkPdfUploadModal } from './BulkPdfUploadModal';
import type { Screenplay } from '@/types';

// Mock data
const mockScreenplays = [
  { id: '1', title: 'The Matrix', sourceFile: 'the_matrix.json', hasPdf: false, category: 'SUBMISSION' },
  { id: '2', title: 'Inception', sourceFile: 'inception.json', hasPdf: true, category: 'LEMON' },
  { id: '3', title: 'Interstellar', sourceFile: 'interstellar.json', hasPdf: false, category: 'BLKLST' },
] as Screenplay[];

const mockSelectedIds = new Set(['1', '2', '3']);

// Mock useScreenplays
vi.mock('@/hooks/useScreenplays', () => ({
  useScreenplays: () => ({ data: mockScreenplays }),
  SCREENPLAYS_QUERY_KEY: ['screenplays'],
}));

// Mock selectionStore
vi.mock('@/stores/selectionStore', () => ({
  useSelectionStore: vi.fn((selector: (s: { selectedIds: Set<string> }) => unknown) =>
    selector({ selectedIds: mockSelectedIds })
  ),
}));

// Mock react-query
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// Mock firebase/storage
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(),
}));

// Mock firebase
vi.mock('@/lib/firebase', () => ({ storage: {} }));

// Mock analysisStore
vi.mock('@/lib/analysisStore', () => ({ patchAnalysisField: vi.fn() }));

// Mock pdfStatusStore
vi.mock('@/stores/pdfStatusStore', () => ({
  usePdfStatusStore: { getState: () => ({ setStatus: vi.fn() }) },
}));

// Mock pdfUploadPanel.helpers
vi.mock('@/components/settings/pdfUploadPanel.helpers', () => ({
  buildStoragePath: vi.fn(() => 'screenplays/SUBMISSION/The_Matrix.pdf'),
}));

describe('BulkPdfUploadModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <BulkPdfUploadModal isOpen={false} onClose={mockOnClose} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders modal with missing-PDF screenplays only', () => {
    render(<BulkPdfUploadModal isOpen={true} onClose={mockOnClose} />);

    // The Matrix and Interstellar should be visible (hasPdf=false)
    expect(screen.getByText('The Matrix')).toBeInTheDocument();
    expect(screen.getByText('Interstellar')).toBeInTheDocument();

    // Inception should NOT be visible (hasPdf=true)
    expect(screen.queryByText('Inception')).not.toBeInTheDocument();
  });

  it('shows already-attached count in info note', () => {
    render(<BulkPdfUploadModal isOpen={true} onClose={mockOnClose} />);

    // 1 of 3 selected screenplays already have PDFs attached (Inception has PDF)
    expect(
      screen.getByText(/1 of 3 selected screenplays already have PDFs attached/)
    ).toBeInTheDocument();
  });

  it('Done button is always present and enabled', () => {
    render(<BulkPdfUploadModal isOpen={true} onClose={mockOnClose} />);

    const doneBtn = screen.getByText('Done');
    expect(doneBtn).toBeInTheDocument();
    expect(doneBtn).not.toBeDisabled();
  });

  it('Done button calls onClose', () => {
    render(<BulkPdfUploadModal isOpen={true} onClose={mockOnClose} />);

    const doneBtn = screen.getByText('Done');
    fireEvent.click(doneBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('shows batch drop zone', () => {
    render(<BulkPdfUploadModal isOpen={true} onClose={mockOnClose} />);

    expect(
      screen.getByText('Drop multiple PDFs here to auto-match by filename')
    ).toBeInTheDocument();
  });

  it('shows Upload PDFs heading', () => {
    render(<BulkPdfUploadModal isOpen={true} onClose={mockOnClose} />);

    expect(
      screen.getByText('Upload PDFs', { selector: 'h3' })
    ).toBeInTheDocument();
  });

  it('shows Browse buttons for idle rows', () => {
    render(<BulkPdfUploadModal isOpen={true} onClose={mockOnClose} />);

    const browseButtons = screen.getAllByText('Browse');
    // 2 missing-PDF screenplays = 2 Browse buttons
    expect(browseButtons).toHaveLength(2);
  });

  it('shows summary bar with screenplay count', () => {
    render(<BulkPdfUploadModal isOpen={true} onClose={mockOnClose} />);

    // Initial state: "2 screenplays need PDFs"
    expect(
      screen.getByText('2 screenplays need PDFs')
    ).toBeInTheDocument();
  });
});
