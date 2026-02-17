/**
 * ModalFooter — Metadata, version control, and V6 lenses display.
 */

import type { Screenplay } from '@/types';
import { SectionHeader } from './SectionHeader';
import { hasV6Fields } from './utils';

interface ModalFooterProps {
    screenplay: Screenplay;
}

export function ModalFooter({ screenplay }: ModalFooterProps) {
    return (
        <>
            {/* V6 Lenses Summary */}
            {hasV6Fields(screenplay) && screenplay.v6LensesEnabled && screenplay.v6LensesEnabled.length > 0 && (
                <div>
                    <SectionHeader icon="🔍">Enabled Analysis Lenses</SectionHeader>
                    <div className="flex flex-wrap gap-2">
                        {screenplay.v6LensesEnabled.map((lens, i) => (
                            <span key={i} className="chip chip-genre">
                                {lens}
                            </span>
                        ))}
                    </div>
                    {screenplay.v6BudgetCeilingUsed && (
                        <p className="text-xs text-black-500 mt-2">
                            Budget ceiling: ${(screenplay.v6BudgetCeilingUsed / 1000000).toFixed(0)}M
                        </p>
                    )}
                </div>
            )}

            {/* Metadata & Version Control */}
            <div className="pt-6 mt-6 border-t border-black-700">
                <div className="flex flex-wrap gap-4 text-xs text-black-500 mb-3">
                    <span>Pages: {screenplay.metadata?.pageCount || 'N/A'}</span>
                    <span>Words: {(screenplay.metadata?.wordCount || 0).toLocaleString()}</span>
                    <span>Source: {screenplay.sourceFile || 'N/A'}</span>
                </div>
                <div className="text-xs text-black-400 pt-2 border-t border-black-800">
                    Analyzed with <span className="font-mono font-medium text-black-300">{screenplay.analysisVersion || 'Unknown'}</span>
                    {screenplay.analysisModel && (
                        <span> • Model: <span className="font-mono text-black-300">{screenplay.analysisModel}</span></span>
                    )}
                    {hasV6Fields(screenplay) && screenplay.v6CoreQuality && (
                        <span> • Core Score: <span className="font-mono text-black-300">{screenplay.v6CoreQuality.weighted_score?.toFixed(2) || 'N/A'}</span></span>
                    )}
                </div>
            </div>
        </>
    );
}
