/**
 * ExpiredLinkPage
 *
 * Branded error page shown when a share token is invalid, expired, or revoked.
 * Professional, standalone page with Lemon Studios branding.
 *
 * No dashboard imports — fully self-contained.
 */

import { useTranslation } from 'react-i18next';
import { PublicShareHeader } from '@/components/share/PublicShareHeader';

export function ExpiredLinkPage() {
  const { t } = useTranslation();
  return (
    <div className="public-share-shell">
      <PublicShareHeader />
      <main className="public-share-expired">
        <section className="public-share-expired__message">
          <p>{t('Shared screenplay')}</p>
          <h1>{t('This link is no longer available')}</h1>
          <p>{t('The share link may have been revoked or expired.')}</p>
          <strong>{t('Ask the sender for a new link to this screenplay.')}</strong>
        </section>
      </main>
    </div>
  );
}
