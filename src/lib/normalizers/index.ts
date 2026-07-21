/**
 * Data Normalization — normalizers barrel exports
 */
export { collectionToCategoryId } from './collectionMap';
export { normalizeScreenplay, normalizeScreenplays } from './normalizeV5';
export {
  isV6UnifiedAnalysis,
  normalizeV6UnifiedScreenplay,
  isV6RawAnalysis,
  normalizeV6Screenplay,
} from './normalizeV6';
export {
  isArchaeologyAnalysis,
  normalizeV9Screenplay,
} from './normalizeV9';
export type {
  PillarScore,
  GoosebumpsMoment,
  ScreenplayWithPillars,
  ScreenplayWithV6,
} from './normalizeV9';
export { smartNormalizeScreenplay } from './smartNormalize';
