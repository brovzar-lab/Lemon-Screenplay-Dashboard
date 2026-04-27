export function PipelinePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Development Pipeline</h1>
        <p className="text-sm text-gray-500 mt-0.5">Kanban from IP scouting to greenlight</p>
      </div>
      <div className="bg-surface-2 border border-border rounded-xl p-12 flex flex-col items-center gap-3">
        <span className="text-4xl opacity-30">⊞</span>
        <p className="text-sm font-medium text-gray-400">Pipeline Kanban coming soon</p>
        <p className="text-xs text-gray-600 text-center max-w-xs">
          Titles grouped by stage — IP scouting through greenlight — with owners and blockers visible at a glance.
        </p>
      </div>
    </div>
  )
}
