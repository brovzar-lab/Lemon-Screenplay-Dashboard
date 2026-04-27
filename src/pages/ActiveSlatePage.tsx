import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTitleStore } from '../store/titleStore'
import type { Platform, SlateStatus, Format } from '../types'

const STATUS_COLOR: Record<string, string> = {
  greenlit:    'bg-status-green/15 text-status-green border-status-green/30',
  active:      'bg-status-dev/15 text-status-dev border-status-dev/30',
  development: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  hold:        'bg-status-hold/15 text-status-hold border-status-hold/30',
  killed:      'bg-status-kill/15 text-status-kill border-status-kill/30',
}

const PLATFORM_COLOR: Record<string, string> = {
  'Netflix':       'bg-red-500/15 text-red-400 border-red-500/30',
  'Apple TV+':     'bg-gray-500/15 text-gray-300 border-gray-500/30',
  'HBO Max':       'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Amazon Prime':  'bg-blue-400/15 text-blue-300 border-blue-400/30',
  'Disney+':       'bg-blue-600/15 text-blue-400 border-blue-600/30',
  'Theatrical':    'bg-lemon-500/15 text-lemon-400 border-lemon-500/30',
  'Other':         'bg-gray-700/50 text-gray-400 border-gray-600/30',
}

const FORMAT_LABEL: Record<string, string> = {
  feature_film:    'Feature',
  limited_series:  'Limited',
  series:          'Series',
  documentary:     'Doc',
}

const PLATFORMS: Platform[] = ['Netflix', 'Apple TV+', 'HBO Max', 'Amazon Prime', 'Disney+', 'Theatrical', 'Other']
const STATUSES: SlateStatus[] = ['active', 'greenlit', 'development', 'hold', 'killed']
const FORMATS: Format[] = ['feature_film', 'limited_series', 'series', 'documentary']

type SortKey = 'name' | 'status' | 'deliveryDate'

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function ActiveSlatePage() {
  const { titles, loading } = useTitleStore()

  const [platform, setPlatform] = useState<Platform | 'all'>('all')
  const [status, setStatus]     = useState<SlateStatus | 'all'>('all')
  const [format, setFormat]     = useState<Format | 'all'>('all')
  const [sortBy, setSortBy]     = useState<SortKey>('status')

  const filtered = useMemo(() => {
    let result = titles
    if (platform !== 'all') result = result.filter(t => t.platform === platform)
    if (status  !== 'all') result = result.filter(t => t.status  === status)
    if (format  !== 'all') result = result.filter(t => t.format  === format)
    return [...result].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'deliveryDate') {
        const da = a.keyDates.premiereDate ?? a.keyDates.pitchDate ?? ''
        const db = b.keyDates.premiereDate ?? b.keyDates.pitchDate ?? ''
        return da.localeCompare(db)
      }
      // status sort: greenlit > active > development > hold > killed
      const order = ['greenlit','active','development','hold','killed']
      return order.indexOf(a.status) - order.indexOf(b.status)
    })
  }, [titles, platform, status, format, sortBy])

  const hasFilters = platform !== 'all' || status !== 'all' || format !== 'all'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Active Slate</h1>
          <p className="text-sm text-gray-500 mt-0.5">All projects — platform, status, key dates</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{filtered.length} title{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Filter + Sort bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Platform */}
        <select
          value={platform}
          onChange={e => setPlatform(e.target.value as Platform | 'all')}
          className="bg-surface-2 border border-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={e => setStatus(e.target.value as SlateStatus | 'all')}
          className="bg-surface-2 border border-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>

        {/* Format */}
        <select
          value={format}
          onChange={e => setFormat(e.target.value as Format | 'all')}
          className="bg-surface-2 border border-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
        >
          <option value="all">All Formats</option>
          {FORMATS.map(f => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
        </select>

        <div className="flex-1" />

        {/* Sort */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>Sort:</span>
          {(['status', 'deliveryDate', 'name'] as SortKey[]).map(k => (
            <button
              key={k}
              onClick={() => setSortBy(k)}
              className={[
                'px-2.5 py-1 rounded-md transition-colors',
                sortBy === k
                  ? 'bg-lemon-500/15 text-lemon-400 border border-lemon-500/30'
                  : 'text-gray-500 hover:text-gray-300 border border-transparent',
              ].join(' ')}
            >
              {k === 'deliveryDate' ? 'Date' : k === 'status' ? 'Status' : 'Name'}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setPlatform('all'); setStatus('all'); setFormat('all') }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors ml-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-sm text-gray-600 animate-pulse">Loading titles…</p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(title => (
          <Link
            key={title.id}
            to={`/titles/${title.id}`}
            className="block bg-surface-2 border border-border rounded-xl p-4 hover:border-lemon-500/40 hover:bg-surface-3 transition-colors group"
          >
            {/* Top row: title + status */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h2 className="text-sm font-medium text-gray-100 group-hover:text-lemon-400 transition-colors line-clamp-2 leading-snug">
                {title.name}
              </h2>
              <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_COLOR[title.status] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                {title.status}
              </span>
            </div>

            {/* Logline */}
            {title.logline && (
              <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">{title.logline}</p>
            )}

            {/* Badges: format + platform */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <span className="text-xs px-2 py-0.5 rounded-full border bg-surface-3 text-gray-400 border-border">
                {FORMAT_LABEL[title.format] ?? title.format}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${PLATFORM_COLOR[title.platform] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                {title.platform}
              </span>
            </div>

            {/* Key dates + owner */}
            <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-border/60">
              <div className="flex items-center gap-3">
                {title.keyDates.premiereDate && (
                  <span>Premiere: <span className="text-gray-400">{formatDate(title.keyDates.premiereDate)}</span></span>
                )}
                {!title.keyDates.premiereDate && title.keyDates.pitchDate && (
                  <span>Pitch: <span className="text-gray-400">{formatDate(title.keyDates.pitchDate)}</span></span>
                )}
                {!title.keyDates.premiereDate && !title.keyDates.pitchDate && title.keyDates.optionExpiry && (
                  <span>Option exp: <span className="text-gray-400">{formatDate(title.keyDates.optionExpiry)}</span></span>
                )}
              </div>
              {title.owner && (
                <span className="text-gray-600 truncate max-w-[80px]">{title.owner}</span>
              )}
            </div>
          </Link>
        ))}

        {!loading && titles.length === 0 && (
          <div className="col-span-3 flex flex-col items-center gap-3 py-16">
            <span className="text-4xl opacity-20">▦</span>
            <p className="text-sm text-gray-500">No titles yet</p>
            <p className="text-xs text-gray-600">Add titles in Firestore to see them here.</p>
          </div>
        )}

        {!loading && titles.length > 0 && filtered.length === 0 && (
          <div className="col-span-3 flex flex-col items-center gap-3 py-16">
            <span className="text-4xl opacity-20">◌</span>
            <p className="text-sm text-gray-500">No titles match these filters</p>
            <button
              onClick={() => { setPlatform('all'); setStatus('all'); setFormat('all') }}
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
