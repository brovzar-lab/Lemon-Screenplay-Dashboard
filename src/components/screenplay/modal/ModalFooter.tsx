/**
 * ModalFooter — Metadata and version control.
 */

import type { Screenplay } from '@/types';

interface ModalFooterProps {
    screenplay: Screenplay;
}

export function ModalFooter({ screenplay }: ModalFooterProps) {
    return (
        <div className="pt-6 mt-6 border-t border-black-700">
            <div className="flex flex-wrap gap-4 text-xs text-black-400 mb-3">
                <span>Pages: {screenplay.metadata?.pageCount || 'N/A'}</span>
                <span>Words: {(screenplay.metadata?.wordCount || 0).toLocaleString()}</span>
                <span>Source: {screenplay.sourceFile || 'N/A'}</span>
            </div>
            <div className="text-xs text-black-400 pt-2 border-t border-black-800">
                Analyzed with <span className="font-medium text-black-300">{screenplay.analysisVersion || 'Unknown'}</span>
                {screenplay.analysisModel && (
                    <span> • Model: <span className="text-black-300">{screenplay.analysisModel}</span></span>
                )}
            </div>
        </div>
    );
}
