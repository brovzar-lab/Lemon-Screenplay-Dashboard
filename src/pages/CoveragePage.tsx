import { useState, useEffect, useMemo } from 'react'
import { useTitleStore } from '../store/titleStore'
import { fetchAllCoverage } from '../lib/firestore'
import { exportCoverageAsPdf, exportCoverageAsDocx } from '../lib/exportDoc'
import type { CoverageDoc, AnalystVerdict } from '../types'

const VERDICT_COLOR: Record<AnalystVerdict, string> = {
  recommend: 'bg-status-green/15 text-status-green border-status-green/30',
  consider:  'bg-lemon-500/15 text-lemon-400 border-lemon-500/30',
  pass:      'bg-status-kill/15 text-status-kill border-status-kill/30',
  pending:   'bg-gray-600/20 text-gray-400 border-gray-600/30',
}

const VERDICT_LABEL: Record<AnalystVerdict, string> = {
  recommend: 'Recommend',
  consider:  'Consider',
  pass:      'Pass',
  pending:   'Pending',
}

const VERDICTS: AnalystVerdict[] = ['recommend', 'consider', 'pass', 'pending']

function ExportButtons({ onPdf, onDocx }: { onPdf: () => void; onDocx: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const handleDocx = async () => {
    setBusy(true)
    try { await onDocx() } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPdf}
        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-surface-3 border border-border text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors"
      >
        ↓ PDF
      </button>
      <button
        onClick={handleDocx}
        disabled={busy}
        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-surface-3 border border-border text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors disabled:opacity-50"
      >
        {busy ? '…' : '↓ Word'}
      </button>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function CoveragePage() {
  const { titles } = useTitleStore()
  const [docs, setDocs]       = useState<CoverageDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [search,        setSearch]        = useState('')
  const [filterVerdict, setFilterVerdict] = useState<AnalystVerdict | 'all'>('all')
  const [filterGenre,   setFilterGenre]   = useState<string>('all')
  const [filterFrom,    setFilterFrom]    = useState('')
  const [filterTo,      setFilterTo]      = useState('')

  useEffect(() => {
    setLoading(true)
    fetchAllCoverage()
      .then(setDocs)
      .finally(() => setLoading(false))
  }, [])

  // Build titleId → genres map from store
  const titleGenres = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const t of titles) map[t.id] = t.genre
    return map
  }, [titles])

  const genres = useMemo(() => {
    const all = docs.flatMap(d => titleGenres[d.titleId] ?? [])
    return Array.from(new Set(all)).sort()
  }, [docs, titleGenres])

  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (search && !d.titleName.toLowerCase().includes(search.toLowerCase())) return false
      if (filterVerdict !== 'all' && d.verdict !== filterVerdict) return false
      if (filterGenre !== 'all' && !(titleGenres[d.titleId] ?? []).includes(filterGenre)) return false
      if (filterFrom && d.createdAt < filterFrom) return false
      if (filterTo   && d.createdAt > filterTo + 'T23:59:59') return false
      return true
    })
  }, [docs, search, filterVerdict, filterGenre, filterFrom, filterTo, titleGenres])

  const hasFilters = filterVerdict !== 'all' || filterGenre !== 'all' || filterFrom || filterTo

  function clearFilters() {
    setFilterVerdict('all')
    setFilterGenre('all')
    setFilterFrom('')
    setFilterTo('')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Coverage & Scripts</h1>
        <p className="text-sm text-gray-500 mt-0.5">Searchable library of coverage documents and analyst verdicts</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-xs">⌕</span>
          <input
            type="text"
            placeholder="Search by title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-surface-2 border border-border text-xs text-gray-300 rounded-lg pl-7 pr-3 py-1.5 w-48 focus:outline-none focus:border-lemon-500/50 placeholder:text-gray-600"
          />
        </div>

        {/* Verdict */}
        <select
          value={filterVerdict}
          onChange={e => setFilterVerdict(e.target.value as AnalystVerdict | 'all')}
          className="bg-surface-2 border border-border text-xs text-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
        >
          <option value="all">All Verdicts</option>
          {VERDICTS.map(v => <option key={v} value={v}>{VERDICT_LABEL[v]}</option>)}
        </select>

        {/* Genre */}
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

        {/* Date range */}
        <input
          type="date"
          value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          className="bg-surface-2 border border-border text-xs text-gray-500 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
          title="From date"
        />
        <input
          type="date"
          value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          className="bg-surface-2 border border-border text-xs text-gray-500 rounded-lg px-3 py-1.5 focus:outline-none focus:border-lemon-500/50"
          title="To date"
        />

        <div className="flex-1" />
        <span className="text-xs text-gray-600">{filtered.length} doc{filtered.length !== 1 ? 's' : ''}</span>

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Clear
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-600 animate-pulse">Loading coverage…</p>}

      {/* Coverage list */}
      <div className="flex flex-col gap-2">
        {filtered.map(doc => {
          const isOpen = expanded === doc.id
          const genres = titleGenres[doc.titleId] ?? []
          return (
            <div key={doc.id} className="bg-surface-2 border border-border rounded-xl overflow-hidden">
              {/* Row */}
              <button
                className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-surface-3 transition-colors"
                onClick={() => setExpanded(isOpen ? null : doc.id)}
              >
                {/* Title + analyst */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-100">{doc.titleName}</span>
                    {genres.slice(0, 2).map(g => (
                      <span key={g} className="text-xs px-1.5 py-0.5 rounded bg-surface-3 text-gray-500 border border-border/60">
                        {g}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{doc.analyst}</p>
                </div>

                {/* Verdict badge */}
                <span className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full border ${VERDICT_COLOR[doc.verdict]}`}>
                  {VERDICT_LABEL[doc.verdict]}
                </span>

                {/* Date */}
                <span className="shrink-0 text-xs text-gray-500">{formatDate(doc.createdAt)}</span>

                {/* Expand chevron */}
                <span className={`shrink-0 text-gray-600 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-border/60 space-y-3 pt-3">
                  {doc.synopsis && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Synopsis</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{doc.synopsis}</p>
                    </div>
                  )}
                  {doc.notes && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Analyst Notes</p>
                      <p className="text-sm text-gray-400 leading-relaxed">{doc.notes}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    {doc.pdfUrl && (
                      <a
                        href={doc.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-lemon-400 hover:text-lemon-300 transition-colors"
                      >
                        <span>⎙</span> View source
                      </a>
                    )}
                    <ExportButtons
                      onPdf={() => exportCoverageAsPdf(doc)}
                      onDocx={() => exportCoverageAsDocx(doc)}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!loading && docs.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="text-4xl opacity-20">⊡</span>
            <p className="text-sm text-gray-500">No coverage documents yet</p>
            <p className="text-xs text-gray-600">Coverage docs will appear here once analysts submit reports.</p>
          </div>
        )}

        {!loading && docs.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="text-4xl opacity-20">◌</span>
            <p className="text-sm text-gray-500">No documents match these filters</p>
            <button onClick={clearFilters} className="text-xs text-lemon-400 hover:text-lemon-300 transition-colors">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
