/**
 * Engine Comparison Lab
 *
 * Compare analysis results across approved V9 routes (Haiku composite / Sonnet / Opus).
 * Supports two source modes:
 *   1. Upload — drop a PDF and run fresh analysis with the V9 Archaeology Engine
 *   2. Dashboard — pull existing analyzed screenplays for instant comparison
 *
 * Results are displayed in a responsive grid with engine-specific dimension bars.
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { analyzeScreenplay } from '@/lib/analysisService';
import type { AnalysisProgress } from '@/lib/analysisService';
import type { TrackedUsage } from '@/lib/multiPassAnalysis';
import { useScreenplays } from '@/hooks/useScreenplays';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import modelCatalog from '@/config/anthropic-model-catalog.json';
import { MODEL_OPTIONS } from './upload/upload.constants';
import { REANALYSIS_MODELS } from '@/components/screenplay/modal/reanalysisModels';
import { decisionReadyScreenplays } from '@/lib/producerProjection';

// ─── Types ───────────────────────────────────────────────────────────────────

type ModelId = 'haiku' | 'sonnet' | 'opus';
type EngineId = 'v9';
type SourceMode = 'upload' | 'dashboard';

interface ModelConfig {
  id: ModelId;
  name: string;
  badge: string;
  badgeColor: string;
  costLabel: string;
  icon: string;
}

interface EngineConfig {
  id: EngineId;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
}

/** A comparison slot = one engine × one model result */
interface SlotResult {
  status: 'idle' | 'parsing' | 'analyzing' | 'complete' | 'error';
  progress: number;
  error?: string;
  analysis?: Record<string, unknown>;
  usage?: TrackedUsage;
  provenance?: Array<Record<string, unknown>>;
  elapsedMs?: number;
  /** If loaded from dashboard, the source screenplay */
  fromDashboard?: boolean;
}

type SlotKey = `${EngineId}-${ModelId}`;

const MODEL_DECORATION: Record<ModelId, Pick<ModelConfig, 'badgeColor' | 'icon'>> = {
  haiku: {
    badgeColor: 'settings-model-badge--budget',
    icon: '⚡',
  },
  sonnet: {
    badgeColor: 'bg-gold-500/20 text-gold-400 border-gold-500/30',
    icon: '🎯',
  },
  opus: {
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: '🧠',
  },
};

const MODELS: ModelConfig[] = (['haiku', 'sonnet', 'opus'] as const).map((id) => {
  const model = MODEL_OPTIONS.find((option) => option.id === id);
  if (!model) throw new Error(`Missing canonical model configuration for ${id}`);
  return {
    id,
    name: model.name,
    badge: model.badge,
    costLabel: model.costPerScript,
    ...MODEL_DECORATION[id],
  };
});

const ENGINES: EngineConfig[] = [
  {
    id: 'v9',
    name: 'V9 Archaeology',
    badge: 'V9',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    description:
      'Five specialist readers examine structure, character, craft, concept, and emotion. A final synthesis checks their evidence and produces the Lemon score and verdict.',
  },
];

const COMPARISON_CANDIDATES = [
  { name: 'Sonnet 5', modelId: modelCatalog.latestObserved.sonnet, label: 'Benchmark pending' },
  { name: 'Opus 5', modelId: modelCatalog.latestObserved.opus, label: 'Benchmark pending' },
] as const;
const FRESH_COMPARISON_DISABLED_MESSAGE =
  'Fresh browser comparisons are disabled. Use Upload or Re-analyze so the authoritative private V9 pipeline records the complete trust evidence.';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getVerdict(analysis: Record<string, unknown>): string {
  const a = analysis as Record<string, Record<string, unknown>>;
  const verdict = a?.core_quality?.verdict as string;
  if (!verdict) return 'N/A';
  return verdict.replace(/_/g, ' ').toUpperCase();
}

function getWeightedScore(analysis: Record<string, unknown>): number {
  const a = analysis as Record<string, Record<string, unknown>>;
  return (a?.core_quality?.weighted_score as number) ?? 0;
}

function getLogline(analysis: Record<string, unknown>): string {
  return (analysis as Record<string, string>)?.logline ?? '';
}

function getExecSummary(analysis: Record<string, unknown>): string {
  return (analysis as Record<string, string>)?.executive_summary ?? '';
}

function getDimensionScores(analysis: Record<string, unknown>): { label: string; score: number }[] {
  const cq = (analysis as Record<string, Record<string, Record<string, Record<string, unknown>>>>)?.core_quality;
  if (!cq) return [];
  return [
    { label: 'Premise', score: (cq.conceptual_strength?.premise?.score as number) ?? 0 },
    { label: 'Theme', score: (cq.conceptual_strength?.theme?.score as number) ?? 0 },
    { label: 'Structure', score: (cq.execution_craft?.structure?.score as number) ?? 0 },
    { label: 'Dialogue', score: (cq.execution_craft?.dialogue?.score as number) ?? 0 },
    { label: 'Protagonist', score: (cq.character_system?.protagonist?.score as number) ?? 0 },
    { label: 'Supporting', score: (cq.character_system?.supporting_cast?.score as number) ?? 0 },
    { label: 'Voice & Tone', score: ((cq.voice_and_tone as Record<string, unknown>)?.score as number) ?? 0 },
  ];
}

function verdictColor(verdict: string): string {
  const v = verdict.toLowerCase();
  if (v.includes('film now')) return 'bg-gold-500/20 text-gold-300 border-gold-500/40';
  if (v.includes('recommend')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (v.includes('consider')) return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
  if (v.includes('pass')) return 'bg-red-500/20 text-red-300 border-red-500/40';
  return 'bg-black-700 text-black-300 border-black-600';
}

function scoreColor(score: number): string {
  if (score >= 8) return 'text-gold-400';
  if (score >= 6.5) return 'text-emerald-400';
  if (score >= 5) return 'text-blue-400';
  return 'text-red-400';
}

function formatCost(usage: TrackedUsage | undefined): string {
  return typeof usage?.actual_cost_usd === 'number'
    ? `$${usage.actual_cost_usd.toFixed(2)}`
    : '—';
}

function formatTokens(usage: TrackedUsage | undefined): string {
  if (!usage) return '—';
  const total = usage.input_tokens + usage.output_tokens;
  return `${(total / 1000).toFixed(1)}K`;
}

function formatProvenance(provenance: SlotResult['provenance']): string {
  if (!provenance?.length) return '';
  return provenance.map((call) => {
    const model = typeof call.returnedModel === 'string'
      ? call.returnedModel
      : typeof call.requestedModel === 'string'
        ? call.requestedModel
        : 'unknown model';
    return typeof call.responseId === 'string' ? `${model} (${call.responseId})` : model;
  }).join(', ');
}

function slotKey(engine: EngineId, model: ModelId): SlotKey {
  return `${engine}-${model}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ModelComparisonPanel() {
  const { t } = useTranslation();
  // API keys are now server-side — no need to read from store
  const { data: screenplays } = useScreenplays();

  // Source mode
  const [sourceMode, setSourceMode] = useState<SourceMode>('upload');

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dashboard state
  const [selectedScreenplayId, setSelectedScreenplayId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Engine & model selection
  const [selectedEngines, setSelectedEngines] = useState<Set<EngineId>>(new Set(['v9']));
  const [selectedModels, setSelectedModels] = useState<Set<ModelId>>(new Set(['sonnet']));

  // Running state
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<Record<SlotKey, SlotResult>>({} as Record<SlotKey, SlotResult>);

  // ─── Filtered screenplays for picker ─────────────────────────────────────

  const filteredScreenplays = useMemo(() => {
    if (!screenplays) return [];
    const eligible = decisionReadyScreenplays(screenplays);
    const q = searchQuery.toLowerCase().trim();
    if (!q) return eligible.slice(0, 20);
    return eligible
      .filter((s) => s.title.toLowerCase().includes(q) || s.author?.toLowerCase().includes(q))
      .slice(0, 20);
  }, [screenplays, searchQuery]);

  const selectedScreenplay = useMemo(() => {
    if (!selectedScreenplayId || !screenplays) return null;
    return decisionReadyScreenplays(screenplays).find((s) => s.id === selectedScreenplayId) ?? null;
  }, [selectedScreenplayId, screenplays]);

  // ─── Toggle helpers ──────────────────────────────────────────────────────

  const toggleEngine = (id: EngineId) => {
    setSelectedEngines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleModel = (id: ModelId) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── File handling ───────────────────────────────────────────────────────

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith('.pdf')) return;
    setFile(f);
    setFileName(f.name);
    setResults({} as Record<SlotKey, SlotResult>);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ─── Load dashboard screenplay ───────────────────────────────────────────

  const loadFromDashboard = useCallback(() => {
    if (!selectedScreenplay) return;

    const newResults: Record<string, SlotResult> = {};

    // Get dimension display data from the stored screenplay
    const dims = getDimensionDisplay(selectedScreenplay);
    const engineUsed: EngineId = 'v9';
    const modelUsed = (selectedScreenplay.analysisModel as ModelId) || 'sonnet';

    // Build a pseudo-analysis object from stored data
    const storedAnalysis: Record<string, unknown> = {
      title: selectedScreenplay.title,
      logline: selectedScreenplay.logline,
      executive_summary: (selectedScreenplay as unknown as Record<string, unknown>).executiveSummary ?? '',
      genre: selectedScreenplay.genre,
      core_quality: {
        weighted_score: Number(selectedScreenplay.weightedScore) || 0,
        verdict: selectedScreenplay.recommendation,
      },
      _dimensions: dims,
      _isStored: true,
    };

    const key = slotKey(engineUsed, modelUsed);
    newResults[key] = {
      status: 'complete',
      progress: 100,
      analysis: storedAnalysis,
      fromDashboard: true,
    };

    setResults(newResults as Record<SlotKey, SlotResult>);

    // Auto-select the engine/model that was used
    setSelectedEngines(new Set([engineUsed]));
    setSelectedModels(new Set([modelUsed]));
  }, [selectedScreenplay]);

  // ─── Run fresh comparison ────────────────────────────────────────────────

  const runComparison = useCallback(async () => {
    if (!file || isRunning) return;
    if (selectedEngines.size === 0 || selectedModels.size === 0) return;
    setIsRunning(true);

    // Initialize slots
    const initialResults: Record<string, SlotResult> = {};
    for (const engine of selectedEngines) {
      for (const model of selectedModels) {
        initialResults[slotKey(engine, model)] = { status: 'parsing', progress: 0 };
      }
    }
    setResults(initialResults as Record<SlotKey, SlotResult>);

    // The service also refuses this legacy browser path before parsing or dispatch.
    const promises: Promise<void>[] = [];

    for (const engine of selectedEngines) {
      for (const model of selectedModels) {
        const key = slotKey(engine, model);
        const promise = (async () => {
          const startTime = performance.now();
          try {
            const result = await analyzeScreenplay(
              file,
              'Comparison Lab',
              {
                model,
                lenses: ['commercial'],
              },
              (p: AnalysisProgress) => {
                setResults((prev) => ({
                  ...prev,
                  [key]: {
                    ...prev[key],
                    status: p.stage === 'error' ? 'error' : p.stage,
                    progress: p.percent,
                  },
                }));
              },
            );

            const elapsed = Math.round(performance.now() - startTime);
            const analysis = result.raw.analysis as Record<string, unknown>;
            const rawProvenance = result.raw.model_provenance;

            setResults((prev) => ({
              ...prev,
              [key]: {
                status: 'complete',
                progress: 100,
                analysis,
                usage: result.usage,
                provenance: Array.isArray(rawProvenance)
                  ? rawProvenance.filter(
                    (call): call is Record<string, unknown> => Boolean(
                      call && typeof call === 'object' && !Array.isArray(call),
                    ),
                  )
                  : [],
                elapsedMs: elapsed,
              },
            }));
          } catch (error) {
            const evidence = error && typeof error === 'object'
              ? error as {
                message?: unknown;
                usage?: TrackedUsage;
                provenance?: unknown;
              }
              : {};
            setResults((prev) => ({
              ...prev,
              [key]: {
                status: 'error',
                progress: 0,
                error: typeof evidence.message === 'string'
                  ? evidence.message
                  : t('Analysis failed'),
                usage: evidence.usage,
                provenance: Array.isArray(evidence.provenance)
                  ? evidence.provenance.filter(
                    (call): call is Record<string, unknown> => Boolean(
                      call && typeof call === 'object' && !Array.isArray(call),
                    ),
                  )
                  : [],
                elapsedMs: Math.round(performance.now() - startTime),
              },
            }));
          }
        })();
        promises.push(promise);
      }
    }

    await Promise.allSettled(promises);
    setIsRunning(false);
  }, [file, isRunning, selectedEngines, selectedModels, t]);

  // ─── Compute active slots ────────────────────────────────────────────────

  const activeSlots = useMemo(() => {
    const slots: { engine: EngineConfig; model: ModelConfig; key: SlotKey }[] = [];
    for (const engine of ENGINES) {
      if (!selectedEngines.has(engine.id)) continue;
      for (const model of MODELS) {
        if (!selectedModels.has(model.id)) continue;
        slots.push({ engine, model, key: slotKey(engine.id, model.id) });
      }
    }
    return slots;
  }, [selectedEngines, selectedModels]);

  const hasResults = Object.values(results).some((r) => r.status !== 'idle');
  const completedResults = Object.entries(results).filter(([, r]) => r.status === 'complete');
  const verdicts = completedResults.map(([, r]) => getVerdict(r.analysis!));
  const hasDisagreement = completedResults.length >= 2 && new Set(verdicts).size > 1;

  // ─── Get dimensions for a result ─────────────────────────────────────────

  function getResultDimensions(r: SlotResult): { label: string; score: number }[] {
    if (!r.analysis) return [];
    const storedDims = (r.analysis as Record<string, unknown>)._dimensions as { label: string; score: number }[] | undefined;
    if (storedDims) return storedDims;
    return getDimensionScores(r.analysis);
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  // Determine columns based on slot count
  const gridCols = activeSlots.length <= 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-display text-gold-200 flex items-center gap-3">
          <span className="text-3xl">🔬</span>
          {t('Engine Comparison Lab')}
        </h2>
        <p className="text-black-400 mt-1">
          {t('Compare AI models side-by-side with the V9 Archaeology Engine. Upload a screenplay or pull from your dashboard.')}
        </p>
      </div>

      <section className="settings-model-candidates" aria-labelledby="comparison-candidates-title">
        <div>
          <p className="settings-model-candidates__label">{t('Benchmark-pending models')}</p>
          <h3 id="comparison-candidates-title">{t('Current comparison candidates')}</h3>
          <p>
            {t(
              'Availability is separate from approval. Production scoring stays on its benchmark-approved routes.',
            )}
            {' '}{t('Fable 5 is restricted to Reader Chat and is not a screenplay-scoring candidate.')}
          </p>
        </div>
        <ul>
          {COMPARISON_CANDIDATES.map((candidate) => (
            <li key={candidate.modelId}>
              <span>
                <strong>{candidate.name}</strong>
                <small>{t(candidate.label)}</small>
              </span>
              <code>{candidate.modelId}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label={t('Approved model selectors')}>
        <div className="rounded-xl border border-black-700 bg-black-800/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-400">
            {t('Re-analysis selector')}
          </p>
          <h3 className="mt-1 font-display text-xl text-gold-200">{t('Full scoring routes')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-black-400">
            {t('Only benchmark-approved full-panel models can replace permanent coverage.')}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {REANALYSIS_MODELS.map((model) => (
              <div key={model.id} className="rounded-lg border border-black-700 bg-black-900/40 px-3 py-2">
                <strong className="block text-sm text-black-100">{model.label}</strong>
                <span className="text-xs text-black-400">{t(model.desc)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-black-700 bg-black-800/40 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-400">
            {t('Reader Chat choices')}
          </p>
          <h3 className="mt-1 font-display text-xl text-gold-200">{t('Conversation-only routes')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-black-400">
            {t('These models answer private Reader Chat questions and never score a screenplay.')}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ['Auto', 'Opus 5 → safe fallback'],
              ['Opus 5', 'Direct'],
              ['Fable 5', '30-day retention'],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-lg border border-black-700 bg-black-900/40 px-3 py-2">
                <strong className="block text-sm text-black-100">{t(label)}</strong>
                <span className="text-xs text-black-400">{t(detail)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Source Selector ─────────────────────────────────────────────── */}
      <div className="flex rounded-xl overflow-hidden border border-black-700">
        <button
          onClick={() => setSourceMode('upload')}
          className={clsx(
            'flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-all',
            sourceMode === 'upload'
              ? 'bg-gold-500/15 text-gold-300 border-r border-gold-500/30'
              : 'bg-black-800/50 text-black-400 hover:text-black-200 border-r border-black-700',
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {t('Upload New PDF')}
        </button>
        <button
          onClick={() => setSourceMode('dashboard')}
          className={clsx(
            'flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition-all',
            sourceMode === 'dashboard'
              ? 'bg-gold-500/15 text-gold-300'
              : 'bg-black-800/50 text-black-400 hover:text-black-200',
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {t('Pull from Dashboard')}
        </button>
      </div>

      {/* ─── Upload Source ─────────────────────────────────────────────── */}
      {sourceMode === 'upload' && (
        <>
          <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {t(FRESH_COMPARISON_DISABLED_MESSAGE)}
          </p>
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
              isDragging
                ? 'border-gold-400 bg-gold-500/10'
                : file
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-black-600 hover:border-gold-500/40 hover:bg-gold-500/5',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="text-gold-200 font-medium">{fileName}</p>
                  <p className="text-black-400 text-sm">{t('Click to change')} • {(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-2xl mb-2">📄</p>
                <p className="text-gold-200 font-medium">{t('Drop a screenplay PDF here')}</p>
                <p className="text-black-500 text-sm mt-1">{t('or click to browse')}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Dashboard Source ──────────────────────────────────────────── */}
      {sourceMode === 'dashboard' && (
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Search screenplays by title or author...')}
              className="input pl-10"
            />
          </div>

          {/* Screenplay List */}
          <div className="max-h-56 overflow-y-auto rounded-xl border border-black-700 divide-y divide-black-800">
            {filteredScreenplays.length === 0 ? (
              <div className="p-4 text-center text-black-500 text-sm">
                {screenplays?.length ? t('No matches found') : t('No screenplays in dashboard')}
              </div>
            ) : (
              filteredScreenplays.map((sp) => {
                const dims = getDimensionDisplay(sp);
                const isPillarBased = dims.length === 5;
                return (
                  <button
                    key={sp.id}
                    onClick={() => setSelectedScreenplayId(sp.id)}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-all',
                      selectedScreenplayId === sp.id
                        ? 'bg-gold-500/10 border-l-2 border-gold-500'
                        : 'hover:bg-black-800/50',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-gold-200 text-sm font-medium truncate">{sp.title}</p>
                      <p className="text-black-500 text-xs truncate">
                        {sp.author ?? t('Unknown')} • {(Number(sp.weightedScore) || 0).toFixed(1)}/10
                      </p>
                    </div>
                    <span className={clsx(
                      'text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider shrink-0',
                      isPillarBased ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30',
                    )}>
                      {isPillarBased ? 'V9' : t('LEGACY')}
                    </span>
                    <span className={clsx(
                      'text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider shrink-0',
                      sp.recommendation === 'recommend' || sp.recommendation === 'film_now'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : sp.recommendation === 'consider'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : 'bg-red-500/20 text-red-300 border-red-500/30',
                    )}>
                      {t(sp.recommendation?.replace('_', ' ').toUpperCase())}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Load button */}
          {selectedScreenplay && (
            <button
              onClick={loadFromDashboard}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-gold-500/80 to-amber-500/80 text-black-900 font-display text-sm hover:from-gold-400 hover:to-amber-400 shadow-lg shadow-gold-500/20 transition-all"
            >
              📊 {t('Load "{{title}}" Results', { title: selectedScreenplay.title })}
            </button>
          )}
        </div>
      )}

      {/* ─── Engine & Model Selection ──────────────────────────────────── */}
      {sourceMode === 'upload' && (
        <div className="grid grid-cols-2 gap-4">
          {/* Engines */}
          <div>
            <p className="text-xs text-black-500 uppercase tracking-wider font-semibold mb-2">{t('Analysis Engine')}</p>
            <div className="space-y-2">
              {ENGINES.map((engine) => (
                <button
                  key={engine.id}
                  onClick={() => toggleEngine(engine.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-sm transition-all',
                    selectedEngines.has(engine.id)
                      ? 'bg-gold-500/10 border-gold-500/40 text-gold-200'
                      : 'bg-black-800/30 border-black-700 text-black-400 hover:border-black-600',
                  )}
                >
                  <div className={clsx(
                    'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                    selectedEngines.has(engine.id)
                      ? 'bg-gold-500 border-gold-400'
                      : 'border-black-600',
                  )}>
                    {selectedEngines.has(engine.id) && (
                      <svg className="w-3 h-3 text-black-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{engine.name}</p>
                    <p className="text-xs text-black-500">{t(engine.description)}</p>
                  </div>
                  <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-bold', engine.badgeColor)}>
                    {engine.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Models */}
          <div>
            <p className="text-xs text-black-500 uppercase tracking-wider font-semibold mb-2">{t('AI Model')}</p>
            <div className="space-y-2">
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => toggleModel(model.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-sm transition-all',
                    selectedModels.has(model.id)
                      ? 'bg-gold-500/10 border-gold-500/40 text-gold-200'
                      : 'bg-black-800/30 border-black-700 text-black-400 hover:border-black-600',
                  )}
                >
                  <div className={clsx(
                    'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                    selectedModels.has(model.id)
                      ? 'bg-gold-500 border-gold-400'
                      : 'border-black-600',
                  )}>
                    {selectedModels.has(model.id) && (
                      <svg className="w-3 h-3 text-black-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-base">{model.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium">{model.name}</p>
                    <p className="text-xs text-black-500">{model.costLabel}/{t('script')}</p>
                  </div>
                  <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-bold', model.badgeColor)}>
                    {t(model.badge)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Slot Summary + Run Button ────────────────────────────────── */}
      {sourceMode === 'upload' && file && (
        <div className="space-y-3">
          {activeSlots.length > 0 && (
            <p className="text-xs text-black-500 text-center">
              {t('Will run {{count}} analysis slot', { count: activeSlots.length })}:{' '}
              {activeSlots.map((s) => `${s.engine.badge}×${s.model.name}`).join(', ')}
            </p>
          )}
          <button
            onClick={runComparison}
            disabled
            className={clsx(
              'w-full py-4 rounded-xl font-display text-lg transition-all',
              'bg-black-700 text-black-400 cursor-not-allowed',
            )}
          >
            {t('Fresh comparison disabled')}
          </button>
        </div>
      )}

      {/* ─── Disagreement Banner ──────────────────────────────────────── */}
      {hasDisagreement && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span><strong>{t('Verdict disagreement')}:</strong> {[...new Set(verdicts)].map((verdict) => t(verdict)).join(` ${t('vs')} `)}</span>
        </div>
      )}

      {/* ─── Results Grid ─────────────────────────────────────────────── */}
      {hasResults && (
        <div className={clsx('grid grid-cols-1 gap-4', gridCols)}>
          {activeSlots.map(({ engine, model, key }) => {
            const r = results[key];
            if (!r) return null;

            return (
              <div
                key={key}
                className={clsx(
                  'rounded-xl border p-5 transition-all',
                  r.status === 'complete'
                    ? 'bg-black-800/60 border-gold-500/20'
                    : r.status === 'error'
                      ? 'bg-red-500/5 border-red-500/20'
                      : 'bg-black-800/30 border-black-700',
                )}
              >
                {/* Card Header — Engine + Model badges */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{model.icon}</span>
                    <div>
                      <p className="text-gold-200 font-medium text-sm">{model.name}</p>
                      <p className="text-black-500 text-xs">{model.costLabel}/{t('script')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-bold', engine.badgeColor)}>
                      {engine.badge}
                    </span>
                    <span className={clsx('text-[10px] px-2 py-0.5 rounded-full border font-bold', model.badgeColor)}>
                      {t(model.badge)}
                    </span>
                    {r.fromDashboard && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full border font-bold bg-teal-500/20 text-teal-400 border-teal-500/30">
                        {t('STORED')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status: Idle */}
                {r.status === 'idle' && (
                  <div className="text-center py-8 text-black-500 text-sm">
                    {t('Waiting to start...')}
                  </div>
                )}

                {/* Status: Loading */}
                {(r.status === 'parsing' || r.status === 'analyzing') && (
                  <div className="space-y-3 py-4">
                    <div className="text-center">
                      <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
                      <p className="text-gold-300 text-sm">
                        {r.status === 'parsing' ? t('Parsing PDF...') : t('Analyzing with {{engine}}...', { engine: engine.name })}
                      </p>
                    </div>
                    <div className="w-full bg-black-700 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-gold-500 to-amber-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${r.progress}%` }}
                      />
                    </div>
                    <p className="text-black-500 text-xs text-center">{r.progress}%</p>
                  </div>
                )}

                {/* Status: Error */}
                {r.status === 'error' && (
                  <div className="py-4 text-center">
                    <p className="text-red-400 text-sm">❌ {r.error}</p>
                    {r.usage?.actual_cost_usd !== undefined && (
                      <p className="mt-2 text-xs text-black-300">
                        {t('Recorded cost')}: {formatCost(r.usage)}
                      </p>
                    )}
                    {formatProvenance(r.provenance) && (
                      <p className="mt-1 text-xs text-black-400">
                        {t('Recorded calls')}: {formatProvenance(r.provenance)}
                      </p>
                    )}
                  </div>
                )}

                {/* Status: Complete */}
                {r.status === 'complete' && r.analysis && (
                  <div className="space-y-4">
                    {/* Score + Verdict */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-black-500 uppercase tracking-wider">{t('Score')}</p>
                        <p className={clsx('text-3xl font-display font-bold', scoreColor(getWeightedScore(r.analysis)))}>
                          {getWeightedScore(r.analysis).toFixed(1)}
                        </p>
                      </div>
                      <span className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border',
                        verdictColor(getVerdict(r.analysis)),
                      )}>
                        {t(getVerdict(r.analysis))}
                      </span>
                    </div>

                    {/* Dimension Scores */}
                    <div className="space-y-1.5">
                      <p className="text-xs text-black-500 uppercase tracking-wider">
                        {t('Pillars (V9)')}
                      </p>
                      {getResultDimensions(r).map((d) => (
                        <div key={d.label} className="flex items-center gap-2">
                          <span className="text-xs text-black-400 w-20 truncate">{t(d.label)}</span>
                          <div className="flex-1 bg-black-700 rounded-full h-1.5">
                            <div
                              className={clsx(
                                'h-1.5 rounded-full transition-all',
                                d.score >= 8 ? 'bg-gold-500' :
                                  d.score >= 6 ? 'bg-emerald-500' :
                                    d.score >= 4 ? 'bg-blue-500' : 'bg-red-500',
                              )}
                              style={{ width: `${d.score * 10}%` }}
                            />
                          </div>
                          <span className={clsx('text-xs w-6 text-right', scoreColor(d.score))}>
                            {d.score.toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Logline */}
                    {getLogline(r.analysis) && (
                      <div>
                        <p className="text-xs text-black-500 uppercase tracking-wider mb-1">{t('Logline')}</p>
                        <p className="text-sm text-black-300 italic leading-relaxed line-clamp-3">
                          "{getLogline(r.analysis)}"
                        </p>
                      </div>
                    )}

                    {/* Executive Summary */}
                    {getExecSummary(r.analysis) && (
                      <div>
                        <p className="text-xs text-black-500 uppercase tracking-wider mb-1">{t('Verdict')}</p>
                        <p className="text-sm text-black-300 leading-relaxed line-clamp-4">
                          {getExecSummary(r.analysis)}
                        </p>
                      </div>
                    )}

                    {/* Cost / Performance (only for fresh analyses) */}
                    {!r.fromDashboard && (
                      <div className="pt-3 border-t border-black-700 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xs text-black-500">{t('Cost')}</p>
                          <p className="text-sm text-gold-300">{formatCost(r.usage)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-black-500">{t('Tokens')}</p>
                          <p className="text-sm text-black-300">{formatTokens(r.usage)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-black-500">{t('Time')}</p>
                          <p className="text-sm text-black-300">
                            {r.elapsedMs ? `${(r.elapsedMs / 1000).toFixed(1)}s` : '—'}
                          </p>
                        </div>
                      </div>
                    )}
                    {formatProvenance(r.provenance) && (
                      <p className="text-[10px] text-black-500 break-all">
                        {t('Recorded calls')}: {formatProvenance(r.provenance)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-black-600 text-center">
        {t('Fresh analyses are temporary. Use the Upload tab to permanently save results.')}
      </p>
    </div>
  );
}

export default ModelComparisonPanel;
