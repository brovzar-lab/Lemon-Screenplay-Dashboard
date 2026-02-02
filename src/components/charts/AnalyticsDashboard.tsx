/**
 * AnalyticsDashboard Component
 * Collapsible panel containing all analytics charts
 */

import { useState } from 'react';
import { ScoreDistribution } from './ScoreDistribution';
import { TierBreakdown } from './TierBreakdown';
import { GenreChart } from './GenreChart';
import { BudgetChart } from './BudgetChart';
import type { Screenplay, RecommendationTier, BudgetCategory } from '@/types';

interface AnalyticsDashboardProps {
  screenplays: Screenplay[];
  onFilterByScoreRange?: (range: { min: number; max: number }) => void;
  onFilterByTier?: (tier: RecommendationTier) => void;
  onFilterByGenre?: (genre: string) => void;
  onFilterByBudget?: (budget: BudgetCategory) => void;
}

export function AnalyticsDashboard({
  screenplays,
  onFilterByScoreRange,
  onFilterByTier,
  onFilterByGenre,
  onFilterByBudget,
}: AnalyticsDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Calculate quick stats
  const avgScore = screenplays.length > 0
    ? (screenplays.reduce((sum, sp) => sum + sp.weightedScore, 0) / screenplays.length).toFixed(1)
    : '0.0';
  const filmNowCount = screenplays.filter((sp) => sp.recommendation === 'film_now').length;
  const recommendCount = screenplays.filter((sp) => sp.recommendation === 'recommend').length;

  return (
    <div className="mb-6">
      {/* Header with toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 rounded-lg glass border border-black-700 hover:border-gold-500/50 transition-colors"
      >
        <div className="flex items-center gap-4">
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
            <span className="font-semibold text-white">Analytics Dashboard</span>
          </div>

          {/* Quick stats when collapsed */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-black-400">
              <span className="font-mono text-gold-400">{screenplays.length}</span> screenplays
            </span>
            <span className="text-black-500">|</span>
            <span className="text-black-400">
              Avg Score: <span className="font-mono text-emerald-400">{avgScore}</span>
            </span>
            <span className="text-black-500">|</span>
            <span className="text-black-400">
              <span className="font-mono text-gold-400">{filmNowCount}</span> FILM NOW
            </span>
            <span className="text-black-500">|</span>
            <span className="text-black-400">
              <span className="font-mono text-emerald-400">{recommendCount}</span> Recommend
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

      {/* Expandable content */}
      {isExpanded && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Score Distribution */}
          <div className="glass rounded-lg border border-black-700 p-4">
            <h3 className="text-sm font-medium text-black-300 mb-3">Score Distribution</h3>
            <div className="h-48">
              <ScoreDistribution
                screenplays={screenplays}
                onBarClick={onFilterByScoreRange}
              />
            </div>
            {onFilterByScoreRange && (
              <p className="text-xs text-black-500 mt-2 text-center">Click a bar to filter</p>
            )}
          </div>

          {/* Tier Breakdown */}
          <div className="glass rounded-lg border border-black-700 p-4">
            <h3 className="text-sm font-medium text-black-300 mb-3">Recommendation Tiers</h3>
            <div className="h-48">
              <TierBreakdown
                screenplays={screenplays}
                onTierClick={onFilterByTier}
              />
            </div>
            {onFilterByTier && (
              <p className="text-xs text-black-500 mt-2 text-center">Click to filter by tier</p>
            )}
          </div>

          {/* Genre Chart */}
          <div className="glass rounded-lg border border-black-700 p-4">
            <h3 className="text-sm font-medium text-black-300 mb-3">Top Genres</h3>
            <div className="h-48">
              <GenreChart
                screenplays={screenplays}
                maxGenres={6}
                onGenreClick={onFilterByGenre}
              />
            </div>
            {onFilterByGenre && (
              <p className="text-xs text-black-500 mt-2 text-center">Click to filter by genre</p>
            )}
          </div>

          {/* Budget Distribution */}
          <div className="glass rounded-lg border border-black-700 p-4">
            <h3 className="text-sm font-medium text-black-300 mb-3">Budget Tiers</h3>
            <div className="h-48">
              <BudgetChart
                screenplays={screenplays}
                onBudgetClick={onFilterByBudget}
              />
            </div>
            {onFilterByBudget && (
              <p className="text-xs text-black-500 mt-2 text-center">Click to filter by budget</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
