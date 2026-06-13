import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTitleStore } from '../store/titleStore'
import type { Title, PipelineStage } from '../types'

// ── Stage config ──────────────────────────────────────────────────────────────

const STAGES: { stage: PipelineStage; label: string; short: string }[] = [
  { stage: 'ip_scouting',  label: 'IP Scouting',  short: 'IP' },
  { stage: 'optioned',     label: 'Optioned',     short: 'OPT' },
  { stage: 'treatment',    label: 'Treatment',    short: 'TRT' },
  { stage: 'pilot_script', label: 'Pilot Script', short: 'PIL' },
  { stage: 'series_bible', label: 'Series Bible', short: 'BIB' },
  { stage: 'pitch_ready',  label: 'Pitch Ready',  short: 'PR' },
  { stage: 'pitched',      label: 'Pitched',      short: 'PCH' },
  { stage: 'negotiation',  label: 'Negotiation',  short: 'NEG' },
  { stage: 'greenlit',     label: 'Greenlit',     short: 'GL' },
]

// Stages that constitute the "Development Gate" — projects that need a decision
const GATE_STAGES: Set<PipelineStage> = new Set(['pitched', 'negotiation'])

// ── Visual helpers ────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function coverGradient(name: string): { from: string; to: string; angle: number } {
  const h = hashString(name)
  const hue1 = h % 360
  const hue2 = (hue1 + 40 + (h % 60)) % 360
  const sat = 55 + (h % 20)
  const light1 = 22 + (h % 10)
  const light2 = 38 + ((h >> 3) % 12)
  const angle = (h % 12) * 30
  return {
    from: `hsl(${hue1}deg ${sat}% ${light1}%)`,
    to:   `hsl(${hue2}deg ${sat}% ${light2}%)`,
    angle,
  }
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}
function fmtRel(iso: string): string {
  const d = daysSince(iso)
  if (d <= 0) return 'today'
  if (d === 1) return '1d ago'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

const STATUS_DOT: Record<string, string> = {
  greenlit:    'bg-status-green shadow-[0_0_10px_2px] shadow-status-green/60',
  active:      'bg-status-dev shadow-[0_0_10px_2px] shadow-status-dev/60',
  development: 'bg-blue-400 shadow-[0_0_10px_2px] shadow-blue-400/60',
  hold:        'bg-status-hold shadow-[0_0_10px_2px] shadow-status-hold/60',
  killed:      'bg-status-kill',
}

const STATUS_LABEL: Record<string, string> = {
  greenlit:    'Greenlit',
  active:      'Active',
  development: 'In Development',
  hold:        'On Hold',
  killed:      'Killed',
}

// ── Cover art ────────────────────────────────────────────────────────────────

function CoverArt({ title, size = 'md' }: { title: Title; size?: 'sm' | 'md' | 'lg' }) {
  const g = coverGradient(title.name)
  const dim = size === 'lg' ? 'h-32' : size === 'sm' ? 'h-16' : 'h-24'
  const txt = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl'
  return (
    <div
      className={`relative w-full ${dim} rounded-lg overflow-hidden flex items-center justify-center`}
      style={{
        background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`,
      }}
    >
      {/* sheen */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30 pointer-events-none" />
      {/* noise dots for texture */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18) 0, transparent 35%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.25) 0, transparent 40%)',
        }}
      />
      <span className={`${txt} font-bold tracking-tight text-white/95 drop-shadow-lg z-10`}>
        {initials(title.name)}
      </span>
      {/* format chip */}
      <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider text-white/80 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded">
        {title.format === 'feature_film'
          ? 'Film'
          : title.format === 'limited_series'
          ? 'Limited'
          : title.format === 'documentary'
          ? 'Doc'
          : 'Series'}
      </span>
      {/* status pulse */}
      <span
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          STATUS_DOT[title.status] ?? 'bg-gray-500'
        } ${title.status === 'active' || title.status === 'greenlit' ? 'animate-pulse' : ''}`}
      />
    </div>
  )
}

// ── Pipeline progress dots ────────────────────────────────────────────────────

function StageProgress({ current }: { current: PipelineStage }) {
  const idx = STAGES.findIndex(s => s.stage === current)
  return (
    <div className="flex items-center gap-1">
      {STAGES.map((s, i) => {
        const passed = i < idx
        const active = i === idx
        return (
          <div
            key={s.stage}
            title={s.label}
            className={`h-1 flex-1 rounded-full transition-all ${
              active
                ? 'bg-lemon-400 shadow-[0_0_6px] shadow-lemon-400/60'
                : passed
                ? 'bg-lemon-600/70'
                : 'bg-surface-3'
            }`}
          />
        )
      })}
    </div>
  )
}

// ── Gate Card (large, for development gate carousel) ──────────────────────────

function GateCard({ title }: { title: Title }) {
  const optionDays =
    title.keyDates.optionExpiry ? daysUntil(title.keyDates.optionExpiry) : null
  const pitchDays =
    title.keyDates.pitchDate ? daysUntil(title.keyDates.pitchDate) : null
  const stale = daysSince(title.updatedAt)

  return (
    <Link
      to={`/titles/${title.id}`}
      className="group relative shrink-0 w-72 bg-surface-2 border border-border rounded-2xl overflow-hidden hover:border-lemon-500/40 hover:-translate-y-1 hover:shadow-2xl hover:shadow-lemon-500/10 transition-all duration-300"
    >
      <CoverArt title={title} size="lg" />

      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-100 text-sm leading-tight group-hover:text-lemon-300 transition-colors">
              {title.name}
            </h3>
            {title.blockers.length > 0 && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-status-kill/15 text-status-kill border border-status-kill/30">
                ⚠
              </span>
            )}
          </div>
          {title.logline && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-snug">
              {title.logline}
            </p>
          )}
        </div>

        {/* Stage progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-gray-600 uppercase tracking-wider">
            <span>{STAGES.find(s => s.stage === title.pipelineStage)?.label}</span>
            <span className="text-lemon-400">Awaiting decision</span>
          </div>
          <StageProgress current={title.pipelineStage} />
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-gray-400 border border-border/60">
            {title.platform}
          </span>
          {title.genre.slice(0, 2).map(g => (
            <span
              key={g}
              className="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-gray-400 border border-border/60"
            >
              {g}
            </span>
          ))}
        </div>

        {/* Footer signals */}
        <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-border/40">
          <span>Updated {fmtRel(title.updatedAt)}</span>
          {optionDays !== null && optionDays >= 0 && optionDays <= 60 && (
            <span className="text-lemon-400">Option {optionDays}d</span>
          )}
          {pitchDays !== null && pitchDays >= 0 && pitchDays <= 30 && (
            <span className="text-lemon-400">Pitch in {pitchDays}d</span>
          )}
          {stale > 21 && optionDays === null && pitchDays === null && (
            <span className="text-status-hold">Stale {stale}d</span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Project Card (compact, for film/tv dev lanes) ─────────────────────────────

function ProjectCard({ title }: { title: Title }) {
  return (
    <Link
      to={`/titles/${title.id}`}
      className="group relative bg-surface-2 border border-border rounded-xl overflow-hidden hover:border-lemon-500/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 transition-all duration-200"
    >
      <CoverArt title={title} size="md" />
      <div className="p-3 space-y-2">
        <div>
          <h4 className="font-medium text-gray-100 text-xs leading-tight group-hover:text-lemon-300 transition-colors line-clamp-1">
            {title.name}
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-snug">
            {title.logline || 'No logline yet'}
          </p>
        </div>

        <StageProgress current={title.pipelineStage} />

        <div className="flex items-center justify-between text-[10px] text-gray-600">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate">{title.platform}</span>
            {title.genre[0] && (
              <>
                <span className="text-gray-700">·</span>
                <span className="truncate">{title.genre[0]}</span>
              </>
            )}
          </div>
          <span className="shrink-0">{fmtRel(title.updatedAt)}</span>
        </div>
      </div>

      {title.blockers.length > 0 && (
        <div className="absolute top-2 left-2 z-10">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-status-kill/80 text-white">
            ⚠ Blocked
          </span>
        </div>
      )}
    </Link>
  )
}

// ── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  tint,
  pulse,
}: {
  label: string
  value: number
  tint: string
  pulse?: boolean
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${tint} px-5 py-4`}
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/5 blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          {pulse && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
            </span>
          )}
          <p className="text-[10px] uppercase tracking-widest font-semibold opacity-80">
            {label}
          </p>
        </div>
        <p className="text-3xl font-bold tabular-nums mt-1 tracking-tight">{value}</p>
      </div>
    </div>
  )
}

// ── Lane (film / tv development) ──────────────────────────────────────────────

function DevLane({
  title,
  subtitle,
  accent,
  titles,
  allRoute,
}: {
  title: string
  subtitle: string
  accent: string
  titles: Title[]
  allRoute: string
}) {
  return (
    <div className="bg-surface-2/60 border border-border rounded-2xl p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`w-1.5 h-8 rounded-full ${accent}`} />
          <div>
            <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600 tabular-nums">{titles.length}</span>
          <Link
            to={allRoute}
            className="text-[11px] text-lemon-400 hover:text-lemon-300 transition-colors"
          >
            View all →
          </Link>
        </div>
      </div>

      {titles.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-xs text-gray-600">No active projects</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {titles.slice(0, 6).map(t => (
            <ProjectCard key={t.id} title={t} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Live ticker ───────────────────────────────────────────────────────────────

function LiveTicker({ titles }: { titles: Title[] }) {
  const recent = useMemo(
    () =>
      [...titles]
        .filter(t => t.status !== 'killed')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 12),
    [titles],
  )

  if (recent.length === 0) return null

  return (
    <div className="bg-surface-2/60 border border-border rounded-2xl px-4 py-3 overflow-hidden">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-border/60">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lemon-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-lemon-400" />
          </span>
          <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
            Live
          </span>
        </div>
        <div className="flex items-center gap-6 overflow-x-auto scrollbar-none">
          {recent.map(t => (
            <Link
              key={t.id}
              to={`/titles/${t.id}`}
              className="shrink-0 flex items-center gap-2 text-xs text-gray-400 hover:text-lemon-300 transition-colors whitespace-nowrap"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[t.status] ?? 'bg-gray-500'}`} />
              <span className="font-medium">{t.name}</span>
              <span className="text-gray-600">— {STATUS_LABEL[t.status]} · {fmtRel(t.updatedAt)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function StudioPulsePage() {
  const { titles, loading } = useTitleStore()
  const [filter, setFilter] = useState<'all' | 'film' | 'tv'>('all')

  const active = useMemo(() => titles.filter(t => t.status !== 'killed'), [titles])

  // Development gate: pitched/negotiation OR explicitly "development" status. These need decisions.
  const gate = useMemo(
    () =>
      active
        .filter(
          t =>
            GATE_STAGES.has(t.pipelineStage) ||
            (t.status === 'development' && t.pipelineStage === 'pitch_ready'),
        )
        .sort((a, b) => {
          // Surgically prioritize: blockers first, then closest option expiry, then most-recent
          const aBlock = a.blockers.length > 0 ? 1 : 0
          const bBlock = b.blockers.length > 0 ? 1 : 0
          if (aBlock !== bBlock) return bBlock - aBlock
          const aExp = a.keyDates.optionExpiry ? new Date(a.keyDates.optionExpiry).getTime() : Infinity
          const bExp = b.keyDates.optionExpiry ? new Date(b.keyDates.optionExpiry).getTime() : Infinity
          if (aExp !== bExp) return aExp - bExp
          return b.updatedAt.localeCompare(a.updatedAt)
        }),
    [active],
  )

  const filmDev = useMemo(
    () =>
      active
        .filter(t => t.format === 'feature_film' && t.status === 'development')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [active],
  )

  const tvDev = useMemo(
    () =>
      active
        .filter(
          t =>
            (t.format === 'series' || t.format === 'limited_series') &&
            t.status === 'development',
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [active],
  )

  const greenlit = useMemo(() => active.filter(t => t.status === 'greenlit').length, [active])
  const activeCount = useMemo(() => active.filter(t => t.status === 'active').length, [active])

  // Page-level format filter (affects gate carousel + lanes visibility)
  const gateFiltered = useMemo(() => {
    if (filter === 'film') return gate.filter(t => t.format === 'feature_film')
    if (filter === 'tv')
      return gate.filter(t => t.format === 'series' || t.format === 'limited_series')
    return gate
  }, [gate, filter])

  if (loading && titles.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 bg-surface-2 rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="h-24 bg-surface-2 rounded-2xl" />
          <div className="h-24 bg-surface-2 rounded-2xl" />
          <div className="h-24 bg-surface-2 rounded-2xl" />
          <div className="h-24 bg-surface-2 rounded-2xl" />
        </div>
        <div className="h-64 bg-surface-2 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-2 via-surface-2 to-surface px-6 py-5">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-lemon-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-status-dev/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lemon-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-lemon-400" />
              </span>
              <p className="text-[10px] uppercase tracking-widest text-lemon-400 font-semibold">
                Studio Pulse · Live
              </p>
            </div>
            <h1 className="text-2xl font-bold text-gray-50 mt-1 tracking-tight">
              Where every project stands. Right now.
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              The development gate, in-development slate, and what needs your attention — at a glance.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
            {(['all', 'film', 'tv'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${
                  filter === f
                    ? 'bg-lemon-500/15 text-lemon-300'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f === 'all' ? 'All' : f === 'film' ? 'Film' : 'TV'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill
          label="At the Gate"
          value={gate.length}
          tint="from-lemon-500/15 to-lemon-500/5 border-lemon-500/30 text-lemon-300"
          pulse
        />
        <StatPill
          label="In Development"
          value={filmDev.length + tvDev.length}
          tint="from-blue-500/15 to-blue-500/5 border-blue-500/30 text-blue-300"
        />
        <StatPill
          label="Active Productions"
          value={activeCount}
          tint="from-indigo-500/15 to-indigo-500/5 border-indigo-500/30 text-indigo-300"
        />
        <StatPill
          label="Greenlit"
          value={greenlit}
          tint="from-emerald-500/15 to-emerald-500/5 border-emerald-500/30 text-emerald-300"
        />
      </div>

      {/* Development Gate */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-8 rounded-full bg-lemon-400" />
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Development Gate</h2>
              <p className="text-xs text-gray-500">
                Projects awaiting your decision — sorted by urgency
              </p>
            </div>
          </div>
          <span className="text-xs text-gray-600 tabular-nums">
            {gateFiltered.length} title{gateFiltered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {gateFiltered.length === 0 ? (
          <div className="bg-surface-2/60 border border-border rounded-2xl py-12 text-center">
            <span className="text-4xl opacity-20">◌</span>
            <p className="text-sm text-gray-500 mt-3">
              Nothing waiting at the gate. Nice.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
              {gateFiltered.map(t => (
                <div key={t.id} className="snap-start">
                  <GateCard title={t} />
                </div>
              ))}
            </div>
            {/* fade gradient hint */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-surface to-transparent" />
          </div>
        )}
      </div>

      {/* Dev lanes */}
      <div className={`grid grid-cols-1 ${filter === 'all' ? 'lg:grid-cols-2' : ''} gap-4`}>
        {filter !== 'tv' && (
          <DevLane
            title="Film Development"
            subtitle="Feature films currently in development"
            accent="bg-orange-400"
            titles={filmDev}
            allRoute="/film-dev"
          />
        )}
        {filter !== 'film' && (
          <DevLane
            title="TV Development"
            subtitle="Series & limited series in development"
            accent="bg-purple-400"
            titles={tvDev}
            allRoute="/tv-dev"
          />
        )}
      </div>

      {/* Live ticker */}
      <LiveTicker titles={active} />
    </div>
  )
}
