import { useState, useEffect } from 'react'

// ─── Types ─────────────────────────────────────────────────────────────────
interface MediaItem {
  outlet: string
  headline: string
  url: string
  date: string
  lang: 'EN' | 'ES' | 'IT'
  market: 'Mexico' | 'US' | 'Spain' | 'International' | 'Italy'
  type: 'Trade' | 'Entertainment' | 'Tech' | 'Regional' | 'Review'
  excerpt: string
}

interface Strategy {
  id: string
  text: string
}

interface DailyUpdate {
  date: string
  content: string
}

// ─── Static data ────────────────────────────────────────────────────────────
const MEDIA_ITEMS: MediaItem[] = [
  {
    outlet: 'Screen Anarchy',
    headline: 'Women in Blue (Las Azules) S2 Review: Two Steps Forward, One Step Back',
    url: 'https://screenanarchy.com/2026/08/women-in-blue-las-azules-s2-review-two-steps-forward-one-step-back.html',
    date: 'Aug 12, 2026',
    lang: 'EN',
    market: 'International',
    type: 'Review',
    excerpt: '"Season 2 feels more on-point and certain of its tone. More relevant today, far beyond Mexico\'s borders." — 4/5 stars',
  },
  {
    outlet: 'Deadline',
    headline: 'Women in Blue Season 2 Premiere Date + First Look',
    url: 'https://deadline.com/2026/03/women-in-blue-las-azules-season-2-premiere-date-apple-tv-1236766505/',
    date: 'Mar 26, 2026',
    lang: 'EN',
    market: 'US',
    type: 'Trade',
    excerpt: 'Season 2 of Apple TV\'s Spanish-language drama premieres August 12.',
  },
  {
    outlet: 'Forbes',
    headline: 'Women in Blue Las Azules Season 2 Gets August Premiere on Apple TV',
    url: 'https://www.forbes.com/sites/veronicavillafane/2026/03/26/women-in-blue-las-azules-season-2-gets-august-premiere-on-apple-tv/',
    date: 'Mar 26, 2026',
    lang: 'EN',
    market: 'US',
    type: 'Entertainment',
    excerpt: 'Veronica Villafane reports on S2 premiere date, cast, and production details.',
  },
  {
    outlet: 'Reuters',
    headline: 'Apple TV series Las Azules S2 blends fact and fiction for tale of corruption and growth',
    url: 'https://macdailynews.com/2026/08/11/apple-tv-series-las-azules-season-2-blends-fact-and-fiction-for-tale-of-corruption-and-growth-reuters/',
    date: 'Aug 10, 2026',
    lang: 'EN',
    market: 'International',
    type: 'Trade',
    excerpt: 'Reuters pre-premiere feature on the historical basis and production vision of Season 2.',
  },
  {
    outlet: '9to5Mac',
    headline: "Women in Blue's second season premieres on Apple TV+",
    url: 'https://9to5mac.com/2026/08/11/women-in-blues-second-season-premieres-on-apple-tv/',
    date: 'Aug 11, 2026',
    lang: 'EN',
    market: 'US',
    type: 'Tech',
    excerpt: 'Launch day coverage and trailer analysis for Apple TV+ subscribers.',
  },
  {
    outlet: 'MacObserver',
    headline: 'Women in Blue Season 2 Is Now Streaming on Apple TV+',
    url: 'https://www.macobserver.com/appletv/women-in-blue-season-2-is-now-streaming-on-apple-tv/',
    date: 'Aug 12, 2026',
    lang: 'EN',
    market: 'US',
    type: 'Tech',
    excerpt: 'Premiere day announcement for Apple ecosystem audience.',
  },
  {
    outlet: 'El Informador',
    headline: 'Las Azules persiguen las sombras del poder',
    url: 'https://www.informador.mx/entretenimiento/series-las-azules-persiguen-las-sombras-del-poder-20260811-0001.html',
    date: 'Aug 11, 2026',
    lang: 'ES',
    market: 'Mexico',
    type: 'Entertainment',
    excerpt: 'Feature interview with cast and creators on the political themes of Season 2.',
  },
  {
    outlet: 'Heraldo de Mexico',
    headline: 'Fernando Rovzar desafia el sistema con Las Azules',
    url: 'https://heraldodemexico.com.mx/espectaculos/2026/8/12/fernando-rovzar-desafia-el-sistema-con-la-serie-las-azules-867326.html',
    date: 'Aug 12, 2026',
    lang: 'ES',
    market: 'Mexico',
    type: 'Entertainment',
    excerpt: 'Premiere day profile on showrunner Fernando Rovzar and his vision for Season 2.',
  },
  {
    outlet: 'AM.com.mx',
    headline: 'Las Azules vuelve con una temporada más intensa y vigente',
    url: 'https://www.am.com.mx/espectaculos/2026/07/30/las-azules-vuelve-con-una-temporada-mas-intensa-y-vigente-fernando-rovzar-barbara-mori-y-horacio-garcia-rojas-la-presentan-en-giff-1825613.html',
    date: 'Jul 30, 2026',
    lang: 'ES',
    market: 'Mexico',
    type: 'Regional',
    excerpt: 'GIFF festival preview with full cast and creator panel coverage.',
  },
  {
    outlet: 'Neeo (Spain)',
    headline: 'Las Azules Season 2 — Premiere Preview',
    url: 'https://neeo.es',
    date: 'Aug 10, 2026',
    lang: 'ES',
    market: 'Spain',
    type: 'Entertainment',
    excerpt: 'Spanish media preview ahead of S2 premiere on Apple TV+.',
  },
  {
    outlet: 'The Week India',
    headline: 'Women in Blue Season 2 Premiere Preview',
    url: 'https://www.theweek.in/news/entertainment/2026/08/10/women-in-blue-season-2-premiere.html',
    date: 'Aug 10, 2026',
    lang: 'EN',
    market: 'International',
    type: 'Entertainment',
    excerpt: 'International preview coverage ahead of global Apple TV+ launch.',
  },
  {
    outlet: 'TVMEG.COM',
    headline: 'Interview: Barbara Mori, Ximena Sarinana, Fernando Rovzar on Season 2',
    url: 'https://tvmeg.com/index.php/2026/08/08/rovzar/',
    date: 'Aug 8, 2026',
    lang: 'EN',
    market: 'US',
    type: 'Entertainment',
    excerpt: 'Multi-subject interview ahead of the August 12 premiere.',
  },
  {
    outlet: 'HeyUGuys',
    headline: 'Women in Blue — Trailer & Cast Interviews',
    url: 'https://www.heyuguys.com/women-in-blue-las-azules-interviews/',
    date: 'Jul 2026',
    lang: 'EN',
    market: 'International',
    type: 'Entertainment',
    excerpt: 'Trailer release and cast interview coverage from UK entertainment press.',
  },
  {
    outlet: 'Excelsior',
    headline: 'Las Azules muestran dos adelantos de temporada 2 en GIFF 2026',
    url: 'https://www.excelsior.com.mx/espectaculos/azules-apple-tv-muestran-dos-adelantos-temporada-2-giff-2026',
    date: 'Jul 30, 2026',
    lang: 'ES',
    market: 'Mexico',
    type: 'Regional',
    excerpt: 'GIFF 2026 coverage of the two advance preview episodes shown in San Miguel de Allende.',
  },
  {
    outlet: 'Broadway World',
    headline: 'Women in Blue Las Azules Season 2 Trailer Drop',
    url: 'https://www.broadwayworld.com/bwwtv/article/WOMEN-IN-BLUE-LAS-AZULES-Season-2-Trailer-to-Drop-on-Apple-TV-20260721',
    date: 'Jul 21, 2026',
    lang: 'EN',
    market: 'US',
    type: 'Entertainment',
    excerpt: 'Multiple articles covering the Season 2 trailer release.',
  },
  {
    outlet: 'uInterview',
    headline: 'Video Exclusive: Barbara Mori & Ximena Sarinana on Playing Mexico\'s First Female Cops',
    url: 'https://uinterview.com/videos/video-exclusive-barbara-mori-ximena-sarinana-on-playing-mexicos-first-female-cops-in-women-in-blue/',
    date: 'Aug 2026',
    lang: 'EN',
    market: 'US',
    type: 'Entertainment',
    excerpt: 'Video exclusive interview with the two leads.',
  },
  {
    outlet: 'Reuters (US Radio Syndication)',
    headline: '7+ US Radio Station Websites — Reuters Feature Syndication',
    url: 'https://macdailynews.com/2026/08/11/apple-tv-series-las-azules-season-2-blends-fact-and-fiction-for-tale-of-corruption-and-growth-reuters/',
    date: 'Aug 11, 2026',
    lang: 'EN',
    market: 'US',
    type: 'Regional',
    excerpt: 'Reuters pre-premiere wire syndicated to 927thevan.com, 1065thebuzz.com, wiky.com, 933thedrive.com, froggyweb.com, wifc.com, y94.com and more.',
  },
]

const FREE_STRATEGIES: Strategy[] = [
  { id: 'f1', text: 'Cast social media activation (Barbara Mori, Ximena Sarinana, Natalia Tellez, Amorita Rasgado)' },
  { id: 'f2', text: 'Historical content series — Tlatelolco/Halconazo education campaign' },
  { id: 'f3', text: 'Mexican celebrity outreach — feminist/justice-aligned influencers' },
  { id: 'f4', text: 'Weekly episode hashtag strategy tied to real historical themes' },
  { id: 'f5', text: 'Media relations — pitch Reforma, El Universal, Milenio (currently underrepresented)' },
  { id: 'f6', text: 'YouTube BTS & clip strategy via Apple TV and Lemon Studios channels' },
  { id: 'f7', text: 'Press screening events in CDMX, LA, Miami, and Madrid' },
  { id: 'f8', text: 'Podcast circuit — Fernando Rovzar and Barbara Mori on key English/Spanish shows' },
  { id: 'f9', text: 'Feminist & cultural media pitches (Chilango, Vogue en Español, Refinery29, Bustle)' },
  { id: 'f10', text: 'Academic / cultural tie-ins with UNAM, Instituto Mora, human rights orgs' },
]

const PAID_STRATEGIES: Strategy[] = [
  { id: 'p1', text: 'Targeted Meta/Instagram ads — Mexico, US Latino, Spain, Argentina (Barbara Mori creative)' },
  { id: 'p2', text: 'YouTube pre-roll targeting crime drama and Spanish-language series viewers' },
  { id: 'p3', text: 'Apple-coordinated promotion — Apple TV app banner, editorial lists, email newsletters' },
  { id: 'p4', text: 'Podcast advertising on top Spanish-language podcasts in Mexico and US' },
  { id: 'p5', text: 'CTV/OTT advertising on Max, Peacock, Pluto TV ad tiers' },
  { id: 'p6', text: 'Influencer partnerships — 10-20 mid/large Mexican & US Latino accounts' },
  { id: 'p7', text: 'Digital out-of-home in Mexico City (Insurgentes, Reforma, Roma/Condesa)' },
  { id: 'p8', text: 'Print/digital advertorial spreads in key Mexican and US Latino publications' },
]

const EPISODES = [
  { ep: 1, date: 'August 12, 2026', status: 'live' },
  { ep: 2, date: 'August 19, 2026', status: 'upcoming' },
  { ep: 3, date: 'August 26, 2026', status: 'upcoming' },
  { ep: 4, date: 'September 2, 2026', status: 'upcoming' },
  { ep: 5, date: 'September 9, 2026', status: 'upcoming' },
  { ep: 6, date: 'September 16, 2026', status: 'upcoming' },
  { ep: 7, date: 'September 23, 2026', status: 'upcoming' },
  { ep: 8, date: 'September 30, 2026', status: 'upcoming' },
]

const CAST = [
  { name: 'Barbara Mori', role: 'Lieutenant María', note: 'Lead; co-wrote scripts with writers room' },
  { name: 'Ximena Sarinana', role: 'Ángeles', note: 'Navigates institutional lack of empathy' },
  { name: 'Natalia Téllez', role: 'Valentina', note: 'Full ensemble return' },
  { name: 'Amorita Rasgado', role: 'Gabina', note: 'Faces machismo at home and within the force' },
  { name: 'Horacio García Rojas', role: 'Det. Gerardo Herrera', note: 'Supporting lead' },
  { name: 'Bruno Bichir', role: 'Supporting', note: '' },
  { name: 'Leonardo Sbaraglia', role: 'Supporting', note: '' },
  { name: 'Christian Tappan', role: 'Supporting', note: '' },
  { name: 'Miguel Rodarte', role: 'Supporting', note: '' },
]

const CREATIVE_TEAM = [
  { name: 'Fernando Rovzar', role: 'Creator, Showrunner, Director', note: 'International Emmy winner; also created Monarca' },
  { name: 'Billy Rovzar', role: 'Executive Producer', note: 'International Emmy winner; Lemon Studios' },
  { name: 'Pablo Aramendi', role: 'Co-creator', note: '' },
  { name: 'Wendy Riss', role: 'Executive Producer', note: 'Emmy nominee, Yellowstone' },
  { name: 'Alejandro Lozano', role: 'Executive Producer', note: 'Control Z' },
  { name: 'Erica Sanchez Su', role: 'Executive Producer', note: 'Monarca' },
]

const QUOTES = [
  { speaker: 'Fernando Rovzar', text: '"If in the first season the enemy was a serial killer, in this season it\'s an entire system."' },
  { speaker: 'Fernando Rovzar', text: '"It\'s impossible to discover a truth if you don\'t first challenge the system that wanted to silence it."' },
  { speaker: 'Barbara Mori', text: '"Now she\'s a woman giving herself permission to be. The entire season treats discovering who she really is."' },
  { speaker: 'Screen Anarchy (4/5 ★)', text: '"Season 2 feels more on-point and certain of its tone. More relevant today, far beyond Mexico\'s borders, and remains a likable, lively, and thoughtful show."' },
]

const INITIAL_UPDATES: DailyUpdate[] = [
  {
    date: 'Aug 12, 2026 — PREMIERE DAY',
    content: `Season 2 of Las Azules (Women in Blue) launched globally on Apple TV+. Research Specialist compiled comprehensive launch-day media coverage report:

• 30+ outlets confirmed covering S2 across trade, entertainment, tech, and regional press
• Screen Anarchy published first full critical review: 4/5 stars
• Reuters pre-premiere feature syndicated to 7+ US radio station websites
• Heraldo de Mexico and El Informador ran premiere-day features
• MacObserver: "Women in Blue Season 2 Is Now Streaming"
• Apple TV+ trending on 9to5Mac

Key quote: Fernando Rovzar — "If in the first season the enemy was a serial killer, in this season it's an entire system."`,
  },
]

// ─── Utility components ─────────────────────────────────────────────────────
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {children}
    </span>
  )
}

function MarketBadge({ market }: { market: MediaItem['market'] }) {
  const colors: Record<string, string> = {
    Mexico: 'bg-green-500/20 text-green-400',
    US: 'bg-blue-500/20 text-blue-400',
    Spain: 'bg-orange-500/20 text-orange-400',
    International: 'bg-purple-500/20 text-purple-400',
    Italy: 'bg-red-500/20 text-red-400',
  }
  return <Badge color={colors[market] || 'bg-gray-500/20 text-gray-400'}>{market}</Badge>
}

function TypeBadge({ type }: { type: MediaItem['type'] }) {
  const colors: Record<string, string> = {
    Trade: 'bg-blue-500/15 text-blue-300',
    Entertainment: 'bg-pink-500/15 text-pink-300',
    Tech: 'bg-cyan-500/15 text-cyan-300',
    Regional: 'bg-yellow-500/15 text-yellow-300',
    Review: 'bg-amber-500/15 text-amber-300',
  }
  return <Badge color={colors[type] || 'bg-gray-500/15 text-gray-300'}>{type}</Badge>
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-4 flex flex-col gap-1 border ${
        highlight
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-white/5 border-white/10'
      }`}
    >
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      <span className={`text-3xl font-bold ${highlight ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  )
}

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value))
  return (
    <div className="flex flex-col gap-2">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-24 shrink-0">{d.label}</span>
          <div className="flex-1 bg-white/5 rounded-full h-5 overflow-hidden">
            <div
              className={`h-full rounded-full ${d.color} flex items-center justify-end pr-2 transition-all`}
              style={{ width: `${Math.max(8, (d.value / max) * 100)}%` }}
            >
              <span className="text-xs font-semibold text-white">{d.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function StrategyList({ strategies, storageKey }: { strategies: Strategy[]; storageKey: string }) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const doneCount = Object.values(checked).filter(Boolean).length

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">{doneCount} / {strategies.length} activated</p>
      <div className="flex flex-col gap-2">
        {strategies.map(s => (
          <label
            key={s.id}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
              checked[s.id]
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-white/5 border-white/10 hover:border-white/20'
            }`}
          >
            <input
              type="checkbox"
              checked={!!checked[s.id]}
              onChange={() => toggle(s.id)}
              className="mt-0.5 accent-green-400 shrink-0"
            />
            <span
              className={`text-sm leading-relaxed ${
                checked[s.id] ? 'text-gray-400 line-through' : 'text-gray-200'
              }`}
            >
              {s.text}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────
export function LasAzulesPage() {
  const [search, setSearch] = useState('')
  const [marketFilter, setMarketFilter] = useState<string>('all')
  const [langFilter, setLangFilter] = useState<string>('all')
  const [updates] = useState<DailyUpdate[]>(INITIAL_UPDATES)

  const markets = Array.from(new Set(MEDIA_ITEMS.map(m => m.market))).sort()

  const filteredMedia = MEDIA_ITEMS.filter(m => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      m.headline.toLowerCase().includes(q) ||
      m.outlet.toLowerCase().includes(q) ||
      m.excerpt.toLowerCase().includes(q)
    const matchMarket = marketFilter === 'all' || m.market === marketFilter
    const matchLang = langFilter === 'all' || m.lang === langFilter
    return matchSearch && matchMarket && matchLang
  })

  const marketCounts = MEDIA_ITEMS.reduce<Record<string, number>>((acc, m) => {
    acc[m.market] = (acc[m.market] || 0) + 1
    return acc
  }, {})

  const typeCounts = MEDIA_ITEMS.reduce<Record<string, number>>((acc, m) => {
    acc[m.type] = (acc[m.type] || 0) + 1
    return acc
  }, {})

  const langCounts = MEDIA_ITEMS.reduce<Record<string, number>>((acc, m) => {
    acc[m.lang] = (acc[m.lang] || 0) + 1
    return acc
  }, {})

  // Scroll to section
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    document.title = 'Las Azules S2 — Media Dashboard'
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">LA</div>
            <div>
              <p className="text-sm font-bold text-white leading-none">Las Azules S2</p>
              <p className="text-xs text-gray-500 leading-none">Media Dashboard</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1 text-xs text-gray-400">
            {['coverage', 'metrics', 'social', 'show', 'amplification', 'updates'].map(s => (
              <button
                key={s}
                onClick={() => scrollTo(s)}
                className="px-3 py-1.5 rounded-lg hover:bg-white/10 capitalize transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs text-green-400 font-medium">LIVE</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 via-slate-900/60 to-slate-950" />
        <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs uppercase tracking-widest text-blue-400 font-semibold">Apple TV+ Original</span>
              <span className="text-gray-600">•</span>
              <span className="text-xs uppercase tracking-widest text-gray-400">Season 2</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-2 leading-none">
              Las Azules
            </h1>
            <p className="text-xl text-blue-300 font-medium mb-4">Women in Blue</p>
            <p className="text-gray-300 text-base md:text-lg mb-6 leading-relaxed max-w-2xl">
              A Lemon Studios production. 8 episodes. Premieres August 12, 2026 — finale September 30, 2026.
              Mexico City, 1971. Lieutenant María and the Azules investigate a student activist's murder —
              uncovering a conspiracy reaching back to the Halconazo massacre.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge color="bg-blue-600/30 text-blue-300">Season 2 Premiere</Badge>
              <Badge color="bg-amber-500/20 text-amber-300">S1: 100% Rotten Tomatoes</Badge>
              <Badge color="bg-green-500/20 text-green-300">Fernando Rovzar</Badge>
              <Badge color="bg-pink-500/20 text-pink-300">Barbara Mori</Badge>
              <Badge color="bg-purple-500/20 text-purple-300">International Emmy</Badge>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-16">

        {/* ── Metrics ── */}
        <section id="metrics">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full inline-block" />
            Metrics & KPIs
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Articles Tracked" value="30+" sub="As of Aug 12 — growing" />
            <StatCard label="S1 Rotten Tomatoes" value="100%" sub="Tomatometer" highlight />
            <StatCard label="S1 IMDb" value="7.3" sub="Most episodes 8.0+" />
            <StatCard label="S1 Metacritic" value="76" sub="Generally Favorable" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Coverage by Market</h3>
              <BarChart
                data={[
                  { label: 'US', value: marketCounts['US'] || 0, color: 'bg-blue-500' },
                  { label: 'Mexico', value: marketCounts['Mexico'] || 0, color: 'bg-green-500' },
                  { label: 'International', value: marketCounts['International'] || 0, color: 'bg-purple-500' },
                  { label: 'Spain', value: marketCounts['Spain'] || 0, color: 'bg-orange-500' },
                  { label: 'Italy', value: marketCounts['Italy'] || 0, color: 'bg-red-400' },
                ]}
              />
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Coverage by Type</h3>
              <BarChart
                data={[
                  { label: 'Entertainment', value: typeCounts['Entertainment'] || 0, color: 'bg-pink-500' },
                  { label: 'Tech', value: typeCounts['Tech'] || 0, color: 'bg-cyan-500' },
                  { label: 'Trade', value: typeCounts['Trade'] || 0, color: 'bg-blue-500' },
                  { label: 'Regional', value: typeCounts['Regional'] || 0, color: 'bg-yellow-500' },
                  { label: 'Review', value: typeCounts['Review'] || 0, color: 'bg-amber-500' },
                ]}
              />
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Coverage by Language</h3>
              <BarChart
                data={[
                  { label: 'English', value: langCounts['EN'] || 0, color: 'bg-blue-500' },
                  { label: 'Spanish', value: langCounts['ES'] || 0, color: 'bg-green-500' },
                  { label: 'Italian', value: langCounts['IT'] || 0, color: 'bg-red-400' },
                ]}
              />
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-400">Season 2 critics scores accumulating — checking RT, IMDb, and Metacritic daily.</p>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Badge color="bg-yellow-500/20 text-yellow-300">RT S2: Accumulating</Badge>
                  <Badge color="bg-blue-500/20 text-blue-300">1 Review: 4/5 ★</Badge>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Media Coverage Feed ── */}
        <section id="coverage">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="w-1 h-6 bg-blue-500 rounded-full inline-block" />
              Media Coverage Feed
              <span className="text-sm font-normal text-gray-400 ml-1">({filteredMedia.length} of {MEDIA_ITEMS.length})</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                placeholder="Search outlets…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 w-40"
              />
              <select
                value={marketFilter}
                onChange={e => setMarketFilter(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
              >
                <option value="all">All Markets</option>
                {markets.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select
                value={langFilter}
                onChange={e => setLangFilter(e.target.value)}
                className="px-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-400"
              >
                <option value="all">All Languages</option>
                <option value="EN">English</option>
                <option value="ES">Spanish</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {filteredMedia.map((item, i) => (
              <article
                key={i}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
              >
                <div className="flex flex-col md:flex-row md:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-blue-300">{item.outlet}</span>
                      <span className="text-gray-600 text-xs">•</span>
                      <span className="text-xs text-gray-500">{item.date}</span>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white font-medium hover:text-blue-300 transition-colors leading-snug block mb-2"
                    >
                      {item.headline} ↗
                    </a>
                    <p className="text-sm text-gray-400 leading-relaxed">{item.excerpt}</p>
                  </div>
                  <div className="flex flex-wrap md:flex-col gap-1 shrink-0">
                    <MarketBadge market={item.market} />
                    <TypeBadge type={item.type} />
                    <Badge color="bg-gray-700/50 text-gray-300">{item.lang}</Badge>
                  </div>
                </div>
              </article>
            ))}
            {filteredMedia.length === 0 && (
              <div className="text-center py-12 text-gray-500">No articles match your filters.</div>
            )}
          </div>
        </section>

        {/* ── Key Quotes ── */}
        <section className="bg-blue-900/20 rounded-2xl p-6 md:p-8 border border-blue-500/20">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full inline-block" />
            Key Quotes
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {QUOTES.map((q, i) => (
              <blockquote key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-gray-200 italic leading-relaxed mb-3">{q.text}</p>
                <footer className="text-sm font-medium text-blue-300">— {q.speaker}</footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* ── Social Media Section ── */}
        <section id="social">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full inline-block" />
            Social Media Impact
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Trailer Performance</h3>
              <div className="space-y-3">
                <a
                  href="https://www.youtube.com/watch?v=1lVJ96Oi9UY"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group"
                >
                  <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center shrink-0 text-red-400 text-xs font-bold">YT</div>
                  <div>
                    <p className="text-sm text-gray-200 group-hover:text-white transition-colors">Official Trailer (EN) — Apple TV+</p>
                    <p className="text-xs text-gray-500">youtube.com/watch?v=1lVJ96Oi9UY ↗</p>
                  </div>
                </a>
                <a
                  href="https://www.youtube.com/watch?v=6PM90l-KLyc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group"
                >
                  <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center shrink-0 text-red-400 text-xs font-bold">YT</div>
                  <div>
                    <p className="text-sm text-gray-200 group-hover:text-white transition-colors">Tráiler Oficial Español Latino</p>
                    <p className="text-xs text-gray-500">youtube.com/watch?v=6PM90l-KLyc ↗</p>
                  </div>
                </a>
                <a
                  href="https://www.youtube.com/watch?v=lojkAQw_Bro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group"
                >
                  <div className="w-8 h-8 rounded bg-red-500/20 flex items-center justify-center shrink-0 text-red-400 text-xs font-bold">YT</div>
                  <div>
                    <p className="text-sm text-gray-200 group-hover:text-white transition-colors">Trailer Oficial (Segunda Temporada)</p>
                    <p className="text-xs text-gray-500">youtube.com/watch?v=lojkAQw_Bro ↗</p>
                  </div>
                </a>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Hashtag Strategy</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {['#LasAzules', '#WomenInBlue', '#AppleTV', '#LasAzulesS2', '#FernandoRovzar', '#BarbaraMori', '#LemonStudios', '#Halconazo', '#Tlatelolco'].map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-blue-500/15 text-blue-300 rounded-lg text-xs font-mono">{tag}</span>
                ))}
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs text-gray-400 mb-2">Team notes:</p>
                <textarea
                  placeholder="Add social media notes here (saved locally)…"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-400 resize-none"
                  rows={3}
                  onChange={e => {
                    try { localStorage.setItem('las-azules-social-notes', e.target.value) } catch {}
                  }}
                  defaultValue={(() => { try { return localStorage.getItem('las-azules-social-notes') || '' } catch { return '' } })()}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── Show Info ── */}
        <section id="show">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full inline-block" />
            Show Info
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Episode schedule */}
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Episode Schedule — Season 2</h3>
              <div className="space-y-2">
                {EPISODES.map(ep => (
                  <div
                    key={ep.ep}
                    className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                      ep.status === 'live'
                        ? 'bg-green-500/15 border border-green-500/30'
                        : 'border border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-12">Ep. {ep.ep}</span>
                      <span className="text-sm text-gray-200">{ep.date}</span>
                    </div>
                    {ep.status === 'live' && (
                      <span className="text-xs text-green-400 font-medium">Live Now</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Cast */}
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Lead Cast</h3>
                <div className="space-y-3">
                  {CAST.filter(c => c.note).map(c => (
                    <div key={c.name} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-300 shrink-0">
                        {c.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{c.name}</p>
                        <p className="text-xs text-blue-300">{c.role}</p>
                        {c.note && <p className="text-xs text-gray-500 mt-0.5">{c.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Creative Team</h3>
                <div className="space-y-2">
                  {CREATIVE_TEAM.map(c => (
                    <div key={c.name} className="flex items-start gap-2">
                      <div className="text-right shrink-0 w-32">
                        <p className="text-xs text-gray-400 leading-tight">{c.role}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white leading-tight">{c.name}</p>
                        {c.note && <p className="text-xs text-gray-500">{c.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Amplification ── */}
        <section id="amplification">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full inline-block" />
            Amplification Strategy Tracker
          </h2>
          <p className="text-sm text-gray-400 mb-6">Check off strategies as the team activates them. State saves in your browser.</p>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-4">
                Free Strategies ({FREE_STRATEGIES.length})
              </h3>
              <StrategyList strategies={FREE_STRATEGIES} storageKey="las-azules-free-strategies" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-4">
                Paid Strategies ({PAID_STRATEGIES.length})
              </h3>
              <StrategyList strategies={PAID_STRATEGIES} storageKey="las-azules-paid-strategies" />
            </div>
          </div>
        </section>

        {/* ── Daily Updates ── */}
        <section id="updates">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full inline-block" />
            Daily Updates Feed
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Updated each morning by the Research Specialist's 7am routine through September 30, 2026.
          </p>
          <div className="flex flex-col gap-4">
            {updates.map((u, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-5 border border-white/10">
                <p className="text-xs text-blue-300 font-semibold mb-3 uppercase tracking-wider">{u.date}</p>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{u.content}</pre>
              </div>
            ))}
          </div>
        </section>

        {/* ── Critical reception deep dive ── */}
        <section>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="w-1 h-6 bg-blue-500 rounded-full inline-block" />
            Critical Reception
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-amber-300 mb-4">Season 1 Baseline</h3>
              <div className="space-y-4">
                {[
                  { label: 'Rotten Tomatoes', score: '100%', note: 'Tomatometer | 83% Audience', color: 'text-green-400' },
                  { label: 'Metacritic', score: '76', note: 'Generally Favorable — 6 reviews', color: 'text-blue-400' },
                  { label: 'IMDb', score: '7.3', note: 'Most episodes rated 8.0+', color: 'text-yellow-400' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{r.label}</span>
                    <div className="text-right">
                      <span className={`text-lg font-bold ${r.color}`}>{r.score}</span>
                      <p className="text-xs text-gray-500">{r.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <h3 className="text-sm font-semibold text-blue-300 mb-4">Season 2 — Premiere Day (Accumulating)</h3>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-300 font-semibold mb-1">Screen Anarchy — 4/5 ★</p>
                  <p className="text-sm text-gray-300 italic">"More on-point and certain of its tone. More relevant today, far beyond Mexico's borders."</p>
                  <a
                    href="https://screenanarchy.com/2026/08/women-in-blue-las-azules-s2-review-two-steps-forward-one-step-back.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
                  >
                    Read full review ↗
                  </a>
                </div>
                <p className="text-xs text-gray-500">Rotten Tomatoes, Metacritic, and IMDb S2 scores will accumulate over premiere week. Dashboard updates daily.</p>
                <div className="flex gap-2 flex-wrap">
                  <a href="https://www.rottentomatoes.com/tv/women_in_blue_2024/s02" target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 bg-red-500/15 text-red-300 rounded hover:bg-red-500/25 transition-colors">RT ↗</a>
                  <a href="https://www.metacritic.com/tv/women-in-blue/" target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 bg-yellow-500/15 text-yellow-300 rounded hover:bg-yellow-500/25 transition-colors">Metacritic ↗</a>
                  <a href="https://www.imdb.com/title/tt20516590/" target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 bg-amber-500/15 text-amber-300 rounded hover:bg-amber-500/25 transition-colors">IMDb ↗</a>
                </div>
              </div>
            </div>
          </div>

          {/* S1 notable quotes */}
          <div className="mt-6 bg-white/5 rounded-xl p-5 border border-white/10">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Season 1 Notable Critic Quotes</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { source: 'Variety (80/100)', text: '"Succeeds because it showcases how patriarchal ideals and misogyny harm not just women but society."' },
                { source: 'RogerEbert.com (80/100)', text: '"Combines predictable genre elements with surprising turns."' },
                { source: 'Collider (80/100)', text: '"Each episode is entertaining enough to keep you hooked with a promising setup for future seasons."' },
                { source: 'The Guardian (60/100)', text: '"The murderer\'s identity forms the narrative drive."' },
              ].map((q, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/5">
                  <p className="text-xs text-blue-300 font-semibold mb-1">{q.source}</p>
                  <p className="text-sm text-gray-400 italic">{q.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-16 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-600">
          <p>Las Azules S2 Media Dashboard — Lemon Virtual Studios</p>
          <p>Data: LEMA-8459 Research Specialist Report • Updated daily by 7am routine</p>
          <p>Aug 12 – Sep 30, 2026</p>
        </div>
      </footer>
    </div>
  )
}
