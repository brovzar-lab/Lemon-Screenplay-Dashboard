/**
 * ComparisonRadar Component
 * Radar chart overlay comparing dimension scores
 */

import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';
import type { Screenplay } from '@/types';

interface ComparisonRadarProps {
  screenplays: Screenplay[];
  onRemove: (id: string) => void;
}

// Colors for each screenplay line
const COLORS = [
  { stroke: '#F59E0B', fill: 'rgba(245, 158, 11, 0.2)' }, // Gold
  { stroke: '#10B981', fill: 'rgba(16, 185, 129, 0.2)' }, // Emerald
  { stroke: '#8B5CF6', fill: 'rgba(139, 92, 246, 0.2)' }, // Violet
];

export function ComparisonRadar({ screenplays, onRemove }: ComparisonRadarProps) {
  // Transform data for Recharts radar
  const radarData = [
    {
      dimension: 'Concept',
      fullMark: 10,
      ...Object.fromEntries(screenplays.map((sp) => [sp.id, sp.dimensionScores.concept])),
    },
    {
      dimension: 'Structure',
      fullMark: 10,
      ...Object.fromEntries(screenplays.map((sp) => [sp.id, sp.dimensionScores.structure])),
    },
    {
      dimension: 'Protagonist',
      fullMark: 10,
      ...Object.fromEntries(screenplays.map((sp) => [sp.id, sp.dimensionScores.protagonist])),
    },
    {
      dimension: 'Supporting',
      fullMark: 10,
      ...Object.fromEntries(screenplays.map((sp) => [sp.id, sp.dimensionScores.supportingCast])),
    },
    {
      dimension: 'Dialogue',
      fullMark: 10,
      ...Object.fromEntries(screenplays.map((sp) => [sp.id, sp.dimensionScores.dialogue])),
    },
    {
      dimension: 'Genre Exec',
      fullMark: 10,
      ...Object.fromEntries(screenplays.map((sp) => [sp.id, sp.dimensionScores.genreExecution])),
    },
    {
      dimension: 'Originality',
      fullMark: 10,
      ...Object.fromEntries(screenplays.map((sp) => [sp.id, sp.dimensionScores.originality])),
    },
  ];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass p-3 rounded-lg border border-black-700 min-w-[150px]">
          <p className="text-xs text-gold-400 font-medium mb-2">{label}</p>
          {payload.map((entry: any) => {
            const sp = screenplays.find((s) => s.id === entry.dataKey);
            return (
              <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-xs">
                <span style={{ color: entry.stroke }}>{sp?.title || entry.dataKey}</span>
                <span className="font-mono font-bold" style={{ color: entry.stroke }}>
                  {entry.value?.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Selected Screenplays Legend */}
      <div className="flex flex-wrap gap-3 justify-center">
        {screenplays.map((sp, index) => (
          <div
            key={sp.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-black-700 bg-black-800/50"
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS[index]?.stroke || '#888' }}
            />
            <span className="text-sm text-black-200">{sp.title}</span>
            <span className="text-xs text-black-500">({sp.weightedScore.toFixed(1)})</span>
            <button
              onClick={() => onRemove(sp.id)}
              className="p-0.5 rounded hover:bg-black-700 text-black-500 hover:text-red-400 ml-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Radar Chart */}
      <div className="h-[500px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid
              stroke="rgba(100, 116, 139, 0.3)"
              strokeDasharray="3 3"
            />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              tickLine={{ stroke: 'rgba(100, 116, 139, 0.5)' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 10]}
              tick={{ fill: '#64748B', fontSize: 10 }}
              tickCount={6}
              axisLine={{ stroke: 'rgba(100, 116, 139, 0.3)' }}
            />

            {screenplays.map((sp, index) => (
              <Radar
                key={sp.id}
                name={sp.title}
                dataKey={sp.id}
                stroke={COLORS[index]?.stroke || '#888'}
                fill={COLORS[index]?.fill || 'rgba(136, 136, 136, 0.2)'}
                strokeWidth={2}
                dot={{
                  r: 4,
                  fill: COLORS[index]?.stroke || '#888',
                  strokeWidth: 0,
                }}
                activeDot={{
                  r: 6,
                  fill: COLORS[index]?.stroke || '#888',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            ))}

            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score Comparison Table */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {screenplays.map((sp, index) => (
          <div
            key={sp.id}
            className="p-4 rounded-lg border border-black-700 bg-black-800/50"
            style={{ borderLeftColor: COLORS[index]?.stroke, borderLeftWidth: 3 }}
          >
            <h4 className="font-display text-lg text-gold-200 mb-2">{sp.title}</h4>
            <p className="text-xs text-black-400 mb-3">{sp.author}</p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-black-400">Weighted:</span>
                <span className="font-mono font-bold text-gold-400">{sp.weightedScore.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black-400">CVS:</span>
                <span className="font-mono font-bold text-gold-400">{sp.cvsTotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black-400">Market:</span>
                <span className="font-mono font-bold text-gold-400">{sp.producerMetrics.marketPotential.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-black-400">ROI:</span>
                <span className="font-mono font-bold text-gold-400">{sp.producerMetrics.roiIndicator.toFixed(1)}</span>
              </div>
            </div>

            {/* Dimension Averages */}
            <div className="mt-3 pt-3 border-t border-black-700">
              <div className="text-xs text-black-500">
                Avg Dimension Score:{' '}
                <span className="font-mono text-gold-400">
                  {(Object.values(sp.dimensionScores).reduce((a, b) => a + b, 0) / 7).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dimension Breakdown Table */}
      <div className="border border-black-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-black-800">
            <tr>
              <th className="px-4 py-3 text-left text-black-400 font-medium">Dimension</th>
              {screenplays.map((sp, index) => (
                <th key={sp.id} className="px-4 py-3 text-center font-medium" style={{ color: COLORS[index]?.stroke }}>
                  {sp.title.length > 15 ? sp.title.slice(0, 15) + '...' : sp.title}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-black-500 font-medium">Winner</th>
            </tr>
          </thead>
          <tbody>
            {[
              { key: 'concept', label: 'Concept' },
              { key: 'structure', label: 'Structure' },
              { key: 'protagonist', label: 'Protagonist' },
              { key: 'supportingCast', label: 'Supporting Cast' },
              { key: 'dialogue', label: 'Dialogue' },
              { key: 'genreExecution', label: 'Genre Execution' },
              { key: 'originality', label: 'Originality' },
            ].map(({ key, label }) => {
              const scores = screenplays.map((sp) => sp.dimensionScores[key as keyof typeof sp.dimensionScores]);
              const maxScore = Math.max(...scores);
              const winnerIndex = scores.indexOf(maxScore);
              const isTie = scores.filter((s) => s === maxScore).length > 1;

              return (
                <tr key={key} className="border-t border-black-800">
                  <td className="px-4 py-3 text-black-300">{label}</td>
                  {scores.map((score, index) => (
                    <td
                      key={screenplays[index].id}
                      className={`px-4 py-3 text-center font-mono font-bold ${
                        score === maxScore ? 'text-emerald-400' : 'text-black-300'
                      }`}
                    >
                      {score.toFixed(1)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    {isTie ? (
                      <span className="text-black-500 text-xs">Tie</span>
                    ) : (
                      <span style={{ color: COLORS[winnerIndex]?.stroke }} className="text-xs font-medium">
                        {screenplays[winnerIndex]?.title?.slice(0, 10)}...
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ComparisonRadar;
