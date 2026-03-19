/**
 * Component Tests for FilterPanel
 *
 * Tests the filter sidebar: open/close, section toggling, filter controls,
 * active filter count, reset, and apply behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterPanel } from './FilterPanel';
import { useFilterStore } from '@/stores/filterStore';
import { DEFAULT_FILTER_STATE } from '@/types/filters';

// Mock the data-derived genres/themes hooks
vi.mock('@/hooks/useScreenplays', () => ({
    useGenres: () => ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller'],
    useThemes: () => ['Identity', 'Redemption', 'Love', 'Revenge', 'Survival'],
}));

describe('FilterPanel', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset the Zustand store to defaults before each test
        useFilterStore.setState(DEFAULT_FILTER_STATE);
    });

    // ────────────────────────────────────────────
    // Open / Close / Visibility
    // ────────────────────────────────────────────

    describe('visibility', () => {
        it('returns null when isOpen is false', () => {
            const { container } = render(
                <FilterPanel isOpen={false} onClose={mockOnClose} />
            );
            expect(container.innerHTML).toBe('');
        });

        it('renders panel when isOpen is true', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            expect(screen.getByText('Advanced Filters')).toBeInTheDocument();
        });

        it('calls onClose when backdrop is clicked', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            // The backdrop is the first child fixed div
            const backdrop = document.querySelector('.fixed.inset-0.bg-black-950\\/80');
            expect(backdrop).not.toBeNull();
            fireEvent.click(backdrop!);
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('calls onClose when Apply Filters button is clicked', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            fireEvent.click(screen.getByText('Apply Filters'));
            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });

    // ────────────────────────────────────────────
    // Section Headers
    // ────────────────────────────────────────────

    describe('section headers', () => {
        it('renders all filter section headers', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            expect(screen.getByText('Display Options')).toBeInTheDocument();
            expect(screen.getByText('Source Category')).toBeInTheDocument();
            expect(screen.getByText('Genre & Theme')).toBeInTheDocument();
            expect(screen.getByText('Core Scores')).toBeInTheDocument();
            expect(screen.getByText('Dimension Scores')).toBeInTheDocument();
            expect(screen.getByText('Market Analysis')).toBeInTheDocument();
        });

        it('opens Genre & Theme section by default', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            // "Genre & Theme" is the default open section — should show its children
            expect(screen.getByText('Genres')).toBeInTheDocument();
            expect(screen.getByText('Themes')).toBeInTheDocument();
        });

        it('Core Scores section is closed initially', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            // Core Scores should NOT be open by default — its content not visible
            expect(screen.queryByText('Weighted Score')).not.toBeInTheDocument();
            expect(screen.queryByText('CVS Total')).not.toBeInTheDocument();
        });

        it('toggles section open/closed on click', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);

            // Genre & Theme is open by default — Genres visible
            expect(screen.getByText('Genres')).toBeInTheDocument();

            // Open Core Scores by clicking it
            fireEvent.click(screen.getByText('Core Scores'));
            // Core Scores content should now be visible
            expect(screen.getByText('Weighted Score')).toBeInTheDocument();
            expect(screen.getByText('CVS Total')).toBeInTheDocument();
        });

        it('closes currently open section when clicking another section', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);

            // Genre & Theme is open by default
            expect(screen.getByText('Genres')).toBeInTheDocument();

            // Open Display Options
            fireEvent.click(screen.getByText('Display Options'));

            // Genre & Theme should now be closed
            expect(screen.queryByText('Genres')).not.toBeInTheDocument();
            // Display Options should be open
            expect(screen.getByText('Hide produced films')).toBeInTheDocument();
        });
    });

    // ────────────────────────────────────────────
    // Advanced Disclosure
    // ────────────────────────────────────────────

    describe('Advanced disclosure', () => {
        it('renders without Advanced content visible by default', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            // Open Dimension Scores section first
            fireEvent.click(screen.getByText('Dimension Scores'));
            // The dimension sliders (Concept, Structure, etc.) should NOT be visible
            // without clicking the "Advanced" button first
            expect(screen.queryByText('Concept')).not.toBeInTheDocument();
        });

        it('clicking Advanced button reveals dimension slider content', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            // Open Dimension Scores section
            fireEvent.click(screen.getByText('Dimension Scores'));
            // Before clicking Advanced — sliders hidden
            expect(screen.queryByText('Concept')).not.toBeInTheDocument();
            // Click the "Advanced" toggle button
            fireEvent.click(screen.getByText('Advanced'));
            // Now dimension sliders should be visible
            expect(screen.getByText('Concept')).toBeInTheDocument();
        });
    });

    // ────────────────────────────────────────────
    // Auto-expand on Open
    // ────────────────────────────────────────────

    describe('auto-expand on open', () => {
        it('auto-expands Genre & Theme section when genres filter is active', () => {
            // Set genres filter active before render
            useFilterStore.setState({ genres: ['Drama'] });
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            // Genre & Theme should auto-expand because genres=['Drama'] is active
            expect(screen.getByText('Genres')).toBeInTheDocument();
        });

        it('auto-expands Advanced when a dimension range is enabled', () => {
            // Set a dimension range enabled before render
            useFilterStore.setState({
                conceptRange: { min: 0, max: 10, enabled: true },
            });
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            // The Dimension Scores section should be open and Advanced expanded
            // so that the Concept slider is visible
            expect(screen.getByText('Concept')).toBeInTheDocument();
        });
    });

    // ────────────────────────────────────────────
    // Display Options
    // ────────────────────────────────────────────

    describe('display options', () => {
        it('renders hide produced toggle', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            fireEvent.click(screen.getByText('Display Options'));

            expect(screen.getByText('Hide produced films')).toBeInTheDocument();
            expect(screen.getByText('Exclude screenplays that became movies')).toBeInTheDocument();
        });

        it('toggles hide produced state', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            fireEvent.click(screen.getByText('Display Options'));

            const checkboxes = screen.getAllByRole('checkbox');
            const checkbox = checkboxes[0]; // hideProduced is first in the list
            // hideProduced defaults to true in DEFAULT_FILTER_STATE
            expect(checkbox).toBeChecked();

            fireEvent.click(checkbox);
            expect(useFilterStore.getState().hideProduced).toBe(false);
        });
    });

    // ────────────────────────────────────────────
    // Active Filter Count
    // ────────────────────────────────────────────

    describe('active filter count', () => {
        it('does NOT show filter count when no filters are active', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            expect(screen.queryByText(/filters active/)).not.toBeInTheDocument();
        });

        it('shows filter count badge when filters are active', () => {
            useFilterStore.setState({
                genres: ['Drama'],
                weightedScoreRange: { min: 7, max: 10, enabled: true },
            });

            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            expect(screen.getByText('2 filters active')).toBeInTheDocument();
        });
    });

    // ────────────────────────────────────────────
    // Reset Filters
    // ────────────────────────────────────────────

    describe('reset', () => {
        it('has a Reset All button', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            expect(screen.getByText('Reset All')).toBeInTheDocument();
        });

        it('resets all filters when Reset All is clicked', () => {
            // Set some active filters
            useFilterStore.setState({
                genres: ['Drama', 'Thriller'],
                themes: ['Identity'],
                weightedScoreRange: { min: 7, max: 10, enabled: true },
                hideProduced: true,
            });

            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            fireEvent.click(screen.getByText('Reset All'));

            const state = useFilterStore.getState();
            expect(state.genres).toEqual([]);
            expect(state.themes).toEqual([]);
            expect(state.weightedScoreRange.enabled).toBe(false);
            // hideProduced defaults to true in DEFAULT_FILTER_STATE
            expect(state.hideProduced).toBe(true);
        });
    });

    // ────────────────────────────────────────────
    // Section Badges
    // ────────────────────────────────────────────

    describe('section badges', () => {
        it('shows badge count on Genre & Theme when genres are selected', () => {
            useFilterStore.setState({ genres: ['Drama', 'Comedy'] });

            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            // Badge should show "2" (2 genres selected)
            const genreSectionHeader = screen.getByText('Genre & Theme').closest('button');
            expect(genreSectionHeader?.textContent).toContain('2');
        });

        it('shows badge count on Core Scores when ranges are enabled', () => {
            useFilterStore.setState({
                weightedScoreRange: { min: 7, max: 10, enabled: true },
                cvsRange: { min: 10, max: 18, enabled: true },
            });

            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            const coreScoresHeader = screen.getByText('Core Scores').closest('button');
            expect(coreScoresHeader?.textContent).toContain('2');
        });
    });

    // ────────────────────────────────────────────
    // Dimension Scores Section
    // ────────────────────────────────────────────

    describe('dimension scores section', () => {
        it('renders all 7 dimension range sliders when Dimension Scores and Advanced are opened', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            // Open Dimension Scores accordion first
            fireEvent.click(screen.getByText('Dimension Scores'));
            // Then open the Advanced disclosure to reveal sliders (FILTER-02)
            fireEvent.click(screen.getByText('Advanced'));

            expect(screen.getByText('Concept')).toBeInTheDocument();
            expect(screen.getByText('Structure')).toBeInTheDocument();
            expect(screen.getByText('Protagonist')).toBeInTheDocument();
            expect(screen.getByText('Supporting Cast')).toBeInTheDocument();
            expect(screen.getByText('Dialogue')).toBeInTheDocument();
            expect(screen.getByText('Genre Execution')).toBeInTheDocument();
            expect(screen.getByText('Originality')).toBeInTheDocument();
        });
    });

    // ────────────────────────────────────────────
    // Market Analysis Section
    // ────────────────────────────────────────────

    describe('market analysis section', () => {
        it('renders market potential range slider when opened', () => {
            render(<FilterPanel isOpen={true} onClose={mockOnClose} />);
            fireEvent.click(screen.getByText('Market Analysis'));

            expect(screen.getByText('Market Potential')).toBeInTheDocument();
        });
    });
});
