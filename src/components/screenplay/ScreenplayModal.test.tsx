/**
 * Component Tests for ScreenplayModal
 *
 * Tests the modal shell: open/close, escape key, backdrop click,
 * focus trap, ARIA attributes, body scroll lock, and content rendering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { ScreenplayModal } from './ScreenplayModal';
import { createTestScreenplay } from '@/test/factories';

// Mock the comparison store (used internally by ScreenplayCard rendered in modal)
vi.mock('@/stores/comparisonStore', () => ({
    useComparisonStore: () => vi.fn(),
    useIsSelectedForComparison: () => false,
    useIsComparisonFull: () => false,
}));

// Mock the notes store (used by NotesSection)
vi.mock('@/stores/notesStore', () => ({
    useNotesStore: (selector: (s: Record<string, unknown>) => unknown) =>
        selector({ notes: {} }),
    useScreenplayNotes: () => [],
}));

// Wrapper with QueryClientProvider for components that use useQueryClient
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
}

function renderWithClient(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
    return render(ui, { wrapper: createWrapper(), ...options });
}

describe('ScreenplayModal', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        // Clean up body style
        document.body.style.overflow = '';
    });

    // ────────────────────────────────────────────
    // Open / Close / Visibility
    // ────────────────────────────────────────────

    describe('visibility', () => {
        it('returns null when isOpen is false', () => {
            const screenplay = createTestScreenplay();
            const { container } = renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={false} onClose={mockOnClose} />
            );
            expect(container.innerHTML).toBe('');
        });

        it('returns null when screenplay is null', () => {
            const { container } = renderWithClient(
                <ScreenplayModal screenplay={null} isOpen={true} onClose={mockOnClose} />
            );
            expect(container.innerHTML).toBe('');
        });

        it('renders modal content when open with valid screenplay', () => {
            const screenplay = createTestScreenplay({ title: 'Visible Movie' });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByText('Visible Movie')).toBeInTheDocument();
        });
    });

    // ────────────────────────────────────────────
    // ARIA & Accessibility
    // ────────────────────────────────────────────

    describe('accessibility', () => {
        it('has role="dialog" and aria-modal="true"', () => {
            const screenplay = createTestScreenplay();
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
        });

        it('has aria-labelledby pointing to modal-title', () => {
            const screenplay = createTestScreenplay({ title: 'ARIA Test Movie' });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');

            // The id="modal-title" element should exist and contain the title
            const titleEl = document.getElementById('modal-title');
            expect(titleEl).not.toBeNull();
            expect(titleEl?.textContent).toBe('ARIA Test Movie');
        });

        it('has a close button with aria-label', () => {
            const screenplay = createTestScreenplay();
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
        });

        it('has aria-hidden backdrop', () => {
            const screenplay = createTestScreenplay();
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            const backdrop = document.querySelector('[aria-hidden="true"]');
            expect(backdrop).not.toBeNull();
        });
    });

    // ────────────────────────────────────────────
    // Close Behaviors
    // ────────────────────────────────────────────

    describe('close behaviors', () => {
        it('calls onClose when Escape key is pressed', () => {
            const screenplay = createTestScreenplay();
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            fireEvent.keyDown(document, { key: 'Escape' });
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when backdrop (outer div) is clicked', () => {
            const screenplay = createTestScreenplay();
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            // Click the outer dialog wrapper (the backdrop click zone)
            fireEvent.click(screen.getByRole('dialog'));
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('does NOT call onClose when modal content area is clicked', () => {
            const screenplay = createTestScreenplay({ logline: 'Click inside test.' });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            // Click the logline text (inside the modal content)
            fireEvent.click(screen.getByText('Click inside test.'));
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('calls onClose when close button is clicked', () => {
            const screenplay = createTestScreenplay();
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            fireEvent.click(screen.getByLabelText('Close modal'));
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });

    // ────────────────────────────────────────────
    // Body Scroll Lock
    // ────────────────────────────────────────────

    describe('body scroll lock', () => {
        it('sets overflow hidden on body when opened', () => {
            const screenplay = createTestScreenplay();
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(document.body.style.overflow).toBe('hidden');
        });

        it('restores overflow on body when closed/unmounted', () => {
            const screenplay = createTestScreenplay();
            const { unmount } = renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(document.body.style.overflow).toBe('hidden');
            unmount();
            expect(document.body.style.overflow).toBe('');
        });
    });

    // ────────────────────────────────────────────
    // Content Rendering
    // ────────────────────────────────────────────

    describe('content rendering', () => {
        it('displays title and author', () => {
            const screenplay = createTestScreenplay({
                title: 'Content Test',
                author: 'Jane Doe',
            });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(screen.getByText('Content Test')).toBeInTheDocument();
            expect(screen.getByText('by Jane Doe')).toBeInTheDocument();
        });

        it('displays logline', () => {
            const screenplay = createTestScreenplay({
                logline: 'A thrilling tale of modal testing.',
            });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(screen.getByText('A thrilling tale of modal testing.')).toBeInTheDocument();
        });

        it('displays genre and budget tier', () => {
            const screenplay = createTestScreenplay({
                genre: 'Sci-Fi',
                budgetCategory: 'high',
            });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(screen.getByText('Sci-Fi')).toBeInTheDocument();
            // Budget tier shows "High ($50M+)"
            expect(screen.getByText('High ($50M+)')).toBeInTheDocument();
        });

        it('displays collection', () => {
            const screenplay = createTestScreenplay({
                collection: '2023 Black List',
            });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(screen.getByText('2023 Black List')).toBeInTheDocument();
        });

        it('displays recommendation badge', () => {
            const screenplay = createTestScreenplay({ recommendation: 'film_now' });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(screen.getByText('FILM NOW')).toBeInTheDocument();
        });

        it('displays verdict statement', () => {
            const screenplay = createTestScreenplay({
                verdictStatement: 'A compelling screenplay with clear potential.',
            });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(screen.getByText('A compelling screenplay with clear potential.')).toBeInTheDocument();
        });

        it('displays critical failures when present', () => {
            const screenplay = createTestScreenplay({
                criticalFailures: ['Protagonist is passive', 'Plot lacks stakes'],
            });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            expect(screen.getByText('Protagonist is passive')).toBeInTheDocument();
            expect(screen.getByText('Plot lacks stakes')).toBeInTheDocument();
        });

        it('shows Film Now styling for Film Now screenplays', () => {
            const screenplay = createTestScreenplay({
                isFilmNow: true,
                recommendation: 'film_now',
            });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            // The modal content div should have film-now-glow class
            const modalContent = document.querySelector('.film-now-glow');
            expect(modalContent).not.toBeNull();
        });

        it('has a PDF download button', () => {
            const screenplay = createTestScreenplay({ sourceFile: 'test.pdf' });
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            const pdfButton = screen.getByTitle('Download test.pdf');
            expect(pdfButton).toBeInTheDocument();
        });
    });

    // ────────────────────────────────────────────
    // Focus Management
    // ────────────────────────────────────────────

    describe('focus management', () => {
        it('focuses close button after opening (with timer)', () => {
            const screenplay = createTestScreenplay();
            renderWithClient(
                <ScreenplayModal screenplay={screenplay} isOpen={true} onClose={mockOnClose} />
            );
            const closeButton = screen.getByLabelText('Close modal');

            // The component uses setTimeout(100ms) to focus
            act(() => {
                vi.advanceTimersByTime(150);
            });

            expect(document.activeElement).toBe(closeButton);
        });
    });
});
