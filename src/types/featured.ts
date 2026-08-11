import type { RecommendationTier } from '@/types/screenplay';

export type FeaturedPriorityMode =
  | 'highest_overall'
  | 'strongest_structure'
  | 'most_commercial'
  | 'fastest_read'
  | 'development_opportunity';

export interface FeaturedPolicy {
  schemaVersion: 1;
  eligibleVerdicts: RecommendationTier[];
  includeProducerLookPass: boolean;
  excludeProduced: boolean;
  excludeIncomplete: boolean;
  priorityMode: FeaturedPriorityMode;
  dustEnabled: boolean;
  dustDays: 30 | 60 | 90;
  dustMinimumScore: number;
  fastestReadMinimumScore: number;
  mandateGenres: string[];
  mandateThemes: string[];
  mandateFormats: string[];
  mandateCategories: string[];
  pinnedProjectId: string | null;
}

export type FeaturedSelectionCode =
  | 'manual_pin'
  | 'dust_resurfacing'
  | 'highest_overall'
  | 'strongest_structure'
  | 'most_commercial'
  | 'fastest_read'
  | 'development_opportunity'
  | 'mandate_fallback'
  | 'invalid_pin_fallback'
  | 'no_eligible_project';

export interface FeaturedSelectionReason {
  code: FeaturedSelectionCode;
  headline: string;
  detail: string;
  selectedProjectId: string | null;
  selectedForDate: string;
  mandateFallback: boolean;
  invalidPin: boolean;
}

export interface FeaturedEngagement {
  schemaVersion: 1;
  projectId: string;
  lastOpenedAt: string;
  openedByUid: string;
  openedByRole: 'admin';
  openCount: number;
}
