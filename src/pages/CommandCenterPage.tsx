import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTitleStore } from '../store/titleStore'
import { StarToggle } from '../components/StarToggle'
import type { Title, PipelineStage } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

function nearestDeadline(t: Title): number | null {
  const days: number[] = []
  if (t.keyDates.optionExpiry) {
    const d = daysUntil(t.keyDates.optionExpiry)
    if (d >= 0) days.push(d)
  }
  if (t.keyDates.pitchDate) {
    const d = daysUntil(t.keyDates.pitchDate)
    if (d >= 0) days.push(d)
  }
  return days.length ? Math.min(...days) : null
}

function formatLabel(fmt: string): string {
  switch (fmt) {
    case 'feature_film':   return 'Film'
    case 'limited_series': return 'Limited'
    case 'documentary':    return 'Doc'
    default:               return 'Series'
  }
}

function stageLabel(s: PipelineStage): string {
  const map: Record<PipelineStage, string> = {
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
  return map[s] ?? s
}

function waitColor(days: number): string {
  if (days >= 14) return 'text-status-kill'
  if (days >= 7)  return 'text-status-hold'
  return 'text-gray-500'
}

function deadlineColor(d: number | null): string {
  if (d === null) return 'text-gray-700'
  if (d < 7)      return 'text-status-kill'
  if (d < 14)     return 'text-status-hold'
  return 'text-gray-500'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Paperclip agent data ───────────────────────────────────────────────────────

interface PaperclipAgent {
  id: string
  name: string
  role: string
  status: 'idle' | 'running' | 'error'
}

interface PaperclipStats {
  agents: { active: number; running: number; paused: number; error: number }
  tasks:  { open: number; inProgress: number; blocked: number; done: number }
}

async function fetchPaperclipData(): Promise<{ stats: PaperclipStats; agents: PaperclipAgent[] } | null> {
  const base    = import.meta.env.VITE_PAPERCLIP_API_URL as string | undefined
  const company = import.meta.env.VITE_PAPERCLIP_COMPANY_ID as string | undefined
  const key     = import.meta.env.VITE_PAPERCLIP_API_KEY as string | undefined
  if (!base || !company || !key) return null
  try {
    const headers = { Authorization: `Bearer ${key}` }
    const [statsRes, agentsRes] = await Promise.all([
      fetch(`${base}/api/companies/${company}/dashboard`, { headers }),
      fetch(`${base}/api/companies/${company}/agents`, { headers }),
    ])
    if (!statsRes.ok || !agentsRes.ok) return null
    const [stats, agents] = await Promise.all([statsRes.json(), agentsRes.json()])
    return { stats, agents }
  } catch {
    return null
  }
}

// ── Pipeline stage order / groupings ──────────────────────────────────────────

const PIPELINE_ORDER: PipelineStage[] = [
  'ip_scouting', 'optioned', 'treatment', 'pilot_script',
  'series_bible', 'pitch_ready', 'pitched', 'negotiation', 'greenlit',
]

const PITCH_STAGES = new Set<PipelineStage>(['pitch_ready', 'pitched', 'negotiation'])

// ── Live timestamp ─────────────────────────────────────────────────────────────

function useLiveClock() {
  const [ts, setTs] = useState(() => new Date().toUTCString().slice(0, 22) + ' UTC')
  useEffect(() => {
    const id = setInterval(() => {
      setTs(new Date().toUTCString().slice(0, 22) + ' UTC')
    }, 30_000)
    return () => clearInterval(id)
  }, [])
  return ts
}

// ── KPI Bar ────────────────────────────────────────────────────────────────────

function KpiBar({ titles }: { titles: Title[] }) {
  const active    = titles.filter(t => t.status !== 'killed')
  const greenlit  = active.filter(t => t.status === 'greenlit').length
  const activeDev = active.filter(t => t.status === 'active').length
  const inDev     = active.filter(t => t.status === 'development').length
  const pitching  = active.filter(t => PITCH_STAGES.has(t.pipelineStage)).length
  const hold      = active.filter(t => t.status === 'hold').length
  return (
    <div className="bg-surface-2 border-b border-border px-3 sm:px-6 py-2 sm:py-2.5 flex items-center flex-wrap gap-4 sm:gap-6 flex-shrink-0">
      <KpiItem value={active.length} label="Active Titles" />
      <div className="hidden sm:block w-px h-8 bg-border" />
      <KpiItem value={greenlit}  label="Greenlit"       color="text-status-green" />
      <KpiItem value={activeDev} label="Active Dev"     color="text-status-dev" />
      <KpiItem value={inDev}     label="In Development" color="text-blue-400" />
      <KpiItem value={pitching}  label="Pitching"       color="text-lemon-400" />
      <KpiItem value={hold}      label="On Hold"        color="text-status-hold" />
    </div>
  )
}

function KpiItem({ value, label, color = 'text-gray-100' }: { value: number; label: string; color?: string }) {
  return (
    <div className="flex flex-col gap-px">
      <span className={`text-[22px] font-bold tabular-nums leading-tight ${color}`}>{value}</span>
      <span className="text-[10px] text-gray-600 uppercase tracking-wide">{label}</span>
    </div>
  )
}

// ── Command Strip (Hero) ───────────────────────────────────────────────────────

function CommandStrip({
  decisions,
  watchlist,
  agentsRunning,
  stalled,
}: {
  decisions: number
  watchlist: number
  agentsRunning: number | null
  stalled: number
}) {
  const ts = useLiveClock()
  return (
    <div className="bg-surface-2/90 border-b border-border flex-shrink-0 grid grid-cols-2 sm:flex sm:items-stretch sm:h-20 px-3 sm:px-6 py-2 sm:py-0">
      <HeroNum num={decisions}      label="Decisions Pending" color="text-lemon-400" />
      <HeroNum num={watchlist}      label="On Watchlist"      color="text-status-dev" />
      <HeroNum num={agentsRunning ?? '--'} label="Agents Running"   color="text-status-green" />
      <HeroNum num={stalled}        label="Titles Stalled"    color="text-status-hold" last />
      <div className="hidden sm:flex flex-1" />
      <div className="hidden sm:flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-lemon-400 animate-pulse flex-shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-lemon-400">
          Mission Control · Live
        </span>
        <span className="text-[11px] text-gray-700 ml-5 tabular-nums">{ts}</span>
      </div>
    </div>
  )
}

function HeroNum({
  num, label, color, last,
}: {
  num: number | string
  label: string
  color: string
  last?: boolean
}) {
  return (
    <div className={`flex flex-col items-start justify-center gap-1 px-3 sm:px-7 py-2 sm:py-0 ${last ? '' : 'sm:border-r sm:border-border/70'}`}>
      <span className={`text-[28px] sm:text-[40px] font-extrabold leading-none tabular-nums tracking-tighter ${color}`}>
        {num}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-700">{label}</span>
    </div>
  )
}

// ── Agent Board (full-width row of agent cards) ────────────────────────────────

function AgentBoard({ agents }: { agents: PaperclipAgent[] }) {
  if (agents.length === 0) return null
  const running = agents.filter(a => a.status === 'running').length
  const blocked = agents.filter(a => a.status === 'error').length
  const idle    = agents.filter(a => a.status === 'idle').length
  return (
    <div className="bg-surface border-b border-border px-6 py-2.5 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 rounded-full bg-status-green flex-shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Agent Board
          </span>
          <span className="text-[10px] text-gray-700">
            — {running} running · {blocked} blocked · {idle} idle
          </span>
        </div>
      </div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
      >
        {agents.map(a => <AgentCard key={a.id} agent={a} />)}
      </div>
    </div>
  )
}

function AgentCard({ agent }: { agent: PaperclipAgent }) {
  const isRun = agent.status === 'running'
  const isBlk = agent.status === 'error'
  return (
    <div
      className={[
        'px-2.5 py-2 rounded-lg border flex flex-col gap-0.5',
        isRun ? 'bg-status-green/[0.07] border-status-green/25' : '',
        isBlk ? 'bg-status-kill/[0.07] border-status-kill/30' : '',
        !isRun && !isBlk ? 'bg-surface-3 border-border' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={[
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            isRun ? 'bg-status-green shadow-[0_0_4px_rgba(34,197,94,0.6)]' : '',
            isBlk ? 'bg-status-kill' : '',
            !isRun && !isBlk ? 'bg-gray-600' : '',
          ].join(' ')}
        />
        <span
          className={[
            'text-[11px] font-semibold truncate',
            isBlk ? 'text-status-kill/80' : 'text-gray-300',
          ].join(' ')}
        >
          {agent.name}{isBlk ? ' ⚠' : ''}
        </span>
      </div>
      <span
        className={[
          'text-[9px] truncate leading-tight',
          isRun ? 'text-status-green/55' : '',
          isBlk ? 'text-status-kill/45' : '',
          !isRun && !isBlk ? 'text-gray-700' : '',
        ].join(' ')}
      >
        {agent.role ?? 'Available'}
      </span>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

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
    <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
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

// ── YOUR MOVE — decision queue ─────────────────────────────────────────────────

const QUEUE_LIMIT = 8

function isDecision(t: Title): boolean {
  return (
    t.status !== 'killed' &&
    (t.pipelineStage === 'pitched' ||
     t.pipelineStage === 'negotiation' ||
     (t.pipelineStage === 'pitch_ready' && t.status === 'development'))
  )
}

function YourMove({ titles }: { titles: Title[] }) {
  const [expanded, setExpanded] = useState(false)

  const queue = useMemo(() =>
    titles
      .filter(isDecision)
      .sort((a, b) => {
        const aD = nearestDeadline(a) ?? Infinity
        const bD = nearestDeadline(b) ?? Infinity
        if (aD !== bD) return aD - bD
        return daysSince(b.updatedAt) - daysSince(a.updatedAt)
      }),
    [titles],
  )

  if (queue.length === 0) return null

  const visible = expanded ? queue : queue.slice(0, QUEUE_LIMIT)
  const hidden  = queue.length - QUEUE_LIMIT

  return (
    <div className="flex-shrink-0">
      <SectionHeader
        accent="bg-lemon-400"
        icon="⚡"
        title="Your Move"
        sub="Decision queue — sorted by urgency"
        extra={
          hidden > 0 && !expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="text-[10px] text-gray-600 bg-surface-3 border border-border rounded-full px-2.5 py-0.5 hover:text-gray-300 transition-colors"
            >
              + {hidden} more
            </button>
          ) : expanded && queue.length > QUEUE_LIMIT ? (
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
          style={{ gridTemplateColumns: '1fr 52px 94px 50px 72px 28px 28px' }}
        >
          <span>Title / Genre</span>
          <span>Format</span>
          <span>Stage</span>
          <span className="text-right">Waiting</span>
          <span className="text-right">Deadline</span>
          <span className="text-right">Flag</span>
          <span />
        </div>
        {visible.map(t => {
          const wait = daysSince(t.updatedAt)
          const dl   = nearestDeadline(t)
          const flag = dl !== null && dl < 7 ? '!!' : dl !== null && dl < 14 ? '!' : '—'
          return (
            <Link
              key={t.id}
              to={`/titles/${t.id}`}
              className="block border-b border-border/50 last:border-0 hover:bg-surface-3 transition-colors"
            >
              {/* Desktop grid layout */}
              <div
                className="hidden sm:grid px-3.5 py-2 items-center gap-2"
                style={{ gridTemplateColumns: '1fr 52px 94px 50px 72px 28px 28px' }}
              >
                <div>
                  <div className="text-[13px] font-medium text-gray-200 truncate">{t.name}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">{t.genre.slice(0, 2).join(' · ')}</div>
                </div>
                <span className="text-[11px] text-gray-500">{formatLabel(t.format)}</span>
                <span className="text-[11px] text-gray-500">{stageLabel(t.pipelineStage)}</span>
                <span className={`text-[12px] font-bold tabular-nums text-right ${waitColor(wait)}`}>
                  {wait}d
                </span>
                <span className={`text-[12px] font-bold tabular-nums text-right ${deadlineColor(dl)}`}>
                  {dl === null ? '—' : dl < 7 ? `🔴 ${dl}d` : `${dl}d`}
                </span>
                <span
                  className={`text-[11px] font-bold text-right ${
                    dl !== null && dl < 7
                      ? 'text-status-kill'
                      : dl !== null && dl < 14
                      ? 'text-status-hold'
                      : 'text-gray-700'
                  }`}
                >
                  {flag}
                </span>
                <div className="flex justify-end" onClick={e => e.preventDefault()}>
                  <StarToggle titleId={t.id} watched={t.ceoWatch ?? false} />
                </div>
              </div>
              {/* Mobile card layout */}
              <div className="sm:hidden px-3.5 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-gray-200 truncate">{t.name}</div>
                    <div className="text-[10px] text-gray-600 mt-0.5">
                      {stageLabel(t.pipelineStage)} · {formatLabel(t.format)} · {t.genre.slice(0, 1).join('')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.preventDefault()}>
                    <StarToggle titleId={t.id} watched={t.ceoWatch ?? false} />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className={`text-[11px] font-semibold tabular-nums ${waitColor(wait)}`}>Wait {wait}d</span>
                  <span className={`text-[11px] font-semibold tabular-nums ${deadlineColor(dl)}`}>
                    {dl === null ? 'No deadline' : `Due ${dl}d`}
                  </span>
                  {flag !== '—' && (
                    <span className={`text-[10px] font-bold ${dl !== null && dl < 7 ? 'text-status-kill' : 'text-status-hold'}`}>
                      {flag}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── MY WATCHLIST ───────────────────────────────────────────────────────────────

function MyWatchlist({ titles }: { titles: Title[] }) {
  const [expanded, setExpanded] = useState(false)

  const watched = useMemo(() =>
    titles.filter(t => t.ceoWatch === true && t.status !== 'killed'),
    [titles],
  )

  if (watched.length === 0) return null

  const visible = expanded ? watched : watched.slice(0, QUEUE_LIMIT)
  const hidden  = watched.length - QUEUE_LIMIT

  return (
    <div className="flex-shrink-0">
      <SectionHeader
        accent="bg-status-dev"
        icon="★"
        title="My Watchlist"
        sub="Starred projects — stage, activity, blockers"
        extra={
          hidden > 0 && !expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="text-[10px] text-gray-600 bg-surface-3 border border-border rounded-full px-2.5 py-0.5 hover:text-gray-300 transition-colors"
            >
              + {hidden} more
            </button>
          ) : expanded && watched.length > QUEUE_LIMIT ? (
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
          style={{ gridTemplateColumns: '1fr 90px 104px 1fr 28px' }}
        >
          <span>Project</span>
          <span>Stage</span>
          <span>Last Activity</span>
          <span>Blockers</span>
          <span />
        </div>
        {visible.map(t => (
          <Link
            key={t.id}
            to={`/titles/${t.id}`}
            className="block border-b border-border/50 last:border-0 hover:bg-surface-3 transition-colors"
          >
            {/* Desktop grid layout */}
            <div
              className="hidden sm:grid px-3.5 py-2 items-center gap-2"
              style={{ gridTemplateColumns: '1fr 90px 104px 1fr 28px' }}
            >
              <div>
                <div className="text-[13px] font-medium text-gray-200 truncate">{t.name}</div>
                <div className="text-[10px] text-gray-600 mt-0.5">
                  {t.genre.slice(0, 1).join('')} · {formatLabel(t.format)}
                </div>
              </div>
              <span className="text-[11px] text-gray-500">{stageLabel(t.pipelineStage)}</span>
              <span className="text-[11px] text-gray-500">{relativeTime(t.updatedAt)}</span>
              <span
                className={
                  t.blockers.length
                    ? 'text-[11px] text-status-hold flex items-center gap-1 truncate'
                    : 'text-[11px] text-status-green'
                }
              >
                {t.blockers.length ? (
                  <><span>⚠</span><span className="truncate">{t.blockers[0]}</span></>
                ) : (
                  'All clear'
                )}
              </span>
              <div className="flex justify-end" onClick={e => e.preventDefault()}>
                <StarToggle titleId={t.id} watched={true} />
              </div>
            </div>
            {/* Mobile card layout */}
            <div className="sm:hidden px-3.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-gray-200 truncate">{t.name}</div>
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    {t.genre.slice(0, 1).join('')} · {formatLabel(t.format)} · {stageLabel(t.pipelineStage)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.preventDefault()}>
                  <StarToggle titleId={t.id} watched={true} />
                </div>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-gray-600">{relativeTime(t.updatedAt)}</span>
                <span className={t.blockers.length ? 'text-[10px] text-status-hold' : 'text-[10px] text-status-green'}>
                  {t.blockers.length ? `⚠ ${t.blockers[0]}` : 'All clear'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── Studio Pulse (right sidebar) ───────────────────────────────────────────────

function StudioPulse({
  titles,
  agents,
  mobile = false,
}: {
  titles: Title[]
  agents: PaperclipAgent[] | null
  mobile?: boolean
}) {
  const active  = titles.filter(t => t.status !== 'killed')
  const stalled = active.filter(t => daysSince(t.updatedAt) >= 14).length

  const stageCounts = useMemo(() => {
    const counts: Partial<Record<PipelineStage, number>> = {}
    for (const t of active) {
      counts[t.pipelineStage] = (counts[t.pipelineStage] ?? 0) + 1
    }
    return counts
  }, [active])

  const maxCount = Math.max(...(Object.values(stageCounts).filter(Boolean) as number[]), 1)

  function barColor(stage: PipelineStage): string {
    if (stage === 'greenlit')        return 'rgba(34,197,94,0.5)'
    if (PITCH_STAGES.has(stage))     return 'rgba(245,197,24,0.5)'
    return 'rgba(99,102,241,0.5)'
  }

  function countColor(stage: PipelineStage): string {
    if (stage === 'greenlit')        return 'text-status-green'
    if (PITCH_STAGES.has(stage))     return 'text-lemon-400'
    return 'text-gray-400'
  }

  const running = agents?.filter(a => a.status === 'running').length ?? null
  const blocked = agents?.filter(a => a.status === 'error').length ?? null
  const idle    = agents?.filter(a => a.status === 'idle').length ?? null

  return (
    <div className={mobile
      ? 'w-full bg-surface px-4 py-3.5 flex flex-col gap-4 overflow-y-auto max-h-72'
      : 'hidden sm:flex sm:flex-col w-[440px] flex-shrink-0 bg-surface border-l border-border px-4 py-3.5 gap-4 overflow-hidden'
    }>
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-[13px] font-bold text-gray-100 tracking-tight">Studio Pulse</span>
      </div>

      {/* Pipeline Snapshot */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Pipeline Snapshot
          </span>
          {stalled > 0 && (
            <span className="text-[10px] font-semibold text-status-hold bg-status-hold/10 border border-status-hold/25 rounded-full px-2 py-0.5">
              ⚠ {stalled} Stalled
            </span>
          )}
        </div>
        {PIPELINE_ORDER.map(stage => {
          const count = stageCounts[stage] ?? 0
          if (count === 0) return null
          return (
            <div key={stage} className="flex items-center gap-2 mb-1.5 last:mb-0">
              <span className="w-20 text-[10px] text-gray-600 text-right flex-shrink-0">
                {stageLabel(stage)}
              </span>
              <div className="flex-1 h-3 bg-surface-3 rounded-[2px] overflow-hidden">
                <div
                  className="h-full rounded-[2px]"
                  style={{
                    width: `${(count / maxCount) * 100}%`,
                    background: barColor(stage),
                  }}
                />
              </div>
              <span
                className={`w-5 text-[12px] font-bold tabular-nums text-right flex-shrink-0 ${countColor(stage)}`}
              >
                {count}
              </span>
            </div>
          )
        })}
      </div>

      {agents !== null && agents.length > 0 && (
        <>
          <div className="h-px bg-border flex-shrink-0" />

          {/* Agent Roster */}
          <div className="flex flex-col gap-2 flex-1 overflow-hidden">
            <div className="flex items-center justify-between flex-shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Agent Roster
              </span>
              <span className="text-[10px] font-semibold text-gray-500">
                <span className="text-status-green">{running}</span> running &middot;{' '}
                <span className={blocked ? 'text-status-kill' : ''}>{blocked}</span> blocked &middot;{' '}
                {idle} idle
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 overflow-y-auto">
              {agents.map(a => {
                const isRun = a.status === 'running'
                const isBlk = a.status === 'error'
                return (
                  <div
                    key={a.id}
                    className={[
                      'flex items-center gap-1.5 px-2 py-1.5 rounded-md border',
                      isRun ? 'bg-status-green/[0.06] border-status-green/20' : '',
                      isBlk ? 'bg-status-kill/[0.07] border-status-kill/25' : '',
                      !isRun && !isBlk ? 'bg-surface-3 border-border' : '',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        isRun ? 'bg-status-green shadow-[0_0_4px_rgba(34,197,94,0.6)]' : '',
                        isBlk ? 'bg-status-kill' : '',
                        !isRun && !isBlk ? 'bg-gray-600' : '',
                      ].join(' ')}
                    />
                    <span
                      className={[
                        'text-[11px] truncate',
                        isBlk ? 'text-status-kill/80' : isRun ? 'text-gray-400' : 'text-gray-600',
                      ].join(' ')}
                    >
                      {a.name}{isBlk ? ' ⚠' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export function CommandCenterPage() {
  const { titles, loading, load } = useTitleStore()
  const [paperclip, setPaperclip] = useState<{ stats: PaperclipStats; agents: PaperclipAgent[] } | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchPaperclipData().then(setPaperclip)
  }, [])

  const agentsRunning   = paperclip?.stats.agents.running ?? null
  const decisionTitles  = titles.filter(isDecision)
  const watchedTitles   = titles.filter(t => t.ceoWatch === true && t.status !== 'killed')
  const stalledCount    = titles.filter(t => t.status !== 'killed' && daysSince(t.updatedAt) >= 14).length

  if (loading && titles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-700 text-sm">
        Loading Mission Control…
      </div>
    )
  }

  const [pulseOpen, setPulseOpen] = useState(false)
  const leftEmpty = decisionTitles.length === 0 && watchedTitles.length === 0

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-950">
      <KpiBar titles={titles} />
      <CommandStrip
        decisions={decisionTitles.length}
        watchlist={watchedTitles.length}
        agentsRunning={agentsRunning}
        stalled={stalledCount}
      />
      {paperclip && <AgentBoard agents={paperclip.agents} />}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column + mobile pulse accordion */}
        <div className="flex-1 flex flex-col overflow-hidden sm:border-r border-border">
          <div className="flex-1 px-4 sm:px-6 py-3.5 flex flex-col gap-4 overflow-y-auto">
            <YourMove titles={titles} />
            <MyWatchlist titles={titles} />
            {leftEmpty && (
              <div className="flex-1 flex items-center justify-center text-gray-700 text-sm">
                No titles in queue or watchlist.
              </div>
            )}
          </div>
          {/* Mobile Studio Pulse accordion */}
          <div className="sm:hidden flex-shrink-0 border-t border-border">
            <button
              onClick={() => setPulseOpen(v => !v)}
              className="w-full px-4 py-3 flex items-center justify-between bg-surface-2 hover:bg-surface-3 transition-colors"
            >
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Studio Pulse</span>
              <span className="text-[10px] text-gray-600">{pulseOpen ? '▲' : '▼'}</span>
            </button>
            {pulseOpen && <StudioPulse titles={titles} agents={paperclip?.agents ?? null} mobile />}
          </div>
        </div>
        {/* Desktop right sidebar */}
        <StudioPulse titles={titles} agents={paperclip?.agents ?? null} />
      </div>
    </div>
  )
}
