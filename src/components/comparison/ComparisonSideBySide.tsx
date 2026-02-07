/**
 * ComparisonSideBySide Component
 * Side-by-side comparison of 2-3 screenplays
 */

import { clsx } from 'clsx';
import type { Screenplay } from '@/types';
import { getDimensionDisplay } from '@/lib/dimensionDisplay';

interface ComparisonSideBySideProps {
  screenplays: Screenplay[];
  onRemove: (id: string) => void;
}

export function ComparisonSideBySide({ screenplays, onRemove }: ComparisonSideBySideProps) {
  // Get tier badge style
  const getTierBadge = (sp: Screenplay) => {
    switch (sp.recommendation) {
      case 'film_now':
        return 'badge-film-now';
      case 'recommend':
        return 'badge-recommend';
      case 'consider':
        return 'badge-consider';
      case 'pass':
        return 'badge-pass';
      default:
        return 'bg-black-700';
    }
  };

  // Get tier label
  const getTierLabel = (sp: Screenplay) => {
    switch (sp.recommendation) {
      case 'film_now':
        return 'FILM NOW';
      case 'recommend':
        return 'RECOMMEND';
      case 'consider':
        return 'CONSIDER';
      case 'pass':
        return 'PASS';
      default:
        return sp.recommendation;
    }
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header Row - Screenplay Info */}
        <div className={`grid gap-4 mb-6`} style={{ gridTemplateColumns: `200px repeat(${screenplays.length}, 1fr)` }}>
          {/* Label Column */}
          <div className="text-sm font-medium text-black-500">Screenplay</div>

          {/* Screenplay Headers */}
          {screenplays.map((sp) => (
            <div key={sp.id} className={clsx(
              'p-4 rounded-lg border transition-all',
              sp.isFilmNow ? 'border-gold-500 bg-gold-500/10' : 'border-black-700 bg-black-800/50'
            )}>
              <div className="flex items-start justify-between mb-2">
                <span className={clsx('px-2 py-0.5 rounded text-xs font-bold', getTierBadge(sp))}>
                  {getTierLabel(sp)}
                </span>
                <button
                  onClick={() => onRemove(sp.id)}
                  className="p-1 rounded hover:bg-black-700 text-black-500 hover:text-red-400"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h4 className="font-display text-lg text-gold-200 leading-tight mb-1">{sp.title}</h4>
              <p className="text-xs text-black-400">{sp.author}</p>
              <p className="text-xs text-black-500 mt-1">{sp.genre}</p>
            </div>
          ))}
        </div>

        {/* Core Scores Section */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gold-400 mb-3">Core Scores</h4>

          {/* Weighted Score Row */}
          <MetricRow
            label="Weighted Score"
            values={screenplays.map(sp => sp.weightedScore)}
            max={10}
            screenplays={screenplays}
          />

          {/* CVS Total Row */}
          <MetricRow
            label="CVS Total"
            values={screenplays.map(sp => sp.cvsTotal)}
            max={18}
            screenplays={screenplays}
            formatValue={(v) => v.toFixed(0)}
          />
        </div>

        {/* Dimension Scores Section — uses version-appropriate labels */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gold-400 mb-3">Dimension Scores</h4>

          {getDimensionDisplay(screenplays[0]).map((dim, idx) => (
            <MetricRow
              key={dim.key}
              label={dim.label}
              values={screenplays.map(sp => getDimensionDisplay(sp)[idx]?.score ?? 0)}
              max={10}
              screenplays={screenplays}
            />
          ))}
        </div>

        {/* Producer Metrics Section */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gold-400 mb-3">Producer Metrics</h4>

          <MetricRow
            label="Market Potential"
            values={screenplays.map(sp => sp.producerMetrics.marketPotential)}
            max={10}
            screenplays={screenplays}
          />
          <MetricRow
            label="ROI Indicator"
            values={screenplays.map(sp => sp.producerMetrics.roiIndicator)}
            max={5}
            screenplays={screenplays}
          />
          <MetricRow
            label="Star Vehicle"
            values={screenplays.map(sp => sp.producerMetrics.starVehiclePotential)}
            max={10}
            screenplays={screenplays}
          />
          <MetricRow
            label="Festival Appeal"
            values={screenplays.map(sp => sp.producerMetrics.festivalAppeal)}
            max={10}
            screenplays={screenplays}
          />
{/* USP Strength is a string enum, display separately */}
          <div
            className="grid gap-4 items-center py-2 border-b border-black-800"
            style={{ gridTemplateColumns: `200px repeat(${screenplays.length}, 1fr)` }}
          >
            <div className="text-sm text-black-400">USP Strength</div>
            {screenplays.map(sp => (
              <div key={sp.id} className="text-sm font-medium">
                <span className={clsx(
                  sp.producerMetrics.uspStrength === 'Strong' && 'text-emerald-400',
                  sp.producerMetrics.uspStrength === 'Moderate' && 'text-gold-400',
                  sp.producerMetrics.uspStrength === 'Weak' && 'text-red-400'
                )}>
                  {sp.producerMetrics.uspStrength}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Budget & Comparable Films */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gold-400 mb-3">Production</h4>

          <div className={`grid gap-4`} style={{ gridTemplateColumns: `200px repeat(${screenplays.length}, 1fr)` }}>
            {/* Budget Row */}
            <div className="text-sm text-black-400 py-2">Budget Tier</div>
            {screenplays.map(sp => (
              <div key={sp.id} className="text-sm text-black-200 py-2">
                <span className="capitalize">{sp.budgetCategory}</span>
              </div>
            ))}

            {/* Comparable Films Row */}
            <div className="text-sm text-black-400 py-2">Comparables</div>
            {screenplays.map(sp => (
              <div key={sp.id} className="text-xs text-black-300 py-2">
                {sp.comparableFilms.length > 0 ? (
                  <ul className="space-y-1">
                    {sp.comparableFilms.slice(0, 3).map((film, i) => (
                      <li key={i}>{film.title}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-black-500">None listed</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Key Strengths & Weaknesses */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gold-400 mb-3">Analysis</h4>

          <div className={`grid gap-4`} style={{ gridTemplateColumns: `200px repeat(${screenplays.length}, 1fr)` }}>
            {/* Strengths Row */}
            <div className="text-sm text-black-400 py-2">Key Strengths</div>
            {screenplays.map(sp => (
              <div key={sp.id} className="text-xs py-2">
                <ul className="space-y-1">
                  {sp.strengths.slice(0, 3).map((s, i) => (
                    <li key={i} className="text-emerald-400">• {s}</li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Weaknesses Row */}
            <div className="text-sm text-black-400 py-2">Concerns</div>
            {screenplays.map(sp => (
              <div key={sp.id} className="text-xs py-2">
                <ul className="space-y-1">
                  {sp.weaknesses.slice(0, 3).map((w, i) => (
                    <li key={i} className="text-amber-400">• {w}</li>
                  ))}
                </ul>
              </div>
            ))}

            {/* Critical Failures */}
            <div className="text-sm text-black-400 py-2">Critical Failures</div>
            {screenplays.map(sp => (
              <div key={sp.id} className="text-xs py-2">
                {sp.criticalFailures.length > 0 ? (
                  <ul className="space-y-1">
                    {sp.criticalFailures.map((f, i) => (
                      <li key={i} className="text-red-400">⚠ {f}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-emerald-400">None</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Metric Row Component
interface MetricRowProps {
  label: string;
  values: number[];
  max: number;
  screenplays: Screenplay[];
  formatValue?: (v: number) => string;
}

function MetricRow({ label, values, max, screenplays, formatValue = (v) => v.toFixed(1) }: MetricRowProps) {
  const bestIndex = Math.max(...values) === Math.min(...values) ? -1 : values.indexOf(Math.max(...values));

  return (
    <div
      className={`grid gap-4 items-center py-2 border-b border-black-800`}
      style={{ gridTemplateColumns: `200px repeat(${screenplays.length}, 1fr)` }}
    >
      <div className="text-sm text-black-400">{label}</div>
      {values.map((value, index) => {
        const pct = (value / max) * 100;
        const isBest = index === bestIndex;
        const scoreClass = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-gold-400' : 'text-red-400';

        return (
          <div key={screenplays[index].id} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={clsx('font-mono text-sm font-bold', scoreClass)}>
                {formatValue(value)}
              </span>
              {isBest && (
                <span className="text-xs text-emerald-400">★</span>
              )}
            </div>
            <div className="h-1.5 bg-black-800 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-gold-500' : 'bg-red-500'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ComparisonSideBySide;
