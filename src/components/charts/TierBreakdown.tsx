/**
 * TierBreakdown Component
 * Donut chart showing recommendation tier distribution
 */

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import type { Screenplay, RecommendationTier } from '@/types';

interface TierBreakdownProps {
  screenplays: Screenplay[];
  onTierClick?: (tier: RecommendationTier) => void;
}

// Tier colors matching the design system
const TIER_CONFIG: Record<RecommendationTier, { label: string; color: string }> = {
  film_now: { label: 'FILM NOW', color: '#F59E0B' },
  recommend: { label: 'Recommend', color: '#10B981' },
  consider: { label: 'Consider', color: '#6B7280' },
  pass: { label: 'Pass', color: '#EF4444' },
};

export function TierBreakdown({ screenplays, onTierClick }: TierBreakdownProps) {
  // Calculate tier distribution
  const tierCounts = screenplays.reduce(
    (acc, sp) => {
      acc[sp.recommendation] = (acc[sp.recommendation] || 0) + 1;
      return acc;
    },
    {} as Record<RecommendationTier, number>
  );

  const data = (Object.entries(TIER_CONFIG) as [RecommendationTier, typeof TIER_CONFIG.film_now][])
    .map(([tier, config]) => ({
      tier,
      name: config.label,
      value: tierCounts[tier] || 0,
      color: config.color,
      percentage: screenplays.length > 0
        ? ((tierCounts[tier] || 0) / screenplays.length * 100).toFixed(0)
        : 0,
    }))
    .filter((d) => d.value > 0);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="glass p-3 rounded-lg border border-black-700 text-sm">
          <p className="font-medium mb-1" style={{ color: item.color }}>
            {item.name}
          </p>
          <p className="text-white">
            <span className="font-mono font-bold">{item.value}</span> screenplays
          </p>
          <p className="text-black-400 text-xs">{item.percentage}% of total</p>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const CustomLegend = ({ payload }: any) => (
    <div className="flex flex-wrap justify-center gap-3 mt-2">
      {payload?.map((entry: any) => (
        <button
          key={entry.value}
          onClick={() => {
            const item = data.find((d) => d.name === entry.value);
            if (item && onTierClick) onTierClick(item.tier);
          }}
          className="flex items-center gap-1.5 text-xs hover:opacity-80 transition-opacity"
        >
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-black-300">{entry.value}</span>
        </button>
      ))}
    </div>
  );

  // Center label showing total
  const total = screenplays.length;

  return (
    <div className="h-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            dataKey="value"
            cursor={onTierClick ? 'pointer' : 'default'}
            onClick={(_, index) => {
              const item = data[index];
              if (item && onTierClick) onTierClick(item.tier);
            }}
          >
            {data.map((entry) => (
              <Cell key={entry.tier} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center total label */}
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <p className="text-2xl font-bold text-white font-mono">{total}</p>
        <p className="text-xs text-black-400">Total</p>
      </div>
    </div>
  );
}
