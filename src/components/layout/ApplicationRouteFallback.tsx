import { useTranslation } from 'react-i18next';
import { ApplicationHeader } from '@/components/layout/ApplicationHeader';
import { PublicShareHeader } from '@/components/share/PublicShareHeader';

export function ApplicationRouteFallback() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-[var(--sp-bg)]">
      <ApplicationHeader />
      <main className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-7">
        <div className="rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface)] p-5 sm:p-7">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--sp-accent-soft)]" />
          <div className="mt-4 h-8 w-full max-w-md animate-pulse rounded bg-[var(--sp-sunken)]" />
          <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded bg-[var(--sp-sunken)]" />
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            <div className="h-28 animate-pulse rounded-lg bg-[var(--sp-sunken)]" />
            <div className="h-28 animate-pulse rounded-lg bg-[var(--sp-sunken)]" />
            <div className="h-28 animate-pulse rounded-lg bg-[var(--sp-sunken)]" />
          </div>
          <span className="sr-only" role="status" aria-live="polite">{t('Loading...')}</span>
        </div>
      </main>
    </div>
  );
}

export function SharedRouteFallback() {
  const { t } = useTranslation();

  return (
    <div className="public-share-route-loading">
      <PublicShareHeader />
      <main>
        <div className="public-share-route-loading__line is-title" />
        <div className="public-share-route-loading__line" />
        <div className="public-share-route-loading__line is-short" />
        <span className="sr-only" role="status" aria-live="polite">{t('Loading...')}</span>
      </main>
    </div>
  );
}
