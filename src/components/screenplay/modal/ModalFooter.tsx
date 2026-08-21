/**
 * ModalFooter — Metadata and version control.
 */

import type { Screenplay } from '@/types';
import { useTranslation } from 'react-i18next';

interface ModalFooterProps {
    screenplay: Screenplay;
}

export function ModalFooter({ screenplay }: ModalFooterProps) {
    const { t } = useTranslation();
    return (
        <div className="pt-6 mt-6 border-t border-black-700">
            <div className="flex flex-wrap gap-4 text-xs text-black-400 mb-3">
                <span>{t('Pages')}: {screenplay.metadata?.pageCount || t('N/A')}</span>
                <span>{t('Words')}: {(screenplay.metadata?.wordCount || 0).toLocaleString()}</span>
                <span>{t('Source')}: {screenplay.sourceFile || t('N/A')}</span>
            </div>
            <div className="text-xs text-black-400 pt-2 border-t border-black-800">
                {t('Analyzed with')} <span className="font-medium text-black-300">{screenplay.analysisVersion || t('Unknown')}</span>
                {screenplay.analysisModel && (
                    <span> • {t('Model')}: <span className="text-black-300">{screenplay.analysisModel}</span></span>
                )}
            </div>
        </div>
    );
}
