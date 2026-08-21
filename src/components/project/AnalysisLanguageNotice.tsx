import { useTranslation } from 'react-i18next';

import { analysisIsEnglishFallback } from '@/lib/localizedAnalysis';
import type { Screenplay } from '@/types';

export function AnalysisLanguageNotice({ screenplay }: { screenplay: Screenplay }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  if (!analysisIsEnglishFallback(screenplay, language)) return null;

  return (
    <div className="dsc-card px-5 py-4" role="status" data-testid="analysis-language-notice">
      <strong className="text-sm text-[var(--dsc-ink)]">
        {t('Analysis available in English')}
      </strong>
      <p className="mt-1 text-sm text-[var(--dsc-ink-2)]">
        {t('Switch to English to read the original analysis, or return after a Spanish translation is saved.')}
      </p>
    </div>
  );
}
