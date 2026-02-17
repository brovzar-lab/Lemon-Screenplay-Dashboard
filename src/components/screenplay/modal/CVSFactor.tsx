/**
 * CVS Factor — displays a single commercial viability score factor.
 */

import { clsx } from 'clsx';

interface CVSFactorProps {
    label: string;
    score: number;
    note: string;
}

export function CVSFactor({ label, score, note }: CVSFactorProps) {
    return (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-black-900/50">
            <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-sm',
                score === 3 && 'bg-emerald-500/20 text-emerald-400',
                score === 2 && 'bg-gold-500/20 text-gold-400',
                score === 1 && 'bg-red-500/20 text-red-400'
            )}>
                {score}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-black-200">{label}</div>
                <div className="text-xs text-black-500">{note}</div>
            </div>
        </div>
    );
}
