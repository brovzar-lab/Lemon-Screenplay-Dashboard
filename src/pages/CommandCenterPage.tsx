import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTitleStore } from '../store/titleStore'
import { fetchMiReports } from '../lib/firestore'
import type { MarketIntelReport, Title, PipelineStage } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

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

const STAGE_BASELINE: Partial<Record<PipelineStage, number>> = {
  ip_scouting:  30,
  optioned:     45,
  treatment:    60,
  pilot_script: 90,
  series_bible: 60,
  pitch_ready:  30,
  pitched:      21,
  negotiation:  21,
}

const PIPELINE_ORDER: PipelineStage[] = [
  'ip_scouting', 'optioned', 'treatment', 'pilot_script',
  'series_bible', 'pitch_ready', 'pitched', 'negotiation', 'greenlit',
]

// ── Urgency helpers ────────────────────────────────────────────────────────────

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

function deadlineColor(d: number | null): string {
  if (d === null) return 'text-gray-600'
  if (d < 7)  return 'text-status-kill'
  if (d < 14) return 'text-status-hold'
  return 'text-status-green'
}

function waitColor(days: number): string {
  if (days >= 14) return 'text-status-kill'
  if (days >= 7)  return 'text-status-hold'
  return 'text-gray-500'
}

function heatColor(days: number, baseline: number): string {
  if (days >= baseline * 2)   return 'text-status-kill'
  if (days >= baseline * 1.5) return 'text-status-hold'
  return 'text-status-green'
}

function formatLabel(fmt: string): string {
  if (fmt === 'feature_film')    return 'Film'
  if (fmt === 'limited_series')  return 'Limited'
  if (fmt === 'documentary')     return 'Doc'
  return 'Series'
}

// ── Shared UI atoms ────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-2 border border-border rounded-xl ${className}`}>
      {children}
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-xs text-gray-700 py-6 text-center">{msg}</p>
}

function SectionTitle({ accent, label, sub, badge }: {
  accent: string
  label: string
  sub: string
  badge?: string
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <span className={`w-1 h-6 rounded-full shrink-0 ${accent}`} />
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-100">{label}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
        </div>
      </div>
      {badge && (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-3 text-gray-600 border border-border shrink-0 mt-0.5">
          {badge}
        </span>
      )}
    </div>
  )
}

// ── Section 1: YOUR MOVE ───────────────────────────────────────────────────────

function YourMoveSection({ titles }: { titles: Title[] }) {
  const gate = useMemo(() => {
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
        if (aD !== bD) return aD - bD
        return daysSince(b.updatedAt) - daysSince(a.updatedAt)
      })
  }, [titles])

  const velocityCount = useMemo(() => {
    return titles.filter(t => {
      const d = daysSince(t.updatedAt)
      return d <= 7 && (
        t.pipelineStage === 'pitched' ||
        t.pipelineStage === 'negotiation' ||
        t.pipelineStage === 'greenlit'
      )
    }).length
  }, [titles])

  return (
    <section>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-6 rounded-full bg-lemon-400 shrink-0" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-100">Your Move</h2>
            <p className="text-xs text-gray-500 mt-0.5">Decision queue — titles awaiting review</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-gray-600 uppercase tracking-wider">7-day pace</p>
          <p className="text-sm font-bold text-lemon-400 tabular-nums mt-0.5">
            {velocityCount} reviewed
          </p>
        </div>
      </div>

      {gate.length === 0 ? (
        <Card className="p-4">
          <Empty msg="Queue clear — no titles pending a decision" />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1fr_64px_96px_56px_72px_64px] gap-2 px-4 py-2 border-b border-border text-[10px] font-semibold uppercase tracking-wider text-gray-600">
            <span>Title / Genre</span>
            <span>Format</span>
            <span>Stage</span>
            <span className="text-right">Waiting</span>
            <span className="text-right">Deadline</span>
            <span className="text-right">Coverage</span>
          </div>
          {gate.map(t => {
            const waiting = daysSince(t.updatedAt)
            const deadline = nearestDeadline(t)
            const hasCoverage = t.coverageRefs.length > 0
            return (
              <Link
                key={t.id}
                to={`/titles/${t.id}`}
                className="grid grid-cols-[1fr_64px_96px_56px_72px_64px] gap-2 items-center px-4 py-2.5 border-b border-border/40 last:border-0 hover:bg-surface-3 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-200 group-hover:text-lemon-400 transition-colors truncate">
                    {t.name}
                  </p>
                  {t.genre.length > 0 && (
                    <p className="text-[10px] text-gray-600 truncate mt-0.5">
                      {t.genre.slice(0, 2).join(' · ')}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-gray-500">{formatLabel(t.format)}</span>
                <span className="text-[10px] text-gray-500">{STAGE_LABELS[t.pipelineStage]}</span>
                <span className={`text-xs text-right tabular-nums font-medium ${waitColor(waiting)}`}>
                  {waiting}d
                </span>
                <span className={`text-xs text-right tabular-nums ${deadlineColor(deadline)}`}>
                  {deadline !== null ? `${deadline}d` : '—'}
                </span>
                <span className={`text-xs text-right ${hasCoverage ? 'text-status-green' : 'text-status-kill'}`}>
                  {hasCoverage ? '✓' : '✗'}
                </span>
              </Link>
            )
          })}
        </Card>
      )}
    </section>
  )
}

// ── Section 2: FIRE WATCH ──────────────────────────────────────────────────────

function FireWatchSection({ titles }: { titles: Title[] }) {
  const active = useMemo(() => titles.filter(t => t.status !== 'killed'), [titles])

  const deadlines = useMemo(() => {
    const items: { title: Title; label: string; daysLeft: number; kind: string }[] = []
    for (const t of active) {
      if (t.keyDates.optionExpiry) {
        const d = daysUntil(t.keyDates.optionExpiry)
        if (d >= 0 && d <= 90) items.push({ title: t, label: 'Option', daysLeft: d, kind: 'option' })
      }
      if (t.keyDates.pitchDate) {
        const d = daysUntil(t.keyDates.pitchDate)
        if (d >= 0 && d <= 90) items.push({ title: t, label: 'Pitch', daysLeft: d, kind: 'pitch' })
      }
    }
    return items.sort((a, b) => a.daysLeft - b.daysLeft)
  }, [active])

  const stalled = useMemo(() => {
    return active
      .filter(t => daysSince(t.updatedAt) >= 14)
      .map(t => {
        let reason = 'No assigned next step'
        if (t.blockers.length > 0) {
          const b = t.blockers[0].toLowerCase()
          if (b.includes('screenwriter') || b.includes('writer')) reason = 'Waiting on screenwriter'
          else if (b.includes('rights'))                           reason = 'Waiting on rights clearance'
          else if (b.includes('billy') || b.includes('decision')) reason = 'Waiting on Billy'
          else reason = `Blocked: ${t.blockers[0]}`
        }
        return { title: t, days: daysSince(t.updatedAt), reason }
      })
      .sort((a, b) => b.days - a.days)
  }, [active])

  const coverageGaps = useMemo(() => {
    return active.filter(t =>
      (t.pipelineStage === 'pitched' || t.pipelineStage === 'negotiation') &&
      t.coverageRefs.length === 0
    )
  }, [active])

  const allClear = deadlines.length === 0 && stalled.length === 0 && coverageGaps.length === 0

  return (
    <section>
      <SectionTitle
        accent="bg-status-kill"
        label="Fire Watch"
        sub="Alerts requiring immediate action"
      />

      {allClear ? (
        <Card className="p-4">
          <Empty msg="All clear — no deadlines, stalled titles, or coverage gaps" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* 2a: Deadline Countdown */}
          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-status-kill mb-3">
              Deadline Countdown <span className="text-gray-700 font-normal normal-case tracking-normal ml-1">90d window</span>
            </p>
            {deadlines.length === 0 ? (
              <Empty msg="No deadlines in 90d" />
            ) : (
              <div>
                {deadlines.slice(0, 7).map(({ title, label, daysLeft, kind }) => (
                  <Link
                    key={`${title.id}-${kind}`}
                    to={`/titles/${title.id}`}
                    className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 hover:bg-surface-3 -mx-3 px-3 rounded transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-gray-300 group-hover:text-lemon-400 truncate transition-colors">{title.name}</p>
                      <p className="text-[10px] text-gray-600">{label}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold tabular-nums ml-2 ${
                      daysLeft < 14 ? 'text-status-kill' : daysLeft < 30 ? 'text-status-hold' : 'text-gray-400'
                    }`}>
                      {daysLeft}d
                    </span>
                  </Link>
                ))}
                {deadlines.length > 7 && (
                  <p className="text-[10px] text-gray-600 pt-2 text-center">+{deadlines.length - 7} more</p>
                )}
              </div>
            )}
          </Card>

          {/* 2b: Stalled Titles */}
          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-status-hold mb-3">
              Stalled <span className="text-gray-700 font-normal normal-case tracking-normal ml-1">14+ days</span>
            </p>
            {stalled.length === 0 ? (
              <Empty msg="No stalled titles" />
            ) : (
              <div>
                {stalled.slice(0, 7).map(({ title, days, reason }) => (
                  <Link
                    key={title.id}
                    to={`/titles/${title.id}`}
                    className="flex items-start justify-between py-2 border-b border-border/40 last:border-0 hover:bg-surface-3 -mx-3 px-3 rounded transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-gray-300 group-hover:text-lemon-400 truncate transition-colors">{title.name}</p>
                      <p className="text-[10px] text-status-hold mt-0.5">⏳ {reason}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-600 tabular-nums ml-2">{days}d</span>
                  </Link>
                ))}
                {stalled.length > 7 && (
                  <p className="text-[10px] text-gray-600 pt-2 text-center">+{stalled.length - 7} more</p>
                )}
              </div>
            )}
          </Card>

          {/* 2c: Coverage Gaps */}
          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-lemon-500 mb-3">
              Coverage Gaps <span className="text-gray-700 font-normal normal-case tracking-normal ml-1">at pitch/negotiation</span>
            </p>
            {coverageGaps.length === 0 ? (
              <Empty msg="All titles at pitch/negotiation have coverage" />
            ) : (
              <div>
                {coverageGaps.slice(0, 7).map(t => (
                  <Link
                    key={t.id}
                    to={`/titles/${t.id}`}
                    className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 hover:bg-surface-3 -mx-3 px-3 rounded transition-colors group"
                  >
                    <p className="text-xs text-gray-300 group-hover:text-lemon-400 truncate transition-colors">{t.name}</p>
                    <span className="shrink-0 text-[10px] text-gray-600 ml-2 capitalize">
                      {STAGE_LABELS[t.pipelineStage]}
                    </span>
                  </Link>
                ))}
                {coverageGaps.length > 7 && (
                  <p className="text-[10px] text-gray-600 pt-2 text-center">+{coverageGaps.length - 7} more</p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </section>
  )
}

// ── Section 3: PIPELINE PULSE ──────────────────────────────────────────────────

function PipelinePulseSection({ titles }: { titles: Title[] }) {
  const active = useMemo(
    () => titles.filter(t => t.status !== 'killed' && t.pipelineStage !== 'greenlit'),
    [titles],
  )

  const heatRows = useMemo(() => {
    return active
      .map(t => ({
        title: t,
        days: daysSince(t.updatedAt),
        baseline: STAGE_BASELINE[t.pipelineStage] ?? 30,
      }))
      .sort((a, b) => (b.days / b.baseline) - (a.days / a.baseline))
  }, [active])

  const funnelData = useMemo(() => {
    const counts: Partial<Record<PipelineStage, number>> = {}
    for (const t of titles.filter(t => t.status !== 'killed')) {
      counts[t.pipelineStage] = (counts[t.pipelineStage] ?? 0) + 1
    }
    return PIPELINE_ORDER
      .map(stage => ({ stage, label: STAGE_LABELS[stage], count: counts[stage] ?? 0 }))
      .filter(r => r.count > 0)
  }, [titles])

  const maxCount = Math.max(...funnelData.map(r => r.count), 1)

  return (
    <section>
      <SectionTitle
        accent="bg-status-dev"
        label="Pipeline Pulse"
        sub="Stage velocity and age health across the active slate"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 3a: Stage Age Heatmap */}
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Stage Age Heatmap</p>
            <p className="text-[10px] text-gray-700 mt-0.5">Days since last activity vs. stage baseline</p>
          </div>
          <div className="grid grid-cols-[1fr_90px_52px] gap-2 px-4 py-2 border-b border-border/60 text-[10px] font-semibold uppercase tracking-wider text-gray-700">
            <span>Title</span>
            <span>Stage</span>
            <span className="text-right">Age</span>
          </div>
          {heatRows.length === 0 ? (
            <div className="p-4"><Empty msg="No active titles" /></div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {heatRows.map(({ title, days, baseline }) => (
                <Link
                  key={title.id}
                  to={`/titles/${title.id}`}
                  className="grid grid-cols-[1fr_90px_52px] gap-2 items-center px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-surface-3 transition-colors group"
                >
                  <p className="text-xs text-gray-300 group-hover:text-lemon-400 truncate transition-colors">
                    {title.name}
                  </p>
                  <span className="text-[10px] text-gray-600">{STAGE_LABELS[title.pipelineStage]}</span>
                  <span className={`text-xs font-semibold text-right tabular-nums ${heatColor(days, baseline)}`}>
                    {days}d
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* 3b: Pipeline Snapshot */}
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            Pipeline Snapshot
          </p>
          <p className="text-[10px] text-gray-700 mb-4">Current stage distribution</p>
          {funnelData.length === 0 ? (
            <Empty msg="No titles in pipeline" />
          ) : (
            <div className="space-y-2.5">
              {funnelData.map(({ stage, label, count }) => (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-600 w-24 shrink-0 text-right">{label}</span>
                  <div className="flex-1 h-3 bg-surface-3 rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-status-dev/50 rounded-sm transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-gray-400 w-5 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  )
}

// ── Section 4: MARKET RADAR ────────────────────────────────────────────────────

const APPETITE_COLOR: Record<string, string> = {
  high:   'text-status-green',
  medium: 'text-lemon-400',
  low:    'text-gray-500',
}

function MarketRadarSection({ reports, loading }: { reports: MarketIntelReport[]; loading: boolean }) {
  const platformLatest = useMemo(() => {
    const map: Record<string, MarketIntelReport> = {}
    for (const r of [...reports].reverse()) {
      if (r.platform && r.platformAppetite) map[r.platform] = r
    }
    return Object.values(map)
  }, [reports])

  const genreFreq = useMemo(() => {
    const freq: Record<string, number> = {}
    for (const r of reports) {
      const g = r.genre?.toLowerCase()
      if (g) freq[g] = (freq[g] ?? 0) + 1
    }
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [reports])

  return (
    <section>
      <SectionTitle
        accent="bg-lemon-600"
        label="Market Radar"
        sub="Platform appetite, genre landscape, and slate alignment"
        badge="Phase 2 — data pipeline pending"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 4a: Platform Appetite */}
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
            Platform Appetite
          </p>
          {loading ? (
            <p className="text-xs text-gray-700 animate-pulse py-2">Loading MI data…</p>
          ) : platformLatest.length === 0 ? (
            <div className="py-4 text-center space-y-1">
              <p className="text-xs text-gray-700">Awaiting MI data</p>
              <p className="text-[10px] text-gray-700">MI agent will populate this once reports exist</p>
            </div>
          ) : (
            <div>
              {platformLatest.map(r => (
                <div key={r.platform} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                  <span className="text-xs text-gray-400">{r.platform}</span>
                  <div className="flex items-center gap-3">
                    {r.genre && <span className="text-[10px] text-gray-600 capitalize">{r.genre}</span>}
                    <span className={`text-xs font-medium capitalize ${APPETITE_COLOR[r.platformAppetite] ?? 'text-gray-400'}`}>
                      {r.platformAppetite}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 4b: Genre Frequency */}
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
            Genre Frequency
            <span className="text-gray-700 font-normal normal-case tracking-normal ml-1">from MI reports</span>
          </p>
          {loading ? (
            <p className="text-xs text-gray-700 animate-pulse py-2">Loading…</p>
          ) : genreFreq.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-xs text-gray-700">Awaiting MI data</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {genreFreq.map(([genre, count]) => (
                <span
                  key={genre}
                  className="text-xs px-2 py-0.5 rounded-full bg-lemon-500/10 text-lemon-400 border border-lemon-500/20 capitalize"
                >
                  {genre} <span className="opacity-50">×{count}</span>
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* 4c: Cultural Momentum — placeholder */}
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            Cultural Momentum
          </p>
          <p className="text-[10px] text-gray-700 mb-3">Audience themes trending now, by genre</p>
          <Empty msg="Awaiting MI + research pipeline" />
        </Card>

        {/* 4d: Slate-Market Alignment — placeholder */}
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            Slate-Market Alignment
          </p>
          <p className="text-[10px] text-gray-700 mb-3">Aligned, headwind, and opportunity gaps</p>
          <Empty msg="Awaiting MI + research pipeline" />
        </Card>
      </div>
    </section>
  )
}

// ── Section 5: STUDIO HEALTH ───────────────────────────────────────────────────

function StudioHealthSection() {
  return (
    <section>
      <SectionTitle
        accent="bg-purple-500"
        label="Studio Health"
        sub="Agent roster health and quality metrics"
        badge="Phase 2 — data pipeline pending"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 5a: Agent Roster */}
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            Agent Roster
          </p>
          <p className="text-[10px] text-gray-700 mb-3">Evaluation scores, completion rates, config health</p>
          <Empty msg="Awaiting AR Evaluator weekly scan output" />
        </Card>

        {/* 5b: Quality Loop */}
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
            Quality Loop
            <span className="text-gray-700 font-normal normal-case tracking-normal ml-1">30-day rolling</span>
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-3 border border-border/60 rounded-lg p-3 text-center">
              <p className="text-[10px] text-gray-600 mb-2 uppercase tracking-wider">Generator Bounce Rate</p>
              <p className="text-xs text-gray-700">% concepts returned at Gate 2.5</p>
              <p className="text-sm text-gray-700 mt-3">Awaiting data</p>
            </div>
            <div className="bg-surface-3 border border-border/60 rounded-lg p-3 text-center">
              <p className="text-[10px] text-gray-600 mb-2 uppercase tracking-wider">Endorsement Accuracy</p>
              <p className="text-xs text-gray-700">HoD endorsements vs Billy approve/kill</p>
              <p className="text-sm text-gray-700 mt-3">Awaiting data</p>
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function CommandCenterPage() {
  const { titles, loading } = useTitleStore()
  const [miReports, setMiReports] = useState<MarketIntelReport[]>([])
  const [miLoading, setMiLoading] = useState(true)

  useEffect(() => {
    fetchMiReports()
      .then(setMiReports)
      .catch(() => setMiReports([]))
      .finally(() => setMiLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-10 bg-surface-2 border border-border rounded-xl w-64" />
        <div className="h-52 bg-surface-2 border border-border rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-36 bg-surface-2 border border-border rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-48 bg-surface-2 border border-border rounded-xl" />
          <div className="h-48 bg-surface-2 border border-border rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lemon-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-lemon-400" />
          </span>
          <p className="text-[10px] uppercase tracking-widest font-semibold text-lemon-400">Command Center · Live</p>
        </div>
        <h1 className="text-2xl font-bold text-gray-100 tracking-tight">Lemon Studio</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Decisions, alerts, pipeline health, and market context — unified.
        </p>
      </div>

      <YourMoveSection titles={titles} />
      <FireWatchSection titles={titles} />
      <PipelinePulseSection titles={titles} />
      <MarketRadarSection reports={miReports} loading={miLoading} />
      <StudioHealthSection />
    </div>
  )
}
