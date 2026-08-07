import { DiscoverySelectionCheckbox } from '@/components/discover/DiscoverySelectionCheckbox';
import { DiscoveryShareStatus } from '@/components/discover/DiscoveryShareStatus';
import { DevelopmentOpportunityBadge } from '@/components/discover/DevelopmentOpportunityBadge';
import { BlueSpineScript } from '@/components/discover/screenplay/BlueSpineScript';
import type {
  OpenScreenplay,
  PercentileMap,
} from '@/components/discover/screenplay/screenplayPresentationTypes';
import type { RankedScreenplay } from '@/components/discover/screenplay/screenplayRankingProjection';
import { AnalysisTrustBadge } from '@/components/screenplay/AnalysisTrustBadge';
import { RecommendationBadge } from '@/components/ui/RecommendationBadge';
import {
  getScreenplayDisplayAuthor,
  getScreenplayDisplayGenre,
  getScreenplayDisplayTitle,
  getScreenplayFormatInfo,
} from '@/lib/screenplayDisplay';
import type { ProducerAssessmentHead } from '@/types';

function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

export function ScreenplayGrid({
  entries,
  percentiles,
  producerAssessments,
  producerLookIds,
  onOpen,
}: {
  entries: RankedScreenplay[];
  percentiles: PercentileMap;
  producerAssessments?: ReadonlyMap<string, ProducerAssessmentHead>;
  producerLookIds?: ReadonlySet<string>;
  onOpen: OpenScreenplay;
}) {
  return (
    <ul className="screenplay-wall" data-testid="screenplay-discovery-grid">
      {entries.map(({ screenplay, rank }) => {
        const percentile = percentiles.get(screenplay.id);
        const displayTitle = getScreenplayDisplayTitle(screenplay.title);
        const displayAuthor = getScreenplayDisplayAuthor(screenplay.author);
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
                <BlueSpineScript screenplay={screenplay} rank={rank} />
              </span>
              <span className="screenplay-wall__copy">
                <span className="screenplay-wall__title">
                  <strong>{displayTitle.title}</strong>
                  {displayTitle.qualifier && <em>{displayTitle.qualifier}</em>}
                  <small>{displayAuthor}</small>
                </span>
                <span className="screenplay-wall__score">
                  <strong>{screenplay.weightedScore.toFixed(1)}</strong>
                  <small>{percentile ? `${ordinal(percentile.overall)} percentile` : ''}</small>
                </span>
                <span className="screenplay-wall__meta">
                  <RecommendationBadge tier={screenplay.recommendation} />
                  <span>{getScreenplayDisplayGenre(screenplay.genre)}</span>
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
