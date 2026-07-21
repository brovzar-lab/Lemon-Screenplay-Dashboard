/**
 * GenreChart Component
 * Horizontal bar chart showing top genres
 */

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

import type { Screenplay } from '@/types';
import { canonicalizeGenre } from '@/lib/calculations';
import { CHART_COLORS } from '@/lib/chartColors';

interface GenreChartProps {
  screenplays: Screenplay[];
  maxGenres?: number;
  onGenreClick?: (genre: string) => void;
}

interface GenreChartItem {
  genre: string;
  displayGenre: string;
  count: number;
  color: string;
  percentage: number | string;
}

// Genre colors - rotating palette
const GENRE_COLORS = [
  CHART_COLORS.gold,
  CHART_COLORS.emerald,
  CHART_COLORS.violet,
  CHART_COLORS.pink,
  CHART_COLORS.cyan,
  CHART_COLORS.orange,
  CHART_COLORS.indigo,
  CHART_COLORS.teal,
];

interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: GenreChartItem }>;
}

// Hoisted to module scope — avoids react-hooks/static-components violation
function CustomTooltip({ active, payload }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0].payload as GenreChartItem;
    return (
      <div className="chart-tooltip">
        <p className="font-medium mb-1">{item.genre}</p>
        <p className="text-black-50">
          <span className="font-bold">{item.count}</span> screenplays
        </p>
        <p className="text-black-400 text-xs">{item.percentage}% of total</p>
      </div>
    );
  }
  return null;
}

export function GenreChart({ screenplays, maxGenres = 8, onGenreClick }: GenreChartProps) {
  // Count genres (canonicalize so "Sci-Fi" and "Science Fiction" merge)
  const genreDisplayMap = new Map<string, string>(); // canonical → first display name
  const genreCounts: Record<string, number> = {};
  screenplays.forEach((sp) => {
    const raw = sp.genre || 'Unknown';
    const canonical = canonicalizeGenre(raw);
    if (!genreDisplayMap.has(canonical)) genreDisplayMap.set(canonical, raw);
    const display = genreDisplayMap.get(canonical)!;
    genreCounts[display] = (genreCounts[display] || 0) + 1;
  });

  // Sort by count and take top N
  const data: GenreChartItem[] = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxGenres)
    .map(([genre, count], index) => ({
      genre,
      displayGenre: genre.length > 30 ? `${genre.slice(0, 28)}…` : genre,
      count,
      color: GENRE_COLORS[index % GENRE_COLORS.length],
      percentage: screenplays.length > 0 ? ((count / screenplays.length) * 100).toFixed(0) : 0,
    }));

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--sp-text-2)', fontSize: 13 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="displayGenre"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--sp-text-2)', fontSize: 13 }}
            width={190}
          />
          <Tooltip
            content={(props) => <CustomTooltip {...props} />}
            cursor={{ fill: 'var(--sp-surface-2)' }}
          />
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
