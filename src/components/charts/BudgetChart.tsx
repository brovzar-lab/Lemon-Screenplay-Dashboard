/**
 * BudgetChart Component
 * Horizontal stacked bar showing budget tier distribution
 */

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend } from 'recharts';

import type { Screenplay, BudgetCategory } from '@/types';
import { BUDGET_TIERS } from '@/types';
import { CHART_COLORS } from '@/lib/chartColors';

interface BudgetChartProps {
  screenplays: Screenplay[];
  onBudgetClick?: (budget: BudgetCategory) => void;
}

interface BudgetChartItem {
  budget: BudgetCategory;
  label: string;
  range: string;
  count: number;
  color: string;
  percentage: number | string;
}

// Budget colors - from low to high
const BUDGET_COLORS: Record<BudgetCategory, string> = {
  micro: CHART_COLORS.emerald, // Emerald - low risk
  low: CHART_COLORS.cyan, // Cyan
  medium: CHART_COLORS.gold, // Gold
  high: CHART_COLORS.red, // Red - high risk
  unknown: CHART_COLORS.gray, // Gray
};

interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: BudgetChartItem }>;
}

// Hoisted to module scope — avoids react-hooks/static-components violation
function CustomTooltip({ active, payload }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    const item = payload[0].payload as BudgetChartItem;
    return (
      <div className="chart-tooltip">
        <p className="font-medium mb-1" style={{ color: item.color }}>
          {item.label} <span className="text-black-400">({item.range})</span>
        </p>
        <p className="text-black-50">
          <span className="font-bold">{item.count}</span> screenplays
        </p>
        <p className="text-black-400 text-xs">{item.percentage}% of total</p>
      </div>
    );
  }
  return null;
}

interface CustomLegendProps {
  data: BudgetChartItem[];
  onBudgetClick?: (budget: BudgetCategory) => void;
}

function CustomLegend({ data, onBudgetClick }: CustomLegendProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-2">
      {data.map((item) => (
        <button
          key={item.budget}
          onClick={() => onBudgetClick?.(item.budget)}
          className="flex min-h-8 items-center gap-1.5 text-sm hover:opacity-80 transition-opacity"
        >
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-black-300">{item.label}</span>
          <span className="text-black-500">({item.count})</span>
        </button>
      ))}
    </div>
  );
}

export function BudgetChart({ screenplays, onBudgetClick }: BudgetChartProps) {
  // Count budget categories
  const budgetCounts = screenplays.reduce(
    (acc, sp) => {
      const budget = sp.budgetCategory || 'unknown';
      acc[budget] = (acc[budget] || 0) + 1;
      return acc;
    },
    {} as Record<BudgetCategory, number>,
  );

  // Create data for horizontal stacked bar
  const orderedBudgets: BudgetCategory[] = ['micro', 'low', 'medium', 'high'];

  const data: BudgetChartItem[] = orderedBudgets
    .filter((budget) => (budgetCounts[budget] || 0) > 0)
    .map((budget) => ({
      budget,
      label: BUDGET_TIERS[budget].label,
      range: BUDGET_TIERS[budget].range,
      count: budgetCounts[budget] || 0,
      color: BUDGET_COLORS[budget],
      percentage:
        screenplays.length > 0
          ? (((budgetCounts[budget] || 0) / screenplays.length) * 100).toFixed(0)
          : 0,
    }));

  if (data.length === 0) {
    return (
      <div className="chart-empty">
        Budget information has not been assessed for this selection.
      </div>
    );
  }

  return (
    <div className="h-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 10, left: 0, bottom: 30 }}
        >
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--sp-text-2)', fontSize: 13 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--sp-text-2)', fontSize: 13 }}
            width={90}
          />
          <Tooltip
            content={(props) => <CustomTooltip {...props} />}
            cursor={{ fill: 'var(--sp-surface-2)' }}
          />
          <Legend content={() => <CustomLegend data={data} onBudgetClick={onBudgetClick} />} />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            cursor={onBudgetClick ? 'pointer' : 'default'}
            onClick={(_, index) => {
              const item = data[index];
              if (item && onBudgetClick) onBudgetClick(item.budget);
            }}
          >
            {data.map((entry) => (
              <Cell key={entry.budget} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
