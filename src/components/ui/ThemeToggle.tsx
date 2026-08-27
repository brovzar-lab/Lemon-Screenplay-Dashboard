import { useThemeStore } from '@/stores/themeStore';
import { useTranslation } from 'react-i18next';

export function ThemeToggle() {
  const { t } = useTranslation();
  const { isDark, setTheme } = useThemeStore();

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="theme-toggle"
      title={t('Switch to {{mode}} mode', { mode: t(isDark ? 'light' : 'dark') })}
      aria-label={t('Use {{mode}} theme', { mode: t(isDark ? 'light' : 'dark') })}
    >
      {isDark ? (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.07-7.07-1.42 1.42M8.35 15.65l-1.42 1.42m12.14 0-1.42-1.42M8.35 8.35 6.93 6.93" />
        </svg>
      ) : (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
