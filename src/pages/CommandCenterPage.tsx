import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTitleStore } from '../store/titleStore'
import { useWatchlistStore } from '../store/watchlistStore'
import type { Title, PipelineStage } from '../types'

// ── Stage config ───────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<PipelineStage, string> = {
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

const PIPELINE_ORDER: PipelineStage[] = [
  'ip_scouting', 'optioned', 'treatment', 'pilot_script',
  'series_bible', 'pitch_ready', 'pitched', 'negotiation', 'greenlit',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function nearestDeadline(t: Title): number | null {
  const days: number[] = []
  if (t.keyDates?.optionExpiry) {
    const d = daysUntil(t.keyDates.optionExpiry)
    if (d >= 0) days.push(d)
  }
  if (t.keyDates?.pitchDate) {
    const d = daysUntil(t.keyDates.pitchDate)
    if (d >= 0) days.push(d)
  }
  return days.length ? Math.min(...days) : null
}

function deadlineColor(d: number | null): string {
  if (d === null) return 'text-gray-700'
  if (d < 7)  return 'text-status-kill'
  if (d < 14) return 'text-status-hold'
  return 'text-status-green'
}

function waitColor(days: number): string {
  if (days >= 14) return 'text-status-kill'
  if (days >= 7)  return 'text-status-hold'
  return 'text-gray-500'
}

function barColor(pct: number): string {
  if (pct >= 80) return 'bg-status-green'
  if (pct >= 60) return 'bg-status-hold'
  return 'bg-status-kill'
}

function formatLabel(fmt: string): string {
  if (fmt === 'feature_film')   return 'Film'
  if (fmt === 'limited_series') return 'Limited'
  if (fmt === 'documentary')    return 'Doc'
  return 'Series'
}

// ── Agent data — real agents from the Lemon Studio company ────────────────────
// Source: GET /api/companies/:id/agents (2026-08-07)
// Status is derived from the Paperclip `status` field (running → active, idle → idle)
// TODO: fetch live from API once a browser-accessible Paperclip auth token is wired

type AgentStatus = 'active' | 'review' | 'idle'

interface AgentInfo {
  id: string
  name: string
  shortName: string
  role: string
  status: AgentStatus
  pct: number
  task: string
  urlKey: string
}

const AGENTS: AgentInfo[] = [
  {
    id:        'head-of-design',
    name:      'Head of Design',
    shortName: 'Design',
    role:      'Design',
    status:    'active',
    pct:       90,
    task:      'Mission Control v3 (LEMA-8070)',
    urlKey:    'head-of-design',
  },
  {
    id:        'studio-boss',
    name:      'Studio Boss',
    shortName: 'Boss',
    role:      'CEO Agent',
    status:    'idle',
    pct:       0,
    task:      'Awaiting escalations',
    urlKey:    'studio-boss',
  },
  {
    id:        'head-of-development',
    name:      'Head of Development',
    shortName: 'Dev PM',
    role:      'Development PM',
    status:    'idle',
    pct:       0,
    task:      'Pipeline review standby',
    urlKey:    'head-of-development',
  },
  {
    id:        'lead-app-engineer',
    name:      'Lead App Engineer',
    shortName: 'Engineer',
    role:      'Engineering',
    status:    'idle',
    pct:       0,
    task:      'Dashboard follow-ups pending',
    urlKey:    'lead-app-engineer',
  },
  {
    id:        'coverage-analyst',
    name:      'Coverage Analyst',
    shortName: 'Coverage',
    role:      'Analysis',
    status:    'idle',
    pct:       0,
    task:      'Awaiting script queue',
    urlKey:    'coverage-analyst',
  },
  {
    id:        'ip-scout-ninja',
    name:      'IP Scout Ninja',
    shortName: 'IP Scout',
    role:      'IP Scouting',
    status:    'idle',
    pct:       0,
    task:      'Monitoring source material',
    urlKey:    'ip-scout-ninja',
  },
  {
    id:        'marketing-intelligence',
    name:      'Marketing Intelligence',
    shortName: 'Market Intel',
    role:      'Market Research',
    status:    'idle',
    pct:       0,
    task:      'Awaiting brief',
    urlKey:    'marketing-intelligence',
  },
  {
    id:        'story-spinner',
    name:      'Story Spinner',
    shortName: 'Story',
    role:      'Development',
    status:    'idle',
    pct:       0,
    task:      'Concept generation standby',
    urlKey:    'story-spinner',
  },
  {
    id:        'creative-development-lead',
    name:      'Creative Development',
    shortName: 'Creative',
    role:      'Creative Lead',
    status:    'idle',
    pct:       0,
    task:      'Slate review',
    urlKey:    'creative-development-lead',
  },
  {
    id:        'qa-engineer',
    name:      'QA Engineer',
    shortName: 'QA',
    role:      'Quality',
    status:    'idle',
    pct:       0,
    task:      'Awaiting test plan',
    urlKey:    'qa-engineer',
  },
  {
    id:        'screenplay-parser',
    name:      'Screenplay Parser',
    shortName: 'Screenplay',
    role:      'Script Analysis',
    status:    'idle',
    pct:       0,
    task:      'Parser on standby',
    urlKey:    'screenplay-parser',
  },
]

const PAPERCLIP_BOARD = 'http://localhost:3100'

// ── Shared UI atoms ────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-2 border border-border rounded-xl flex flex-col min-h-0 ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ label, badge, badgeColor = 'bg-lemon-400 text-slate-950' }: {
  label: string
  badge?: string | number
  badgeColor?: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      {badge !== undefined && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
      )}
    </div>
  )
}

// ── Agent Fleet Strip ─────────────────────────────────────────────────────────

const STATUS_DOT: Record<AgentStatus, string> = {
  active: 'bg-status-green',
  review: 'bg-status-hold',
  idle:   'bg-gray-600',
}

const STATUS_BORDER: Record<AgentStatus, string> = {
  active: 'border-status-dev/60',
  review: 'border-status-hold',
  idle:   'border-border',
}

const STATUS_BAR: Record<AgentStatus, string> = {
  active: 'bg-status-dev',
  review: 'bg-status-hold',
  idle:   'bg-gray-700',
}

const online  = AGENTS.filter(a => a.status !== 'idle').length
const total   = AGENTS.length

function AgentFleetStrip() {
  return (
    <div className="px-4 pt-3 pb-0 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-700">
          Agent Fleet — {online} of {total} active
        </span>
      </div>
      <div className="flex gap-2">
        {AGENTS.map(ag => (
          <a
            key={ag.id}
            href={`${PAPERCLIP_BOARD}/LEMA/agents/${ag.urlKey}`}
            target="_blank"
            rel="noreferrer"
            title={`${ag.name} — ${ag.task}`}
            className={`flex-1 bg-surface-2 border rounded-lg p-2.5 hover:bg-surface-3 transition-colors min-w-0 ${STATUS_BORDER[ag.status]}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[ag.status]}`} />
              <span className="text-[10px] font-bold text-gray-100 truncate">{ag.shortName}</span>
            </div>
            <p className="text-[8px] text-gray-700 truncate mb-1.5">{ag.role}</p>
            <p className="text-[8px] text-gray-600 truncate mb-2 leading-tight">{ag.task}</p>
            <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
              {ag.pct > 0 && (
                <div
                  className={`h-full rounded-full ${STATUS_BAR[ag.status]}`}
                  style={{ width: `${ag.pct}%` }}
                />
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Your Move ─────────────────────────────────────────────────────────────────

function YourMoveSection({ titles }: { titles: Title[] }) {
  const decisions = useMemo(() => {
    return titles
      .filter(t =>
        t.status !== 'killed' &&
        (
          t.pipelineStage === 'pitched' ||
          t.pipelineStage === 'negotiation' ||
          (t.pipelineStage === 'pitch_ready' && t.status === 'development')
        )
      )
      .sort((a, b) => {
        const aD = nearestDeadline(a) ?? Infinity
        const bD = nearestDeadline(b) ?? Infinity
        return aD !== bD ? aD - bD : daysSince(b.updatedAt) - daysSince(a.updatedAt)
      })
      .slice(0, 8)
  }, [titles])

  return (
    <Card className="flex-[0_0_auto]">
      <CardHeader label="Your Move — Decision Queue" badge={decisions.length} />
      {decisions.length === 0 ? (
        <p className="text-xs text-gray-700 text-center py-4">Queue clear — no titles awaiting a decision</p>
      ) : (
        <>
          <div className="grid grid-cols-[1fr_52px_84px_48px_60px] gap-2 px-4 py-1.5 border-b border-border/40 text-[9px] font-semibold uppercase tracking-wider text-gray-700 shrink-0">
            <span>Title</span>
            <span>Format</span>
            <span>Stage</span>
            <span className="text-right">Wait</span>
            <span className="text-right">Deadline</span>
          </div>
          <div className="overflow-hidden">
            {decisions.map(t => {
              const waiting  = daysSince(t.updatedAt)
              const deadline = nearestDeadline(t)
              return (
                <Link
                  key={t.id}
                  to={`/titles/${t.id}`}
                  className="grid grid-cols-[1fr_52px_84px_48px_60px] gap-2 items-center px-4 py-2 border-b border-border/30 last:border-0 hover:bg-surface-3 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-200 group-hover:text-lemon-400 transition-colors truncate">{t.name}</p>
                    {t.genre?.length > 0 && (
                      <p className="text-[9px] text-gray-700 truncate">{t.genre.slice(0, 2).join(' · ')}</p>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-600">{formatLabel(t.format)}</span>
                  <span className="text-[9px] text-gray-600">{STAGE_LABELS[t.pipelineStage]}</span>
                  <span className={`text-xs text-right tabular-nums font-medium ${waitColor(waiting)}`}>{waiting}d</span>
                  <span className={`text-xs text-right tabular-nums ${deadlineColor(deadline)}`}>
                    {deadline !== null ? `${deadline}d` : '—'}
                  </span>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

// ── My Watchlist — star/pin any project ───────────────────────────────────────

function MyWatchlistSection({ titles }: { titles: Title[] }) {
  const { starred, toggle, isStarred } = useWatchlistStore()

  const watchlist = useMemo(() => {
    const active = titles.filter(t => t.status !== 'killed')

    if (starred.length > 0) {
      // Show starred titles first, sorted by urgency, then remaining by urgency
      const pinned    = active.filter(t => starred.includes(t.id))
        .sort((a, b) => (nearestDeadline(a) ?? Infinity) - (nearestDeadline(b) ?? Infinity))
      const unpinned  = active.filter(t => !starred.includes(t.id))
        .sort((a, b) => (nearestDeadline(a) ?? Infinity) - (nearestDeadline(b) ?? Infinity))
        .slice(0, Math.max(0, 7 - pinned.length))
      return [...pinned, ...unpinned]
    }

    return active
      .sort((a, b) => (nearestDeadline(a) ?? Infinity) - (nearestDeadline(b) ?? Infinity))
      .slice(0, 7)
  }, [titles, starred])

  return (
    <Card className="flex-1">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">My Watchlist</span>
        <div className="flex items-center gap-2">
          {starred.length > 0 && (
            <span className="text-[9px] text-lemon-400 font-semibold">★ {starred.length} pinned</span>
          )}
          <span className="text-[9px] text-gray-700">click ★ to pin</span>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <p className="text-xs text-gray-700 text-center py-4">No active projects</p>
      ) : (
        <>
          <div className="grid grid-cols-[20px_1fr_60px_80px_100px_52px] gap-2 px-4 py-1.5 border-b border-border/40 text-[9px] font-semibold uppercase tracking-wider text-gray-700 shrink-0">
            <span />
            <span>Project</span>
            <span>Status</span>
            <span>Health</span>
            <span>Next Action</span>
            <span className="text-right">Age</span>
          </div>
          <div className="flex-1 overflow-hidden">
            {watchlist.map(t => {
              const age      = daysSince(t.updatedAt)
              const deadline = nearestDeadline(t)
              const pct      = deadline !== null
                ? Math.max(0, Math.min(100, Math.round((1 - deadline / 90) * 100)))
                : Math.max(0, 100 - Math.round((age / 90) * 100))
              const isActive = t.status === 'development'
              const isHold   = t.status === 'hold'
              const dotColor = isActive ? 'bg-status-green' : isHold ? 'bg-status-hold' : 'bg-gray-600'
              const txtColor = isActive ? 'text-status-green' : isHold ? 'text-status-hold' : 'text-gray-500'
              const statusLbl = isActive ? 'Active' : isHold ? 'On Hold' : t.status
              const pinned   = isStarred(t.id)

              return (
                <div
                  key={t.id}
                  className="grid grid-cols-[20px_1fr_60px_80px_100px_52px] gap-2 items-center px-4 py-1.5 border-b border-border/30 last:border-0 hover:bg-surface-3 transition-colors group"
                >
                  <button
                    onClick={() => toggle(t.id)}
                    title={pinned ? 'Unpin from watchlist' : 'Pin to watchlist'}
                    className={`text-sm leading-none focus:outline-none transition-colors ${pinned ? 'text-lemon-400' : 'text-gray-700 hover:text-gray-400'}`}
                  >
                    {pinned ? '★' : '☆'}
                  </button>
                  <Link to={`/titles/${t.id}`} className="min-w-0">
                    <p className="text-xs font-medium text-gray-200 group-hover:text-lemon-400 transition-colors truncate">{t.name}</p>
                    <p className="text-[9px] text-gray-700 truncate">{STAGE_LABELS[t.pipelineStage]}</p>
                  </Link>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    <span className={`text-[9px] font-medium ${txtColor}`}>{statusLbl}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] text-gray-600 tabular-nums shrink-0">{pct}%</span>
                  </div>
                  <span className="text-[9px] text-gray-500 truncate">
                    {deadline !== null
                      ? `Deadline in ${deadline}d`
                      : age < 3
                      ? 'Updated recently'
                      : `${age}d since update`}
                  </span>
                  <span className={`text-xs text-right tabular-nums ${age >= 14 ? 'text-status-kill' : age >= 7 ? 'text-status-hold' : 'text-gray-600'}`}>
                    {age}d
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

// ── Studio Pulse — Pipeline ────────────────────────────────────────────────────

const STAGE_COLORS: Partial<Record<PipelineStage, string>> = {
  ip_scouting:  'bg-gray-600',
  optioned:     'bg-blue-600',
  treatment:    'bg-blue-500',
  pilot_script: 'bg-status-dev',
  series_bible: 'bg-indigo-400',
  pitch_ready:  'bg-lemon-500',
  pitched:      'bg-lemon-400',
  negotiation:  'bg-status-hold',
  greenlit:     'bg-status-green',
}

function StudioPulseSection({ titles }: { titles: Title[] }) {
  const funnelData = useMemo(() => {
    const counts: Partial<Record<PipelineStage, number>> = {}
    for (const t of titles.filter(t => t.status !== 'killed')) {
      counts[t.pipelineStage] = (counts[t.pipelineStage] ?? 0) + 1
    }
    return PIPELINE_ORDER
      .map(stage => ({ stage, label: STAGE_LABELS[stage], count: counts[stage] ?? 0 }))
      .filter(r => r.count > 0)
  }, [titles])

  const maxCount    = Math.max(...funnelData.map(r => r.count), 1)
  const totalActive = titles.filter(t => t.status !== 'killed').length
  const stalled     = titles.filter(t => t.status !== 'killed' && daysSince(t.updatedAt) >= 14).length

  return (
    <Card className="flex-[0_0_auto]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Studio Pulse — Pipeline</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-status-green/10 text-status-green border border-status-green/20">
            {totalActive} active
          </span>
          {stalled > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-status-hold/10 text-status-hold border border-status-hold/20">
              {stalled} stalled
            </span>
          )}
        </div>
      </div>
      <div className="px-4 py-3">
        {funnelData.length === 0 ? (
          <p className="text-xs text-gray-700 text-center py-2">No titles in pipeline</p>
        ) : (
          <div className="space-y-2">
            {funnelData.map(({ stage, label, count }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-[10px] text-gray-600 shrink-0 w-20 text-right truncate">{label}</span>
                <div className="flex-1 h-4 bg-surface-3 rounded-sm overflow-hidden">
                  <div
                    className={`h-full rounded-sm transition-all ${STAGE_COLORS[stage] ?? 'bg-status-dev/50'}`}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold tabular-nums text-gray-400 w-4 text-right shrink-0">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Agent Roster ──────────────────────────────────────────────────────────────

function AgentRosterSection() {
  return (
    <Card className="flex-1">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Agent Fleet</span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-status-dev/10 text-status-dev border border-status-dev/20">
          {online} / {total} active
        </span>
      </div>
      <div className="flex-1 overflow-hidden px-3 py-2">
        {AGENTS.map(ag => (
          <a
            key={ag.id}
            href={`${PAPERCLIP_BOARD}/LEMA/agents/${ag.urlKey}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 py-1.5 border-b border-border/30 last:border-0 hover:bg-surface-3 -mx-1 px-1 rounded transition-colors"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[ag.status]}`} />
            <span className={`text-[10px] font-medium w-16 shrink-0 truncate ${ag.status === 'idle' ? 'text-gray-600' : 'text-gray-200'}`}>
              {ag.shortName}
            </span>
            <div className="flex-1 h-1 bg-surface-3 rounded-full overflow-hidden">
              {ag.pct > 0 && (
                <div
                  className={`h-full rounded-full ${STATUS_BAR[ag.status]}`}
                  style={{ width: `${ag.pct}%` }}
                />
              )}
            </div>
            <span className="text-[9px] text-gray-700 tabular-nums w-6 text-right shrink-0">
              {ag.pct > 0 ? `${ag.pct}%` : '—'}
            </span>
          </a>
        ))}
      </div>
    </Card>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function CommandCenterPage() {
  const { titles, loading } = useTitleStore()

  if (loading) {
    return (
      <div className="-m-6 flex flex-col overflow-hidden animate-pulse" style={{ height: 'calc(100vh - 52px)' }}>
        <div className="h-24 bg-surface-2 m-4 rounded-xl border border-border" />
        <div className="flex flex-1 gap-3 px-4 pb-4 min-h-0">
          <div className="flex flex-col gap-3 min-h-0" style={{ flex: '0 0 57%' }}>
            <div className="flex-1 bg-surface-2 border border-border rounded-xl" />
            <div className="flex-1 bg-surface-2 border border-border rounded-xl" />
          </div>
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="flex-1 bg-surface-2 border border-border rounded-xl" />
            <div className="flex-1 bg-surface-2 border border-border rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="-m-6 flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>

      {/* Agent fleet — real agents, click through to Paperclip board */}
      <AgentFleetStrip />

      {/* Body — 57% / 43% two-column, zero scroll */}
      <div className="flex flex-1 gap-3 px-4 pt-3 pb-4 min-h-0">

        {/* Left: decision queue + watchlist */}
        <div className="flex flex-col gap-3 min-h-0" style={{ flex: '0 0 57%' }}>
          <YourMoveSection titles={titles} />
          <MyWatchlistSection titles={titles} />
        </div>

        {/* Right: pipeline + agent roster */}
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <StudioPulseSection titles={titles} />
          <AgentRosterSection />
        </div>

      </div>
    </div>
  )
}
