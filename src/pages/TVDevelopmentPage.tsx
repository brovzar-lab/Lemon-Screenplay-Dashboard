import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTitleStore } from '../store/titleStore'
import type { Format } from '../types'

const TV_FORMATS: Format[] = ['limited_series', 'series', 'documentary']

const FORMAT_LABEL: Record<string, string> = {
  limited_series: 'Limited',
  series:         'Series',
  documentary:    'Documentary',
}

const STATUS_ORDER = ['greenlit', 'active', 'development', 'hold'] as const
type DevStatus = typeof STATUS_ORDER[number]

const STATUS_LABEL: Record<DevStatus, string> = {
  greenlit:    'Greenlit',
  active:      'Active',
  development: 'In Development',
  hold:        'On Hold',
}

const STATUS_COLOR: Record<DevStatus, string> = {
  greenlit:    'bg-status-green/15 text-status-green border-status-green/30',
  active:      'bg-status-dev/15 text-status-dev border-status-dev/30',
  development: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  hold:        'bg-status-hold/15 text-status-hold border-status-hold/30',
}

const GENRE_COLORS = [
  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'bg-pink-500/15 text-pink-400 border-pink-500/30',
  'bg-teal-500/15 text-teal-400 border-teal-500/30',
]

function genreColor(genre: string): string {
  let h = 0
  for (let i = 0; i < genre.length; i++) h = (h * 31 + genre.charCodeAt(i)) & 0xffff
  return GENRE_COLORS[h % GENRE_COLORS.length]
}

export function TVDevelopmentPage() {
  const { titles, loading } = useTitleStore()
  const [filterGenre, setFilterGenre] = useState<string>('all')
  const [filterFormat, setFilterFormat] = useState<Format | 'all'>('all')

  const tvTitles = useMemo(
    () => titles.filter(t => TV_FORMATS.includes(t.format) && t.status !== 'killed'),
    [titles]
  )

  const genres = useMemo(() => {
    const all = tvTitles.flatMap(t => t.genre)
    return Array.from(new Set(all)).sort()
  }, [tvTitles])

  const filtered = useMemo(() => {
    let result = tvTitles
    if (filterFormat !== 'all') result = result.filter(t => t.format === filterFormat)
    if (filterGenre !== 'all') result = result.filter(t => t.genre.includes(filterGenre))
    return result
  }, [tvTitles, filterGenre, filterFormat])

  const grouped = useMemo(() => {
    const map = {} as Record<DevStatus, typeof filtered>
    for (const s of STATUS_ORDER) map[s] = []
    for (const t of filtered) {
      const s = t.status as DevStatus
      if (map[s]) map[s].push(t)
    }
    return map
  }, [filtered])

  const visibleGroups = STATUS_ORDER.filter(s => grouped[s].length > 0)
  const hasFilters = filterGenre !== 'all' || filterFormat !== 'all'

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">TV Development</h1>
          <p className="text-sm text-gray-500 mt-0.5">Series, limited series, and documentary projects</p>
        </div>
        <div className="text-xs text-gray-500">
          {filtered.length} title{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterGenre}
          onChange={e => setFilterGenre(e.target.value)}
          className="bg-surface-2 border border-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
        >
          <option value="all">All Genres</option>
          {genres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select
          value={filterFormat}
          onChange={e => setFilterFormat(e.target.value as Format | 'all')}
          className="bg-surface-2 border border-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
        >
          <option value="all">All Formats</option>
          {TV_FORMATS.map(f => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
        </select>

        {hasFilters && (
          <button
            onClick={() => { setFilterGenre('all'); setFilterFormat('all') }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <p className="text-sm text-gray-600 animate-pulse">Loading titles…</p>
      )}

      {/* Grouped table */}
      <div className="space-y-6">
        {visibleGroups.map(status => (
          <div key={status}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                {STATUS_LABEL[status]}
              </span>
              <span className="text-xs text-gray-700 tabular-nums">{grouped[status].length}</span>
            </div>

            <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Title</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium w-28">Format</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium w-36">Status</th>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Genre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {grouped[status].map(title => (
                    <tr key={title.id} className="hover:bg-surface-3 transition-colors group">
                      <td className="px-4 py-3">
                        <Link
                          to={`/titles/${title.id}`}
                          className="font-medium text-gray-200 group-hover:text-lemon-400 transition-colors"
                        >
                          {title.name}
                        </Link>
                        {title.blockers.length > 0 && (
                          <span className="ml-2 text-xs text-status-kill">⚠ Blocked</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-surface-3 text-gray-400 border-border">
                          {FORMAT_LABEL[title.format] ?? title.format}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLOR[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {title.genre.map(g => (
                            <span
                              key={g}
                              className={`text-xs px-2 py-0.5 rounded-full border ${genreColor(g)}`}
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {!loading && tvTitles.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="text-4xl opacity-20">▦</span>
            <p className="text-sm text-gray-500">No TV titles yet</p>
          </div>
        )}

        {!loading && tvTitles.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="text-4xl opacity-20">◌</span>
            <p className="text-sm text-gray-500">No titles match these filters</p>
            <button
              onClick={() => { setFilterGenre('all'); setFilterFormat('all') }}
              className="text-xs text-lemon-400 hover:text-lemon-300 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
