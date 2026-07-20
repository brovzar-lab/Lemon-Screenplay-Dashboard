/**
 * Component Tests for FilterBar
 *
 * Tests the filter bar: Filters button badge (advanced filter count)
 * and Missing PDF chip (file status quick filter).
 *
 * Covers FILTER-03 (Filters badge) and FILE-03 (Missing PDF chip).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from './FilterBar';
import { createTestScreenplay } from '@/test/factories';

// ─────────────────────────────────────────────────────────
// Mock state defaults
// ─────────────────────────────────────────────────────────

const makeDefaultFilterState = () => ({
    searchQuery: '',
    setSearchQuery: vi.fn(),
    recommendationTiers: [],
    setRecommendationTiers: vi.fn(),
    resetFilters: vi.fn(),
    missingPdfOnly: false,
    setMissingPdfOnly: vi.fn(),
    hasPdfOnly: false,
    setHasPdfOnly: vi.fn(),
    // 7 dimension ranges — all disabled by default
    conceptRange: { min: 0, max: 10, enabled: false },
    structureRange: { min: 0, max: 10, enabled: false },
    protagonistRange: { min: 0, max: 10, enabled: false },
    supportingCastRange: { min: 0, max: 10, enabled: false },
    dialogueRange: { min: 0, max: 10, enabled: false },
    genreExecutionRange: { min: 0, max: 10, enabled: false },
    originalityRange: { min: 0, max: 10, enabled: false },
});

let mockFilterState = makeDefaultFilterState();

vi.mock('@/stores/filterStore', () => ({
    useFilterStore: (selector: (s: unknown) => unknown) => selector(mockFilterState),
}));

vi.mock('@/stores/sortStore', () => ({
    useSortStore: (selector: (s: unknown) => unknown) =>
        selector({
            sortConfigs: [],
            addSortColumn: vi.fn(),
            resetSort: vi.fn(),
        }),
}));

vi.mock('@/stores/exportSelectionStore', () => ({
    useExportSelectionStore: (selector: (s: unknown) => unknown) =>
        selector({
            selectedIds: [],
            selectAll: vi.fn(),
            deselectAll: vi.fn(),
            isSelected: vi.fn(() => false),
        }),
    useExportSelectionCount: () => 0,
}));

vi.mock('@/hooks/useFilteredScreenplays', () => ({
    useHasActiveFilters: () => false,
}));

vi.mock('@/hooks/useUrlState', () => ({
    buildShareableUrl: () => '',
}));

vi.mock('@/hooks/useKeyboardShortcuts', () => ({
    useKeyboardShortcuts: () => undefined,
}));

vi.mock('@/hooks/useScreenplays', () => ({
    useScreenplays: () => ({ data: [], isLoading: false }),
    useDeleteScreenplays: () => ({ mutate: vi.fn(), isPending: false }),
    SCREENPLAYS_QUERY_KEY: ['screenplays'],
}));

vi.mock('@/hooks/usePdfScan', () => ({
    usePdfScan: () => ({ scan: vi.fn(), isScanning: false }),
}));

vi.mock('@/stores/pdfStatusStore', () => ({
    usePdfStatusStore: (selector: (s: unknown) => unknown) =>
        selector({ statuses: {}, hasScanResult: false, isScanning: false }),
}));

vi.mock('@/components/filters', () => ({
    FilterPanel: () => null,
    AdvancedSortPanel: () => null,
    ActionsDropdown: () => null,
    LensMenu: () => null,
}));

vi.mock('@/components/export', () => ({
    ExportModal: () => null,
}));

vi.mock('@/components/share', () => ({
    ShareModal: () => null,
}));

vi.mock('@/components/bulk', () => ({
    BulkShareModal: () => null,
    BulkReanalyzeModal: () => null,
}));

vi.mock('@/components/ui/ShortcutHint', () => ({
    ShortcutHint: () => null,
}));

vi.mock('@/hooks/useScreenplays', () => ({
    useScreenplays: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/usePdfScan', () => ({
    usePdfScan: () => ({ triggerScan: vi.fn(), hasScanResult: false, isScanning: false }),
}));

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function renderFilterBar(
    screenplays = [createTestScreenplay()],
    filteredCount = 1,
    totalCount = 1,
    onOpenReadingRoom?: () => void,
) {
    return render(
        <FilterBar
            screenplays={screenplays}
            isLoading={false}
            filteredCount={filteredCount}
            totalCount={totalCount}
            onOpenReadingRoom={onOpenReadingRoom}
        />,
    );
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('FilterBar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFilterState = makeDefaultFilterState();
    });

    describe('Reading Room', () => {
        it('opens from the toolbar', () => {
            const onOpenReadingRoom = vi.fn();
            renderFilterBar([createTestScreenplay()], 1, 1, onOpenReadingRoom);

            fireEvent.click(screen.getByTitle('Open Reading Room'));

            expect(onOpenReadingRoom).toHaveBeenCalledOnce();
        });

        it('is disabled when the filtered slate is empty', () => {
            renderFilterBar([], 0, 1, vi.fn());

            expect(screen.getByTitle('Open Reading Room')).toBeDisabled();
        });
    });

    // ────────────────────────────────────────────
    // Filters Button Badge (FILTER-03)
    // ────────────────────────────────────────────

    describe('Filters button badge', () => {
        it('shows no badge on Filters button when no advanced filters active', () => {
            renderFilterBar();
            // The Filters button should exist
            const filtersButton = screen.getByTitle('Advanced Filters');
            expect(filtersButton).toBeInTheDocument();
            // No badge — no element with a numeric count inside the button
            const badge = filtersButton.querySelector('[data-testid="filter-badge"]');
            expect(badge).toBeNull();
        });

        it('shows badge count on Filters button when 2 dimension ranges enabled', () => {
            mockFilterState.conceptRange = { min: 0, max: 10, enabled: true };
            mockFilterState.structureRange = { min: 0, max: 10, enabled: true };

            renderFilterBar();
            // A badge with text "2" should appear near the Filters button
            expect(screen.getByText('2')).toBeInTheDocument();
        });
    });

    // ────────────────────────────────────────────
    // Missing PDF Chip (FILE-03)
    // ────────────────────────────────────────────

    describe('Missing PDF chip', () => {
        it('is absent when missingPdfCount is 0 and filter is inactive', () => {
            // All screenplays have hasPdf=true, filter inactive
            const screenplays = [
                createTestScreenplay({ hasPdf: true }),
                createTestScreenplay({ id: 'sp-2', hasPdf: true }),
            ];
            renderFilterBar(screenplays, screenplays.length, screenplays.length);
            expect(screen.queryByText(/Missing PDF/)).not.toBeInTheDocument();
        });

        it('renders with count badge when screenplays have no PDF', () => {
            const screenplays = [
                createTestScreenplay({ id: 'sp-1', hasPdf: false }),
                createTestScreenplay({ id: 'sp-2', hasPdf: false }),
                createTestScreenplay({ id: 'sp-3', hasPdf: false }),
            ];
            renderFilterBar(screenplays, screenplays.length, screenplays.length);
            // "Missing PDF" chip visible
            expect(screen.getByText(/Missing PDF/)).toBeInTheDocument();
            // Badge showing count "3"
            expect(screen.getByText('3')).toBeInTheDocument();
        });

        it('calls setMissingPdfOnly when chip is clicked', () => {
            const screenplays = [createTestScreenplay({ id: 'sp-1', hasPdf: false })];
            renderFilterBar(screenplays, screenplays.length, screenplays.length);

            const chip = screen.getByText(/Missing PDF/);
            fireEvent.click(chip);
            expect(mockFilterState.setMissingPdfOnly).toHaveBeenCalledWith(true);
        });

        it('shows chip as active when missingPdfOnly is true', () => {
            mockFilterState.missingPdfOnly = true;
            const screenplays = [createTestScreenplay({ id: 'sp-1', hasPdf: false })];
            renderFilterBar(screenplays, screenplays.length, screenplays.length);

            const chip = screen.getByText(/Missing PDF/).closest('button');
            expect(chip).toHaveAttribute('data-active', 'true');
        });
    });
});
