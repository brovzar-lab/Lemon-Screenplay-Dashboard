/**
 * Data Normalization — barrel exports
 *
 * This module has been split for maintainability. The actual implementations
 * live in src/lib/normalizers/:
 *
 *   collectionMap.ts   — collection → category mapping
 *   helpers.ts         — shared internal helpers (generateId, normalizeSeverity, etc.)
 *   normalizeV9.ts     — V9 Archaeology Engine (accepts legacy v7/v8 labels)
 *
 * All consumers can continue to import from '@/lib/normalize'.
 * Documents that fail isArchaeologyAnalysis are quarantined by
 * normalizeAnalyses (api.ts) — never rendered blank.
 */

// ── Collection mapping ──────────────────────────────────────
export { collectionToCategoryId } from './normalizers/collectionMap';

// ── V9 Archaeology Engine (with V7/V8 backward compat) ────
export {
  isArchaeologyAnalysis,
  normalizeV9Screenplay,
} from './normalizers/normalizeV9';
export type {
  PillarScore,
  GoosebumpsMoment,
  ScreenplayWithPillars,
} from './normalizers/normalizeV9';
