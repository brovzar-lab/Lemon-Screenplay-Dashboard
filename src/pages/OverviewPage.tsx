import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTitleStore } from '../store/titleStore'
import { fetchMiReports } from '../lib/firestore'
import type { MarketIntelReport, Title } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function fmtDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtRelative(iso: string): string {
  const d = daysSince(iso)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

// ── Stage config ──────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { stage: 'ip_scouting',  label: 'IP Scouting',  color: 'text-gray-400',   bar: 'bg-gray-600' },
  { stage: 'optioned',     label: 'Optioned',      color: 'text-blue-400',   bar: 'bg-blue-600' },
  { stage: 'treatment',    label: 'Treatment',     color: 'text-blue-400',   bar: 'bg-blue-500' },
  { stage: 'pilot_script', label: 'Pilot Script',  color: 'text-purple-400', bar: 'bg-purple-600' },
  { stage: 'series_bible', label: 'Series Bible',  color: 'text-purple-400', bar: 'bg-purple-500' },
  { stage: 'pitch_ready',  label: 'Pitch Ready',   color: 'text-lemon-400',  bar: 'bg-lemon-600' },
  { stage: 'pitched',      label: 'Pitched',       color: 'text-lemon-400',  bar: 'bg-lemon-500' },
  { stage: 'negotiation',  label: 'Negotiation',   color: 'text-orange-400', bar: 'bg-orange-500' },
  { stage: 'greenlit',     label: 'Greenlit',      color: 'text-status-green', bar: 'bg-status-green' },
] as const

const STATUS_COLOR: Record<string, string> = {
  greenlit:    'bg-status-green/15 text-status-green border-status-green/30',
  active:      'bg-status-dev/15 text-status-dev border-status-dev/30',
  development: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  hold:        'bg-status-hold/15 text-status-hold border-status-hold/30',
  killed:      'bg-status-kill/15 text-status-kill border-status-kill/30',
}

const APPETITE_COLOR: Record<string, string> = {
  high:   'text-status-green',
  medium: 'text-lemon-400',
  low:    'text-gray-500',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</h2>
      {count !== undefined && (
        <span className="text-xs text-gray-600 tabular-nums">{count}</span>
      )}
    </div>
  )
}

function AttentionItem({ title, reason, reasonColor = 'text-status-kill' }: {
  title: Title
  reason: string
  reasonColor?: string
}) {
  return (
    <Link
      to={`/titles/${title.id}`}
      className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0 hover:bg-surface-3 -mx-3 px-3 rounded transition-colors group"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-200 group-hover:text-lemon-400 transition-colors truncate">{title.name}</p>
        <p className={`text-xs mt-0.5 ${reasonColor}`}>{reason}</p>
      </div>
      <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_COLOR[title.status] ?? ''}`}>
        {title.status}
      </span>
    </Link>
  )
}

// ── Pipeline Summary Bar ──────────────────────────────────────────────────────

function PipelineSummaryBar({ titles }: { titles: Title[] }) {
  const active = titles.filter(t => t.status !== 'killed' && t.status !== 'hold')
  const total = active.length

  const stageCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of PIPELINE_STAGES) map[s.stage] = 0
    for (const t of active) {
      if (map[t.pipelineStage] !== undefined) map[t.pipelineStage]++
    }
    return map
  }, [active])

  if (total === 0) return null

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Pipeline</h2>
        <span className="text-xs text-gray-600">{total} active title{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Visual bar */}
      <div className="flex h-2 rounded-full overflow-hidden mb-4 gap-px bg-surface-3">
        {PIPELINE_STAGES.map(({ stage, bar }) => {
          const count = stageCounts[stage]
          if (count === 0) return null
          const pct = (count / total) * 100
          return (
            <div
              key={stage}
              className={`${bar} opacity-80 transition-all`}
              style={{ width: `${pct}%` }}
              title={`${stage}: ${count}`}
            />
          )
        })}
      </div>

      {/* Stage labels */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {PIPELINE_STAGES.map(({ stage, label, color }) => {
          const count = stageCounts[stage]
          if (count === 0) return null
          return (
            <div key={stage} className="flex items-center gap-1.5">
              <span className={`text-sm font-semibold tabular-nums ${color}`}>{count}</span>
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function OverviewPage() {
  const { titles, loading } = useTitleStore()
  const [miReports, setMiReports] = useState<MarketIntelReport[]>([])
  const [miLoading, setMiLoading] = useState(true)

  useEffect(() => {
    fetchMiReports()
      .then(setMiReports)
      .catch(() => setMiReports([]))
      .finally(() => setMiLoading(false))
  }, [])

  // Titles excluding killed
  const activeTitles = useMemo(
    () => titles.filter(t => t.status !== 'killed'),
    [titles]
  )

  // Attention required: blocked, stale >14d, option expiry <30d
  const attentionItems = useMemo(() => {
    const items: { title: Title; reason: string; reasonColor?: string; priority: number }[] = []

    for (const t of activeTitles) {
      if (t.blockers.length > 0) {
        items.push({ title: t, reason: `Blocked: ${t.blockers[0]}`, reasonColor: 'text-status-kill', priority: 0 })
        continue
      }
      const stale = daysSince(t.updatedAt)
      if (stale > 14) {
        items.push({ title: t, reason: `No update in ${stale} days`, reasonColor: 'text-status-hold', priority: 1 })
        continue
      }
      if (t.keyDates.optionExpiry) {
        const d = daysUntil(t.keyDates.optionExpiry)
        if (d >= 0 && d <= 30) {
          items.push({ title: t, reason: `Option expires in ${d} day${d !== 1 ? 's' : ''}`, reasonColor: 'text-lemon-400', priority: 2 })
          continue
        }
      }
      if (t.keyDates.pitchDate) {
        const d = daysUntil(t.keyDates.pitchDate)
        if (d >= 0 && d <= 14) {
          items.push({ title: t, reason: `Pitch in ${d} day${d !== 1 ? 's' : ''}`, reasonColor: 'text-lemon-400', priority: 2 })
        }
      }
    }

    return items.sort((a, b) => a.priority - b.priority).slice(0, 8)
  }, [activeTitles])

  // Active slate snapshot: top 8 non-killed, non-hold titles by recency
  const activeSlate = useMemo(
    () => activeTitles
      .filter(t => t.status !== 'hold')
      .slice(0, 8),
    [activeTitles]
  )

  // Recent activity: last 10 updated titles (any status except killed)
  const recentActivity = useMemo(
    () => [...activeTitles]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 10),
    [activeTitles]
  )

  // MI Highlights
  const latestMi = miReports.slice(0, 3)
  const genreFreq = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const r of miReports) {
      const g = r.genre?.toLowerCase()
      if (g) freq[g] = (freq[g] ?? 0) + 1
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [miReports])

  const platformAppetite = useMemo(() => {
    const latest: Record<string, string> = {}
    for (const r of [...miReports].reverse()) {
      if (r.platform && r.platformAppetite) latest[r.platform] = r.platformAppetite
    }
    return Object.entries(latest)
  }, [miReports])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-surface-2 border border-border rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-48 bg-surface-2 border border-border rounded-xl" />
          <div className="h-48 bg-surface-2 border border-border rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Studio Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Executive dashboard — active slate health at a glance</p>
      </div>

      {/* Pipeline summary bar */}
      <PipelineSummaryBar titles={titles} />

      {/* Main grid: 2 columns on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Left column: Attention Required + Recent Activity */}
        <div className="space-y-4">

          {/* Attention Required */}
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <SectionHeader
              title="Attention Required"
              count={attentionItems.length}
            />
            {attentionItems.length === 0 ? (
              <p className="text-xs text-gray-600 py-3 text-center">All clear — no blockers or stale titles</p>
            ) : (
              <div>
                {attentionItems.map(({ title, reason, reasonColor }) => (
                  <AttentionItem key={title.id} title={title} reason={reason} reasonColor={reasonColor} />
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <SectionHeader title="Recent Activity" count={recentActivity.length} />
            <div className="space-y-0">
              {recentActivity.map(title => (
                <Link
                  key={title.id}
                  to={`/titles/${title.id}`}
                  className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0 hover:bg-surface-3 -mx-3 px-3 rounded transition-colors group"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${title.status === 'greenlit' ? 'bg-status-green' : title.status === 'active' ? 'bg-status-dev' : title.status === 'hold' ? 'bg-status-hold' : 'bg-blue-400'}`} />
                    <p className="text-xs text-gray-300 group-hover:text-lemon-400 transition-colors truncate">{title.name}</p>
                  </div>
                  <span className="shrink-0 text-xs text-gray-600 tabular-nums">{fmtRelative(title.updatedAt)}</span>
                </Link>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-xs text-gray-600 py-3 text-center">No activity yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Active Slate Snapshot + MI Highlights */}
        <div className="space-y-4">

          {/* Active Slate Snapshot */}
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Active Slate</h2>
              <Link to="/slate" className="text-xs text-lemon-400 hover:text-lemon-300 transition-colors">
                View all →
              </Link>
            </div>
            <div className="space-y-2">
              {activeSlate.map(title => (
                <Link
                  key={title.id}
                  to={`/titles/${title.id}`}
                  className="flex items-center justify-between gap-3 py-2 border-b border-border/40 last:border-0 hover:bg-surface-3 -mx-3 px-3 rounded transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-200 group-hover:text-lemon-400 transition-colors truncate">{title.name}</p>
                    <p className="text-xs text-gray-600 truncate mt-0.5">
                      {title.platform} · {title.pipelineStage.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_COLOR[title.status] ?? ''}`}>
                    {title.status}
                  </span>
                </Link>
              ))}
              {activeSlate.length === 0 && (
                <p className="text-xs text-gray-600 py-3 text-center">No active titles</p>
              )}
            </div>
          </div>

          {/* MI Highlights */}
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">Market Intelligence</h2>
              <Link to="/market" className="text-xs text-lemon-400 hover:text-lemon-300 transition-colors">
                Full reports →
              </Link>
            </div>

            {miLoading && (
              <p className="text-xs text-gray-600 animate-pulse py-2">Loading MI…</p>
            )}

            {!miLoading && miReports.length === 0 && (
              <p className="text-xs text-gray-600 py-3 text-center">No MI reports yet</p>
            )}

            {!miLoading && miReports.length > 0 && (
              <div className="space-y-4">
                {/* Latest reports */}
                {latestMi.length > 0 && (
                  <div className="space-y-0">
                    {latestMi.map(r => (
                      <div key={r.id} className="py-2 border-b border-border/40 last:border-0">
                        <p className="text-xs font-medium text-gray-200 truncate">{r.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-600">{r.platform}</span>
                          <span className="text-xs text-gray-700">·</span>
                          <span className="text-xs text-gray-600">{fmtDate(r.reportDate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Genre trends */}
                {genreFreq.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">Trending genres</p>
                    <div className="flex flex-wrap gap-1.5">
                      {genreFreq.map(([genre, count]) => (
                        <span key={genre} className="text-xs px-2 py-0.5 rounded-full bg-lemon-500/10 text-lemon-400 border border-lemon-500/20 capitalize">
                          {genre} <span className="opacity-60">×{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Platform appetite */}
                {platformAppetite.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-600 mb-2">Platform appetite</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {platformAppetite.map(([platform, appetite]) => (
                        <div key={platform} className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-500">{platform}</span>
                          <span className={`text-xs font-medium capitalize ${APPETITE_COLOR[appetite] ?? 'text-gray-400'}`}>
                            {appetite}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
