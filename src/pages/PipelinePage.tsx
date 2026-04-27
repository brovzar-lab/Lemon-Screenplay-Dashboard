import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTitleStore } from '../store/titleStore'
import type { PipelineStage } from '../types'

const COLUMNS: { stage: PipelineStage; label: string }[] = [
  { stage: 'ip_scouting',  label: 'IP Scouting' },
  { stage: 'optioned',     label: 'Optioned' },
  { stage: 'treatment',    label: 'Treatment' },
  { stage: 'pilot_script', label: 'Pilot Script' },
  { stage: 'series_bible', label: 'Series Bible' },
  { stage: 'pitch_ready',  label: 'Pitch Ready' },
  { stage: 'pitched',      label: 'Pitched' },
  { stage: 'negotiation',  label: 'Negotiation' },
  { stage: 'greenlit',     label: 'Greenlit' },
]

const VERDICT_COLOR: Record<string, string> = {
  recommend: 'bg-status-green/15 text-status-green border-status-green/30',
  consider:  'bg-lemon-500/15 text-lemon-400 border-lemon-500/30',
  pass:      'bg-status-kill/15 text-status-kill border-status-kill/30',
  pending:   'bg-gray-600/20 text-gray-400 border-gray-600/30',
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export function PipelinePage() {
  const { titles, loading } = useTitleStore()

  const [filterGenre, setFilterGenre]   = useState<string>('all')
  const [filterOwner, setFilterOwner]   = useState<string>('all')
  const [filterStage, setFilterStage]   = useState<PipelineStage | 'all'>('all')

  const genres = useMemo(() => {
    const all = titles.flatMap(t => t.genre)
    return Array.from(new Set(all)).sort()
  }, [titles])

  const owners = useMemo(() => {
    const all = titles.map(t => t.owner).filter(Boolean)
    return Array.from(new Set(all)).sort()
  }, [titles])

  const filtered = useMemo(() => {
    return titles.filter(t => {
      if (filterGenre !== 'all' && !t.genre.includes(filterGenre)) return false
      if (filterOwner !== 'all' && t.owner !== filterOwner) return false
      if (filterStage !== 'all' && t.pipelineStage !== filterStage) return false
      return true
    })
  }, [titles, filterGenre, filterOwner, filterStage])

  const byStage = useMemo(() => {
    const map: Record<string, typeof filtered> = {}
    for (const col of COLUMNS) map[col.stage] = []
    for (const t of filtered) {
      if (map[t.pipelineStage]) map[t.pipelineStage].push(t)
    }
    return map
  }, [filtered])

  const hasFilters = filterGenre !== 'all' || filterOwner !== 'all' || filterStage !== 'all'

  return (
    <div className="flex flex-col gap-5 min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Development Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">IP scouting through greenlight</p>
        </div>
        <div className="text-xs text-gray-500">{filtered.length} title{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {genres.length > 0 && (
          <select
            value={filterGenre}
            onChange={e => setFilterGenre(e.target.value)}
            className="bg-surface-2 border border-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
          >
            <option value="all">All Genres</option>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}

        {owners.length > 0 && (
          <select
            value={filterOwner}
            onChange={e => setFilterOwner(e.target.value)}
            className="bg-surface-2 border border-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
          >
            <option value="all">All Owners</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}

        <select
          value={filterStage}
          onChange={e => setFilterStage(e.target.value as PipelineStage | 'all')}
          className="bg-surface-2 border border-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
        >
          <option value="all">All Stages</option>
          {COLUMNS.map(c => <option key={c.stage} value={c.stage}>{c.label}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setFilterGenre('all'); setFilterOwner('all'); setFilterStage('all') }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <p className="text-sm text-gray-600 animate-pulse shrink-0">Loading pipeline…</p>
      )}

      {/* Kanban board — horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-6 px-6 pb-4">
        <div className="flex gap-3 min-w-max">
          {COLUMNS.map(({ stage, label }) => {
            const cards = byStage[stage] ?? []
            return (
              <div key={stage} className="w-52 shrink-0 flex flex-col gap-2">
                {/* Column header */}
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className={[
                    'text-xs font-medium',
                    stage === 'greenlit' ? 'text-status-green' : 'text-gray-400',
                  ].join(' ')}>
                    {label}
                  </span>
                  <span className="text-xs bg-surface-3 text-gray-500 rounded-full px-2 py-0.5 tabular-nums">
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 min-h-[3rem]">
                  {cards.map(title => (
                    <Link
                      key={title.id}
                      to={`/titles/${title.id}`}
                      className="block bg-surface-2 border border-border rounded-lg p-3 hover:border-lemon-500/40 hover:bg-surface-3 transition-colors group"
                    >
                      {/* Blocker indicator */}
                      {title.blockers.length > 0 && (
                        <div className="flex items-center gap-1 mb-1.5 text-xs text-status-kill">
                          <span>⚠</span>
                          <span className="truncate">Blocked</span>
                        </div>
                      )}

                      <p className="text-xs font-medium text-gray-200 group-hover:text-lemon-400 transition-colors line-clamp-2 mb-2 leading-snug">
                        {title.name}
                      </p>

                      {/* Genre tags */}
                      {title.genre.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {title.genre.slice(0, 2).map(g => (
                            <span key={g} className="text-xs px-1.5 py-0.5 rounded bg-surface-3 text-gray-500 border border-border/60">
                              {g}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Coverage verdict */}
                      {title.coverageRefs.length > 0 && (
                        <div className="mb-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${VERDICT_COLOR['pending']}`}>
                            {title.coverageRefs.length} coverage
                          </span>
                        </div>
                      )}

                      {/* Footer: owner + days */}
                      <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-border/50">
                        {title.owner
                          ? <span className="truncate max-w-[80px]">{title.owner}</span>
                          : <span>—</span>
                        }
                        <span className="tabular-nums shrink-0">{daysSince(title.updatedAt)}d</span>
                      </div>
                    </Link>
                  ))}

                  {cards.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border/40 p-3 flex items-center justify-center min-h-[3rem]">
                      <span className="text-xs text-gray-700">empty</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
