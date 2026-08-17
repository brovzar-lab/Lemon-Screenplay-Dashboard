/**
 * ComparisonSideBySide Component
 * Side-by-side comparison of 2-3 screenplays
 */

import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { Screenplay } from '@/types';
import {
  getDimensionDisplay,
  hasPillarScores,
} from '@/lib/dimensionDisplay';

interface ComparisonSideBySideProps {
  screenplays: Screenplay[];
  onRemove: (id: string) => void;
}

export function ComparisonSideBySide({ screenplays, onRemove }: ComparisonSideBySideProps) {
  const { t } = useTranslation();
  const evidenceGroups = (['pillar', 'legacy'] as const).flatMap((kind) => {
    const reference = screenplays.find((screenplay) =>
      kind === 'pillar'
        ? hasPillarScores(screenplay)
        : !hasPillarScores(screenplay),
    );
    return reference
      ? [{
          kind,
          title: kind === 'pillar'
            ? 'Five-Pillar Reader Evidence'
            : 'Legacy Dimension Scores',
          dimensions: getDimensionDisplay(reference),
        }]
      : [];
  });

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
          <div className="text-sm font-medium text-black-500">{t('Screenplay')}</div>

          {/* Screenplay Headers */}
          {screenplays.map((sp) => (
            <div key={sp.id} className={clsx(
              'p-4 rounded-lg border transition-all',
              sp.isFilmNow ? 'border-black-600 bg-black-800/50' : 'border-black-700 bg-black-800/50'
            )}>
              <div className="flex items-start justify-between mb-2">
                <span className={clsx('px-2 py-0.5 rounded text-xs font-bold', getTierBadge(sp))}>
                  {t(getTierLabel(sp))}
                </span>
                <button
                  onClick={() => onRemove(sp.id)}
                  aria-label={t('Remove {{title}} from comparison', { title: sp.title })}
                  className="p-1 rounded hover:bg-black-700 text-black-500 hover:text-red-400"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h4 className="font-display text-lg leading-tight mb-1" style={{ color: 'var(--sp-text)' }}>{sp.title}</h4>
              <p className="text-xs text-black-400">{sp.author}</p>
              <p className="text-xs text-black-500 mt-1">{sp.genre}</p>
            </div>
          ))}
        </div>

        {/* Core Scores Section */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--sp-accent)' }}>{t('Core Scores')}</h4>

          {/* Final Score Row */}
          <MetricRow
            label={t('Final Score')}
            values={screenplays.map(sp => sp.weightedScore)}
            max={10}
            screenplays={screenplays}
          />

          {/* CVS Total Row */}
          <MetricRow
            label={t('CVS Total')}
            values={screenplays.map(sp => sp.cvsTotal)}
            max={18}
            screenplays={screenplays}
            formatValue={(v) => v.toFixed(0)}
          />
        </div>

        {/* Analysis evidence sections stay separate across engine generations. */}
        {evidenceGroups.map((group) => (
          <div key={group.kind} className="mb-6">
            <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--sp-accent)' }}>
              {t(group.title)}
            </h4>

            {group.dimensions.map((dimension) => (
              <MetricRow
                key={`${group.kind}:${dimension.key}`}
                label={t(dimension.label)}
                values={screenplays.map((screenplay) => {
                  const sameKind = group.kind === 'pillar'
                    ? hasPillarScores(screenplay)
                    : !hasPillarScores(screenplay);
                  if (!sameKind) return null;
                  return getDimensionDisplay(screenplay).find(
                    (item) => item.key === dimension.key,
                  )?.score ?? null;
                })}
                max={10}
                screenplays={screenplays}
              />
            ))}
          </div>
        ))}

        {/* AI Market Analysis Section */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--sp-accent)' }}>{t('AI Market Analysis')}</h4>

          <MetricRow
            label={t('Market Potential')}
            values={screenplays.map(sp => sp.producerMetrics.marketPotential ?? 0)}
            max={10}
            screenplays={screenplays}
          />
          {/* USP Strength is a string enum, display separately */}
          <div
            className="grid gap-4 items-center py-2 border-b border-black-800"
            style={{ gridTemplateColumns: `200px repeat(${screenplays.length}, 1fr)` }}
          >
            <div className="text-sm text-black-400">{t('USP Strength')}</div>
            {screenplays.map(sp => (
              <div key={sp.id} className="text-sm font-medium">
                <span className={clsx(
                  sp.producerMetrics.uspStrength === 'Strong' && 'text-emerald-400',
                  sp.producerMetrics.uspStrength === 'Moderate' && 'text-amber-400',
                  sp.producerMetrics.uspStrength === 'Weak' && 'text-red-400'
                )}>
                  {sp.producerMetrics.uspStrength ? t(sp.producerMetrics.uspStrength) : t('N/A')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Budget & Comparable Films */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--sp-accent)' }}>{t('Production')}</h4>

          <div className={`grid gap-4`} style={{ gridTemplateColumns: `200px repeat(${screenplays.length}, 1fr)` }}>
            {/* Budget Row */}
            <div className="text-sm text-black-400 py-2">{t('Budget Tier')}</div>
            {screenplays.map(sp => (
              <div key={sp.id} className="text-sm text-black-200 py-2">
                <span className="capitalize">{sp.budgetCategory}</span>
              </div>
            ))}

            {/* Comparable Films Row */}
            <div className="text-sm text-black-400 py-2">{t('Comparables')}</div>
            {screenplays.map(sp => (
              <div key={sp.id} className="text-xs text-black-300 py-2">
                {sp.comparableFilms.length > 0 ? (
                  <ul className="space-y-1">
                    {sp.comparableFilms.slice(0, 3).map((film, i) => (
                      <li key={i}>{film.title}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-black-500">{t('None listed')}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Key Strengths & Weaknesses */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--sp-accent)' }}>{t('Analysis')}</h4>

          <div className={`grid gap-4`} style={{ gridTemplateColumns: `200px repeat(${screenplays.length}, 1fr)` }}>
            {/* Strengths Row */}
            <div className="text-sm text-black-400 py-2">{t('Key Strengths')}</div>
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
            <div className="text-sm text-black-400 py-2">{t('Concerns')}</div>
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
            <div className="text-sm text-black-400 py-2">{t('Critical Failures')}</div>
            {screenplays.map(sp => (
              <div key={sp.id} className="text-xs py-2">
                {sp.criticalFailures.length > 0 ? (
                  <ul className="space-y-1">
                    {sp.criticalFailures.map((f, i) => (
                      <li key={i} className="text-red-400">⚠ {f}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-emerald-400">{t('None')}</span>
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
  values: Array<number | null>;
  max: number;
  screenplays: Screenplay[];
  formatValue?: (v: number) => string;
}

function MetricRow({ label, values, max, screenplays, formatValue = (v) => v.toFixed(1) }: MetricRowProps) {
  const { t } = useTranslation();
  const numericValues = values.flatMap((value) =>
    value === null ? [] : [value],
  );
  const highest = numericValues.length > 0 ? Math.max(...numericValues) : null;
  const lowest = numericValues.length > 0 ? Math.min(...numericValues) : null;
  const bestIndex = highest === null || highest === lowest
    ? -1
    : values.indexOf(highest);

  return (
    <div
      className={`grid gap-4 items-center py-2 border-b border-black-800`}
      style={{ gridTemplateColumns: `200px repeat(${screenplays.length}, 1fr)` }}
    >
      <div className="text-sm text-black-400">{label}</div>
      {values.map((value, index) => {
        if (value === null) {
          return (
            <div key={screenplays[index].id} className="text-sm text-black-500">
              {t('N/A')}
            </div>
          );
        }
        const pct = (value / max) * 100;
        const isBest = index === bestIndex;
        const scoreClass = pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400';

        return (
          <div key={screenplays[index].id} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={clsx('text-sm font-bold', scoreClass)}>
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
                  pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500'
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
