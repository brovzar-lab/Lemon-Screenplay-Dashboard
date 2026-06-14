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
 *   normalizeV7.ts     — Archaeology Engine V7/V8/V9
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
  isV7RawAnalysis,
  normalizeV7Screenplay,
} from './normalizers/normalizeV7';
export type {
  V7PillarScore,
  V7GoosebumpsMoment,
  ScreenplayWithV7,
  ScreenplayWithV6,
} from './normalizers/normalizeV7';

// ── Smart normalizer ────────────────────────────────────────
export { smartNormalizeScreenplay } from './normalizers/smartNormalize';
