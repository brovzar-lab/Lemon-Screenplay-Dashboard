/**
 * ReanalyzeButton — Model picker + engine selector + re-analysis trigger.
 *
 * Flow:
 *   1. Click "🔄 Re-analyze ▾" → dropdown with:
 *      - Engine: V6 (4-Pillar) | V9 Archaeology (5-Reader) — current version shown
 *      - Model: Sonnet | Opus | Hybrid (Haiku triage → Sonnet full)
 *   2. Picks combo → spinner + progress message
 *   3. Calls reanalyzeFromStorage → replaces data
 *   4. Invalidates React Query cache → modal/dashboard auto-updates
 */

import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import type { AnalysisProgress } from '@/lib/analysisService';
import { useApiConfigStore } from '@/stores/apiConfigStore';
import { useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '@/stores/toastStore';
import { getAnalysisVersionLabel } from '@/lib/dimensionDisplay';

interface ReanalyzeButtonProps {
    screenplay: Screenplay;
    onComplete?: () => void;
}

type ModelOption = {
    id: 'sonnet' | 'opus' | 'hybrid';
    label: string;
    desc: string;
};

const MODELS: ModelOption[] = [
    { id: 'sonnet', label: 'Sonnet', desc: 'Fast · ~$0.50' },
    { id: 'opus', label: 'Opus', desc: 'Deep · ~$2.00' },
    { id: 'hybrid', label: 'Hybrid', desc: 'Triage → Full · ~$0.35' },
];

export function ReanalyzeButton({ screenplay, onComplete }: ReanalyzeButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState<AnalysisProgress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    const { canMakeRequest, checkAndResetIfNeeded } = useApiConfigStore();

    // Detect current analysis engine from screenplay
    const currentVersionLabel = getAnalysisVersionLabel(screenplay);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const handleReanalyze = async (modelId: 'sonnet' | 'opus' | 'hybrid') => {
        setIsOpen(false);
        setIsAnalyzing(true);
        setProgress(null);
        setError(null);

        try {
            checkAndResetIfNeeded();

            if (!canMakeRequest()) {
                throw new Error('Budget or request limit reached. Check Settings → API Configuration.');
            }

            // Map hybrid → haiku model with v9 triage
            const model: 'sonnet' | 'opus' | 'haiku' = modelId === 'hybrid' ? 'haiku' : modelId;
            const v9Mode = modelId === 'hybrid' ? 'triage' as const : 'full' as const;
            const { reanalyzeFromStorage } = await import('@/lib/analysisService');

            await reanalyzeFromStorage(
                screenplay,
                model,
                (p) => setProgress(p),
                { v9Mode },
            );

            // Invalidate React Query cache so data refreshes everywhere
            await queryClient.invalidateQueries({ queryKey: ['screenplays'] });

            onComplete?.();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Re-analysis failed';
            setError(msg);
            console.error('[ReanalyzeButton]', err);
            useToastStore.getState().addToast('Reanalysis failed — please try again');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Analyzing — show spinner + status
    if (isAnalyzing) {
        return (
            <div className="flex items-center gap-2 text-xs text-gold-400">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="max-w-[180px] truncate">
                    {progress?.message || 'Starting re-analysis...'}
                </span>
            </div>
        );
    }

    // Error — show message with retry
    if (error) {
        return (
            <div className="flex items-center gap-2">
                <span className="text-xs text-red-400 max-w-[200px] truncate" title={error}>
                    ❌ {error}
                </span>
                <button
                    onClick={() => setError(null)}
                    className="text-xs text-black-400 hover:text-gold-400 underline"
                >
                    Dismiss
                </button>
            </div>
        );
    }

    // Default — button with engine + model dropdown
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    'btn text-xs flex items-center gap-1.5 py-1.5 px-3',
                    'bg-black-800 hover:bg-black-700 border border-black-600',
                    'hover:border-gold-500/50 transition-all duration-200',
                    'text-black-200 hover:text-gold-300',
                )}
            >
                🔄 Re-analyze
                <svg className={clsx('w-3 h-3 transition-transform', isOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Engine + Model dropdown */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 py-1 bg-black-800 border border-black-600 rounded-lg shadow-xl z-50">
                    {/* Current version info */}
                    <div className="px-3 py-1.5 text-[10px] text-black-500 border-b border-black-700">
                        Current: <span className="text-black-300">{currentVersionLabel}</span>
                    </div>

                    {/* Model selector */}
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-black-500 uppercase tracking-wider border-t border-black-700">
                        Choose Model
                    </div>
                    {MODELS.map((model) => {
                        return (
                            <button
                                key={model.id}
                                onClick={() => handleReanalyze(model.id)}
                                className="w-full px-3 py-2 text-left hover:bg-black-700 transition-colors flex items-center justify-between group"
                            >
                                <span className="text-sm text-black-200 group-hover:text-gold-300">{model.label}</span>
                                <span className="text-[10px] text-black-500">{model.desc}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
