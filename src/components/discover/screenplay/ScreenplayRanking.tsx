import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { DevelopmentOpportunityBadge } from '@/components/discover/DevelopmentOpportunityBadge';
import { BlueSpineScript } from '@/components/discover/screenplay/BlueSpineScript';
import type {
  OpenScreenplay,
  PercentileMap,
} from '@/components/discover/screenplay/screenplayPresentationTypes';
import type { RankedScreenplay } from '@/components/discover/screenplay/screenplayRankingProjection';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { getScreenplayDisplayTitle, getScreenplayFormatInfo } from '@/lib/screenplayDisplay';
import type { ProducerAssessmentHead, Screenplay, SortField } from '@/types';

function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function rankingMetric(
  screenplay: Screenplay,
  sortField: SortField,
): { label: string; value: string } {
  if (sortField === 'marketPotential') {
    return {
      label: 'Market potential',
      value:
        screenplay.producerMetrics.marketPotential === null
          ? 'Not assessed'
          : screenplay.producerMetrics.marketPotential.toFixed(1),
    };
  }
  if (sortField === 'cvsTotal') {
    return {
      label: 'Commercial viability',
      value: screenplay.commercialViability.cvsAssessed
        ? screenplay.cvsTotal.toFixed(0)
        : 'Not assessed',
    };
  }
  return { label: 'Final score', value: screenplay.weightedScore.toFixed(1) };
}

interface ScreenplayRankingProps {
  topResult: RankedScreenplay;
  nextThree: RankedScreenplay[];
  reason: string;
  filterContext: string;
  sortField: SortField;
  percentiles: PercentileMap;
  producerAssessments: ReadonlyMap<string, ProducerAssessmentHead>;
  producerLookIds?: ReadonlySet<string>;
  onOpen: OpenScreenplay;
}

export function ScreenplayRanking({
  topResult,
  nextThree,
  reason,
  filterContext,
  sortField,
  percentiles,
  producerAssessments,
  producerLookIds,
  onOpen,
}: ScreenplayRankingProps) {
  const screenplay = topResult.screenplay;
  const title = getScreenplayDisplayTitle(screenplay.title);
  const format = getScreenplayFormatInfo(screenplay);
  const percentile = percentiles.get(screenplay.id);
  const projectKey = screenplay.projectId ?? screenplay.id;
  const metric = rankingMetric(screenplay, sortField);

  return (
    <section
      className="screenplay-ranking"
      data-testid="screenplay-discovery-ranking"
      aria-labelledby="screenplay-ranking-title"
    >
      <header className="screenplay-ranking__heading">
        <div>
          <p className="screenplay-ui-eyebrow">Best in the current view</p>
          <h2 id="screenplay-ranking-title">Top result</h2>
        </div>
        <p>
          {reason} · {filterContext}
        </p>
      </header>
      <div className="screenplay-ranking__layout">
        <article
          className="screenplay-ranking__top"
          data-testid="screenplay-ranking-top"
          data-screenplay-id={screenplay.id}
          data-verdict={screenplay.recommendation}
        >
          <DiscoverySelectionCheckbox screenplay={screenplay} />
          <button
            type="button"
            className="screenplay-ranking__top-open"
            onClick={(event) => onOpen(screenplay, event.currentTarget)}
            aria-label={`Open ${title.title} screenplay file`}
          >
            <span className="screenplay-ranking__object">
              <BlueSpineScript screenplay={screenplay} featured rank={topResult.rank} />
            </span>
            <span className="screenplay-ranking__brief">
              <span className="screenplay-ranking__title">{title.title}</span>
              {title.qualifier && (
                <span className="screenplay-ranking__qualifier">{title.qualifier}</span>
              )}
              <span className="screenplay-ranking__meta">
                {format.format} · {format.source} · {screenplay.genre} ·{' '}
                {screenplay.author || 'Unknown writer'}
              </span>
              <span className="screenplay-ranking__logline">
                {screenplay.logline || 'Logline not yet available.'}
              </span>
              <span className="screenplay-ranking__decision">
                <RecommendationBadge tier={screenplay.recommendation} />
                <DevelopmentOpportunityBadge
                  screenplay={screenplay}
                  assessment={producerAssessments.get(projectKey)}
                  routed={producerLookIds?.has(projectKey)}
                />
                <strong>{metric.value}</strong>
                <small>{metric.label}</small>
                <small>
                  {percentile
                    ? `${ordinal(percentile.overall)} final-score percentile`
                    : 'Position pending'}
                </small>
              </span>
              <span className="screenplay-ranking__action">Open screenplay file →</span>
            </span>
          </button>
        </article>
        {nextThree.length > 0 && (
          <ol className="screenplay-ranking__runners" aria-label="Next three results">
            {nextThree.map((entry) => {
              const runner = entry.screenplay;
              const runnerTitle = getScreenplayDisplayTitle(runner.title);
              const runnerFormat = getScreenplayFormatInfo(runner);
              const runnerPercentile = percentiles.get(runner.id);
              const runnerMetric = rankingMetric(runner, sortField);
              return (
                <li
                  key={runner.id}
                  data-testid="screenplay-ranking-runner"
                  data-screenplay-id={runner.id}
                >
                  <DiscoverySelectionCheckbox screenplay={runner} />
                  <button
                    type="button"
                    onClick={(event) => onOpen(runner, event.currentTarget)}
                    aria-label={`Open ${runnerTitle.title} screenplay file`}
                  >
                    <BlueSpineScript screenplay={runner} rank={entry.rank} />
                    <span>
                      <small>
                        #{entry.rank} · {runnerFormat.format}
                      </small>
                      <strong>{runnerTitle.title}</strong>
                      <em>{runner.author || 'Unknown writer'}</em>
                      <b>{runnerMetric.value}</b>
                      <small>{runnerMetric.label}</small>
                      <small>
                        {runnerPercentile
                          ? `${ordinal(runnerPercentile.overall)} final-score percentile`
                          : 'Position pending'}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
