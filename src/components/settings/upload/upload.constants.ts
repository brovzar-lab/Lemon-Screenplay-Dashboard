/**
 * Shared constants for the Upload feature
 */

import type { UploadStatus } from '@/stores/uploadStore';
import type { ModelInfo } from './upload.types';

// ─── Model definitions ───────────────────────────────────────────────────────

export const MODEL_OPTIONS: ModelInfo[] = [
  {
    id: 'haiku',
    name: 'Haiku 4.5',
    subtitle: 'Fast & Affordable',
    costPerScript: '~$0.06',
    speed: '~1 min',
    quality: 'Good',
    badge: 'BUDGET',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    description: 'Best for bulk scanning. Great accuracy for structured analysis at a fraction of the cost. Ideal for processing large batches of 100+ screenplays.',
    icon: '\u26A1',
  },
  {
    id: 'sonnet',
    name: 'Sonnet 4.5',
    subtitle: 'Balanced Power',
    costPerScript: '~$0.22',
    speed: '~3 min',
    quality: 'Excellent',
    badge: 'RECOMMENDED',
    badgeColor: 'bg-gold-500/20 text-gold-400',
    description: 'Best quality-to-cost ratio. Deep character analysis, nuanced genre detection, and reliable scoring. The default choice for professional analysis.',
    icon: '\uD83C\uDFAF',
  },
  {
    id: 'opus',
    name: 'Opus 4.6',
    subtitle: 'Maximum Depth',
    costPerScript: '~$0.90',
    speed: '~5 min',
    quality: 'Premium',
    badge: 'PREMIUM',
    badgeColor: 'bg-purple-500/20 text-purple-400',
    description: 'Deepest analysis with the most nuanced insights. Best for high-priority screenplays where you need every detail. 4x the cost of Sonnet.',
    icon: '\uD83D\uDC51',
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    subtitle: 'Smart Two-Pass',
    costPerScript: '~$0.22\u2013$1.12',
    speed: '~3\u20138 min',
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
  parsing: { label: 'Parsing PDF...', color: 'text-blue-400' },
  analyzing: { label: 'AI Analyzing...', color: 'text-gold-400' },
  promoting: { label: '\u2B06\uFE0F Promoted \u2192 Opus re-analysis...', color: 'text-purple-400' },
  complete: { label: 'Complete', color: 'text-emerald-400' },
  error: { label: 'Error', color: 'text-red-400' },
  skipped: { label: 'Skipped (duplicate)', color: 'text-black-400' },
};


// Token cost multipliers per model (per 1K tokens)
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  haiku: { input: 0.001, output: 0.005 },
  sonnet: { input: 0.003, output: 0.015 },
  opus: { input: 0.015, output: 0.075 },
  hybrid: { input: 0.003, output: 0.015 }, // base rate = Sonnet; Opus cost added dynamically
};
