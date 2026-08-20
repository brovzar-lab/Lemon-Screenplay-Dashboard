import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApplicationHeader } from '@/components/layout/ApplicationHeader';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';
import {
  buildStudioPulse,
  STUDIO_PULSE_MARKET_SNAPSHOT,
  type MarketBuyer,
  type TerritoryId,
} from '@/lib/studioPulse';
import './studio-pulse.css';

const BUYER_LOGOS: Record<string, string> = {
  netflix: '/brand/buyers/netflix.svg',
  amazon: '/brand/buyers/amazon-mgm.svg',
  'hbo-max': '/brand/buyers/hbo-max.svg',
  'warner-bros': '/brand/buyers/warner-bros.svg',
  'apple-tv-plus': '/brand/buyers/apple-tv-plus.svg',
};

function BuyerLogo({ buyer }: { buyer: MarketBuyer }) {
  const [failed, setFailed] = useState(false);

  if (failed || !BUYER_LOGOS[buyer.id]) {
    return (
      <span className="studio-pulse__buyer-logo-fallback" aria-hidden="true">
        {buyer.name
          .split(/\s+/)
          .map((word) => word[0])
          .join('')
          .slice(0, 3)}
      </span>
    );
  }

  return (
    <img
      className="studio-pulse__buyer-logo"
      src={BUYER_LOGOS[buyer.id]}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function StudioPulsePage() {
  const { t, i18n } = useTranslation();
  const isSpanish = (i18n.resolvedLanguage ?? i18n.language).startsWith('es');
  const [territoryId, setTerritoryId] = useState<TerritoryId>('mexico');
  const { data: screenplays = [], isLoading, error } = useScreenplays();
  useLiveScreenplaySync();

  const territory = STUDIO_PULSE_MARKET_SNAPSHOT.territories.find(({ id }) => id === territoryId)!;
  const pulse = useMemo(() => buildStudioPulse(screenplays, territory), [screenplays, territory]);
  const marketAsOf = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'long',
        timeZone: 'UTC',
      }).format(new Date(`${STUDIO_PULSE_MARKET_SNAPSHOT.asOf}T00:00:00Z`)),
    [i18n.language],
  );
  const matchUrl = (query: string) => `/discover?q=${encodeURIComponent(query)}`;
  const opportunityAction = pulse.highestDemand.fitCount
    ? t('Review {{count}} matching screenplay', { count: pulse.highestDemand.fitCount })
    : t('Explore the opportunity');

  return (
    <div className="studio-pulse">
      <ApplicationHeader settingsIssueCount={isLoading || error ? 0 : pulse.needsAttention} />
      <main className="studio-pulse__main">
        <section className="studio-pulse__masthead" aria-labelledby="studio-pulse-title">
          <div className="studio-pulse__masthead-copy">
            <h1 id="studio-pulse-title">
              {isSpanish
                ? t('Market Brief')
                : t('{{territory}} Market Brief', { territory: t(territory.label) })}
            </h1>
            <p>{t('What buyers want now, and where Lemon can compete.')}</p>
            <span>{t('Research updated {{date}}', { date: marketAsOf })}</span>
          </div>
          <Link className="studio-pulse__primary-action" to="/discover">
            {t('View screenplays')} <span aria-hidden="true">→</span>
          </Link>
        </section>

        <nav className="studio-pulse__territory-tabs" aria-label={t('Choose a market territory')}>
          {STUDIO_PULSE_MARKET_SNAPSHOT.territories.map((option) => (
            <button
              type="button"
              aria-current={option.id === territoryId ? 'page' : undefined}
              className={option.id === territoryId ? 'is-active' : ''}
              key={option.id}
              onClick={() => setTerritoryId(option.id)}
            >
              {t(option.label)}
            </button>
          ))}
        </nav>

        {error && (
          <p className="studio-pulse__notice" role="status">
            {t('Lemon match counts are temporarily unavailable. Market research is still visible.')}
          </p>
        )}

        <section className="studio-pulse__insight" aria-labelledby="what-matters-title">
          <div className="studio-pulse__insight-copy">
            <span className="studio-pulse__section-label">{t('What matters now')}</span>
            <h2 id="what-matters-title">{t(pulse.highestDemand.label)}</h2>
            <p>
              {pulse.highestDemand.fitCount
                ? t(
                    '{{buyers}} buyers support this signal. Lemon has {{count}} current matches to review.',
                    {
                      buyers: pulse.supportingBuyerCount,
                      count: pulse.highestDemand.fitCount,
                    },
                  )
                : t(
                    '{{buyers}} buyers support this signal. Lemon has no current matches, so this is a clear acquisition opportunity.',
                    { buyers: pulse.supportingBuyerCount },
                  )}
            </p>
            <Link to={matchUrl(pulse.highestDemand.matchQuery)}>
              {opportunityAction} <span aria-hidden="true">→</span>
            </Link>
          </div>

          <dl className="studio-pulse__insight-facts">
            <div>
              <dt>{t('Demand score')}</dt>
              <dd>
                {pulse.highestDemand.index}
                <span>/100</span>
              </dd>
            </div>
            <div>
              <dt>{t('Supporting buyers')}</dt>
              <dd>{pulse.supportingBuyerCount}</dd>
            </div>
            <div>
              <dt>{t('Lemon matches')}</dt>
              <dd>{isLoading ? '—' : pulse.highestDemand.fitCount}</dd>
            </div>
          </dl>
        </section>

        <section
          className="studio-pulse__section studio-pulse__buyers"
          aria-labelledby="active-buyers-title"
        >
          <div className="studio-pulse__section-heading">
            <div>
              <span className="studio-pulse__section-label">{t('Buyer intelligence')}</span>
              <h2 id="active-buyers-title">
                {t('Active buyers in {{territory}}', { territory: t(territory.label) })}
              </h2>
            </div>
            <p>{t('Current appetite, preferred formats, and Lemon fit.')}</p>
          </div>

          <ul className="studio-pulse__buyer-list">
            {pulse.buyerFits.map((buyer) => (
              <li key={buyer.id}>
                <div className="studio-pulse__buyer-name">
                  <BuyerLogo buyer={buyer} />
                  <strong>{buyer.name}</strong>
                </div>
                <p>{t(buyer.appetite)}</p>
                <div className="studio-pulse__buyer-meta">
                  <span>
                    <small>{t('Formats')}</small>
                    {t(buyer.formats)}
                  </span>
                  <span>
                    <small>{t('Signal')}</small>
                    <b className={`is-${buyer.signal}`}>{t(buyer.signal)}</b>
                  </span>
                  <Link to={matchUrl(buyer.matchQuery)}>
                    <small>{t('Lemon fit')}</small>
                    {buyer.fitCount
                      ? t('{{count}} matching screenplay', { count: buyer.fitCount })
                      : t('No current matches')}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="studio-pulse__section studio-pulse__demand"
          aria-labelledby="market-demand-title"
        >
          <div className="studio-pulse__section-heading">
            <div>
              <span className="studio-pulse__section-label">{t('Opportunity map')}</span>
              <h2 id="market-demand-title">
                {t('Where demand is strongest in {{territory}}', { territory: t(territory.label) })}
              </h2>
            </div>
            <p>
              {t(
                'Market demand is scored from 0 to 100. Lemon matches are shown as a separate count.',
              )}
            </p>
          </div>

          <ol className="studio-pulse__demand-list">
            {pulse.demandFits.map((demand) => (
              <li key={demand.id}>
                <div className="studio-pulse__demand-label">
                  <strong>{t(demand.label)}</strong>
                  <span>{demand.index}</span>
                </div>
                <progress
                  max="100"
                  value={demand.index}
                  aria-label={t('{{category}} demand score', { category: t(demand.label) })}
                />
                <Link to={matchUrl(demand.matchQuery)}>
                  {demand.fitCount
                    ? t('Lemon matches: {{count}}', { count: demand.fitCount })
                    : t('Lemon matches: none')}
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="studio-pulse__methodology" aria-labelledby="market-methodology-title">
          <div>
            <span className="studio-pulse__section-label">{t('Research record')}</span>
            <h2 id="market-methodology-title">{t('Method and sources')}</h2>
          </div>
          <p>
            {t(
              'Market scores combine dated buyer announcements, commissioning signals, audience evidence, source quality, and recency. Lemon match counts use live slate genres, themes, tone, and loglines. Market research never changes screenplay scores or verdicts.',
            )}
          </p>
          <a
            href="/research/studio-pulse-market-snapshot-2026-08-19.md"
            target="_blank"
            rel="noreferrer"
          >
            {t('Open the full research snapshot')} <span aria-hidden="true">↗</span>
          </a>
        </section>
      </main>
    </div>
  );
}

export default StudioPulsePage;
