import { doc, getDoc } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/firebase';

interface DailyBudgetStatus {
  limitUsd: number;
  spentUsd: number;
  reservedUsd: number;
  callCount: number;
}

const microusdToUsd = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value / 1_000_000 : 0;

async function loadDailyBudget(date: string): Promise<DailyBudgetStatus | null> {
  const snapshot = await getDoc(doc(db, 'system', `llm-budget-${date}`));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    limitUsd: microusdToUsd(data.limit_microusd),
    spentUsd: microusdToUsd(data.spent_microusd),
    reservedUsd: microusdToUsd(data.reserved_microusd),
    callCount: typeof data.call_count === 'number' ? data.call_count : 0,
  };
}

export function SystemStatusPanel() {
  const { t } = useTranslation();
  const date = new Date().toISOString().slice(0, 10);
  const { data: budget = null, isError: budgetError, refetch } = useQuery({
    queryKey: ['system', 'daily-budget', date],
    queryFn: () => loadDailyBudget(date),
  });

  const usedPercent = budget?.limitUsd
    ? Math.min(100, ((budget.spentUsd + budget.reservedUsd) / budget.limitUsd) * 100)
    : 0;

  return (
    <div className="system-status" data-testid="system-status">
      <section className="system-status__section" aria-labelledby="ai-service-title">
        <div className="system-status__heading">
          <div>
            <p className="settings-eyebrow">{t('Analysis service')}</p>
            <h3 id="ai-service-title">{t('AI connection')}</h3>
            <p>{t('AI credentials stay on the server and are never entered in this browser.')}</p>
          </div>
          <span className="system-status__badge is-managed">{t('Server managed')}</span>
        </div>
      </section>

      <section className="system-status__section" aria-labelledby="production-check-title">
        <div className="system-status__heading">
          <div>
            <p className="settings-eyebrow">{t('Production screening')}</p>
            <h3 id="production-check-title">TMDB</h3>
            <p>
              {t('The ingestion server checks whether a screenplay has already been produced before analysis starts.')}
            </p>
          </div>
          <span className="system-status__badge is-managed">{t('Server managed')}</span>
        </div>
      </section>

      <section className="system-status__section" aria-labelledby="daily-budget-title">
        <div className="system-status__heading">
          <div>
            <p className="settings-eyebrow">{t('Cost protection')}</p>
            <h3 id="daily-budget-title">{t('Today’s AI budget')}</h3>
            <p>{t('These numbers come from the production server ledger.')}</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => void refetch()}>
            {t('Refresh')}
          </button>
        </div>

        {budgetError ? (
          <p className="system-status__notice is-error">
            {t('Budget status is unavailable. Production protection remains active.')}
          </p>
        ) : budget ? (
          <div className="system-status__budget">
            <div className="system-status__budget-summary">
              <strong>${budget.spentUsd.toFixed(2)}</strong>
              <span>{t('spent of ${{limit}} today', { limit: budget.limitUsd.toFixed(2) })}</span>
            </div>
            <progress className="system-status__meter" value={usedPercent} max={100}>
              {usedPercent.toFixed(0)}%
            </progress>
            <dl>
              <div><dt>{t('Reserved')}</dt><dd>${budget.reservedUsd.toFixed(2)}</dd></div>
              <div><dt>{t('Model calls')}</dt><dd>{budget.callCount}</dd></div>
            </dl>
          </div>
        ) : (
          <p className="system-status__notice">
            {t('No model spending has been recorded today.')}
          </p>
        )}
      </section>
    </div>
  );
}
