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
  isV7RawAnalysis,
  normalizeV7Screenplay,
} from './normalizeV7';
export type {
  V7PillarScore,
  V7GoosebumpsMoment,
  ScreenplayWithV7,
  ScreenplayWithV6,
} from './normalizeV7';
export { smartNormalizeScreenplay } from './smartNormalize';
