/**
 * BudgetChart Component
 * Horizontal stacked bar showing budget tier distribution
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend,
} from 'recharts';
import type { Screenplay, BudgetCategory } from '@/types';
import { BUDGET_TIERS } from '@/types';

interface BudgetChartProps {
  screenplays: Screenplay[];
  onBudgetClick?: (budget: BudgetCategory) => void;
}

// Budget colors - from low to high
const BUDGET_COLORS: Record<BudgetCategory, string> = {
  micro: '#10B981',  // Emerald - low risk
  low: '#06B6D4',    // Cyan
  medium: '#F59E0B', // Gold
  high: '#EF4444',   // Red - high risk
  unknown: '#6B7280', // Gray
};

export function BudgetChart({ screenplays, onBudgetClick }: BudgetChartProps) {
  // Count budget categories
  const budgetCounts = screenplays.reduce(
    (acc, sp) => {
      const budget = sp.budgetCategory || 'unknown';
      acc[budget] = (acc[budget] || 0) + 1;
      return acc;
    },
    {} as Record<BudgetCategory, number>
  );

  // Create data for horizontal stacked bar
  const orderedBudgets: BudgetCategory[] = ['micro', 'low', 'medium', 'high'];

  const data = orderedBudgets
    .filter((budget) => (budgetCounts[budget] || 0) > 0)
    .map((budget) => ({
      budget,
      label: BUDGET_TIERS[budget].label,
      range: BUDGET_TIERS[budget].range,
      count: budgetCounts[budget] || 0,
      color: BUDGET_COLORS[budget],
      percentage: screenplays.length > 0
        ? ((budgetCounts[budget] || 0) / screenplays.length * 100).toFixed(0)
        : 0,
    }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="glass p-3 rounded-lg border border-black-700 text-sm">
          <p className="font-medium mb-1" style={{ color: item.color }}>
            {item.label} <span className="text-black-400">({item.range})</span>
          </p>
          <p className="text-white">
            <span className="font-mono font-bold">{item.count}</span> screenplays
          </p>
          <p className="text-black-400 text-xs">{item.percentage}% of total</p>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const CustomLegend = () => (
    <div className="flex flex-wrap justify-center gap-3 mt-2">
      {data.map((item) => (
        <button
          key={item.budget}
          onClick={() => onBudgetClick?.(item.budget)}
          className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-black-300">{item.label}</span>
          <span className="text-black-500">({item.count})</span>
        </button>
      ))}
    </div>
  );

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
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Legend content={<CustomLegend />} />
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
