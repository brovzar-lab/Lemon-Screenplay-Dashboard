import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_COLORS } from '@/lib/chartColors';
import { getScreenplayFormatInfo } from '@/lib/screenplayDisplay';
import type { Screenplay } from '@/types';

interface FormatChartProps {
  screenplays: Screenplay[];
}

interface FormatChartItem {
  format: string;
  count: number;
  color: string;
}

const FORMAT_COLORS = [
  CHART_COLORS.dataBlue,
  CHART_COLORS.dataTeal,
  CHART_COLORS.dataViolet,
  CHART_COLORS.dataCoral,
];

function shortFormatLabel(value: string): string {
  return value
    .replace('Feature Film', 'Feature')
    .replace('Television Pilot', 'TV Pilot')
    .replace('Format not recorded', 'Not recorded');
}

function FormatTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: FormatChartItem }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{item.format}</strong>
      <span>
        {item.count} screenplay{item.count === 1 ? '' : 's'}
      </span>
    </div>
  );
}

export function FormatChart({ screenplays }: FormatChartProps) {
  const counts = screenplays.reduce<Record<string, number>>((accumulator, screenplay) => {
    const format = shortFormatLabel(getScreenplayFormatInfo(screenplay).format);
    accumulator[format] = (accumulator[format] ?? 0) + 1;
    return accumulator;
  }, {});
  const data: FormatChartItem[] = Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([format, count], index) => ({
      format,
      count,
      color: FORMAT_COLORS[index % FORMAT_COLORS.length],
    }));

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: 2, bottom: 5 }}>
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="format"
            axisLine={false}
            tickLine={false}
            width={82}
            tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
          />
          <Tooltip
            content={(props) => <FormatTooltip {...props} />}
            cursor={{ fill: 'var(--chart-cursor)' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.format} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
