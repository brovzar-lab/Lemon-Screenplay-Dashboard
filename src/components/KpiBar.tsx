import { useTitleStore } from '../store/titleStore'
import { Skeleton } from './Skeleton'

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
      <div className="bg-surface-2 border-b border-border px-6 py-3 flex items-center gap-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="h-6 w-8" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-surface-2 border-b border-border px-6 py-3 flex items-center gap-8 overflow-x-auto">
      <KpiItem label="Active Titles" value={kpi.total} />
      <div className="w-px h-8 bg-border shrink-0" />
      <KpiItem label="Greenlit" value={kpi.greenlit} color="text-status-green" />
      <KpiItem label="Active Dev" value={kpi.active} color="text-status-dev" />
      <KpiItem label="In Development" value={kpi.development} color="text-blue-400" />
      <KpiItem label="Pitching" value={kpi.pitching} color="text-lemon-400" />
      <KpiItem label="On Hold" value={kpi.hold} color="text-status-hold" />
      {kpi.killed > 0 && (
        <>
          <div className="w-px h-8 bg-border shrink-0" />
          <KpiItem label="Killed" value={kpi.killed} color="text-status-kill" />
        </>
      )}
    </div>
  )
}
