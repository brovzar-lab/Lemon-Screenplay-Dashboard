/**
 * Data Normalization — barrel exports
 *
 * This module has been split for maintainability. The actual implementations
 * live in src/lib/normalizers/:
 *
 *   collectionMap.ts   — collection → category mapping
 *   helpers.ts         — shared internal helpers (generateId, normalizeSeverity, etc.)
 *   normalizeV5.ts     — standard V5 normalizer
 *   normalizeV6.ts     — lemon-ingest V6_unified bridge
 *   normalizeV9.ts     — V9 Archaeology Engine (accepts legacy v7/v8 labels)
 *   smartNormalize.ts  — version-detecting entry point
 *
 * All consumers can continue to import from '@/lib/normalize'.
 */

// ── Collection mapping ──────────────────────────────────────
export { collectionToCategoryId } from './normalizers/collectionMap';

// ── V5 (standard) ───────────────────────────────────────────
export { normalizeScreenplay, normalizeScreenplays } from './normalizers/normalizeV5';

// ── V6 (lemon-ingest bridge + deprecated stubs) ─────────────
export {
  isV6UnifiedAnalysis,
  normalizeV6UnifiedScreenplay,
  isV6RawAnalysis,
  normalizeV6Screenplay,
} from './normalizers/normalizeV6';

// ── V9 Archaeology Engine (with V7/V8 backward compat) ────
export {
  isArchaeologyAnalysis,
  normalizeV9Screenplay,
} from './normalizers/normalizeV9';
export type {
  PillarScore,
  GoosebumpsMoment,
  ScreenplayWithPillars,
  ScreenplayWithV6,
} from './normalizers/normalizeV9';

// ── Smart normalizer ────────────────────────────────────────
export { smartNormalizeScreenplay } from './normalizers/smartNormalize';
