import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchTitle, fetchCoverageForTitle, fetchMiReports } from '../lib/firestore'
import type { Title, CoverageDoc, MarketIntelReport } from '../types'

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

const VERDICT_COLOR: Record<string, string> = {
  recommend: 'bg-status-green/15 text-status-green border-status-green/30',
  consider:  'bg-lemon-500/15 text-lemon-400 border-lemon-500/30',
  pass:      'bg-status-kill/15 text-status-kill border-status-kill/30',
  pending:   'bg-gray-600/20 text-gray-400 border-gray-600/30',
}

const APPETITE_COLOR: Record<string, string> = {
  high:   'bg-status-green/15 text-status-green border-status-green/30',
  medium: 'bg-lemon-500/15 text-lemon-400 border-lemon-500/30',
  low:    'bg-status-kill/15 text-status-kill border-status-kill/30',
}

const FORMAT_LABEL: Record<string, string> = {
  feature_film:   'Feature Film',
  limited_series: 'Limited Series',
  series:         'Series',
  documentary:    'Documentary',
}

const STAGE_LABEL: Record<string, string> = {
  ip_scouting:  'IP Scouting',
  optioned:     'Optioned',
  treatment:    'Treatment',
  pilot_script: 'Pilot Script',
  series_bible: 'Series Bible',
  pitch_ready:  'Pitch Ready',
  pitched:      'Pitched',
  negotiation:  'Negotiation',
  greenlit:     'Greenlit',
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function printHtml(title: string, body: string) {
  const win = window.open('', '_blank', 'width=800,height=600')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
    body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:0 20px;color:#111;line-height:1.6}
    h1{font-size:1.4em;margin-bottom:0.25em}
    .meta{color:#666;font-size:0.85em;margin-bottom:1.5em}
    pre{white-space:pre-wrap;font-family:inherit}
    @media print{body{margin:0}}
  </style></head><body>
    <h1>${title}</h1>
    <pre>${body.replace(/</g, '&lt;')}</pre>
  </body></html>`)
  win.document.close()
  win.focus()
  win.print()
}

function formatDateShort(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type Tab = 'overview' | 'coverage' | 'market' | 'activity'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'coverage', label: 'Coverage' },
  { id: 'market',   label: 'Market' },
  { id: 'activity', label: 'Activity' },
]

export function TitleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('overview')

  const [title,    setTitle]    = useState<Title | null>(null)
  const [coverage, setCoverage] = useState<CoverageDoc[]>([])
  const [miReports, setMiReports] = useState<MarketIntelReport[]>([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [expandedCov, setExpandedCov] = useState<string | null>(null)
  const [expandedMi,  setExpandedMi]  = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setTitle(null); setCoverage([]); setMiReports([])

    fetchTitle(id).then(t => {
      if (!t) { setNotFound(true); setLoading(false); return }
      setTitle(t)
      return Promise.all([
        fetchCoverageForTitle(id).then(setCoverage),
        fetchMiReports(id).then(setMiReports),
      ])
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="space-y-4">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/" className="hover:text-gray-300 transition-colors">Overview</Link>
          <span>›</span>
          <span className="text-gray-300">Loading…</span>
        </nav>
        <p className="text-sm text-gray-600 animate-pulse">Loading title…</p>
      </div>
    )
  }

  if (notFound || !title) {
    return (
      <div className="space-y-4">
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/" className="hover:text-gray-300 transition-colors">Overview</Link>
          <span>›</span>
          <span className="text-gray-300">Not found</span>
        </nav>
        <div className="bg-surface-2 border border-border rounded-xl p-12 flex flex-col items-center gap-3">
          <span className="text-4xl opacity-20">◌</span>
          <p className="text-sm text-gray-400">Title not found</p>
          <Link to="/" className="text-xs text-lemon-400 hover:text-lemon-300 transition-colors">Back to overview</Link>
        </div>
      </div>
    )
  }

  // Activity timeline — synthesized from available timestamps
  const activityLog = [
    ...coverage.map(c => ({ date: c.createdAt, text: `Coverage submitted by ${c.analyst}`, verdict: c.verdict })),
    ...miReports.map(r => ({ date: r.createdAt, text: `MI report: ${r.title}`, verdict: null })),
    { date: title.createdAt, text: 'Title created', verdict: null },
    { date: title.updatedAt, text: 'Title last updated', verdict: null },
  ]
    .filter((a, i, arr) => arr.findIndex(b => b.date === a.date && b.text === a.text) === i)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back nav */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => history.back()} className="hover:text-gray-300 transition-colors">← Back</button>
        <span>›</span>
        <span className="text-gray-300 truncate">{title.name}</span>
      </nav>

      {/* Hero header */}
      <div className="bg-surface-2 border border-border rounded-xl p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold text-gray-100 mb-1">{title.name}</h1>
            <p className="text-sm text-gray-400 mb-3">{title.logline}</p>
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs px-2.5 py-0.5 rounded-full border capitalize ${STATUS_COLOR[title.status] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                {title.status}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border ${PLATFORM_COLOR[title.platform] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                {title.platform}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full border bg-surface-3 text-gray-400 border-border">
                {FORMAT_LABEL[title.format] ?? title.format}
              </span>
              {title.genre.map(g => (
                <span key={g} className="text-xs px-2.5 py-0.5 rounded-full border bg-surface-3 text-gray-500 border-border">
                  {g}
                </span>
              ))}
            </div>
          </div>
          {title.owner && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500">Owner</p>
              <p className="text-sm text-gray-200">{title.owner}</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'px-4 py-2 text-sm transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'text-lemon-400 border-b-2 border-lemon-400 -mb-px'
                  : 'text-gray-500 hover:text-gray-300',
              ].join(' ')}
            >
              {t.label}
              {t.id === 'coverage' && coverage.length > 0 && (
                <span className="ml-1.5 text-xs bg-surface-3 text-gray-500 rounded-full px-1.5">{coverage.length}</span>
              )}
              {t.id === 'market' && miReports.length > 0 && (
                <span className="ml-1.5 text-xs bg-surface-3 text-gray-500 rounded-full px-1.5">{miReports.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Slate info */}
          <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Slate Info</h2>
            <dl className="space-y-2">
              {[
                { label: 'Status',        value: <span className="capitalize">{title.status}</span> },
                { label: 'Option Expiry', value: formatDate(title.keyDates.optionExpiry) },
                { label: 'Pitch Date',    value: formatDate(title.keyDates.pitchDate) },
                { label: 'Greenlit',      value: formatDate(title.keyDates.greenlitDate) },
                { label: 'Premiere',      value: formatDate(title.keyDates.premiereDate) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-xs text-gray-500">{label}</dt>
                  <dd className="text-xs text-gray-300 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Pipeline status */}
          <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-3">
            <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Pipeline</h2>
            <div className="space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-xs text-gray-500">Stage</span>
                <span className="text-xs text-gray-300">{STAGE_LABEL[title.pipelineStage] ?? title.pipelineStage}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-xs text-gray-500">Owner</span>
                <span className="text-xs text-gray-300">{title.owner || '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-xs text-gray-500">Coverage</span>
                <span className="text-xs text-gray-300">{coverage.length} doc{coverage.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            {title.blockers.length > 0 && (
              <div className="pt-2 border-t border-border/60">
                <p className="text-xs text-status-kill mb-1.5">⚠ Blockers</p>
                <ul className="space-y-1">
                  {title.blockers.map((b, i) => (
                    <li key={i} className="text-xs text-gray-400">• {b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Coverage */}
      {tab === 'coverage' && (
        <div className="space-y-2">
          {coverage.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12">
              <span className="text-4xl opacity-20">⊡</span>
              <p className="text-sm text-gray-500">No coverage docs for this title</p>
            </div>
          )}
          {coverage.map(doc => {
            const isOpen = expandedCov === doc.id
            return (
              <div key={doc.id} className="bg-surface-2 border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-surface-3 transition-colors"
                  onClick={() => setExpandedCov(isOpen ? null : doc.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100">{doc.analyst}</p>
                    <p className="text-xs text-gray-500">{formatDateShort(doc.createdAt)}</p>
                  </div>
                  <span className={`shrink-0 text-xs px-2.5 py-0.5 rounded-full border ${VERDICT_COLOR[doc.verdict] ?? ''}`}>
                    {doc.verdict}
                  </span>
                  <span className={`shrink-0 text-gray-600 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/60 pt-3 space-y-3">
                    {doc.synopsis && <p className="text-sm text-gray-300 leading-relaxed">{doc.synopsis}</p>}
                    {doc.notes && <p className="text-sm text-gray-400 leading-relaxed">{doc.notes}</p>}
                    <div className="flex items-center gap-3 pt-1">
                      {doc.pdfUrl && (
                        <a href={doc.pdfUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-lemon-400 hover:text-lemon-300 transition-colors">
                          <span>⎙</span> View PDF
                        </a>
                      )}
                      <button
                        onClick={() => printHtml(
                          `Coverage — ${doc.titleName} (${doc.analyst})`,
                          `Coverage Report\n${'─'.repeat(40)}\nTitle: ${doc.titleName}\nAnalyst: ${doc.analyst}\nVerdict: ${doc.verdict}\nDate: ${formatDateShort(doc.createdAt)}\n\nSynopsis\n${'─'.repeat(40)}\n${doc.synopsis}\n\nNotes\n${'─'.repeat(40)}\n${doc.notes}`
                        )}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        <span>⎙</span> Print / PDF
                      </button>
                      <button
                        onClick={() => downloadText(
                          `coverage-${doc.titleName.replace(/\s+/g, '-').toLowerCase()}.txt`,
                          `Coverage Report\n${'='.repeat(60)}\nTitle: ${doc.titleName}\nAnalyst: ${doc.analyst}\nVerdict: ${doc.verdict}\nDate: ${formatDateShort(doc.createdAt)}\n\nSYNOPSIS\n${'─'.repeat(40)}\n${doc.synopsis}\n\nNOTES\n${'─'.repeat(40)}\n${doc.notes}`
                        )}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        ↓ Export text
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Market */}
      {tab === 'market' && (
        <div className="space-y-2">
          {miReports.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12">
              <span className="text-4xl opacity-20">◉</span>
              <p className="text-sm text-gray-500">No MI reports reference this title</p>
            </div>
          )}
          {miReports.map(report => {
            const isOpen = expandedMi === report.id
            return (
              <div key={report.id} className="bg-surface-2 border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-4 hover:bg-surface-3 transition-colors"
                  onClick={() => setExpandedMi(isOpen ? null : report.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100">{report.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{report.summary}</p>
                  </div>
                  <div className="shrink-0 text-right space-y-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${APPETITE_COLOR[report.platformAppetite] ?? ''}`}>
                      {report.platformAppetite}
                    </span>
                    <p className="text-xs text-gray-600">{formatDateShort(report.reportDate)}</p>
                  </div>
                  <span className={`shrink-0 text-gray-600 text-xs mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/60 pt-3 space-y-3">
                    <p className="text-sm text-gray-300 leading-relaxed">{report.summary}</p>
                    {report.trends.length > 0 && (
                      <ul className="space-y-1">
                        {report.trends.map((t, i) => (
                          <li key={i} className="flex gap-2 text-sm text-gray-400">
                            <span className="text-lemon-600 shrink-0">→</span>{t}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => printHtml(
                          report.title,
                          `Market Intelligence Report\n${'─'.repeat(40)}\nTitle: ${report.title}\nPlatform: ${report.platform}\nAppetite: ${report.platformAppetite}\nDate: ${formatDateShort(report.reportDate)}\n\nSummary\n${'─'.repeat(40)}\n${report.summary}\n\nKey Trends\n${'─'.repeat(40)}\n${report.trends.map(t => `• ${t}`).join('\n')}\n\nComp Titles\n${'─'.repeat(40)}\n${report.compTitles.join(', ')}`
                        )}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        <span>⎙</span> Print / PDF
                      </button>
                      <button
                        onClick={() => downloadText(
                          `mi-report-${report.title.replace(/\s+/g, '-').toLowerCase().slice(0, 40)}.txt`,
                          `Market Intelligence Report\n${'='.repeat(60)}\nTitle: ${report.title}\nPlatform: ${report.platform}\nPlatform Appetite: ${report.platformAppetite}\nGenre: ${report.genre}\nDate: ${formatDateShort(report.reportDate)}\n\nSUMMARY\n${'─'.repeat(40)}\n${report.summary}\n\nKEY TRENDS\n${'─'.repeat(40)}\n${report.trends.map(t => `• ${t}`).join('\n')}\n\nCOMP TITLES\n${'─'.repeat(40)}\n${report.compTitles.join(', ')}`
                        )}
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                      >
                        ↓ Export text
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Activity */}
      {tab === 'activity' && (
        <div className="space-y-2">
          {activityLog.length === 0 && (
            <p className="text-sm text-gray-600 py-8 text-center">No activity recorded</p>
          )}
          {activityLog.map((event, i) => (
            <div key={i} className="flex items-start gap-4 py-2.5 border-b border-border/40 last:border-0">
              <div className="w-2 h-2 rounded-full bg-surface-3 border border-border mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300">{event.text}</p>
                {event.verdict && (
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${VERDICT_COLOR[event.verdict] ?? ''}`}>
                    {event.verdict}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-600 shrink-0">{formatDateShort(event.date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
