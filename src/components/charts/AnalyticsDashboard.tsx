/**
 * AnalyticsDashboard Component
 * Collapsible panel containing all analytics charts
 */

import { useState, useRef, useLayoutEffect } from 'react';
import { ScoreDistribution } from './ScoreDistribution';
import { TierBreakdown } from './TierBreakdown';
import { GenreChart } from './GenreChart';
import { FormatChart } from './FormatChart';
import { useCountUp } from '../../hooks/useCountUp';
import type { BudgetCategory, Screenplay, RecommendationTier } from '@/types';
import { useTranslation } from 'react-i18next';
import { decisionReadyScreenplays } from '@/lib/producerProjection';

interface AnalyticsDashboardProps {
  screenplays: Screenplay[];
  totalScreenplays?: Screenplay[];
  onFilterByScoreRange?: (range: { min: number; max: number }) => void;
  onFilterByTier?: (tier: RecommendationTier) => void;
  onFilterByGenre?: (genre: string) => void;
  /** Retained for old-dashboard compatibility; Discovery intentionally shows Format Mix. */
  onFilterByBudget?: (budget: BudgetCategory) => void;
  title?: string;
  initiallyExpanded?: boolean;
  deferContentUntilExpanded?: boolean;
  className?: string;
  maxGenres?: number;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function AnalyticsDashboard({
  screenplays,
  totalScreenplays,
  onFilterByScoreRange,
  onFilterByTier,
  onFilterByGenre,
  title = 'Slate Overview',
  initiallyExpanded = true,
  deferContentUntilExpanded = false,
  className = '',
  maxGenres = 6,
  expanded,
  onExpandedChange,
}: AnalyticsDashboardProps) {
  const { t } = useTranslation();
  const [internalExpanded, setInternalExpanded] = useState(initiallyExpanded);
  const isExpanded = expanded ?? internalExpanded;
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(2000);

  const toggleExpanded = () => {
    const next = !isExpanded;
    if (expanded === undefined) setInternalExpanded(next);
    onExpandedChange?.(next);
  };

  // Measure content height after each expansion so the style reads from state,
  // not from ref.current directly during render (avoids react-hooks/refs error).
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!isExpanded || !content) return;

    const measure = () => setContentHeight(content.scrollHeight);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [isExpanded]);

  const isFiltered = totalScreenplays && totalScreenplays.length !== screenplays.length;
  const decisionScreenplays = decisionReadyScreenplays(screenplays);
  const omittedUnverified = screenplays.length - decisionScreenplays.length;

  // Raw numeric values for count-up
  const avgScoreRaw =
    decisionScreenplays.length > 0
      ? decisionScreenplays.reduce((sum, sp) => sum + sp.weightedScore, 0) / decisionScreenplays.length
      : 0;
  const filmNowCount = decisionScreenplays.filter((sp) => sp.recommendation === 'film_now').length;
  const recommendCount = decisionScreenplays.filter((sp) => sp.recommendation === 'recommend').length;

  // Animated count-up values — only run once when panel is first expanded
  const animatedTotal = useCountUp(screenplays.length, 600, isExpanded);
  const animatedAvg = useCountUp(avgScoreRaw, 600, isExpanded);
  const animatedFilmNow = useCountUp(filmNowCount, 600, isExpanded);
  const animatedRecommend = useCountUp(recommendCount, 600, isExpanded);

  // Chart cards: each gets a stagger delay offset (100 ms apart)
  const chartCards = [
    {
      title: t('Score Distribution'),
      hint: onFilterByScoreRange ? t('Click a bar to filter') : null,
      content: <ScoreDistribution screenplays={decisionScreenplays} onBarClick={onFilterByScoreRange} />,
    },
    {
      title: t('Recommendation Tiers'),
      hint: onFilterByTier ? t('Click to filter by tier') : null,
      content: <TierBreakdown screenplays={decisionScreenplays} onTierClick={onFilterByTier} />,
    },
    {
      title: t('Top Genres'),
      hint: onFilterByGenre ? t('Click to filter by genre') : null,
      content: (
        <GenreChart
          screenplays={decisionScreenplays}
          maxGenres={maxGenres}
          onGenreClick={onFilterByGenre}
        />
      ),
    },
    {
      title: t('Format Mix'),
      hint: null,
      content: <FormatChart screenplays={screenplays} />,
    },
  ];

  return (
    <div className={`slate-analytics mb-6 ${className}`.trim()}>
      {/* Header with toggle */}
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={isExpanded}
        aria-controls="analytics-dashboard-content"
        className="slate-analytics__toggle w-full"
      >
        <div className="flex items-center gap-4">
          <div className="slate-analytics__title flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gold-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span>{title}</span>
          </div>

          {/* Quick stats — count-up when expanded, static when collapsed */}
          <div className="slate-analytics__summary flex items-center gap-4 text-sm">
            <span className="text-black-400">
              <span className="text-gold-400">
                {isExpanded ? animatedTotal.toFixed(0) : screenplays.length}
              </span>
              {isFiltered
                ? t(' of {{count}} screenplays', { count: totalScreenplays.length })
                : ` ${t('screenplays')}`}
              {isFiltered && <span className="ml-1 text-gold-500">({t('filtered')})</span>}
            </span>
            {omittedUnverified > 0 && (
              <span className="text-amber-400">
                {t('{{count}} unverified omitted', { count: omittedUnverified })}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-black-400">
              {t('Avg Score')}:{' '}
              <span className="text-emerald-400">
                {isExpanded ? animatedAvg.toFixed(1) : avgScoreRaw.toFixed(1)}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-black-400">
              <span className="text-gold-400">
                {isExpanded ? animatedFilmNow.toFixed(0) : filmNowCount}
              </span>{' '}
              {t('FILM NOW')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-black-400">
              <span className="text-emerald-400">
                {isExpanded ? animatedRecommend.toFixed(0) : recommendCount}
              </span>{' '}
              {t('Recommend')}
            </span>
          </div>
        </div>

        {/* Toggle icon */}
        <svg
          className={`w-5 h-5 text-black-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content — smooth height + opacity transition */}
      <div
        id="analytics-dashboard-content"
        ref={contentRef}
        className="overflow-hidden transition-all duration-400 ease-out"
        style={
          isExpanded
            ? {
                maxHeight: contentHeight,
                opacity: 1,
              }
            : {
                maxHeight: 0,
                opacity: 0,
              }
        }
      >
        {(!deferContentUntilExpanded || isExpanded) && (
          <>
            <div className="slate-analytics__grid mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {chartCards.map((card) => (
                <div key={card.title} className="slate-analytics__card">
                  <div className="p-4 h-full">
                    <h2>{card.title}</h2>
                    <div className="h-48">{card.content}</div>
                    {card.hint && (
                      <p className="text-xs text-black-400 mt-2 text-center">{card.hint}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
