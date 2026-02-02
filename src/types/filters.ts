/**
 * TypeScript interfaces for Filters and Sorting
 * Lemon Screenplay Dashboard
 */

import type { RecommendationTier, BudgetCategory, Collection } from './screenplay';

// ============================================
// RANGE FILTER
// ============================================

export interface RangeFilter {
  min: number;
  max: number;
  enabled: boolean;
}

// ============================================
// FILTER STATE
// ============================================

export interface FilterState {
  // Search
  searchQuery: string;

  // Recommendation Tier
  recommendationTiers: RecommendationTier[];

  // Budget
  budgetCategories: BudgetCategory[];

  // Collections
  collections: Collection[];

  // Genres & Themes
  genres: string[];
  themes: string[];

  // Score Ranges (dimension scores are 0-10)
  weightedScoreRange: RangeFilter;
  conceptRange: RangeFilter;
  structureRange: RangeFilter;
  protagonistRange: RangeFilter;
  supportingCastRange: RangeFilter;
  dialogueRange: RangeFilter;
  genreExecutionRange: RangeFilter;
  originalityRange: RangeFilter;

  // CVS Range (0-18)
  cvsRange: RangeFilter;

  // Producer Metrics Ranges
  marketPotentialRange: RangeFilter;
  starVehiclePotentialRange: RangeFilter;
  festivalAppealRange: RangeFilter;
  roiIndicatorRange: RangeFilter; // 1-5

  // Flags
  showFilmNowOnly: boolean;
  hidePassRated: boolean;
  hasCriticalFailures: boolean | null; // null = any, true = only with failures, false = no failures
}

// ============================================
// DEFAULT FILTER STATE
// ============================================

export const createDefaultRangeFilter = (min: number, max: number): RangeFilter => ({
  min,
  max,
  enabled: false,
});

export const DEFAULT_FILTER_STATE: FilterState = {
  searchQuery: '',
  recommendationTiers: [],
  budgetCategories: [],
  collections: [],
  genres: [],
  themes: [],
  weightedScoreRange: createDefaultRangeFilter(0, 10),
  conceptRange: createDefaultRangeFilter(0, 10),
  structureRange: createDefaultRangeFilter(0, 10),
  protagonistRange: createDefaultRangeFilter(0, 10),
  supportingCastRange: createDefaultRangeFilter(0, 10),
  dialogueRange: createDefaultRangeFilter(0, 10),
  genreExecutionRange: createDefaultRangeFilter(0, 10),
  originalityRange: createDefaultRangeFilter(0, 10),
  cvsRange: createDefaultRangeFilter(0, 18),
  marketPotentialRange: createDefaultRangeFilter(0, 10),
  starVehiclePotentialRange: createDefaultRangeFilter(0, 10),
  festivalAppealRange: createDefaultRangeFilter(0, 10),
  roiIndicatorRange: createDefaultRangeFilter(1, 5),
  showFilmNowOnly: false,
  hidePassRated: false,
  hasCriticalFailures: null,
};

// ============================================
// SORTING
// ============================================

export type SortDirection = 'asc' | 'desc';

export type SortField =
  // Core Scores
  | 'weightedScore'
  | 'cvsTotal'
  // Dimensions
  | 'concept'
  | 'structure'
  | 'protagonist'
  | 'supportingCast'
  | 'dialogue'
  | 'genreExecution'
  | 'originality'
  // Producer Metrics
  | 'marketPotential'
  | 'starVehiclePotential'
  | 'festivalAppeal'
  | 'roiIndicator'
  // Text Fields
  | 'title'
  | 'author'
  | 'genre'
  | 'collection'
  // Recommendation (custom order)
  | 'recommendation';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface SortState {
  // Multi-column sorting (priority order)
  sortConfigs: SortConfig[];

  // Film Now always first?
  prioritizeFilmNow: boolean;
}

export const DEFAULT_SORT_STATE: SortState = {
  sortConfigs: [
    { field: 'marketPotential', direction: 'desc' },
    { field: 'roiIndicator', direction: 'desc' },
  ],
  prioritizeFilmNow: true,
};

// ============================================
// SORT FIELD CONFIG
// ============================================

export interface SortFieldConfig {
  field: SortField;
  label: string;
  group: 'score' | 'dimension' | 'producer' | 'text';
}

export const SORT_FIELD_CONFIG: SortFieldConfig[] = [
  // Scores
  { field: 'weightedScore', label: 'Weighted Score', group: 'score' },
  { field: 'cvsTotal', label: 'CVS Total', group: 'score' },
  { field: 'recommendation', label: 'Recommendation', group: 'score' },

  // Dimensions
  { field: 'concept', label: 'Concept', group: 'dimension' },
  { field: 'structure', label: 'Structure', group: 'dimension' },
  { field: 'protagonist', label: 'Protagonist', group: 'dimension' },
  { field: 'supportingCast', label: 'Supporting Cast', group: 'dimension' },
  { field: 'dialogue', label: 'Dialogue', group: 'dimension' },
  { field: 'genreExecution', label: 'Genre Execution', group: 'dimension' },
  { field: 'originality', label: 'Originality', group: 'dimension' },

  // Producer Metrics
  { field: 'marketPotential', label: 'Market Potential', group: 'producer' },
  { field: 'starVehiclePotential', label: 'Star Vehicle', group: 'producer' },
  { field: 'festivalAppeal', label: 'Festival Appeal', group: 'producer' },
  { field: 'roiIndicator', label: 'ROI Indicator', group: 'producer' },

  // Text
  { field: 'title', label: 'Title', group: 'text' },
  { field: 'author', label: 'Author', group: 'text' },
  { field: 'genre', label: 'Genre', group: 'text' },
  { field: 'collection', label: 'Collection', group: 'text' },
];

// ============================================
// SAVED VIEWS
// ============================================

export interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  sort: SortState;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// COMPARISON
// ============================================

export interface ComparisonState {
  selectedIds: string[]; // Max 3
  isComparing: boolean;
  viewMode: 'side-by-side' | 'radar';
}

export const DEFAULT_COMPARISON_STATE: ComparisonState = {
  selectedIds: [],
  isComparing: false,
  viewMode: 'side-by-side',
};

// ============================================
// NOTES
// ============================================

export interface Note {
  id: string;
  screenplayId: string;
  content: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotesState {
  notes: Record<string, Note[]>; // Keyed by screenplay ID
}

export const DEFAULT_NOTES_STATE: NotesState = {
  notes: {},
};
