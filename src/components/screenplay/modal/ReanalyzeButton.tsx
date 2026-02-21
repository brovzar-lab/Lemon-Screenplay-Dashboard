/**
 * ReanalyzeButton — Model picker + re-analysis trigger in the screenplay modal header.
 *
 * Flow:
 *   1. Click "🔄 Re-analyze" → dropdown with Sonnet / Opus
 *   2. Picks model → spinner + progress message
 *   3. Calls reanalyzeFromStorage → replaces data
 *   4. Invalidates React Query cache → modal/dashboard auto-updates
 */

import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { reanalyzeFromStorage, type AnalysisProgress } from '@/lib/analysisService';
import { useApiConfigStore } from '@/stores/apiConfigStore';
import { useQueryClient } from '@tanstack/react-query';

interface ReanalyzeButtonProps {
    screenplay: Screenplay;
    onComplete?: () => void;
}

type ModelOption = {
    id: 'sonnet' | 'opus';
    label: string;
    desc: string;
};

const MODELS: ModelOption[] = [
    { id: 'sonnet', label: 'Sonnet', desc: 'Fast · ~$0.50' },
    { id: 'opus', label: 'Opus', desc: 'Deep · ~$2.00' },
];

export function ReanalyzeButton({ screenplay, onComplete }: ReanalyzeButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState<AnalysisProgress | null>(null);
    const [error, setError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    const { apiKey, isConfigured, canMakeRequest, checkAndResetIfNeeded } = useApiConfigStore();

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

    const handleReanalyze = async (model: 'sonnet' | 'opus') => {
        setIsOpen(false);
        setIsAnalyzing(true);
        setProgress(null);
        setError(null);

        try {
            checkAndResetIfNeeded();

            if (!canMakeRequest()) {
                throw new Error('Budget or request limit reached. Check Settings → API Configuration.');
            }

            await reanalyzeFromStorage(
                screenplay,
                model,
                apiKey,
                (p) => setProgress(p),
            );

            // Invalidate React Query cache so data refreshes everywhere
            await queryClient.invalidateQueries({ queryKey: ['screenplays'] });

            onComplete?.();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Re-analysis failed';
            setError(msg);
            console.error('[ReanalyzeButton]', err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Not configured — show disabled button with tooltip
    if (!isConfigured) {
        return (
            <button
                disabled
                className="btn text-xs flex items-center gap-1.5 py-1.5 px-3 opacity-50 cursor-not-allowed"
                title="Configure API key in Settings to enable re-analysis"
            >
                🔄 Re-analyze
            </button>
        );
    }

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

    // Default — button with model dropdown
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

            {/* Model dropdown */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-1 w-48 py-1 bg-black-800 border border-black-600 rounded-lg shadow-xl z-50">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-black-500 uppercase tracking-wider">
                        Choose Model
                    </div>
                    {MODELS.map((model) => (
                        <button
                            key={model.id}
                            onClick={() => handleReanalyze(model.id)}
                            className="w-full px-3 py-2 text-left hover:bg-black-700 transition-colors flex items-center justify-between group"
                        >
                            <span className="text-sm text-black-200 group-hover:text-gold-300">{model.label}</span>
                            <span className="text-[10px] text-black-500">{model.desc}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
