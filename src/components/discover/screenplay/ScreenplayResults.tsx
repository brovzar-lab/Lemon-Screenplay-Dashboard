import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { DevelopmentOpportunityBadge } from '@/components/discover/DevelopmentOpportunityBadge';
import { BlueSpineScript } from '@/components/discover/screenplay/BlueSpineScript';
import { AnalysisTrustBadge } from '@/components/screenplay/AnalysisTrustBadge';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';
import type { PercentileRank } from '@/lib/percentileRanking';
import { getScreenplayDisplayTitle, getScreenplayFormatInfo } from '@/lib/screenplayDisplay';
import type { ProducerAssessmentHead, Screenplay, SortField } from '@/types';

type PercentileMap = ReadonlyMap<string, PercentileRank>;

interface OpenScreenplay {
  (screenplay: Screenplay, trigger: HTMLButtonElement): void;
}

function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function sortLabel(sortField: SortField): string {
  if (sortField === 'title') return 'First by title';
  if (sortField === 'marketPotential') return 'Top market potential';
  if (sortField === 'cvsTotal') return 'Top commercial viability';
  return 'Top weighted score';
}

export function ScreenplayFeature({
  screenplay,
  sortField,
  percentiles,
  producerAssessment,
  producerLookIds,
  onOpen,
}: {
  screenplay: Screenplay;
  sortField: SortField;
  percentiles: PercentileMap;
  producerAssessment?: ProducerAssessmentHead;
  producerLookIds?: ReadonlySet<string>;
  onOpen: OpenScreenplay;
}) {
  const percentile = percentiles.get(screenplay.id);
  const pillars = getDimensionDisplay(screenplay).slice(0, 5);
  const displayTitle = getScreenplayDisplayTitle(screenplay.title);
  const formatInfo = getScreenplayFormatInfo(screenplay);

  return (
    <article
      className="screenplay-feature"
      data-testid="screenplay-discovery-featured"
      data-screenplay-id={screenplay.id}
    >
      <DiscoverySelectionCheckbox screenplay={screenplay} />
      <div className="screenplay-feature__object">
        <BlueSpineScript screenplay={screenplay} featured rank={1} />
      </div>
      <div className="screenplay-feature__brief">
        <p className="screenplay-ui-eyebrow">Featured screenplay</p>
        <h1>{displayTitle.title}</h1>
        {displayTitle.qualifier && (
          <p className="screenplay-feature__qualifier">{displayTitle.qualifier}</p>
        )}
        <p className="screenplay-feature__meta">
          {formatInfo.format} <span>·</span> {screenplay.genre} <span>·</span>{' '}
          {screenplay.author || 'Unknown writer'}
        </p>
        <p className="screenplay-feature__logline">
          {screenplay.logline || 'Logline not yet available.'}
        </p>
        <div className="screenplay-feature__decision">
          <RecommendationBadge tier={screenplay.recommendation} />
          <DevelopmentOpportunityBadge
            screenplay={screenplay}
            assessment={producerAssessment}
            routed={producerLookIds?.has(screenplay.projectId ?? screenplay.id)}
          />
          <span>{sortLabel(sortField)}</span>
        </div>
        <button
          type="button"
          className="screenplay-primary-action"
          onClick={(event) => onOpen(screenplay, event.currentTarget)}
        >
          Open screenplay file <span aria-hidden="true">→</span>
        </button>
      </div>
      <aside className="screenplay-feature__score" aria-label="Featured screenplay scores">
        <span>Weighted score</span>
        <strong>{screenplay.weightedScore.toFixed(1)}</strong>
        <small>
          {percentile ? `${ordinal(percentile.overall)} percentile` : 'Slate position pending'}
        </small>
        <div className="screenplay-feature__pillars">
          {pillars.map((pillar) => (
            <div key={pillar.key}>
              <span>{pillar.label}</span>
              <progress value={Math.max(0, Math.min(10, pillar.score))} max={10} />
              <b>{pillar.score.toFixed(1)}</b>
            </div>
          ))}
        </div>
      </aside>
    </article>
  );
}

export function ScreenplayGrid({
  screenplays,
  rankOffset,
  percentiles,
  producerAssessments,
  producerLookIds,
  onOpen,
}: {
  screenplays: Screenplay[];
  rankOffset: number;
  percentiles: PercentileMap;
  producerAssessments?: ReadonlyMap<string, ProducerAssessmentHead>;
  producerLookIds?: ReadonlySet<string>;
  onOpen: OpenScreenplay;
}) {
  return (
    <ul className="screenplay-wall" data-testid="screenplay-discovery-grid">
      {screenplays.map((screenplay, index) => {
        const percentile = percentiles.get(screenplay.id);
        const displayTitle = getScreenplayDisplayTitle(screenplay.title);
        const formatInfo = getScreenplayFormatInfo(screenplay);
        return (
          <li
            key={screenplay.id}
            className="screenplay-wall__item"
            data-testid="screenplay-discovery-result"
            data-screenplay-id={screenplay.id}
            data-verdict={screenplay.recommendation}
          >
            <DiscoverySelectionCheckbox screenplay={screenplay} />
            <button
              type="button"
              className="screenplay-wall__open"
              onClick={(event) => onOpen(screenplay, event.currentTarget)}
              aria-label={`Open ${displayTitle.title} screenplay file`}
            >
              <span className="screenplay-wall__object-stage">
                <BlueSpineScript screenplay={screenplay} rank={rankOffset + index + 1} />
              </span>
              <span className="screenplay-wall__copy">
                <span className="screenplay-wall__title">
                  <strong>{displayTitle.title}</strong>
                  {displayTitle.qualifier && <em>{displayTitle.qualifier}</em>}
                  <small>{screenplay.author || 'Unknown writer'}</small>
                </span>
                <span className="screenplay-wall__score">
                  <strong>{screenplay.weightedScore.toFixed(1)}</strong>
                  <small>{percentile ? `${ordinal(percentile.overall)} percentile` : ''}</small>
                </span>
                <span className="screenplay-wall__meta">
                  <RecommendationBadge tier={screenplay.recommendation} />
                  <span>{screenplay.genre}</span>
                </span>
                <span className="screenplay-wall__facts" aria-label="Screenplay format and source">
                  <span>{formatInfo.format}</span>
                  <span>{formatInfo.source}</span>
                </span>
                <span className="screenplay-wall__status">
                  <AnalysisTrustBadge screenplay={screenplay} />
                  <DiscoveryShareStatus screenplay={screenplay} />
                  <DevelopmentOpportunityBadge
                    screenplay={screenplay}
                    assessment={producerAssessments?.get(screenplay.projectId ?? screenplay.id)}
                    routed={producerLookIds?.has(screenplay.projectId ?? screenplay.id)}
                    compact
                  />
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
