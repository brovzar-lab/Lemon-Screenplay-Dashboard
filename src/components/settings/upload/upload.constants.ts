/**
 * Shared constants for the Upload feature
 */

import type { UploadStatus } from '@/stores/uploadStore';
import modelCatalog from '@/config/anthropic-model-catalog.json';
import type { ModelInfo, ModelOption } from './upload.types';

// ─── Model definitions ───────────────────────────────────────────────────────

// Planning ranges use seven metered production runs ($2.70–$7.33 on Opus)
// and the approved server-side price ratios. Hybrid includes a Sonnet pass
// plus the possible Opus promotion. Keep these conservative until the pilot
// supplies direct Hybrid measurements.
export const MODEL_PLANNING_COSTS_USD: Record<ModelOption, readonly [number, number]> = {
  haiku: [1.65, 4.75],
  sonnet: [1.6, 4.5],
  opus: [2.7, 7.5],
  hybrid: [1.6, 12],
};

export const MODEL_OPTIONS: ModelInfo[] = [
  {
    id: 'haiku',
    name: 'Haiku cold read + Sonnet 4.6',
    modelId: `${modelCatalog.analysisRoutes.haiku.modelId} + ${modelCatalog.analysisRoutes.sonnet.modelId}`,
    routeLabel: 'Approved non-binding support route',
    subtitle: 'Cold Read + Full Panel',
    costPerScript: '~$1.65–$4.75',
    speed: '~3-4 min',
    quality: 'Excellent',
    badge: 'SAFE',
    badgeColor: 'settings-model-badge--budget',
    description: 'Haiku supplies a cold read and genre signal, then the complete Sonnet panel always runs. A Haiku PASS can never stop full scoring.',
    icon: '\u26A1',
  },
  {
    id: 'sonnet',
    name: modelCatalog.analysisRoutes.sonnet.displayName,
    modelId: modelCatalog.analysisRoutes.sonnet.modelId,
    routeLabel: 'Approved analysis route',
    subtitle: 'Balanced Power',
    costPerScript: '~$1.60–$4.50',
    speed: '~3 min',
    quality: 'Excellent',
    badge: 'RECOMMENDED',
    badgeColor: 'bg-gold-500/20 text-gold-400',
    description: 'Best quality-to-cost ratio. Deep character analysis, nuanced genre detection, and reliable scoring. The default choice for professional analysis.',
    icon: '\uD83C\uDFAF',
  },
  {
    id: 'opus',
    name: modelCatalog.analysisRoutes.opus.displayName,
    modelId: modelCatalog.analysisRoutes.opus.modelId,
    routeLabel: 'Approved analysis route',
    subtitle: 'Maximum Depth',
    costPerScript: '~$2.70–$7.50',
    speed: '~5 min',
    quality: 'Premium',
    badge: 'PREMIUM',
    badgeColor: 'bg-purple-500/20 text-purple-400',
    description: 'Deep analysis with nuanced insights. Best for high-priority screenplays where you need every detail. This pinned route remains unchanged until it passes a benchmark review.',
    icon: '\uD83D\uDC51',
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    modelId: `${modelCatalog.analysisRoutes.sonnet.modelId} + ${modelCatalog.analysisRoutes.opus.modelId}`,
    routeLabel: 'Approved two-pass route',
    subtitle: 'Smart Two-Pass',
    costPerScript: '~$1.60–$12.00',
    speed: '~3-8 min',
    quality: 'Optimized',
    badge: 'SMART',
    badgeColor: 'bg-cyan-500/20 text-cyan-400',
    description: 'Sonnet first pass on all scripts. Recommend & Film Now scripts get a fresh Opus deep analysis automatically. Best value for batches.',
    icon: '\uD83D\uDD04',
  },
];

// ─── Status labels ───────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<UploadStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-black-400' },
  uploading: { label: 'Uploading', color: 'text-blue-400' },
  uploaded: { label: 'Uploaded', color: 'text-blue-400' },
  queued: { label: 'Queued', color: 'text-blue-400' },
  parsing: { label: 'Parsing PDF...', color: 'text-blue-400' },
  analyzing: { label: 'AI Analyzing...', color: 'text-gold-400' },
  promoting: { label: '\u2B06\uFE0F Promoted \u2192 Opus re-analysis...', color: 'text-purple-400' },
  waiting_for_budget: { label: 'Waiting for Budget', color: 'text-amber-400' },
  complete: { label: 'Complete', color: 'text-emerald-400' },
  error: { label: 'Error', color: 'text-red-400' },
  skipped: { label: 'Skipped (duplicate)', color: 'text-black-400' },
  needs_review: { label: 'Needs review', color: 'text-amber-400' },
};


// Token cost multipliers per model (per 1K tokens)
export const MODEL_COSTS: Record<ModelOption, { input: number; output: number }> = {
  haiku: { input: 0.001, output: 0.005 },
  sonnet: { input: 0.003, output: 0.015 },
  opus: { input: 0.005, output: 0.025 },
  hybrid: { input: 0.003, output: 0.015 }, // base rate = Sonnet; Opus cost added dynamically
};
