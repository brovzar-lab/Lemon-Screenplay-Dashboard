import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApplicationHeader } from '@/components/layout/ApplicationHeader';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';
import {
  buildStudioPulse,
  STUDIO_PULSE_MARKET_SNAPSHOT,
  type TerritoryId,
} from '@/lib/studioPulse';
import { useSyncStatusStore } from '@/stores/syncStatusStore';
import './studio-pulse.css';

function PulseIcon({ name }: { name: 'check' | 'globe' | 'buyer' | 'trend' | 'target' | 'idea' }) {
  const paths = {
    check: <path d="m5 12 4 4L19 6" />,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></>,
    buyer: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20c0-4 2-6 6-6s6 2 6 6M14 15c4 0 6 2 6 5" /></>,
    trend: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="m14 10 6-6" /></>,
    idea: <><path d="M9 18h6M10 22h4" /><path d="M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function StudioPulsePage() {
  const { t, i18n } = useTranslation();
  const [territoryId, setTerritoryId] = useState<TerritoryId>('mexico');
  const { data: screenplays = [], isLoading, error } = useScreenplays();
  const isLiveConnected = useSyncStatusStore((state) => state.isLiveConnected);
  useLiveScreenplaySync();

  const territory = STUDIO_PULSE_MARKET_SNAPSHOT.territories.find(({ id }) => id === territoryId)!;
  const pulse = useMemo(() => buildStudioPulse(screenplays, territory), [screenplays, territory]);
  const number = useMemo(() => new Intl.NumberFormat(i18n.language), [i18n.language]);
  const marketAsOf = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(`${STUDIO_PULSE_MARKET_SNAPSHOT.asOf}T00:00:00Z`),
    ),
    [i18n.language],
  );
  const matchUrl = (query: string) => `/discover?q=${encodeURIComponent(query)}`;

  return (
    <div className="studio-pulse">
      <ApplicationHeader />
      <main className="studio-pulse__main">
        <section className="studio-pulse__masthead" aria-labelledby="studio-pulse-title">
          <div>
            <p className="studio-pulse__eyebrow">{t('Studio command center')}</p>
            <h1 id="studio-pulse-title">{t('Studio Pulse')}</h1>
            <p>{t('Lemon status and industry context')}</p>
            <span className={`studio-pulse__connection ${isLiveConnected ? '' : 'is-reconnecting'}`}>
              <PulseIcon name="check" />
              {isLiveConnected ? t('Studio data is live') : t('Reconnecting to studio data')}
            </span>
          </div>
          <Link className="studio-pulse__primary-action" to="/discover">
            {t('Open Screenplay Dashboard')} <span aria-hidden="true">→</span>
          </Link>
        </section>

        {error && (
          <p className="studio-pulse__notice" role="status">
            {t('Live Lemon totals are temporarily unavailable. Industry research is still visible.')}
          </p>
        )}

        <section className="studio-pulse__metrics" aria-label={t('Lemon status')} aria-busy={isLoading}>
          <article>
            <strong>{isLoading ? '—' : number.format(pulse.activeProjects)}</strong>
            <span>{t('Active projects')}</span>
          </article>
          <article>
            <strong>{isLoading ? '—' : `${pulse.v9CompletePercent}%`}</strong>
            <span>{t('V9 complete')}</span>
            <small>{t('{{count}} verified analysis', { count: pulse.v9Complete })}</small>
          </article>
          <article>
            <strong>{isLoading ? '—' : number.format(pulse.readyForReview)}</strong>
            <span>{t('Ready for review')}</span>
          </article>
          <article className="studio-pulse__metric-attention">
            <strong>{isLoading ? '—' : number.format(pulse.needsAttention)}</strong>
            <span>{t('Need attention')}</span>
          </article>
        </section>

        <div className="studio-pulse__top-grid">
          <section className="studio-pulse__panel studio-pulse__health" aria-labelledby="operating-health-title">
            <h2 id="operating-health-title">{t('Lemon operating health')}</h2>
            <div className="studio-pulse__pipeline">
              {[
                [t('Active slate'), pulse.activeProjects],
                [t('V9 complete'), pulse.v9Complete],
                [t('Review-ready'), pulse.readyForReview],
                [t('Producer look'), pulse.producerLook],
              ].map(([label, value], index) => (
                <div className="studio-pulse__pipeline-step" key={String(label)}>
                  <span>{label}</span>
                  <i aria-hidden="true"><PulseIcon name={index === 0 ? 'buyer' : index === 1 ? 'trend' : index === 2 ? 'check' : 'target'} /></i>
                  <strong>{isLoading ? '—' : number.format(Number(value))}</strong>
                </div>
              ))}
            </div>
            <p className="studio-pulse__snapshot-note">
              {t('Current slate snapshot. Market research does not affect scores or verdicts.')}
            </p>
          </section>

          <section className="studio-pulse__panel studio-pulse__territory" aria-labelledby="market-territory-title">
            <div className="studio-pulse__section-heading">
              <h2 id="market-territory-title">{t('Market territory')}</h2>
              <span>{t('Research snapshot · {{date}}', { date: marketAsOf })}</span>
            </div>
            <div className="studio-pulse__territory-title">
              <i aria-hidden="true"><PulseIcon name="globe" /></i>
              <strong>{t(territory.label)}</strong>
            </div>
            <div className="studio-pulse__territory-tabs" role="tablist" aria-label={t('Choose a market territory')}>
              {STUDIO_PULSE_MARKET_SNAPSHOT.territories.map((option) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={option.id === territoryId}
                  className={option.id === territoryId ? 'is-active' : ''}
                  key={option.id}
                  onClick={() => setTerritoryId(option.id)}
                >
                  {t(option.label)}
                </button>
              ))}
            </div>
            <p>{t('Industry signals change by territory')}</p>
            <div className="studio-pulse__territory-stats">
              <span><PulseIcon name="buyer" /><strong>{territory.buyers.length}</strong>{t('active buyers')}</span>
              <span><PulseIcon name="trend" /><strong>{territory.demands.filter(({ index }) => index >= 70).length}</strong>{t('rising genres')}</span>
              <span><PulseIcon name="target" /><strong>{pulse.uniqueLemonFits}</strong>{t('Lemon fits')}</span>
            </div>
          </section>
        </div>

        <div className="studio-pulse__market-grid">
          <section className="studio-pulse__panel studio-pulse__buyers" aria-labelledby="buyer-table-title">
            <div className="studio-pulse__section-heading">
              <h2 id="buyer-table-title">{t('What buyers want in {{territory}}', { territory: t(territory.label) })}</h2>
              <span>{t('Industry research · Dated sources')}</span>
            </div>
            <div className="studio-pulse__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('Buyer')}</th>
                    <th>{t('Current appetite')}</th>
                    <th>{t('Formats')}</th>
                    <th>{t('Signal')}</th>
                    <th>{t('Lemon fit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pulse.buyerFits.map((buyer) => (
                    <tr key={buyer.id}>
                      <th scope="row">{buyer.name}</th>
                      <td data-label={t('Current appetite')}>{t(buyer.appetite)}</td>
                      <td data-label={t('Formats')}>{t(buyer.formats)}</td>
                      <td data-label={t('Signal')}><span className={`studio-pulse__signal is-${buyer.signal}`}><i />{t(buyer.signal)}</span></td>
                      <td data-label={t('Lemon fit')}><Link to={matchUrl(buyer.matchQuery)}>{t('{{count}} project', { count: buyer.fitCount })} <span aria-hidden="true">→</span></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="studio-pulse__method-note">ⓘ {t('Research signals only. Not used in project scores or verdicts.')}</p>
          </section>

          <section className="studio-pulse__panel studio-pulse__demand" aria-labelledby="demand-title">
            <div className="studio-pulse__section-heading">
              <h2 id="demand-title">{t('Lemon pipeline vs. buyer demand')}</h2>
              <span>{t('Research snapshot · {{date}}', { date: marketAsOf })}</span>
            </div>
            <div className="studio-pulse__legend"><span className="is-market" />{t('Market demand')}<span className="is-lemon" />{t('Lemon projects')}</div>
            <div className="studio-pulse__demand-chart">
              {pulse.demandFits.map((demand) => (
                <Link to={matchUrl(demand.matchQuery)} key={demand.id} aria-label={t('View {{count}} matching {{category}} projects', { count: demand.fitCount, category: t(demand.label) })}>
                  <span>{t(demand.label)}</span>
                  <span className="studio-pulse__bar is-market"><progress max="100" value={demand.index} /><b>{demand.index}</b></span>
                  <span className="studio-pulse__bar is-lemon"><progress max="12" value={Math.min(12, demand.fitCount)} /><b>{demand.fitCount}</b></span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="studio-pulse__bottom-grid">
          <section className="studio-pulse__insight" aria-labelledby="actionable-insight-title">
            <i aria-hidden="true"><PulseIcon name="idea" /></i>
            <div>
              <h2 id="actionable-insight-title">{t('Actionable insight')}</h2>
              <p>{t('{{territory}} has strong demand for {{category}}.', { territory: t(territory.label), category: t(pulse.highestDemand.label).toLocaleLowerCase(i18n.language) })}</p>
              <small>{t('Lemon has {{count}} possible matches, with {{ready}} ready for producer review.', { count: pulse.highestDemand.fitCount, ready: pulse.highestDemandReady })}</small>
            </div>
            <Link to={matchUrl(pulse.highestDemand.matchQuery)}>{t('Review matching projects')} <span aria-hidden="true">→</span></Link>
            <a href="#market-methodology">{t('How this is calculated')}</a>
          </section>

          <aside className="studio-pulse__onboarding" aria-labelledby="new-here-title">
            <h2 id="new-here-title">{t('New here?')}</h2>
            <nav aria-label={t('Getting started')}>
              <Link to="/discover">{t('Read the briefing')}</Link>
              <Link to="/discover">{t('Open Discovery')}</Link>
              <Link to="/discover?view=producer-look">{t('Review evidence')}</Link>
            </nav>
          </aside>
        </div>

        <p className="studio-pulse__methodology" id="market-methodology">
          <strong>{t('Research methodology')}:</strong>{' '}
          {t('Market values use dated research. The signal index measures source authority, recency, independent support, and buyer intent. Lemon fit counts use live slate genres, themes, tone, and loglines.')}
        </p>
      </main>
    </div>
  );
}

export default StudioPulsePage;
