import { useTranslation } from 'react-i18next';
import type { UiLanguage } from '@/i18n';

const LANGUAGES: Array<{ value: UiLanguage; label: string; name: 'English' | 'Spanish' }> = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'es', label: 'ES', name: 'Spanish' },
];

export function LanguageControl() {
  const { t, i18n } = useTranslation();
  const language: UiLanguage = i18n.resolvedLanguage === 'es' ? 'es' : 'en';

  return (
    <fieldset className="inline-flex shrink-0 rounded-lg border border-slate-600 bg-[#0e1d33] p-[3px]" aria-label={t('Language')}>
      <legend className="sr-only">{t('Language')}</legend>
      {LANGUAGES.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={t(option.name)}
          aria-pressed={language === option.value}
          className={`min-h-8 rounded-md px-2 text-[10px] font-bold text-slate-400 hover:text-white ${language === option.value ? 'bg-[#6e8bff] text-[#071222]' : ''}`}
          onClick={() => void i18n.changeLanguage(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
