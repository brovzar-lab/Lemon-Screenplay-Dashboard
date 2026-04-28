import { useState, useEffect, useMemo } from 'react'
import { fetchMiReports } from '../lib/firestore'
import { exportMiAsPdf, exportMiAsDocx } from '../lib/exportDoc'
import type { MarketIntelReport } from '../types'

const APPETITE_COLOR: Record<string, string> = {
  high:   'bg-status-green/15 text-status-green border-status-green/30',
  medium: 'bg-lemon-500/15 text-lemon-400 border-lemon-500/30',
  low:    'bg-status-kill/15 text-status-kill border-status-kill/30',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

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

// Simple inline bar chart — no external library
function BarChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="space-y-1.5">
      {data.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-24 truncate shrink-0">{label}</span>
          <div className="flex-1 h-4 bg-surface-3 rounded-sm overflow-hidden">
            <div
              className="h-full bg-lemon-500/40 rounded-sm transition-all duration-500"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 tabular-nums w-4 shrink-0">{count}</span>
        </div>
      ))}
    </div>
  )
}

export function MarketIntelPage() {
  const [reports, setReports]   = useState<MarketIntelReport[]>([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchMiReports()
      .then(setReports)
      .finally(() => setLoading(false))
  }, [])

  // Genre distribution
  const genreChart = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of reports) {
      counts[r.genre] = (counts[r.genre] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [reports])

  // Platform appetite: latest appetite per platform
  const platformAppetite = useMemo(() => {
    const map: Record<string, { appetite: string; count: number }> = {}
    for (const r of reports) {
      if (!map[r.platform]) {
        map[r.platform] = { appetite: r.platformAppetite, count: 1 }
      } else {
        map[r.platform].count++
      }
    }
    return Object.entries(map).map(([platform, { appetite, count }]) => ({ platform, appetite, count }))
  }, [reports])

  // Comp titles: unique comps across all reports, capped at 20
  const compTitles = useMemo(() => {
    const all = reports.flatMap(r => r.compTitles ?? [])
    const counts: Record<string, number> = {}
    for (const t of all) counts[t] = (counts[t] ?? 0) + 1
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([title]) => title)
  }, [reports])

  const hasData = reports.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Market Intelligence</h1>
        <p className="text-sm text-gray-500 mt-0.5">Genre trends, platform appetite, comp titles, MI agent reports</p>
      </div>

      {loading && <p className="text-sm text-gray-600 animate-pulse">Loading reports…</p>}

      {/* Analytics panels — only when data exists */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Genre trend chart */}
          {genreChart.length > 0 && (
            <div className="lg:col-span-2 bg-surface-2 border border-border rounded-xl p-4">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Genre Distribution</h2>
              <BarChart data={genreChart} />
            </div>
          )}

          {/* Platform appetite */}
          {platformAppetite.length > 0 && (
            <div className="bg-surface-2 border border-border rounded-xl p-4">
              <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-4">Platform Appetite</h2>
              <div className="space-y-2">
                {platformAppetite.map(({ platform, appetite, count }) => (
                  <div key={platform} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-gray-300 truncate">{platform}</span>
                      <span className="text-xs text-gray-600">{count}</span>
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border capitalize ${APPETITE_COLOR[appetite] ?? ''}`}>
                      {appetite}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comp titles */}
      {compTitles.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Comp Titles</h2>
          <div className="flex flex-wrap gap-2">
            {compTitles.map(title => (
              <span key={title} className="text-xs px-2.5 py-1 rounded-full bg-surface-3 border border-border text-gray-300">
                {title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Report cards */}
      <div>
        <h2 className="text-sm font-medium text-gray-300 mb-3">Reports <span className="text-gray-600 font-normal">({reports.length})</span></h2>

        <div className="flex flex-col gap-2">
          {reports.map(report => {
            const isOpen = expanded === report.id
            return (
              <div key={report.id} className="bg-surface-2 border border-border rounded-xl overflow-hidden">
                {/* Card header */}
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-4 hover:bg-surface-3 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : report.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-medium text-gray-100">{report.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${APPETITE_COLOR[report.platformAppetite]}`}>
                        {report.platformAppetite}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{report.summary}</p>
                  </div>

                  <div className="shrink-0 text-right space-y-1">
                    <p className="text-xs text-gray-400">{report.platform}</p>
                    <p className="text-xs text-gray-600">{formatDate(report.reportDate)}</p>
                  </div>

                  <span className={`shrink-0 text-gray-600 text-xs mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/60 pt-3 space-y-4">
                    <p className="text-sm text-gray-300 leading-relaxed">{report.summary}</p>

                    {report.trends.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Trends</p>
                        <ul className="space-y-1">
                          {report.trends.map((t, i) => (
                            <li key={i} className="flex gap-2 text-sm text-gray-400">
                              <span className="text-lemon-600 shrink-0">→</span>
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {report.compTitles.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Comp Titles</p>
                        <div className="flex flex-wrap gap-1.5">
                          {report.compTitles.map(title => (
                            <span key={title} className="text-xs px-2 py-0.5 rounded-full bg-surface-3 border border-border text-gray-400">
                              {title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <ExportButtons
                      onPdf={() => exportMiAsPdf(report)}
                      onDocx={() => exportMiAsDocx(report)}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {!loading && reports.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16">
              <span className="text-4xl opacity-20">◉</span>
              <p className="text-sm text-gray-500">No MI reports yet</p>
              <p className="text-xs text-gray-600 text-center max-w-xs">
                Market intelligence reports will appear here once the MI agent generates them.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
