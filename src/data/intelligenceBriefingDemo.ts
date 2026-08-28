import type {
  BriefingClaim,
  BriefingSource,
  IntelligenceBriefingSnapshot,
  PortfolioOpportunity,
  PortfolioProject,
} from '@/lib/studioPulse';

const mx = {
  scope: 'country' as const,
  countryCodes: ['MX'],
  audienceDefinition: null,
};

const demoSources: BriefingSource[] = [
  {
    ...mx,
    id: 'demo-reddit-sample',
    title: 'Licensed Mexico conversation sample',
    publisher: 'Demo Reddit connector',
    url: 'https://example.com/demo-reddit-sample',
    publishedAt: '2026-08-24',
    accessedAt: '2026-08-26',
    expiresAt: '2026-09-02',
    role: 'measurement',
    method: {
      collection: 'Licensed aggregate sample',
      notes: {
        en: 'Fictional aggregate created only to preview the interface.',
        'es-MX': 'Agregado ficticio creado únicamente para previsualizar la interfaz.',
      },
    },
    independenceGroup: 'demo-reddit',
    channel: 'conversation',
  },
  {
    ...mx,
    id: 'demo-x-sample',
    title: 'Mexico public-conversation sample',
    publisher: 'Demo X connector',
    url: 'https://example.com/demo-x-sample',
    publishedAt: '2026-08-24',
    accessedAt: '2026-08-26',
    expiresAt: '2026-09-02',
    role: 'measurement',
    method: {
      collection: 'Licensed aggregate sample',
      notes: {
        en: 'Fictional aggregate created only to preview the interface.',
        'es-MX': 'Agregado ficticio creado únicamente para previsualizar la interfaz.',
      },
    },
    independenceGroup: 'demo-x',
    channel: 'conversation',
  },
  {
    ...mx,
    id: 'demo-search-sample',
    title: 'Mexico search-interest sample',
    publisher: 'Demo search connector',
    url: 'https://example.com/demo-search-sample',
    publishedAt: '2026-08-24',
    accessedAt: '2026-08-26',
    expiresAt: '2026-09-02',
    role: 'measurement',
    method: {
      collection: 'Indexed sample',
      notes: {
        en: 'Fictional indexed signal created only to preview the interface.',
        'es-MX': 'Señal indexada ficticia creada únicamente para previsualizar la interfaz.',
      },
    },
    independenceGroup: 'demo-search',
    channel: 'conversation',
  },
];

const demoClaims: BriefingClaim[] = [
  {
    ...mx,
    id: 'demo-claim-reinvention',
    kind: 'conversation',
    statement: {
      en: 'Sample conversation shows a rising cluster around starting over after financial or family disruption, especially among viewers 25–44.',
      'es-MX': 'La conversación de muestra presenta un grupo creciente alrededor de empezar de nuevo después de una ruptura económica o familiar, especialmente entre audiencias de 25 a 44 años.',
    },
    classification: 'strong_inference',
    sourceIds: ['demo-reddit-sample', 'demo-search-sample'],
    decisionCritical: false,
  },
  {
    ...mx,
    id: 'demo-claim-nostalgia',
    kind: 'conversation',
    statement: {
      en: 'Sample social discussion favors recognizable Mexican worlds that are reinterpreted through a younger character rather than repeated unchanged.',
      'es-MX': 'La conversación social de muestra favorece mundos mexicanos reconocibles reinterpretados desde un personaje joven, en vez de repetirlos sin cambios.',
    },
    classification: 'speculation',
    sourceIds: ['demo-x-sample', 'demo-reddit-sample'],
    decisionCritical: false,
  },
  {
    ...mx,
    id: 'demo-claim-folk-horror',
    kind: 'conversation',
    statement: {
      en: 'Sample search and discussion signals rise around regional legends, religious unease, and family secrets presented as contemporary horror.',
      'es-MX': 'Las señales de búsqueda y conversación de muestra crecen alrededor de leyendas regionales, inquietud religiosa y secretos familiares presentados como horror contemporáneo.',
    },
    classification: 'speculation',
    sourceIds: ['demo-search-sample', 'demo-x-sample'],
    decisionCritical: false,
  },
];

export function buildDemoBriefing(base: IntelligenceBriefingSnapshot): IntelligenceBriefingSnapshot {
  const demoOpportunity: PortfolioOpportunity = {
      id: 'demo-mexico-folk-horror',
      label: { en: 'Contemporary Mexican folk horror', 'es-MX': 'Horror folclórico mexicano contemporáneo' },
      need: {
        en: 'A contained horror project rooted in a specific Mexican place or belief system.',
        'es-MX': 'Un proyecto de horror contenido, arraigado en un lugar o sistema de creencias mexicano específico.',
      },
      timingBand: ['emerging', 'active'],
      action: 'investigate',
      classification: 'speculation',
      claimIds: ['demo-claim-folk-horror'],
      match: {
        all: [],
        any: [{ fields: ['genre', 'subgenres', 'themes', 'logline'], terms: ['horror', 'terror', 'leyenda', 'folk'] }],
      },
      nextAction: {
        en: 'Test the strongest contained concept with genre buyers before development spend.',
        'es-MX': 'Probar el concepto contenido más fuerte con compradores de género antes de invertir en desarrollo.',
      },
  };
  const opportunities = [...base.opportunities, demoOpportunity];

  return {
    ...base,
    snapshot: {
      ...base.snapshot,
      id: 'demo-intelligence-preview',
      asOf: '2026-08-26',
      periodEnd: '2026-08-26',
      reviewedAt: '2026-08-26T12:00:00Z',
      freshness: { status: 'current', expiresAt: '2026-09-02' },
      coverageState: 'complete',
      knowledgeLimits: {
        en: 'DEMO ONLY. Every social, search, portfolio, and forecast value on this preview is fictional. It shows the intended decision experience, not a real market conclusion.',
        'es-MX': 'SOLO DEMO. Cada dato social, de búsqueda, portafolio y pronóstico en esta vista es ficticio. Muestra la experiencia de decisión prevista, no una conclusión real de mercado.',
      },
    },
    sources: [...base.sources, ...demoSources],
    claims: [...base.claims, ...demoClaims],
    opportunities,
    actions: [
      ...base.actions.filter(({ evidenceState }) => evidenceState === 'sufficient'),
      {
        id: 'demo-action-folk-horror',
        rank: 3,
        action: 'investigate',
        evidenceState: 'sufficient',
        title: { en: 'Test a contained folk-horror lane', 'es-MX': 'Probar una vía de horror folclórico contenido' },
        whyNow: {
          en: 'The demo conversation layer shows how a weak early signal could be paired with a low-cost validation step instead of treated as a greenlight.',
          'es-MX': 'La capa de conversación de demostración muestra cómo una señal temprana débil puede combinarse con una validación de bajo costo, en vez de tratarse como luz verde.',
        },
        supportClaimIds: ['demo-claim-folk-horror'],
        strongestContradictionId: null,
        classification: 'speculation',
        nextAction: {
          en: 'Select one contained concept and test the promise with a small Mexican genre-audience panel.',
          'es-MX': 'Elegir un concepto contenido y probar la promesa con un panel pequeño de audiencia mexicana de género.',
        },
        reversalCondition: {
          en: 'Stop if the signal disappears in a second source or the concept requires genericizing the cultural engine.',
          'es-MX': 'Detener si la señal desaparece en una segunda fuente o si el concepto requiere volver genérico el motor cultural.',
        },
        zeitgeistDerived: true,
      },
    ],
    zeitgeistStories: [
      {
        ...mx,
        id: 'demo-reinvention-story',
        state: 'available',
        title: {
          en: 'Starting over is becoming a useful emotional frame',
          'es-MX': 'Empezar de nuevo se convierte en un marco emocional útil',
        },
        signalClass: 'conversation',
        window: { start: '2026-08-20', end: '2026-08-26' },
        conversationClaimIds: ['demo-claim-reinvention', 'demo-claim-nostalgia'],
        contextClaimIds: ['claim-mexico-incentive'],
        outcomeClaimIds: ['claim-mentiras-outcome'],
        sourceFamilies: [
          { en: 'Licensed social sample', 'es-MX': 'Muestra social licenciada' },
          { en: 'Search sample', 'es-MX': 'Muestra de búsqueda' },
          { en: 'Verified trade context', 'es-MX': 'Contexto verificado de prensa' },
        ],
        classification: 'strong_inference',
        doesNotProve: {
          en: 'Conversation does not prove viewing intent, willingness to pay, or that any specific screenplay fits the audience need.',
          'es-MX': 'La conversación no prueba intención de ver, disposición a pagar ni que un guion específico cubra la necesidad de audiencia.',
        },
        alternativeExplanations: [
          { en: 'The cluster may reflect economic anxiety rather than entertainment demand.', 'es-MX': 'El grupo puede reflejar ansiedad económica, no demanda de entretenimiento.' },
          { en: 'Nostalgia discussion may be driven by one highly promoted release.', 'es-MX': 'La conversación nostálgica puede estar impulsada por un solo estreno muy promocionado.' },
        ],
        contradictionIds: ['contradiction-volume'],
        nextTest: {
          en: 'Compare two logline promises with a small Mexico audience panel and check whether the emotional need survives without familiar IP.',
          'es-MX': 'Comparar dos promesas de logline con un panel pequeño en México y revisar si la necesidad emocional sobrevive sin propiedad intelectual conocida.',
        },
      },
      {
        ...mx,
        id: 'demo-folk-horror-story',
        state: 'available',
        title: {
          en: 'Regional folklore can be a discovery hook when the human stakes stay contemporary',
          'es-MX': 'El folclor regional puede ser un gancho de descubrimiento cuando el conflicto humano permanece contemporáneo',
        },
        signalClass: 'conversation',
        window: { start: '2026-08-20', end: '2026-08-26' },
        conversationClaimIds: ['demo-claim-folk-horror'],
        contextClaimIds: ['claim-mexico-incentive'],
        outcomeClaimIds: [],
        sourceFamilies: [
          { en: 'Search sample', 'es-MX': 'Muestra de búsqueda' },
          { en: 'Public-conversation sample', 'es-MX': 'Muestra de conversación pública' },
        ],
        classification: 'speculation',
        doesNotProve: {
          en: 'Interest in legends does not prove demand for horror or preference for a specific tone, format, or platform.',
          'es-MX': 'El interés en leyendas no prueba demanda por horror ni preferencia por un tono, formato o plataforma específicos.',
        },
        alternativeExplanations: [
          { en: 'Search may be seasonal or tied to school and tourism content.', 'es-MX': 'La búsqueda puede ser estacional o estar ligada a contenido escolar y turístico.' },
          { en: 'High discussion may reflect curiosity, not a desire to watch a full series or film.', 'es-MX': 'La conversación alta puede reflejar curiosidad, no deseo de ver una serie o película completa.' },
        ],
        contradictionIds: [],
        nextTest: {
          en: 'Test artwork and a one-sentence promise before spending on a full treatment.',
          'es-MX': 'Probar arte y una promesa de una frase antes de invertir en un tratamiento completo.',
        },
      },
    ],
    connectors: base.connectors.map((connector) => ({
      ...connector,
      status: 'available',
      lastChecked: '2026-08-26',
      notes: {
        en: 'Fictional connector state used only for this interface preview.',
        'es-MX': 'Estado ficticio del conector usado únicamente para esta previsualización.',
      },
    })),
    evidenceHealth: {
      ...base.evidenceHealth,
      coverage: {
        status: 'good',
        explanation: {
          en: 'Demo coverage includes buyer, trade, government, outcome, social, and search examples.',
          'es-MX': 'La cobertura demo incluye ejemplos de compradores, prensa, gobierno, resultados, social y búsqueda.',
        },
        sourceIds: demoSources.map(({ id }) => id),
        claimIds: demoClaims.map(({ id }) => id),
      },
      knowledgeLimits: {
        status: 'caution',
        explanation: {
          en: 'This preview demonstrates disclosure of limits even when every connector appears populated.',
          'es-MX': 'Esta vista demuestra cómo revelar límites incluso cuando todos los conectores aparecen poblados.',
        },
        sourceIds: [],
        claimIds: [],
      },
    },
    ledger: {
      status: 'not_enough_history',
      explanation: {
        en: 'Demo entries below illustrate how Lemon can compare a forecast with the later outcome. No accuracy score is calculated from these fictional examples.',
        'es-MX': 'Las entradas demo ilustran cómo Lemon puede comparar un pronóstico con el resultado posterior. No se calcula precisión a partir de estos ejemplos ficticios.',
      },
    },
  };
}

export function buildDemoPortfolio(snapshot: IntelligenceBriefingSnapshot): {
  matches: PortfolioProject[];
  unmatched: PortfolioProject[];
  unrankable: PortfolioProject[];
} {
  const [romance, crime, horror] = snapshot.opportunities;
  return {
    matches: [
      { id: 'demo-metro', title: 'El Último Metro', creativeScore: 8.4, finalVerdict: 'recommend', rankable: true, opportunity: romance },
      { id: 'demo-moscas', title: 'La Casa de las Moscas', creativeScore: 7.8, finalVerdict: 'consider', rankable: true, opportunity: crime },
      { id: 'demo-ceniza', title: 'Festival de Ceniza', creativeScore: 7.3, finalVerdict: 'consider', rankable: true, opportunity: horror },
    ],
    unmatched: [
      { id: 'demo-milagros', title: 'Domingo de Milagros', creativeScore: 8.0, finalVerdict: 'recommend', rankable: true, opportunity: null },
    ],
    unrankable: [
      { id: 'demo-ausentes', title: 'Los Ausentes', creativeScore: null, finalVerdict: null, rankable: false, opportunity: null },
    ],
  };
}

export const DEMO_LEDGER = [
  {
    date: '2026-05-12',
    prediction: { en: 'Locally rooted romance will remain an active buyer conversation through Q3.', 'es-MX': 'El romance de raíz local seguirá activo en conversaciones con compradores durante el tercer trimestre.' },
    status: { en: 'On track', 'es-MX': 'En curso' },
    outcome: { en: 'Two later public buyer signals supported the direction; no private mandate was inferred.', 'es-MX': 'Dos señales públicas posteriores respaldaron la dirección; no se infirió un mandato privado.' },
  },
  {
    date: '2026-06-03',
    prediction: { en: 'True crime access will matter more than broad genre popularity.', 'es-MX': 'El acceso de investigación en crimen real importará más que la popularidad general del género.' },
    status: { en: 'Needs review', 'es-MX': 'Requiere revisión' },
    outcome: { en: 'Buyer interest remained visible, but rights and access still blocked a confident recommendation.', 'es-MX': 'El interés de compradores siguió visible, pero derechos y acceso todavía bloquearon una recomendación firme.' },
  },
  {
    date: '2026-07-18',
    prediction: { en: 'A culturally specific horror hook can earn discovery before a known cast is attached.', 'es-MX': 'Un gancho de horror culturalmente específico puede generar descubrimiento antes de tener elenco conocido.' },
    status: { en: 'Open test', 'es-MX': 'Prueba abierta' },
    outcome: { en: 'Awaiting concept and artwork test. No result has been recorded.', 'es-MX': 'En espera de una prueba de concepto y arte. Aún no se registra resultado.' },
  },
] as const;
