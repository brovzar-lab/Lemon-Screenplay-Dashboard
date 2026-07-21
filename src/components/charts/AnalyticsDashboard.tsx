/**
 * AnalyticsDashboard Component
 * Collapsible panel containing all analytics charts
 */

import { useState, useRef, useLayoutEffect } from 'react';
import { ScoreDistribution } from './ScoreDistribution';
import { TierBreakdown } from './TierBreakdown';
import { GenreChart } from './GenreChart';
import { BudgetChart } from './BudgetChart';
import { TasteMatch } from './TasteMatch';
import { useCountUp } from '../../hooks/useCountUp';
import type { Screenplay, RecommendationTier, BudgetCategory } from '@/types';
import { useIsAdmin } from '@/stores/authStore';

interface AnalyticsDashboardProps {
  screenplays: Screenplay[];
  totalScreenplays?: Screenplay[];
  onFilterByScoreRange?: (range: { min: number; max: number }) => void;
  onFilterByTier?: (tier: RecommendationTier) => void;
  onFilterByGenre?: (genre: string) => void;
  onFilterByBudget?: (budget: BudgetCategory) => void;
}

export function AnalyticsDashboard({
  screenplays,
  totalScreenplays,
  onFilterByScoreRange,
  onFilterByTier,
  onFilterByGenre,
  onFilterByBudget,
}: AnalyticsDashboardProps) {
  const isAdmin = useIsAdmin();
  const [isExpanded, setIsExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(2000);

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

  // Raw numeric values for count-up
  const avgScoreRaw =
    screenplays.length > 0
      ? screenplays.reduce((sum, sp) => sum + sp.weightedScore, 0) / screenplays.length
      : 0;
  const filmNowCount = screenplays.filter((sp) => sp.recommendation === 'film_now').length;
  const recommendCount = screenplays.filter((sp) => sp.recommendation === 'recommend').length;

  // Animated count-up values — only run once when panel is first expanded
  const animatedTotal = useCountUp(screenplays.length, 600, isExpanded);
  const animatedAvg = useCountUp(avgScoreRaw, 600, isExpanded);
  const animatedFilmNow = useCountUp(filmNowCount, 600, isExpanded);
  const animatedRecommend = useCountUp(recommendCount, 600, isExpanded);

  const chartCards = [
    {
      title: 'Score Distribution',
      hint: onFilterByScoreRange ? 'Click a bar to filter' : null,
      content: <ScoreDistribution screenplays={screenplays} onBarClick={onFilterByScoreRange} />,
    },
    {
      title: 'Recommendation Tiers',
      hint: onFilterByTier ? 'Click to filter by tier' : null,
      content: <TierBreakdown screenplays={screenplays} onTierClick={onFilterByTier} />,
    },
    {
      title: 'Top Genres',
      hint: onFilterByGenre ? 'Click to filter by genre' : null,
      content: (
        <GenreChart screenplays={screenplays} maxGenres={6} onGenreClick={onFilterByGenre} />
      ),
    },
    {
      title: 'Budget Tiers',
      hint: onFilterByBudget ? 'Click to filter by budget' : null,
      content: <BudgetChart screenplays={screenplays} onBudgetClick={onFilterByBudget} />,
    },
  ];

  return (
    <div className="mb-6">
      {/* Header with toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-4 rounded-lg bg-black-900 px-4 py-4 text-left shadow-sm md:px-5"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex items-center gap-2">
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
            <span className="font-semibold text-black-50">Analytics Dashboard</span>
          </div>

          {/* Quick stats — count-up when expanded, static when collapsed */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="text-black-300">
              <span className="text-gold-400">
                {isExpanded ? animatedTotal.toFixed(0) : screenplays.length}
              </span>
              {isFiltered ? ` of ${totalScreenplays.length}` : ''} screenplays
              {isFiltered && <span className="ml-1 text-black-400">(filtered)</span>}
            </span>
            <span className="text-black-300">
              Average{' '}
              <span className="font-semibold text-black-50">
                {isExpanded ? animatedAvg.toFixed(1) : avgScoreRaw.toFixed(1)}
              </span>
            </span>
            <span className="text-black-300">
              <span className="font-semibold text-black-50">
                {isExpanded ? animatedFilmNow.toFixed(0) : filmNowCount}
              </span>{' '}
              FILM NOW
            </span>
            <span className="text-black-300">
              <span className="font-semibold text-black-50">
                {isExpanded ? animatedRecommend.toFixed(0) : recommendCount}
              </span>{' '}
              Recommend
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
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {chartCards.map((card) => (
            <div key={card.title} className="analytics-card">
              <div className="h-full">
                <h2 className="mb-4 font-heading text-lg font-semibold text-black-50">
                  {card.title}
                </h2>
                <div className="h-64 md:h-72">{card.content}</div>
                {card.hint && (
                  <p className="mt-3 text-center text-sm text-black-300">{card.hint}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        {isAdmin && <TasteMatch />}
      </div>
    </div>
  );
}
