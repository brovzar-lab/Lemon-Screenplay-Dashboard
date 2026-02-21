/**
 * Model Comparison Lab
 *
 * Upload one screenplay, analyze with all 3 Claude models (Haiku, Sonnet, Opus),
 * and view results side-by-side. Standalone — does NOT save to dashboard.
 */

import { useState, useCallback, useRef } from 'react';
import { clsx } from 'clsx';
import { analyzeScreenplay } from '@/lib/analysisService';
import type { AnalysisProgress } from '@/lib/analysisService';
import { useApiConfigStore } from '@/stores/apiConfigStore';

// ─── Types ───────────────────────────────────────────────────────────────────

type ModelId = 'haiku' | 'sonnet' | 'opus';

interface ModelConfig {
    id: ModelId;
    name: string;
    badge: string;
    badgeColor: string;
    costLabel: string;
    icon: string;
}

interface ModelResult {
    status: 'idle' | 'parsing' | 'analyzing' | 'complete' | 'error';
    progress: number;
    error?: string;
    raw?: Record<string, unknown>;
    analysis?: Record<string, unknown>;
    usage?: { input_tokens: number; output_tokens: number };
    elapsedMs?: number;
}

const MODELS: ModelConfig[] = [
    { id: 'haiku', name: 'Claude Haiku 4.5', badge: 'FAST', badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', costLabel: '~$0.10/script', icon: '⚡' },
    { id: 'sonnet', name: 'Claude Sonnet 4.5', badge: 'BALANCED', badgeColor: 'bg-gold-500/20 text-gold-400 border-gold-500/30', costLabel: '~$0.50/script', icon: '🎯' },
    { id: 'opus', name: 'Claude Opus 4', badge: 'DEEPEST', badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30', costLabel: '~$3.00/script', icon: '🧠' },
];

const COST_RATES: Record<ModelId, { input: number; output: number }> = {
    haiku: { input: 0.80, output: 4.00 },
    sonnet: { input: 3.00, output: 15.00 },
    opus: { input: 15.00, output: 75.00 },
};

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

function getGenre(analysis: Record<string, unknown>): string {
    return (analysis as Record<string, string>)?.genre ?? '';
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

function formatCost(usage: { input_tokens: number; output_tokens: number } | undefined, model: ModelId): string {
    if (!usage) return '—';
    const rates = COST_RATES[model];
    const cost = (usage.input_tokens * rates.input + usage.output_tokens * rates.output) / 1_000_000;
    return `$${cost.toFixed(2)}`;
}

function formatTokens(usage: { input_tokens: number; output_tokens: number } | undefined): string {
    if (!usage) return '—';
    const total = usage.input_tokens + usage.output_tokens;
    return `${(total / 1000).toFixed(1)}K tokens`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ModelComparisonPanel() {
    const apiKey = useApiConfigStore((s) => s.apiKey);
    const [file, setFile] = useState<File | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<Record<ModelId, ModelResult>>({
        haiku: { status: 'idle', progress: 0 },
        sonnet: { status: 'idle', progress: 0 },
        opus: { status: 'idle', progress: 0 },
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── File handling ─────────────────────────────────────────────────────────

    const handleFile = useCallback((f: File) => {
        if (!f.name.toLowerCase().endsWith('.pdf')) return;
        setFile(f);
        setFileName(f.name);
        // Reset results
        setResults({
            haiku: { status: 'idle', progress: 0 },
            sonnet: { status: 'idle', progress: 0 },
            opus: { status: 'idle', progress: 0 },
        });
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
    }, [handleFile]);

    // ─── Run comparison ────────────────────────────────────────────────────────

    const runComparison = useCallback(async () => {
        if (!file || !apiKey || isRunning) return;
        setIsRunning(true);

        // Reset all to parsing
        setResults({
            haiku: { status: 'parsing', progress: 0 },
            sonnet: { status: 'parsing', progress: 0 },
            opus: { status: 'parsing', progress: 0 },
        });

        // Run all 3 models in parallel
        const promises = MODELS.map(async (model) => {
            const startTime = performance.now();
            try {
                const result = await analyzeScreenplay(
                    file,
                    'Comparison Lab',
                    { apiKey, model: model.id, lenses: ['commercial'] },
                    (p: AnalysisProgress) => {
                        setResults((prev) => ({
                            ...prev,
                            [model.id]: {
                                ...prev[model.id],
                                status: p.stage === 'error' ? 'error' : p.stage,
                                progress: p.percent,
                            },
                        }));
                    },
                );

                const elapsed = Math.round(performance.now() - startTime);
                const analysis = result.raw.analysis as Record<string, unknown>;

                setResults((prev) => ({
                    ...prev,
                    [model.id]: {
                        status: 'complete',
                        progress: 100,
                        raw: result.raw,
                        analysis,
                        usage: result.usage,
                        elapsedMs: elapsed,
                    },
                }));
            } catch (err) {
                setResults((prev) => ({
                    ...prev,
                    [model.id]: {
                        status: 'error',
                        progress: 0,
                        error: err instanceof Error ? err.message : 'Unknown error',
                    },
                }));
            }
        });

        await Promise.allSettled(promises);
        setIsRunning(false);
    }, [file, apiKey, isRunning]);

    // ─── Check for verdict disagreements ───────────────────────────────────────

    const completedResults = MODELS.filter((m) => results[m.id].status === 'complete');
    const verdicts = completedResults.map((m) => getVerdict(results[m.id].analysis!));
    const hasDisagreement = completedResults.length >= 2 && new Set(verdicts).size > 1;

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-display text-gold-200 flex items-center gap-3">
                    <span className="text-3xl">🔬</span>
                    Model Comparison Lab
                </h2>
                <p className="text-black-400 mt-1">
                    Upload one screenplay and analyze with all 3 models side-by-side.
                    Results are temporary — nothing is saved to the dashboard.
                </p>
            </div>

            {/* API Key Warning */}
            {!apiKey && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                    ⚠️ You need to configure your Anthropic API key in the <strong>Upload</strong> tab first.
                </div>
            )}

            {/* Drop Zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={clsx(
                    'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
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
                            <p className="text-black-400 text-sm">Click to change • {(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                    </div>
                ) : (
                    <div>
                        <p className="text-2xl mb-2">📄</p>
                        <p className="text-gold-200 font-medium">Drop a screenplay PDF here</p>
                        <p className="text-black-500 text-sm mt-1">or click to browse</p>
                    </div>
                )}
            </div>

            {/* Run Button */}
            {file && apiKey && (
                <button
                    onClick={runComparison}
                    disabled={isRunning}
                    className={clsx(
                        'w-full py-4 rounded-xl font-display text-lg transition-all',
                        isRunning
                            ? 'bg-black-700 text-black-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-gold-500/80 to-amber-500/80 text-black-900 hover:from-gold-400 hover:to-amber-400 shadow-lg shadow-gold-500/20',
                    )}
                >
                    {isRunning ? '⏳ Running all 3 models...' : '🚀 Run Comparison (3 models)'}
                </button>
            )}

            {/* Disagreement Banner */}
            {hasDisagreement && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm flex items-center gap-2">
                    <span className="text-lg">⚠️</span>
                    <span><strong>Models disagree on verdict:</strong> {verdicts.join(' vs ')}</span>
                </div>
            )}

            {/* Results Grid */}
            {(isRunning || completedResults.length > 0 || MODELS.some((m) => results[m.id].status === 'error')) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {MODELS.map((model) => {
                        const r = results[model.id];
                        return (
                            <div
                                key={model.id}
                                className={clsx(
                                    'rounded-xl border p-5 transition-all',
                                    r.status === 'complete'
                                        ? 'bg-black-800/60 border-gold-500/20'
                                        : r.status === 'error'
                                            ? 'bg-red-500/5 border-red-500/20'
                                            : 'bg-black-800/30 border-black-700',
                                )}
                            >
                                {/* Model Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{model.icon}</span>
                                        <div>
                                            <p className="text-gold-200 font-medium text-sm">{model.name}</p>
                                            <p className="text-black-500 text-xs">{model.costLabel}</p>
                                        </div>
                                    </div>
                                    <span className={clsx('text-xs px-2 py-0.5 rounded-full border', model.badgeColor)}>
                                        {model.badge}
                                    </span>
                                </div>

                                {/* Status: Idle */}
                                {r.status === 'idle' && (
                                    <div className="text-center py-8 text-black-500 text-sm">
                                        Waiting to start...
                                    </div>
                                )}

                                {/* Status: Loading */}
                                {(r.status === 'parsing' || r.status === 'analyzing') && (
                                    <div className="space-y-3 py-4">
                                        <div className="text-center">
                                            <div className="inline-block animate-spin text-2xl mb-2">⏳</div>
                                            <p className="text-gold-300 text-sm">
                                                {r.status === 'parsing' ? 'Parsing PDF...' : 'Analyzing with AI...'}
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
                                    </div>
                                )}

                                {/* Status: Complete */}
                                {r.status === 'complete' && r.analysis && (
                                    <div className="space-y-4">
                                        {/* Score + Verdict */}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-black-500 uppercase tracking-wider">Score</p>
                                                <p className={clsx('text-3xl font-display font-bold', scoreColor(getWeightedScore(r.analysis)))}>
                                                    {getWeightedScore(r.analysis).toFixed(1)}
                                                </p>
                                            </div>
                                            <span className={clsx(
                                                'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border',
                                                verdictColor(getVerdict(r.analysis)),
                                            )}>
                                                {getVerdict(r.analysis)}
                                            </span>
                                        </div>

                                        {/* Genre */}
                                        {getGenre(r.analysis) && (
                                            <p className="text-xs text-black-400">
                                                <span className="text-black-500">Genre:</span> {getGenre(r.analysis)}
                                            </p>
                                        )}

                                        {/* Dimension Scores */}
                                        <div className="space-y-1.5">
                                            <p className="text-xs text-black-500 uppercase tracking-wider">Dimensions</p>
                                            {getDimensionScores(r.analysis).map((d) => (
                                                <div key={d.label} className="flex items-center gap-2">
                                                    <span className="text-xs text-black-400 w-20 truncate">{d.label}</span>
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
                                                    <span className={clsx('text-xs font-mono w-6 text-right', scoreColor(d.score))}>
                                                        {d.score.toFixed(1)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Logline */}
                                        {getLogline(r.analysis) && (
                                            <div>
                                                <p className="text-xs text-black-500 uppercase tracking-wider mb-1">Logline</p>
                                                <p className="text-sm text-black-300 italic leading-relaxed">
                                                    "{getLogline(r.analysis)}"
                                                </p>
                                            </div>
                                        )}

                                        {/* Executive Summary */}
                                        {getExecSummary(r.analysis) && (
                                            <div>
                                                <p className="text-xs text-black-500 uppercase tracking-wider mb-1">Verdict</p>
                                                <p className="text-sm text-black-300 leading-relaxed line-clamp-4">
                                                    {getExecSummary(r.analysis)}
                                                </p>
                                            </div>
                                        )}

                                        {/* Cost / Performance */}
                                        <div className="pt-3 border-t border-black-700 grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <p className="text-xs text-black-500">Cost</p>
                                                <p className="text-sm text-gold-300 font-mono">{formatCost(r.usage, model.id)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-black-500">Tokens</p>
                                                <p className="text-sm text-black-300 font-mono">{formatTokens(r.usage)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-black-500">Time</p>
                                                <p className="text-sm text-black-300 font-mono">
                                                    {r.elapsedMs ? `${(r.elapsedMs / 1000).toFixed(1)}s` : '—'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Footer Note */}
            <p className="text-xs text-black-600 text-center">
                Results are not saved. Use the Upload tab to permanently analyze screenplays.
            </p>
        </div>
    );
}

export default ModelComparisonPanel;
