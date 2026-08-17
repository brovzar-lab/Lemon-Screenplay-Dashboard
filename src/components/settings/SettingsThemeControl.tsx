import { useThemeStore, type ColorMode } from '@/stores/themeStore';
import { useTranslation } from 'react-i18next';

const MODES: Array<{ value: ColorMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function SettingsThemeControl() {
  const { t } = useTranslation();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <fieldset className="settings-theme-control" aria-label={t('Appearance')}>
      <legend className="sr-only">{t('Appearance')}</legend>
      {MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          aria-pressed={theme === mode.value}
          className={theme === mode.value ? 'is-active' : undefined}
          onClick={() => setTheme(mode.value)}
        >
          {t(mode.label)}
        </button>
      ))}
    </fieldset>
  );
}
