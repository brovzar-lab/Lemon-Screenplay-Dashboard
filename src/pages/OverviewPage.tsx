import { useTitleStore } from '../store/titleStore'

const STATUS_COLOR: Record<string, string> = {
  greenlit:    'bg-status-green/15 text-status-green border-status-green/30',
  active:      'bg-status-dev/15 text-status-dev border-status-dev/30',
  development: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  hold:        'bg-status-hold/15 text-status-hold border-status-hold/30',
  killed:      'bg-status-kill/15 text-status-kill border-status-kill/30',
}

export function OverviewPage() {
  const { titles, loading } = useTitleStore()

  const recent = titles.slice(0, 8)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Studio Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Real-time view of all active and in-development titles</p>
      </div>

      {loading && (
        <p className="text-sm text-gray-600 animate-pulse">Loading titles…</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {recent.map(title => (
          <a
            key={title.id}
            href={`/titles/${title.id}`}
            className="block bg-surface-2 border border-border rounded-xl p-4 hover:border-lemon-500/40 hover:bg-surface-3 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h2 className="text-sm font-medium text-gray-100 group-hover:text-lemon-400 transition-colors line-clamp-1">
                {title.name}
              </h2>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[title.status] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                {title.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2 mb-3">{title.logline}</p>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>{title.platform}</span>
              <span>·</span>
              <span>{title.format.replace('_', ' ')}</span>
              <span>·</span>
              <span className="capitalize">{title.pipelineStage.replace(/_/g, ' ')}</span>
            </div>
          </a>
        ))}

        {!loading && titles.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-600 text-sm">
            No titles yet. Add data in Firestore to see them here.
          </div>
        )}
      </div>
    </div>
  )
}
