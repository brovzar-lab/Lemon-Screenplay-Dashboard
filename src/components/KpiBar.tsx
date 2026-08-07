import { useTitleStore } from '../store/titleStore'
import { Skeleton } from './Skeleton'

interface HeroMetricProps {
  value: string | number
  label: string
  sub?: string
  color?: string
}

function HeroMetric({ value, label, sub, color = 'text-gray-100' }: HeroMetricProps) {
  return (
    <div className="flex flex-col gap-0">
      <span className={`text-3xl font-bold tabular-nums leading-none ${color}`}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600 mt-1.5">{label}</span>
      {sub && <span className="text-[10px] text-gray-700 mt-0.5">{sub}</span>}
    </div>
  )
}

export function KpiBar() {
  const { kpi, loading } = useTitleStore()

  if (loading || !kpi) {
    return (
      <div className="bg-surface-2 border-b border-border px-6 py-3 flex items-center gap-12">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-2 w-20" />
          </div>
        ))}
      </div>
    )
  }

  const decisionsPending = kpi.pitching
  const activeProjects   = kpi.total - kpi.killed
  const healthPct = kpi.total > 0
    ? Math.round(((kpi.greenlit + kpi.active) / kpi.total) * 100)
    : 0
  const healthColor = healthPct >= 70 ? 'text-status-green' : healthPct >= 50 ? 'text-status-hold' : 'text-status-kill'

  return (
    <div className="bg-surface-2 border-b border-border px-6 py-3 flex items-center gap-12">
      <HeroMetric
        value={decisionsPending}
        label="Decisions Pending"
        sub="Needs your call"
        color={decisionsPending > 0 ? 'text-lemon-400' : 'text-gray-400'}
      />
      <div className="w-px h-10 bg-border shrink-0" />
      <HeroMetric
        value={activeProjects}
        label="Active Projects"
        sub={`${kpi.greenlit} greenlit · ${kpi.hold} on hold`}
        color="text-status-green"
      />
      <HeroMetric
        value="9 / 11"
        label="Agents Online"
        sub="9 working · 2 idle"
        color="text-status-dev"
      />
      <HeroMetric
        value={`${healthPct}%`}
        label="Pipeline Health"
        sub={`${kpi.active} active dev`}
        color={healthColor}
      />
      <div className="w-px h-10 bg-border shrink-0" />
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lemon-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-lemon-400" />
        </span>
        <span className="text-[10px] uppercase tracking-widest font-semibold text-lemon-400">Mission Control · Live</span>
      </div>
    </div>
  )
}
