/**
 * ExpiredLinkPage
 *
 * Branded error page shown when a share token is invalid, expired, or revoked.
 * Professional, standalone page with Lemon Studios branding.
 *
 * No dashboard imports — fully self-contained.
 */

import { useTranslation } from 'react-i18next';
import { LanguageControl } from '@/components/layout/LanguageControl';

export function ExpiredLinkPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-black-900 flex flex-col items-center justify-center px-4">
      <div className="absolute right-4 top-4"><LanguageControl /></div>
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <img
          src="/lemon-logo-white.png"
          alt="Lemon Studios"
          className="h-12 w-12"
        />

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-gold-200">
            {t('This link is no longer available')}
          </h1>
          <p className="text-sm text-black-400">
            {t('The share link may have been revoked or expired.')}
          </p>
        </div>

        <div className="mt-8 border-t border-black-700 pt-6 w-full">
          <p className="text-xs text-black-500">
            Lemon Studios
          </p>
        </div>
      </div>
    </div>
  );
}
