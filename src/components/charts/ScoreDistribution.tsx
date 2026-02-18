/**
 * ScoreDistribution Component
 * Bar chart showing weighted score distribution across all screenplays
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import type { Screenplay } from '@/types';

interface ScoreDistributionProps {
  screenplays: Screenplay[];
  onBarClick?: (range: { min: number; max: number }) => void;
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
  if (min >= 8) return '#F59E0B'; // Gold - excellent
  if (min >= 7) return '#10B981'; // Emerald - good
  if (min >= 5) return '#6B7280'; // Gray - average
  return '#EF4444'; // Red - poor
}

export function ScoreDistribution({ screenplays, onBarClick }: ScoreDistributionProps) {
  // Calculate distribution
  const data = SCORE_BINS.map((bin) => {
    const count = screenplays.filter(
      (sp) => sp.weightedScore >= bin.min && sp.weightedScore < bin.max
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="glass p-3 rounded-lg border border-black-700 text-sm">
          <p className="text-gold-400 font-medium mb-1">Score: {item.label}</p>
          <p className="text-white">
            <span className="font-mono font-bold">{item.count}</span> screenplays
          </p>
          <p className="text-black-400 text-xs">{item.percentage}% of total</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
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
