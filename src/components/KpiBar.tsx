import { useTitleStore } from '../store/titleStore'

interface KpiItemProps {
  label: string
  value: number | string
  color?: string
}

function KpiItem({ label, value, color = 'text-gray-100' }: KpiItemProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-xl font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
  )
}

export function KpiBar() {
  const { kpi, loading } = useTitleStore()

  if (loading || !kpi) {
    return (
      <div className="h-14 bg-surface-2 border-b border-border flex items-center px-6">
        <span className="text-xs text-gray-600 animate-pulse">Loading KPIs…</span>
      </div>
    )
  }

  return (
    <div className="bg-surface-2 border-b border-border px-6 py-3 flex items-center gap-8">
      <KpiItem label="Total Titles" value={kpi.total} />
      <div className="w-px h-8 bg-border" />
      <KpiItem label="Greenlit" value={kpi.greenlit} color="text-status-green" />
      <KpiItem label="Active Dev" value={kpi.active} color="text-status-dev" />
      <KpiItem label="In Development" value={kpi.development} color="text-blue-400" />
      <KpiItem label="Pitching" value={kpi.pitching} color="text-lemon-400" />
      <KpiItem label="On Hold" value={kpi.hold} color="text-status-hold" />
    </div>
  )
}
