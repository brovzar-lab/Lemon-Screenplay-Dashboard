import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from 'recharts';
import { ApplicationHeader } from '@/components/layout/ApplicationHeader';
import {
  buildDemoBriefing,
  buildDemoPortfolio,
  DEMO_LEDGER,
} from '@/data/intelligenceBriefingDemo';
import { useLiveScreenplaySync, useScreenplays } from '@/hooks/useScreenplays';
import {
  buildPortfolioOpportunity,
  getSlateQueryState,
  INTELLIGENCE_BRIEFING_RESULT,
  localizedText,
  weakestEvidenceDimensions,
  type EvidenceHealth,
  type IntelligenceBriefingSnapshot,
  type PortfolioProject,
  type TimingBand,
} from '@/lib/studioPulse';
import './studio-pulse.css';

const TIMING_POSITION: Record<TimingBand, number> = {
  wait: 1,
  emerging: 2,
  active: 3,
  immediate: 4,
};
const TIMING_LABELS: Record<number, TimingBand> = {
  1: 'wait',
  2: 'emerging',
  3: 'active',
  4: 'immediate',
};

export function UnavailableBriefing({
  code = INTELLIGENCE_BRIEFING_RESULT.code,
  snapshotId = INTELLIGENCE_BRIEFING_RESULT.snapshotId,
}: {
  code?: string;
  snapshotId?: string;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error(
      `[Intelligence Briefing] snapshot=${snapshotId ?? 'unknown'} code=${code}`,
    );
  }, [code, snapshotId]);

  return (
    <div className="studio-pulse">
      <ApplicationHeader />
      <main className="studio-pulse__main">
        <section className="studio-pulse__unavailable" role="alert">
          <span className="studio-pulse__eyebrow">{t('Intelligence Briefing')}</span>
          <h1>{t('Briefing unavailable')}</h1>
          <p>{t('The reviewed research artifact did not pass validation. No market decision is shown.')}</p>
          <code>{code}</code>
        </section>
      </main>
    </div>
  );
}

function SectionHeading({
  id,
  eyebrow,
  title,
  note,
}: {
  id: string;
  eyebrow: string;
  title: string;
  note: string;
}) {
  return (
    <header className="studio-pulse__section-heading">
      <div>
        <span className="studio-pulse__eyebrow">{eyebrow}</span>
        <h2 id={id}>{title}</h2>
      </div>
      <p>{note}</p>
    </header>
  );
}

const STATUS_ICONS: Record<string, string> = {
  advance: '▲', investigate: '◇', acquire: '+', watch: '○', dismiss: '×',
  confirmed: '●', strong_inference: '◆', speculation: '△', unknown_proprietary: '?',
  open: '●', limited: '◐', unknown: '?', good: '●', caution: '◆', weak: '△',
};

function StatusCue({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <span className={`studio-pulse__status-cue is-${value}`}>
      <span aria-hidden="true">{STATUS_ICONS[value] ?? '•'}</span>
      {t(value)}
    </span>
  );
}

function PortfolioTable({
  groups,
  language,
}: {
  groups: Array<{ label: string; projects: PortfolioProject[] }>;
  language: string;
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<'title' | 'score'>('score');
  const sortedGroups = useMemo(
    () => groups.map((group) => ({
      ...group,
      projects: [...group.projects].sort((a, b) => sort === 'title'
        ? a.title.localeCompare(b.title)
        : (b.creativeScore ?? -1) - (a.creativeScore ?? -1)),
    })),
    [groups, sort],
  );

  return (
    <div className="studio-pulse__table-wrap">
      <table>
        <caption>{t('Authorized portfolio opportunity table')}</caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={sort === 'title' ? 'ascending' : 'none'}>
              <button type="button" onClick={() => setSort('title')}>{t('Project')} ↕</button>
            </th>
            <th scope="col" aria-sort={sort === 'score' ? 'descending' : 'none'}>
              <button type="button" onClick={() => setSort('score')}>{t('Verified creative score')} ↕</button>
            </th>
            <th scope="col">{t('Market timing')}</th>
            <th scope="col">{t('Market action')}</th>
            <th scope="col">{t('Market claim')}</th>
            <th scope="col">{t('Match status')}</th>
            <th scope="col">{t('Next action')}</th>
          </tr>
        </thead>
        {sortedGroups.filter(({ projects }) => projects.length > 0).map((group) => (
          <tbody key={group.label} aria-label={t(group.label)}>
            <tr className="studio-pulse__table-group">
              <th colSpan={7} scope="rowgroup">{t(group.label)}</th>
            </tr>
            {group.projects.map((project) => (
              <tr key={project.id}>
                <th scope="row">{project.title}</th>
                <td>{project.creativeScore === null ? t('Unrankable') : project.creativeScore.toFixed(1)}</td>
                <td>
                  {project.opportunity
                    ? project.opportunity.timingBand.map((band) => t(band)).join(` ${t('to')} `)
                    : t('No matched timing band')}
                </td>
                <td>{project.opportunity ? <StatusCue value={project.opportunity.action} /> : t('No market match')}</td>
                <td>{project.opportunity ? <StatusCue value={project.opportunity.classification} /> : t('Not applicable')}</td>
                <td>{project.opportunity ? t('Approximate text match') : t('No reviewed match')}</td>
                <td>{project.opportunity ? localizedText(project.opportunity.nextAction, language) : t('Keep creative review separate')}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function PortfolioSurface({
  snapshot,
  demoPortfolio,
}: {
  snapshot: IntelligenceBriefingSnapshot;
  demoPortfolio?: ReturnType<typeof buildDemoPortfolio>;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, error } = useScreenplays();
  useLiveScreenplaySync();
  const state = demoPortfolio ? 'ready' : getSlateQueryState(data, isLoading, error);
  const portfolio = useMemo(
    () => demoPortfolio ?? buildPortfolioOpportunity(data ?? [], snapshot.opportunities),
    [data, demoPortfolio, snapshot.opportunities],
  );
  const groups = [
    { label: 'Matched projects', projects: portfolio.matches },
    { label: 'Unmatched projects', projects: portfolio.unmatched },
    { label: 'Unrankable projects', projects: portfolio.unrankable },
  ];
  const chartData = portfolio.matches.map((project) => {
    const band = project.opportunity!.timingBand;
    const low = TIMING_POSITION[band[0]];
    const high = TIMING_POSITION[band.at(-1)!];
    const timing = (low + high) / 2;
    return {
      title: project.title,
      creativeScore: project.creativeScore,
      timing,
      timingInterval: [timing - low, high - timing],
    };
  });

  if (state !== 'ready') {
    const messages = {
      loading: t('Loading authorized portfolio…'),
      authorization_error: t('Portfolio authorization failed. No slate decision is shown.'),
      error: t('Portfolio data is unavailable. This is not an empty-slate signal.'),
      empty: t('The authorized slate query succeeded and returned no projects.'),
    };
    return (
      <div className={`studio-pulse__portfolio-state is-${state}`} role="status">
        <strong>{messages[state]}</strong>
        {state === 'empty' && (
          <div>
            <p>{t('Acquisition gaps')}</p>
            <ul>
              {snapshot.opportunities.map((opportunity) => (
                <li key={opportunity.id}>{localizedText(opportunity.need, i18n.language)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {portfolio.matches.length > 0 ? (
        <div className="studio-pulse__chart" aria-hidden="true" data-testid="portfolio-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <ScatterChart
              accessibilityLayer={false}
              margin={{ top: 24, right: 28, bottom: 18, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 6" />
              <XAxis type="number" dataKey="creativeScore" domain={[0, 10]} name={t('Verified creative score')} />
              <YAxis
                type="number"
                dataKey="timing"
                width={88}
                domain={[1, 4]}
                ticks={[1, 2, 3, 4]}
                tickFormatter={(value: number) => t(TIMING_LABELS[value])}
                name={t('Market timing')}
              />
              <Scatter data={chartData} fill="var(--sp-accent)">
                <ErrorBar dataKey="timingInterval" direction="y" stroke="var(--sp-text)" width={8} />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="studio-pulse__portfolio-state">{t('No verified project matches the reviewed criteria. No project was manufactured.')}</p>
      )}
      <p className="studio-pulse__chart-takeaway">
        {t('Creative score stays on its existing verified scale. Market timing is a reviewed band, not a demand score, and it never changes a screenplay verdict.')}
      </p>
      <PortfolioTable groups={groups} language={i18n.language} />
    </>
  );
}

function EvidenceHealthSurface({ snapshot }: { snapshot: IntelligenceBriefingSnapshot }) {
  const { t, i18n } = useTranslation();
  const health = snapshot.evidenceHealth;
  const weakest = weakestEvidenceDimensions(health);
  const staleSources = snapshot.sources.filter(({ expiresAt }) => expiresAt < snapshot.snapshot.asOf);
  const unresolvedContradictions = snapshot.contradictions.filter(({ resolved }) => !resolved);
  const missingConnectors = snapshot.connectors.filter(({ status }) => status !== 'available');
  return (
    <>
      <p className="studio-pulse__weakest">
        <strong>{t('Weakest evidence')}:</strong> {weakest.map((key) => t(key)).join(', ')}
      </p>
      <dl className="studio-pulse__health-grid">
        {(Object.entries(health) as Array<[keyof EvidenceHealth, EvidenceHealth[keyof EvidenceHealth]]>).map(([key, dimension]) => (
          <div key={key} className={`is-${dimension.status}`}>
            <dt>{t(key)}</dt>
            <dd><StatusCue value={dimension.status} />{localizedText(dimension.explanation, i18n.language)}</dd>
          </div>
        ))}
      </dl>
      <div className="studio-pulse__health-details">
        <div>
          <h3>{t('Stale sources')}</h3>
          {staleSources.length > 0
            ? <ul>{staleSources.map((source) => <li key={source.id}>{source.publisher}: {source.title}</li>)}</ul>
            : <p>{t('None recorded')}</p>}
        </div>
        <div>
          <h3>{t('Unresolved contradictions')}</h3>
          {unresolvedContradictions.length > 0
            ? <ul>{unresolvedContradictions.map((item) => <li key={item.id}>{localizedText(item.statement, i18n.language)}</li>)}</ul>
            : <p>{t('None recorded')}</p>}
        </div>
        <div>
          <h3>{t('Missing connectors')}</h3>
          {missingConnectors.length > 0
            ? <ul>{missingConnectors.map((connector) => (
              <li key={connector.id}><strong>{connector.label}</strong>: {t(connector.status)}. {localizedText(connector.notes, i18n.language)}</li>
            ))}</ul>
            : <p>{t('None recorded')}</p>}
        </div>
      </div>
    </>
  );
}

export function IntelligenceBriefing({
  snapshot,
  demo = false,
}: {
  snapshot: IntelligenceBriefingSnapshot;
  demo?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const copy = (en: string, es: string) => language.startsWith('es') ? es : en;
  const date = new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${snapshot.snapshot.asOf}T00:00:00Z`));
  const claims = new Map(snapshot.claims.map((claim) => [claim.id, claim]));
  const contradictions = new Map(snapshot.contradictions.map((item) => [item.id, item]));
  const sources = new Map(snapshot.sources.map((source) => [source.id, source]));
  const rankedActions = snapshot.actions.filter(({ evidenceState }) => evidenceState === 'sufficient');
  const insufficientActions = snapshot.actions.filter(({ evidenceState }) => evidenceState === 'insufficient');
  const demoPortfolio = demo ? buildDemoPortfolio(snapshot) : undefined;
  const highestPriority = rankedActions[0];
  const largestRisk = snapshot.contradictions.find(({ resolved }) => !resolved);
  const changedSignals = snapshot.claims.filter(({ decisionCritical }) => decisionCritical).slice(0, 4);
  const leadSupport = highestPriority ? claims.get(highestPriority.supportClaimIds[0]) : undefined;
  const leadSources = leadSupport?.sourceIds.map((id) => sources.get(id)!).filter(Boolean) ?? [];

  return (
    <div className="studio-pulse">
      <ApplicationHeader />
      <main className="studio-pulse__main">
        {demo && (
          <aside className="studio-pulse__demo-banner" role="note">
            <strong>{copy('DEMO DATA', 'DATOS DEMO')}</strong>
            <span>{copy(
              'This preview uses fictional social signals, projects, and forecasts. Nothing here is a real market finding.',
              'Esta vista usa señales sociales, proyectos y pronósticos ficticios. Nada aquí es un hallazgo real de mercado.',
            )}</span>
          </aside>
        )}
        <section className="studio-pulse__masthead" aria-labelledby="intelligence-title">
          <div>
            <span className="studio-pulse__eyebrow">{t('Lemon Studios · Mexico')}</span>
            <h1 id="intelligence-title">{t('Intelligence Briefing')}</h1>
            <p>
              {t('A reviewed decision surface. Intelligence advises; Billy owns the executive and creative decision.')}
            </p>
          </div>
          <dl>
            <div><dt>{t('As of')}</dt><dd>{date}</dd></div>
            <div><dt>{t('Freshness')}</dt><dd>{t(snapshot.snapshot.freshness.status)}</dd></div>
            <div><dt>{t('Coverage')}</dt><dd>{t(snapshot.snapshot.coverageState)}</dd></div>
          </dl>
        </section>

        <section className="studio-pulse__signal-strip" aria-labelledby="changed-title">
          <header>
            <span className="studio-pulse__eyebrow">{copy('What changed', 'Qué cambió')}</span>
            <h2 id="changed-title">{copy('Signals in this edition', 'Señales de esta edición')}</h2>
            <p>{copy('No reviewed comparison exists yet. These are decision-critical signals, not measured changes.', 'Todavía no existe una comparación revisada. Estas son señales críticas para decidir, no cambios medidos.')}</p>
          </header>
          <ul>
            {changedSignals.map((claim) => {
              const source = sources.get(claim.sourceIds[0]);
              return (
                <li key={claim.id}>
                  <StatusCue value={claim.classification} />
                  <p>{localizedText(claim.statement, language)}</p>
                  {source && <a href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher} ↗</a>}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="studio-pulse__command-grid">
          <article className="studio-pulse__lead-story" aria-labelledby="lead-title">
            <div className="studio-pulse__lead-meta">
              <span className="studio-pulse__eyebrow">{copy('Editorial lead', 'Nota principal')}</span>
              <span>{copy('Reviewed edition', 'Edición revisada')}</span>
            </div>
            <h2 id="lead-title">{highestPriority ? localizedText(highestPriority.title, language) : copy('No supported lead move', 'No hay movimiento principal respaldado')}</h2>
            <p className="studio-pulse__lead-deck">
              {highestPriority
                ? localizedText(highestPriority.whyNow, language)
                : copy('This issue does not contain enough evidence to rank a market move.', 'Esta edición no contiene suficiente evidencia para priorizar un movimiento de mercado.')}
            </p>
            {highestPriority && (
              <div className="studio-pulse__lead-cues">
                <StatusCue value={highestPriority.action!} />
                <StatusCue value={highestPriority.classification} />
              </div>
            )}
            <div className="studio-pulse__lead-evidence">
              <div>
                <strong>{t('Strongest support')}</strong>
                <p>{leadSupport ? localizedText(leadSupport.statement, language) : t('Unavailable')}</p>
                {leadSources.map((source) => (
                  <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher} ↗</a>
                ))}
              </div>
              <div>
                <strong>{t('Strongest contradiction')}</strong>
                <p>{largestRisk ? localizedText(largestRisk.statement, language) : t('None recorded')}</p>
              </div>
            </div>
            <dl className="studio-pulse__lead-metrics">
              <div><dt>{copy('Ranked moves', 'Movimientos priorizados')}</dt><dd>{rankedActions.length}</dd></div>
              <div><dt>{t('Freshness')}</dt><dd>{t(snapshot.snapshot.freshness.status)}</dd></div>
              <div><dt>{t('Coverage')}</dt><dd>{t(snapshot.snapshot.coverageState)}</dd></div>
            </dl>
          </article>

          <section className="studio-pulse__section studio-pulse__moves" aria-labelledby="moves-title">
          <SectionHeading
            id="moves-title"
            eyebrow={t('Three Moves')}
            title={t('Ranked decisions supported by this issue')}
            note={t('The briefing publishes zero to three moves. It never fills the layout with unsupported decisions.')}
          />
          <ol className="studio-pulse__move-list">
            {rankedActions.map((action) => {
              const support = claims.get(action.supportClaimIds[0]);
              const contradiction = action.strongestContradictionId
                ? contradictions.get(action.strongestContradictionId)
                : null;
              const supportSources = support?.sourceIds.map((id) => sources.get(id)!).filter(Boolean) ?? [];
              return (
                <li key={action.id} className={`is-${action.action}`}>
                  <div className="studio-pulse__move-rank"><span>{action.rank}</span></div>
                  <div className="studio-pulse__move-body">
                    <div className="studio-pulse__move-title">
                      <h3>{localizedText(action.title, language)}</h3>
                      <div className="studio-pulse__move-title-meta">
                        <StatusCue value={action.action!} />
                        <StatusCue value={action.classification} />
                      </div>
                    </div>
                    <p>{localizedText(action.whyNow, language)}</p>
                    <dl className="studio-pulse__move-checkpoints">
                      <div><dt>{t('Strongest contradiction')}</dt><dd>{contradiction ? localizedText(contradiction.statement, language) : t('None recorded')}</dd></div>
                      <div><dt>{copy('Next checkpoint', 'Siguiente punto de control')}</dt><dd>{localizedText(action.nextAction, language)}</dd></div>
                      <div><dt>{t('Reverse when')}</dt><dd>{localizedText(action.reversalCondition, language)}</dd></div>
                    </dl>
                    <details className="studio-pulse__move-evidence">
                      <summary>{copy('View supporting evidence', 'Ver evidencia de respaldo')}</summary>
                      <div>
                        <strong>{t('Strongest support')}</strong>
                        <p>{support ? localizedText(support.statement, language) : t('Unavailable')}</p>
                        {supportSources.map((source) => (
                          <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher} ↗</a>
                        ))}
                      </div>
                    </details>
                  </div>
                </li>
              );
            })}
          </ol>
          {rankedActions.length === 0 && insufficientActions.length === 0 && (
            <div className="studio-pulse__insufficient" role="note">
              <strong>{t('Insufficient evidence')}</strong>
              <p>{t('No ranked market move is supported by this issue. Keep decisions unranked until the evidence contract is satisfied.')}</p>
            </div>
          )}
          {insufficientActions.map((action) => (
            <div className="studio-pulse__insufficient" key={action.id} role="note">
              <strong>{t('Insufficient evidence')}</strong>
              <h3>{localizedText(action.title, language)}</h3>
              <p>{localizedText(action.whyNow, language)}</p>
              <small>{localizedText(action.nextAction, language)}</small>
            </div>
          ))}
          </section>
        </div>

        <section className="studio-pulse__situation" aria-labelledby="situation-title">
          <SectionHeading
            id="situation-title"
            eyebrow={t('Situation')}
            title={t('What we know, and what we do not')}
            note={t('Mexico is the decision territory. Regional, diaspora, Spain, and global evidence stays labeled as context.')}
          />
          <p>{localizedText(snapshot.snapshot.knowledgeLimits, language)}</p>
        </section>

        <section className="studio-pulse__section studio-pulse__compact-section" aria-labelledby="mexico-now-title">
          <SectionHeading
            id="mexico-now-title"
            eyebrow={t('Mexico Now')}
            title={t('Open buyer doors')}
            note={t('Public evidence only. A visible strategy signal is not a private buying mandate.')}
          />
          <ul className="studio-pulse__buyer-board">
            {snapshot.buyers.map((buyer) => {
              const claim = claims.get(buyer.claimIds[0]);
              const source = claim ? sources.get(claim.sourceIds[0]) : undefined;
              return (
                <li key={buyer.id}>
                  <div><strong>{buyer.name}</strong><StatusCue value={buyer.doorState} /></div>
                  <p>{localizedText(buyer.appetite, language)}</p>
                  <small>{localizedText(buyer.formats, language)} · {t(buyer.signal)}</small>
                  {source && <a href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher} ↗</a>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="studio-pulse__section studio-pulse__compact-section" aria-labelledby="zeitgeist-title">
          <SectionHeading
            id="zeitgeist-title"
            eyebrow={t('Zeitgeist + Context')}
            title={t('Conversation beside verified evidence')}
            note={t('Conversation, verified context, and observed outcomes remain separate. No blended truth score is calculated.')}
          />
          <div className="studio-pulse__zeitgeist-preview">
            {snapshot.zeitgeistStories.map((story) => (
              <article key={story.id}>
                <div><StatusCue value={story.classification} /><span>{t(story.signalClass)}</span></div>
                <h3>{localizedText(story.title, language)}</h3>
                <p><strong>{t('Next confirming test')}:</strong> {localizedText(story.nextTest, language)}</p>
              </article>
            ))}
          </div>
          <details className="studio-pulse__section-disclosure">
            <summary>{copy(`${snapshot.zeitgeistStories.length} reviewed themes · View evidence`, `${snapshot.zeitgeistStories.length} temas revisados · Ver evidencia`)}</summary>
            <div className="studio-pulse__section-disclosure-content">
          {snapshot.zeitgeistStories.map((story) => (
            <article className="studio-pulse__zeitgeist" key={story.id}>
              <header>
                <span className={`is-${story.state}`}>{t(story.signalClass)}</span>
                <h3>{localizedText(story.title, language)}</h3>
                <small>
                  {t('Territory')}: {story.countryCodes.length > 0 ? story.countryCodes.join(', ') : t(story.scope)} ·{' '}
                  {story.window.start} → {story.window.end} · <StatusCue value={story.classification} />
                </small>
              </header>
              <div className="studio-pulse__evidence-columns">
                <div>
                  <h4>{t('Conversation')}</h4>
                  {story.state === 'unavailable'
                    ? <p>{t('Unavailable. No volume or sentiment was fabricated.')}</p>
                    : story.conversationClaimIds.map((id) => (
                      <p key={id}>{localizedText(claims.get(id)!.statement, language)}</p>
                    ))}
                </div>
                <div>
                  <h4>{t('Verified context')}</h4>
                  {story.contextClaimIds.map((id) => <p key={id}>{localizedText(claims.get(id)!.statement, language)}</p>)}
                </div>
                <div>
                  <h4>{t('Observed outcomes')}</h4>
                  {story.outcomeClaimIds.map((id) => <p key={id}>{localizedText(claims.get(id)!.statement, language)}</p>)}
                </div>
              </div>
              <div className="studio-pulse__limits">
                <p><strong>{t('Does not prove')}:</strong> {localizedText(story.doesNotProve, language)}</p>
                <p><strong>{t('Alternative explanations')}:</strong></p>
                <ul>{story.alternativeExplanations.map((item) => <li key={item.en}>{localizedText(item, language)}</li>)}</ul>
                <p><strong>{t('Source families')}:</strong>{' '}
                  {story.sourceFamilies.map((family) => localizedText(family, language)).join(', ')}
                </p>
                <p><strong>{t('Contradictions')}:</strong>{' '}
                  {story.contradictionIds.length > 0
                    ? story.contradictionIds.map((id) => localizedText(contradictions.get(id)!.statement, language)).join(' ')
                    : t('None recorded')}
                </p>
                <p><strong>{t('Next confirming test')}:</strong> {localizedText(story.nextTest, language)}</p>
              </div>
            </article>
          ))}
          <details className="studio-pulse__disclosure">
            <summary>{t('Source receipts and methodology')}</summary>
            <p>{t('All source pages are treated as untrusted data. Embedded instructions are ignored; social evidence may be published only in aggregate.')}</p>
            <ul>
              {snapshot.sources.map((source) => (
                <li key={source.id}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">{source.publisher}: {source.title} ↗</a>
                  <span>{source.publishedAt} · {t(source.scope)} · {t(source.role)}</span>
                </li>
              ))}
            </ul>
          </details>
            </div>
          </details>
        </section>

        <section className="studio-pulse__section studio-pulse__compact-section studio-pulse__portfolio" aria-labelledby="portfolio-title">
          <SectionHeading
            id="portfolio-title"
            eyebrow={t('Portfolio Opportunity')}
            title={t('Creative quality beside market timing')}
            note={t('Private titles join locally only after team authorization. Paperclip never receives slate data.')}
          />
          <div className="studio-pulse__opportunity-preview">
            {snapshot.opportunities.map((opportunity) => (
              <article key={opportunity.id}>
                <div><StatusCue value={opportunity.action} /><StatusCue value={opportunity.classification} /></div>
                <h3>{localizedText(opportunity.label, language)}</h3>
                <p>{localizedText(opportunity.need, language)}</p>
                <small>{opportunity.timingBand.map((band) => t(band)).join(` ${t('to')} `)}</small>
              </article>
            ))}
          </div>
          <details className="studio-pulse__section-disclosure">
            <summary>{demo
              ? copy(`${demoPortfolio?.matches.length ?? 0} reviewed matches · View map`, `${demoPortfolio?.matches.length ?? 0} coincidencias revisadas · Ver mapa`)
              : copy('View authorized portfolio map', 'Ver mapa autorizado del portafolio')}</summary>
            <div className="studio-pulse__section-disclosure-content">
              <PortfolioSurface snapshot={snapshot} demoPortfolio={demoPortfolio} />
            </div>
          </details>
        </section>

        <section className="studio-pulse__section studio-pulse__compact-section" aria-labelledby="health-title">
          <SectionHeading
            id="health-title"
            eyebrow={t('Evidence Health')}
            title={t('Seven separate checks, no confidence score')}
            note={t('Every weakest dimension stays visible, including ties.')}
          />
          <details className="studio-pulse__section-disclosure">
            <summary>{copy('Review evidence health and contradictions', 'Revisar salud de evidencia y contradicciones')}</summary>
            <div className="studio-pulse__section-disclosure-content">
              <EvidenceHealthSurface snapshot={snapshot} />
            </div>
          </details>
        </section>

        <section className="studio-pulse__ledger studio-pulse__compact-section" aria-labelledby="ledger-title">
          <div className="studio-pulse__ledger-heading">
            <div>
              <span className="studio-pulse__eyebrow">{t('Decision & Prediction Ledger')}</span>
              <h2 id="ledger-title">{demo ? copy('Prediction accountability', 'Rendición de cuentas de predicciones') : t('Not enough history')}</h2>
            </div>
            <p>{localizedText(snapshot.ledger.explanation, language)}</p>
          </div>
          <details className="studio-pulse__section-disclosure">
            <summary>{demo ? copy(`${DEMO_LEDGER.length} fictional entries · View ledger`, `${DEMO_LEDGER.length} entradas ficticias · Ver registro`) : copy('View ledger boundary', 'Ver límite del registro')}</summary>
          {demo && (
            <div className="studio-pulse__ledger-grid">
              {DEMO_LEDGER.map((entry) => (
                <article key={entry.date}>
                  <time dateTime={entry.date}>{entry.date}</time>
                  <h3>{localizedText(entry.prediction, language)}</h3>
                  <strong>{localizedText(entry.status, language)}</strong>
                  <p>{localizedText(entry.outcome, language)}</p>
                </article>
              ))}
            </div>
          )}
          </details>
        </section>
      </main>
    </div>
  );
}

export default function StudioPulsePage() {
  const demo = import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1';
  const snapshot = INTELLIGENCE_BRIEFING_RESULT.snapshot;
  return snapshot
    ? <IntelligenceBriefing snapshot={demo ? buildDemoBriefing(snapshot) : snapshot} demo={demo} />
    : <UnavailableBriefing />;
}
