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
  filterGenre: string;
  count: number;
  color: string;
  percentage: number | string;
}

// Genre colors - rotating palette
const GENRE_COLORS = [
  CHART_COLORS.dataBlue,
  CHART_COLORS.dataTeal,
  CHART_COLORS.dataViolet,
  CHART_COLORS.dataCoral,
];

const GENRE_FAMILIES = [
  'Horror',
  'Drama',
  'Comedy',
  'Thriller',
  'Action',
  'Romance',
  'Science Fiction',
  'Fantasy',
  'Western',
  'Crime',
  'Family',
] as const;

function conciseGenre(value: string): string {
  const canonical = canonicalizeGenre(value);
  const family = GENRE_FAMILIES.find((candidate) =>
    canonical.toLowerCase().includes(candidate.toLowerCase()),
  );
  if (family) return family === 'Science Fiction' ? 'Sci-Fi' : family;
  const first = value.split(/\s*\/\s*|\s*·\s*|,\s*/)[0]?.trim() || 'Unknown';
  return first.length > 17 ? `${first.slice(0, 16)}…` : first;
}

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
        <strong>{item.genre}</strong>
        <span>
          <span className="font-bold">{item.count}</span> screenplays
        </span>
        <span>{item.percentage}% of total</span>
      </div>
    );
  }
  return null;
}

export function GenreChart({ screenplays, maxGenres = 8, onGenreClick }: GenreChartProps) {
  // Count genres (canonicalize so "Sci-Fi" and "Science Fiction" merge)
  const genreCounts = new Map<string, { count: number; filterGenre: string }>();
  screenplays.forEach((sp) => {
    const raw = sp.genre || 'Unknown';
    const display = conciseGenre(raw);
    const current = genreCounts.get(display);
    genreCounts.set(display, {
      count: (current?.count ?? 0) + 1,
      filterGenre: current?.filterGenre ?? raw,
    });
  });

  // Sort by count and take top N
  const data: GenreChartItem[] = Array.from(genreCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxGenres)
    .map(([genre, entry], index) => ({
      genre,
      filterGenre: entry.filterGenre,
      count: entry.count,
      color: GENRE_COLORS[index % GENRE_COLORS.length],
      percentage:
        screenplays.length > 0 ? ((entry.count / screenplays.length) * 100).toFixed(0) : 0,
    }));

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="genre"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
            width={82}
          />
          <Tooltip
            content={(props) => <CustomTooltip {...props} />}
            cursor={{ fill: 'var(--chart-cursor)' }}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            cursor={onGenreClick ? 'pointer' : 'default'}
            onClick={(_, index) => {
              const item = data[index];
              if (item && onGenreClick) onGenreClick(item.filterGenre);
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
