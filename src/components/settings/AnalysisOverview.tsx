/**
 * AnalysisOverview
 *
 * Premium visual showcase of the V9 Archaeology Engine pipeline.
 * Designed to impress — animated flow, glowing nodes, cinematic feel.
 */

import { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { useScreenplays } from '@/hooks/useScreenplays';

/* ─── Reader data ─────────────────────────────────────────────────────────── */

const READERS = [
  {
    emoji: '🏗️',
    name: 'Structure',
    focus: 'Plot architecture, act breaks, pacing rhythm',
    color: 'from-blue-400 to-blue-600',
    glow: 'shadow-blue-500/30',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    tags: ['Three-act integrity', 'Inciting incident', 'Midpoint reversal', 'Climax payoff', 'Pacing'],
  },
  {
    emoji: '🎭',
    name: 'Character',
    focus: 'Arcs, depth, agency, relationships',
    color: 'from-rose-400 to-rose-600',
    glow: 'shadow-rose-500/30',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    tags: ['Protagonist arc', 'Antagonist depth', 'Voice distinctness', 'Relationship dynamics'],
  },
  {
    emoji: '✍️',
    name: 'Craft & Scene',
    focus: 'Dialogue, prose, scene economy',
    color: 'from-emerald-400 to-emerald-600',
    glow: 'shadow-emerald-500/30',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    tags: ['Dialogue authenticity', 'Subtext layers', 'Visual storytelling', 'Tonal control'],
  },
  {
    emoji: '💡',
    name: 'Concept',
    focus: 'Originality, market fit, audience hooks',
    color: 'from-amber-400 to-amber-600',
    glow: 'shadow-amber-500/30',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    tags: ['Premise strength', 'Genre awareness', 'Commercial hooks', 'Comparable titles'],
  },
  {
    emoji: '❤️',
    name: 'Emotional Resonance',
    focus: 'Stakes, gut impact, staying power',
    color: 'from-purple-400 to-purple-600',
    glow: 'shadow-purple-500/30',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    tags: ['Emotional stakes', 'Audience connection', 'Thematic depth', 'Cathartic payoff'],
  },
];

export function AnalysisOverview() {
  const [activeReader, setActiveReader] = useState<number | null>(null);
  const { data: screenplays = [] } = useScreenplays();

  // ── Live Stats ──
  const stats = useMemo(() => {
    const total = screenplays.length;
    if (total === 0) return null;

    // Top genre
    const genreCounts: Record<string, number> = {};
    screenplays.forEach(s => {
      const g = s.genre || 'Unknown';
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
    const topGenre = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || '—';

    // Average weighted score
    const avgScore = screenplays.reduce((sum, s) => sum + (s.weightedScore || 0), 0) / total;

    // Pass rate
    const passCount = screenplays.filter(s =>
      s.recommendation === 'pass' || s.recommendation === 'film_now'
    ).length;
    const passRate = Math.round((passCount / total) * 100);

    return { total, topGenre, avgScore: avgScore.toFixed(1), passRate };
  }, [screenplays]);

  return (
    <div className="space-y-10">

      {/* ── Hero Header ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gold-500/8 via-black-900 to-purple-500/8 border border-gold-500/15 p-8">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
              <span className="text-lg">🔬</span>
            </div>
            <div>
              <h2 className="text-2xl font-display text-gold-100 tracking-tight">V9 Archaeology Engine</h2>
              <p className="text-xs text-gold-400/60 tracking-wider">MULTI-READER ANALYSIS PIPELINE</p>
            </div>
          </div>
          <p className="text-sm text-black-300 leading-relaxed max-w-lg mt-4">
            Every screenplay is independently analyzed by <span className="text-gold-300 font-medium">5 expert AI readers</span>,
            each specializing in a different dimension of screenwriting craft.
            Their reports are synthesized into a single calibrated assessment — eliminating bias, maximizing depth.
          </p>
        </div>
      </div>

      {/* ── Pipeline Flow ─────────────────────────────────────────────── */}
      <div className="relative">
        {/* Vertical connecting line */}
        <div className="absolute left-[27px] top-6 bottom-6 w-px bg-gradient-to-b from-gold-500/40 via-gold-500/20 to-gold-500/40" />

        {/* Step 1: Upload */}
        <PipelineNode
          step={1}
          icon="📄"
          title="PDF Uploaded"
          desc="Your screenplay enters the pipeline"
          time="instant"
          accent="gold"
        />

        {/* Step 2: Parse */}
        <PipelineNode
          step={2}
          icon="🔍"
          title="Text Extraction"
          desc="Every page parsed — dialogue, action, scene headers identified"
          time="2–5s"
          accent="cyan"
        />

        {/* Step 3: The 5 readers — this is the centerpiece */}
        <div className="relative flex items-start gap-4 py-4">
          {/* Node dot */}
          <div className="shrink-0 w-[55px] flex justify-center">
            <div className="w-[14px] h-[14px] rounded-full bg-gold-500 shadow-lg shadow-gold-500/40 ring-4 ring-gold-500/10 z-10" />
          </div>
          <div className="flex-1 -mt-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gold-500/60">STEP 3</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-500/10 text-gold-400">30–60s</span>
            </div>
            <h3 className="font-display text-gold-100 text-lg mb-1">5 Expert Readers — Parallel Analysis</h3>
            <p className="text-xs text-black-400 mb-5">Each reader works independently. No groupthink. Maximum coverage.</p>

            {/* Reader Cards Grid */}
            <div className="grid grid-cols-5 gap-2">
              {READERS.map((reader, i) => (
                <button
                  key={reader.name}
                  onClick={() => setActiveReader(activeReader === i ? null : i)}
                  className={clsx(
                    'relative rounded-xl p-3 text-center transition-all duration-300 cursor-pointer group',
                    'border hover:scale-[1.03]',
                    activeReader === i
                      ? `${reader.bg} ${reader.border} shadow-lg ${reader.glow}`
                      : 'bg-black-900/60 border-black-700/50 hover:border-gold-500/20',
                  )}
                >
                  {/* Glow effect when active */}
                  {activeReader === i && (
                    <div className={clsx(
                      'absolute inset-0 rounded-xl opacity-20 blur-xl -z-10',
                      `bg-gradient-to-br ${reader.color}`,
                    )} />
                  )}

                  <div className="text-2xl mb-2">{reader.emoji}</div>
                  <p className={clsx(
                    'text-xs font-display font-medium leading-tight',
                    activeReader === i ? 'text-white' : 'text-gold-200',
                  )}>
                    {reader.name}
                  </p>
                  <p className="text-[9px] text-black-500 mt-1 leading-snug hidden group-hover:block">
                    {reader.focus.split(',')[0]}
                  </p>
                </button>
              ))}
            </div>

            {/* Expanded reader detail */}
            {activeReader !== null && (
              <div className={clsx(
                'mt-3 rounded-xl border p-4 transition-all',
                READERS[activeReader].bg,
                READERS[activeReader].border,
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{READERS[activeReader].emoji}</span>
                  <span className="font-display text-gold-100 text-sm">{READERS[activeReader].name} Reader</span>
                  <span className="text-[10px] text-black-400 ml-1">— {READERS[activeReader].focus}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {READERS[activeReader].tags.map((tag) => (
                    <span
                      key={tag}
                      className={clsx(
                        'text-[10px] px-2 py-1 rounded-full border',
                        READERS[activeReader].bg,
                        READERS[activeReader].border,
                        'text-white/70',
                      )}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 4: Synthesis */}
        <PipelineNode
          step={4}
          icon="⚖️"
          title="Synthesis & Scoring"
          desc="Cross-reader consensus — weighted scores, agreements flagged, divergences noted"
          time="10–15s"
          accent="purple"
        />

        {/* Step 5: Output */}
        <PipelineNode
          step={5}
          icon="🎬"
          title="Final Report"
          desc="Score, verdict, logline, genre, budget tier, movie poster — saved to cloud"
          time="complete"
          accent="emerald"
          isLast
        />
      </div>

      {/* ── Output Showcase ──────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-black-900 to-black-950 border border-gold-500/15 overflow-hidden">
        <div className="px-6 pt-5 pb-3 border-b border-gold-500/10">
          <h3 className="text-sm font-display text-gold-300 tracking-wide">WHAT YOU GET</h3>
        </div>
        <div className="grid grid-cols-4 divide-x divide-gold-500/10">
          {[
            { icon: '🎯', value: '0–10', label: 'Weighted Score', sub: '5 pillar average' },
            { icon: '💰', value: '/18', label: 'CVS Score', sub: 'Commercial viability' },
            { icon: '🏷️', value: '4 tiers', label: 'Verdict', sub: 'Film Now → Pass' },
            { icon: '🖼️', value: 'AI art', label: 'Movie Poster', sub: 'Cinematic one-sheet' },
          ].map((item) => (
            <div key={item.label} className="p-5 text-center group hover:bg-gold-500/3 transition-colors">
              <span className="text-2xl block mb-2 group-hover:scale-110 transition-transform">{item.icon}</span>
              <p className="text-lg font-bold text-gold-300">{item.value}</p>
              <p className="text-xs font-medium text-gold-200 mt-1">{item.label}</p>
              <p className="text-[10px] text-black-500 mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 divide-x divide-gold-500/10 border-t border-gold-500/10">
          {[
            { icon: '📝', label: 'Auto-Logline', sub: 'AI-crafted pitch' },
            { icon: '🎬', label: 'Genre + Budget', sub: 'Classification' },
            { icon: '📊', label: '5 Pillar Breakdown', sub: 'With justifications' },
            { icon: '🔗', label: 'Shareable Link', sub: 'Public analysis URL' },
          ].map((item) => (
            <div key={item.label} className="p-4 text-center group hover:bg-gold-500/3 transition-colors">
              <span className="text-lg block mb-1.5">{item.icon}</span>
              <p className="text-xs font-medium text-gold-200">{item.label}</p>
              <p className="text-[10px] text-black-500 mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Live Stats ──────────────────────────────────────────────── */}
      {stats && (
        <div className="rounded-2xl bg-gradient-to-r from-gold-500/8 via-transparent to-gold-500/8 border border-gold-500/10 p-5">
          <p className="text-[10px] text-gold-500/60 uppercase tracking-widest mb-3 text-center">Your Dashboard Stats</p>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gold-300">{stats.total}</p>
              <p className="text-[10px] text-black-500 uppercase tracking-wider mt-1">analyzed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gold-300">{stats.topGenre}</p>
              <p className="text-[10px] text-black-500 uppercase tracking-wider mt-1">top genre</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gold-300">{stats.avgScore}</p>
              <p className="text-[10px] text-black-500 uppercase tracking-wider mt-1">avg score</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.passRate}%</p>
              <p className="text-[10px] text-black-500 uppercase tracking-wider mt-1">pass rate</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Engine Stats Strip ────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-8 py-4">
        {[
          { n: '5', l: 'expert readers' },
          { n: '300+', l: 'data points' },
          { n: '~60s', l: 'total time' },
          { n: '0', l: 'human bias' },
        ].map((s) => (
          <div key={s.l} className="text-center">
            <p className="text-xl font-bold text-gold-400">{s.n}</p>
            <p className="text-[10px] text-black-500 uppercase tracking-wider">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Pipeline Node sub-component ────────────────────────────────────────── */

function PipelineNode({
  step,
  icon,
  title,
  desc,
  time,
  accent: _accent,
  isLast,
}: {
  step: number;
  icon: string;
  title: string;
  desc: string;
  time: string;
  accent: string;
  isLast?: boolean;
}) {
  return (
    <div className={clsx('relative flex items-start gap-4 py-4', isLast && 'pb-0')}>
      {/* Node dot */}
      <div className="shrink-0 w-[55px] flex justify-center">
        <div className="w-[10px] h-[10px] rounded-full bg-gold-500/60 ring-4 ring-gold-500/10 z-10 mt-1.5" />
      </div>

      {/* Content */}
      <div className="flex-1 -mt-0.5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-gold-500/60">STEP {step}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black-800/60 text-black-400">{time}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="font-display text-gold-200 text-sm">{title}</h3>
        </div>
        <p className="text-xs text-black-400 mt-0.5 ml-7">{desc}</p>
      </div>
    </div>
  );
}
