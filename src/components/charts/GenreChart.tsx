/**
 * GenreChart Component
 * Horizontal bar chart showing top genres
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

interface GenreChartProps {
  screenplays: Screenplay[];
  maxGenres?: number;
  onGenreClick?: (genre: string) => void;
}

// Genre colors - rotating palette
const GENRE_COLORS = [
  '#F59E0B', // Gold
  '#10B981', // Emerald
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#14B8A6', // Teal
];

export function GenreChart({ screenplays, maxGenres = 8, onGenreClick }: GenreChartProps) {
  // Count genres
  const genreCounts = screenplays.reduce(
    (acc, sp) => {
      const genre = sp.genre || 'Unknown';
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Sort by count and take top N
  const data = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxGenres)
    .map(([genre, count], index) => ({
      genre,
      count,
      color: GENRE_COLORS[index % GENRE_COLORS.length],
      percentage: screenplays.length > 0 ? ((count / screenplays.length) * 100).toFixed(0) : 0,
    }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="glass p-3 rounded-lg border border-black-700 text-sm">
          <p className="text-gold-400 font-medium mb-1">{item.genre}</p>
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
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
        >
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="genre"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            width={90}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            cursor={onGenreClick ? 'pointer' : 'default'}
            onClick={(_, index) => {
              const item = data[index];
              if (item && onGenreClick) onGenreClick(item.genre);
            }}
          >
            {data.map((entry) => (
              <Cell key={entry.genre} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
