/**
 * Data Normalization — normalizers barrel exports
 */
export { collectionToCategoryId } from './collectionMap';
export {
  isArchaeologyAnalysis,
  normalizeV9Screenplay,
} from './normalizeV9';
export {
  isCoverageV1Analysis,
  normalizeCoverageV1Screenplay,
  resolveCoverageV1Report,
} from './normalizeCoverageV1';
export type {
  PillarScore,
  GoosebumpsMoment,
  ScreenplayWithPillars,
} from './normalizeV9';
