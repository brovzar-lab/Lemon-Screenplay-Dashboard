import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requestPoster, type PosterModelKey } from '@/lib/googleProxyClient';
import { useIsAdmin } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import type { Screenplay } from '@/types';
import { isDecisionReady } from '@/lib/producerProjection';

const OPTIONS: Array<{ value: PosterModelKey; label: string }> = [
  { value: 'economy', label: 'Economy · $0.034' },
  { value: 'studio', label: 'Studio · $0.067' },
  { value: 'premium', label: 'Premium · $0.134' },
];
const POSTER_LEASE_MS = 10 * 60 * 1000;

export function PosterControls({ screenplay }: { screenplay: Screenplay }) {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const [model, setModel] = useState<PosterModelKey>('economy');
  const [working, setWorking] = useState(false);
  const requestedAt = screenplay.posterRequestedAt
    ? Date.parse(screenplay.posterRequestedAt)
    : Number.NaN;
  const serverBusy =
    (screenplay.posterStatus === 'pending' || screenplay.posterStatus === 'generating') &&
    Number.isFinite(requestedAt) &&
    Date.now() - requestedAt < POSTER_LEASE_MS;
  const busy = working || serverBusy;

  if (!isAdmin) return null;
  if (!isDecisionReady(screenplay)) {
    return (
      <p className="screenplay-file__poster-note">
        {t('Decision data unavailable until verification')}
      </p>
    );
  }
  if (screenplay.recommendation === 'pass') {
    return (
      <p className="screenplay-file__poster-note">{t('Poster withheld for a Pass verdict')}</p>
    );
  }

  const generate = async () => {
    setWorking(true);
    try {
      const result = await requestPoster(screenplay.projectId ?? screenplay.id, model);
      useToastStore
        .getState()
        .addToast(
          t(result.status === 'skipped' ? 'Poster is already being created' : 'Poster ready'),
          result.status === 'skipped' ? 'warning' : 'success',
        );
    } catch (error) {
      console.error('[PosterControls] Poster generation failed:', error);
      useToastStore
        .getState()
        .addToast(t('Poster generation failed'), 'warning');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="screenplay-file__poster-controls">
      <label>
        <span>{t('Poster model')}</span>
        <select
          value={model}
          onChange={(event) => setModel(event.target.value as PosterModelKey)}
          disabled={busy}
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.label)}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={generate} disabled={busy}>
        {busy
          ? t('Creating poster…')
          : screenplay.posterUrl
            ? t('Regenerate poster')
            : t('Generate poster')}
      </button>
    </div>
  );
}
