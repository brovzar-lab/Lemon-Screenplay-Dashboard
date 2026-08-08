import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

// ── Paperclip API client ────────────────────────────────────────────────────────

const BASE    = import.meta.env.VITE_PAPERCLIP_API_URL as string | undefined
const COMPANY = import.meta.env.VITE_PAPERCLIP_COMPANY_ID as string | undefined
const KEY     = import.meta.env.VITE_PAPERCLIP_API_KEY as string | undefined

function paperclipEnabled() {
  return Boolean(BASE && COMPANY && KEY)
}

async function paperclipFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json() as Promise<T>
}

const Q_OPTS = { staleTime: 60_000, refetchInterval: 120_000, enabled: paperclipEnabled() }

// ── Types ───────────────────────────────────────────────────────────────────────

interface Project {
  id: string
  name: string
  status: string
  format: string | null
  sourceType: string | null
}

interface Agent {
  id: string
  name: string
  role: string
  status: 'idle' | 'running' | 'error'
}

interface DashboardData {
  agents: { active: number; running: number; paused: number; error: number }
  tasks:  { open: number; inProgress: number; blocked: number; done: number }
  costs:  { monthUtilizationPercent: number }
}

interface Issue {
  id: string
  identifier: string
  title: string
  status: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  billyCall: string | null
  updatedAt: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function bucketFormat(fmt: string | null): string {
  if (!fmt) return 'Other'
  const f = fmt.toLowerCase()
  if (f.includes('documentary') || f.includes('doc')) return 'Doc'
  if (f.includes('limited'))                           return 'Limited'
  if (f.includes('film'))                              return 'Film'
  return 'Series'
}

// ── Section header (shared) ─────────────────────────────────────────────────────

function SectionHeader({
  accent, icon, title, sub, extra,
}: {
  accent: string
  icon: string
  title: string
  sub: string
  extra?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-1 h-5 rounded-full flex-shrink-0 ${accent}`} />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-100">
            {icon} {title}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
        </div>
      </div>
      {extra}
    </div>
  )
}

// ── 1. Sticky identity row ──────────────────────────────────────────────────────

function IdentityRow() {
  return (
    <div className="sticky top-0 z-20 h-11 bg-surface-2/95 backdrop-blur-sm border-b border-border flex items-center px-4 sm:px-6 gap-3">
      <span className="text-[13px] font-bold text-gray-100 tracking-tight">Lemon Studio</span>
      <span className="text-gray-700 text-[11px]">/</span>
      <span className="text-[13px] text-gray-400">Command Center</span>
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="w-2 h-2 rounded-full bg-status-green animate-pulse flex-shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Live</span>
      </div>
    </div>
  )
}

// ── 2. KPI tiles ────────────────────────────────────────────────────────────────

function KpiTile({
  value, label, color = 'text-gray-100',
}: {
  value: number | string
  label: string
  color?: string
}) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className={`text-[28px] font-extrabold leading-none tabular-nums tracking-tighter ${color}`}>
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">{label}</span>
    </div>
  )
}

function KpiTiles({
  projects,
  issueCount,
  agents,
}: {
  projects: Project[] | undefined
  issueCount: number | undefined
  agents: Agent[] | undefined
}) {
  const activeProjects = (projects ?? []).filter(p =>
    p.status === 'in_progress' || p.status === 'planned',
  ).length

  const running = (agents ?? []).filter(a => a.status === 'running').length
  const total   = (agents ?? []).length

  return (
    <div className="grid grid-cols-3 gap-4 py-6">
      <KpiTile value={activeProjects} label="Active Projects" color="text-gray-100" />
      <KpiTile value={issueCount ?? '—'} label="Decisions Pending" color="text-lemon-400" />
      <KpiTile
        value={total ? `${running}/${total}` : '—'}
        label="Agents Live"
        color="text-status-green"
      />
    </div>
  )
}

// ── 3. Decision queue ───────────────────────────────────────────────────────────

const QUEUE_LIMIT = 10

function priorityBadge(p: string) {
  const map: Record<string, string> = {
    critical: 'text-status-kill bg-status-kill/10 border-status-kill/25',
    high:     'text-lemon-400 bg-lemon-400/10 border-lemon-400/25',
    medium:   'text-gray-400 bg-surface-3 border-border',
    low:      'text-gray-600 bg-surface-3 border-border',
  }
  return map[p] ?? map.medium
}

function DecisionQueue({ issues }: { issues: Issue[] | undefined }) {
  const [expanded, setExpanded] = useState(false)

  const sorted = useMemo(
    () =>
      [...(issues ?? [])].sort((a, b) => {
        const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        if (pd !== 0) return pd
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      }),
    [issues],
  )

  const visible = expanded ? sorted : sorted.slice(0, QUEUE_LIMIT)
  const hidden  = sorted.length - QUEUE_LIMIT

  if (!issues) {
    return (
      <div>
        <SectionHeader accent="bg-lemon-400" icon="⚡" title="Decision Queue" sub="Issues awaiting Billy call" />
        <div className="bg-surface-2 border border-border rounded-xl p-6 text-center text-gray-600 text-sm">
          Loading…
        </div>
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div>
        <SectionHeader accent="bg-lemon-400" icon="⚡" title="Decision Queue" sub="Issues awaiting Billy call" />
        <div className="bg-surface-2 border border-border rounded-xl p-6 text-center text-gray-600 text-sm">
          No pending decisions.
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader
        accent="bg-lemon-400"
        icon="⚡"
        title="Decision Queue"
        sub={`${sorted.length} issues awaiting Billy call · sorted by priority`}
        extra={
          hidden > 0 && !expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="text-[10px] text-gray-600 bg-surface-3 border border-border rounded-full px-2.5 py-0.5 hover:text-gray-300 transition-colors"
            >
              + {hidden} more
            </button>
          ) : expanded && sorted.length > QUEUE_LIMIT ? (
            <button
              onClick={() => setExpanded(false)}
              className="text-[10px] text-gray-600 bg-surface-3 border border-border rounded-full px-2.5 py-0.5 hover:text-gray-300 transition-colors"
            >
              Show less
            </button>
          ) : null
        }
      />
      <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
        <div
          className="hidden sm:grid px-3.5 py-1.5 border-b border-border text-[10px] font-semibold uppercase tracking-wide text-gray-700 gap-2"
          style={{ gridTemplateColumns: '80px 1fr 80px 100px' }}
        >
          <span>ID</span>
          <span>Title</span>
          <span>Priority</span>
          <span className="text-right">Last updated</span>
        </div>
        {visible.map(issue => (
          <div
            key={issue.id}
            className="border-b border-border/50 last:border-0 hover:bg-surface-3 transition-colors"
          >
            {/* Desktop */}
            <div
              className="hidden sm:grid px-3.5 py-2.5 items-center gap-2"
              style={{ gridTemplateColumns: '80px 1fr 80px 100px' }}
            >
              <span className="text-[11px] font-mono text-gray-500">{issue.identifier}</span>
              <span className="text-[13px] font-medium text-gray-200 truncate">{issue.title}</span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 w-fit ${priorityBadge(issue.priority)}`}
              >
                {issue.priority}
              </span>
              <span className="text-[11px] text-gray-500 text-right">{relativeTime(issue.updatedAt)}</span>
            </div>
            {/* Mobile */}
            <div className="sm:hidden px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-mono text-gray-600">{issue.identifier}</div>
                  <div className="text-[13px] font-medium text-gray-200 truncate mt-0.5">{issue.title}</div>
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 flex-shrink-0 ${priorityBadge(issue.priority)}`}
                >
                  {issue.priority}
                </span>
              </div>
              <div className="text-[10px] text-gray-600 mt-1">{relativeTime(issue.updatedAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 4. Project breakdown ────────────────────────────────────────────────────────

function FormatBars({ projects }: { projects: Project[] }) {
  const counts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const p of projects) {
      const bucket = bucketFormat(p.format)
      acc[bucket] = (acc[bucket] ?? 0) + 1
    }
    return Object.entries(acc).sort((a, b) => b[1] - a[1])
  }, [projects])

  const max = Math.max(...counts.map(([, n]) => n), 1)

  const barColor: Record<string, string> = {
    Film:    'rgba(245,197,24,0.55)',
    Series:  'rgba(99,102,241,0.55)',
    Limited: 'rgba(34,197,94,0.5)',
    Doc:     'rgba(99,102,241,0.3)',
    Other:   'rgba(100,100,100,0.4)',
  }
  const textColor: Record<string, string> = {
    Film:    'text-lemon-400',
    Series:  'text-blue-400',
    Limited: 'text-status-green',
    Doc:     'text-gray-400',
    Other:   'text-gray-600',
  }

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4">
      <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-3">
        By Format
      </div>
      <div className="flex flex-col gap-2">
        {counts.map(([label, count]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-14 text-[10px] text-gray-600 text-right flex-shrink-0">{label}</span>
            <div className="flex-1 h-3.5 bg-surface-3 rounded-[3px] overflow-hidden">
              <div
                className="h-full rounded-[3px]"
                style={{ width: `${(count / max) * 100}%`, background: barColor[label] ?? barColor.Other }}
              />
            </div>
            <span className={`w-7 text-[12px] font-bold tabular-nums text-right flex-shrink-0 ${textColor[label] ?? 'text-gray-500'}`}>
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function IpDonut({ projects }: { projects: Project[] }) {
  const original = projects.filter(p => p.sourceType === 'original').length
  const ip       = projects.length - original
  const total    = projects.length || 1

  const R = 36
  const CX = 48
  const CY = 48
  const STROKE = 10
  const circ = 2 * Math.PI * R

  const origArc  = (original / total) * circ
  const ipArc    = (ip / total) * circ

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4">
      <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-3">
        IP vs Original
      </div>
      <div className="flex items-center gap-4">
        <svg width="96" height="96" viewBox="0 0 96 96" className="flex-shrink-0">
          {/* Background ring */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
          {/* Original arc (lemon, starts at top) */}
          <circle
            cx={CX} cy={CY} r={R} fill="none"
            stroke="rgba(245,197,24,0.7)" strokeWidth={STROKE}
            strokeDasharray={`${origArc} ${circ}`}
            strokeDashoffset={circ / 4}
            strokeLinecap="round"
          />
          {/* IP arc (indigo, continues after original) */}
          <circle
            cx={CX} cy={CY} r={R} fill="none"
            stroke="rgba(99,102,241,0.6)" strokeWidth={STROKE}
            strokeDasharray={`${ipArc} ${circ}`}
            strokeDashoffset={circ / 4 - origArc}
            strokeLinecap="round"
          />
          <text x={CX} y={CY - 5} textAnchor="middle" className="text-[13px]" fill="#e2e8f0" fontSize="14" fontWeight="700">
            {Math.round((original / total) * 100)}%
          </text>
          <text x={CX} y={CY + 10} textAnchor="middle" fill="#6b7280" fontSize="9">
            original
          </text>
        </svg>
        <div className="flex flex-col gap-2 flex-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-lemon-400/70 flex-shrink-0" />
            <span className="text-[11px] text-gray-400 flex-1">Original</span>
            <span className="text-[13px] font-bold tabular-nums text-lemon-400">{original}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500/60 flex-shrink-0" />
            <span className="text-[11px] text-gray-400 flex-1">IP / Adapted</span>
            <span className="text-[13px] font-bold tabular-nums text-blue-400">{ip}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProjectBreakdown({ projects }: { projects: Project[] | undefined }) {
  const activeProjects = useMemo(
    () => (projects ?? []).filter(p => p.status !== 'cancelled'),
    [projects],
  )

  if (!projects) {
    return (
      <div>
        <SectionHeader accent="bg-indigo-500" icon="📊" title="Project Breakdown" sub="Format mix and source type" />
        <div className="bg-surface-2 border border-border rounded-xl p-6 text-center text-gray-600 text-sm">
          Loading…
        </div>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader accent="bg-indigo-500" icon="📊" title="Project Breakdown" sub={`${activeProjects.length} active projects`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormatBars projects={activeProjects} />
        <IpDonut projects={activeProjects} />
      </div>
    </div>
  )
}

// ── 5. Watchlist ────────────────────────────────────────────────────────────────

function Watchlist({ projects }: { projects: Project[] | undefined }) {
  return (
    <div>
      <SectionHeader
        accent="bg-status-dev"
        icon="★"
        title="Watchlist"
        sub="Starred and pinned projects"
      />
      <div className="bg-surface-2 border border-border rounded-xl p-6 text-center">
        <p className="text-[13px] text-gray-500">
          No starred projects yet.
        </p>
        <p className="text-[11px] text-gray-700 mt-1">
          Project starring is not yet available in the API.
        </p>
      </div>
    </div>
  )
}

// ── 6. Agent health ─────────────────────────────────────────────────────────────

function AgentHealth({
  agents,
  dashboard,
}: {
  agents: Agent[] | undefined
  dashboard: DashboardData | undefined
}) {
  const running = (agents ?? []).filter(a => a.status === 'running').length
  const idle    = (agents ?? []).filter(a => a.status === 'idle').length
  const blocked = dashboard?.tasks.blocked ?? 0
  const budgetPct = dashboard?.costs.monthUtilizationPercent ?? 0

  return (
    <div>
      <SectionHeader accent="bg-status-green" icon="🤖" title="Agent Health" sub="Current studio agent status" />
      <div className="bg-surface-2 border border-border rounded-xl px-5 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <StatPill label="Running" value={running} color="text-status-green" />
          <StatPill label="Idle"    value={idle}    color="text-gray-400" />
          <StatPill label="Blocked" value={blocked} color={blocked > 0 ? 'text-status-kill' : 'text-gray-400'} />
          <div className="flex-1 min-w-40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                Monthly Budget
              </span>
              <span className="text-[11px] font-bold tabular-nums text-gray-400">
                {budgetPct}%
              </span>
            </div>
            <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div
                className={[
                  'h-full rounded-full transition-all',
                  budgetPct >= 80 ? 'bg-status-kill' : budgetPct >= 50 ? 'bg-status-hold' : 'bg-status-green',
                ].join(' ')}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`text-[22px] font-extrabold leading-none tabular-nums ${color}`}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">{label}</span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function CommandCenterPage() {
  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects', COMPANY],
    queryFn:  () => paperclipFetch(`/api/companies/${COMPANY}/projects`),
    ...Q_OPTS,
  })

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['agents', COMPANY],
    queryFn:  () => paperclipFetch(`/api/companies/${COMPANY}/agents`),
    ...Q_OPTS,
  })

  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ['dashboard', COMPANY],
    queryFn:  () => paperclipFetch(`/api/companies/${COMPANY}/dashboard`),
    ...Q_OPTS,
  })

  const { data: decisionIssues } = useQuery<Issue[]>({
    queryKey: ['issues-billy-null', COMPANY],
    queryFn:  () => paperclipFetch(`/api/companies/${COMPANY}/issues?billyCall=null`),
    ...Q_OPTS,
  })

  return (
    <div className="min-h-screen bg-slate-950">
      <IdentityRow />
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 pb-12">
        <KpiTiles
          projects={projects}
          issueCount={decisionIssues?.length}
          agents={agents}
        />
        <div className="flex flex-col gap-8">
          <DecisionQueue issues={decisionIssues} />
          <ProjectBreakdown projects={projects} />
          <Watchlist projects={projects} />
          <AgentHealth agents={agents} dashboard={dashboard} />
        </div>
      </div>
    </div>
  )
}
