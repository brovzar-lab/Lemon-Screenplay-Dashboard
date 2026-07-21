/**
 * ScoreDistribution Component
 * Bar chart showing weighted score distribution across all screenplays
 */

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

import type { Screenplay } from '@/types';
import { CHART_COLORS } from '@/lib/chartColors';

interface ScoreDistributionProps {
  screenplays: Screenplay[];
  onBarClick?: (range: { min: number; max: number }) => void;
}

interface ScoreBinItem {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number | string;
}

// Score ranges for histogram bins
const SCORE_BINS = [
  { label: '0-2', min: 0, max: 2 },
  { label: '2-4', min: 2, max: 4 },
  { label: '4-5', min: 4, max: 5 },
  { label: '5-6', min: 5, max: 6 },
  { label: '6-7', min: 6, max: 7 },
  { label: '7-8', min: 7, max: 8 },
  { label: '8-9', min: 8, max: 9 },
  { label: '9-10', min: 9, max: 10 },
];

// Color based on score quality
function getBarColor(min: number): string {
  if (min >= 8) return CHART_COLORS.gold; // Gold - excellent
  if (min >= 7) return CHART_COLORS.emerald; // Emerald - good
  if (min >= 5) return CHART_COLORS.gray; // Gray - average
  return CHART_COLORS.red; // Red - poor
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: ScoreBinItem }>;
}

// Hoisted to module scope — avoids react-hooks/static-components violation
function CustomTooltip({ active, payload }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0].payload as ScoreBinItem;
    return (
      <div className="chart-tooltip">
        <p className="font-medium mb-1">Score: {item.label}</p>
        <p className="text-black-50">
          <span className="font-bold">{item.count}</span> screenplays
        </p>
        <p className="text-black-400 text-xs">{item.percentage}% of total</p>
      </div>
    );
  }
  return null;
}

export function ScoreDistribution({ screenplays, onBarClick }: ScoreDistributionProps) {
  // Calculate distribution
  const data: ScoreBinItem[] = SCORE_BINS.map((bin) => {
    const count = screenplays.filter(
      (sp) => sp.weightedScore >= bin.min && sp.weightedScore < bin.max,
    ).length;
    return {
      ...bin,
      count,
      percentage: screenplays.length > 0 ? ((count / screenplays.length) * 100).toFixed(0) : 0,
    };
  });

  // Handle edge case for score exactly 10
  const perfectScores = screenplays.filter((sp) => sp.weightedScore === 10).length;
  if (perfectScores > 0) {
    data[data.length - 1].count += perfectScores;
  }

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={data} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--sp-text-2)', fontSize: 13 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--sp-text-2)', fontSize: 13 }}
            allowDecimals={false}
          />
          <Tooltip
            content={(props) => <CustomTooltip {...props} />}
            cursor={{ fill: 'var(--sp-surface-2)' }}
          />
          <Bar
            dataKey="count"
            radius={[4, 4, 0, 0]}
            cursor={onBarClick ? 'pointer' : 'default'}
            onClick={(_, index) => {
              const bin = data[index];
              if (bin && onBarClick) onBarClick({ min: bin.min, max: bin.max });
            }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.min)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
