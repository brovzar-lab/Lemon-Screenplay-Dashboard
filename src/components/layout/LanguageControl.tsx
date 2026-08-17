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
    <fieldset className="language-control" aria-label={t('Language')}>
      <legend className="sr-only">{t('Language')}</legend>
      {LANGUAGES.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-label={t(option.name)}
          aria-pressed={language === option.value}
          className={language === option.value ? 'is-active' : undefined}
          onClick={() => void i18n.changeLanguage(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
