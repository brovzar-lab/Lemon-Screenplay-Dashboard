/**
 * LoadingFallback Component
 * Branded loading spinner for React.lazy() Suspense boundaries
 */

import { useTranslation } from 'react-i18next';

export function LoadingFallback() {
    const { t } = useTranslation();
    return (
        <div className="flex items-center justify-center min-h-[200px]">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin" />
                <p className="text-sm text-black-400">{t('Loading...')}</p>
            </div>
        </div>
    );
}
