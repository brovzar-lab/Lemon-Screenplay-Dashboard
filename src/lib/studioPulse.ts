import marketSnapshotData from '@/data/studio-pulse-market-snapshot.json';
import type { Screenplay } from '@/types';

export type BriefingLocale = 'en' | 'es-MX';
export type LocalizedText = { en: string; 'es-MX': string };
export type EvidenceClassification =
  | 'confirmed'
  | 'strong_inference'
  | 'speculation'
  | 'unknown_proprietary';
export type DecisionAction = 'advance' | 'investigate' | 'acquire' | 'watch' | 'dismiss';
export type EvidenceStatus = 'good' | 'caution' | 'weak' | 'unknown';
export type TimingBand = 'wait' | 'emerging' | 'active' | 'immediate';
export type GeographyScope = 'country' | 'regional' | 'diaspora' | 'global';
export type SnapshotValidationCode =
  | 'valid'
  | 'invalid_object'
  | 'unknown_field'
  | 'schema_version'
  | 'invalid_metadata'
  | 'invalid_localization'
  | 'invalid_url'
  | 'invalid_geography'
  | 'invalid_date'
  | 'invalid_reference'
  | 'invalid_evidence'
  | 'invalid_action'
  | 'invalid_timing'
  | 'invalid_manifest'
  | 'manifest_mismatch';

interface Geography {
  scope: GeographyScope;
  countryCodes: string[];
  audienceDefinition: LocalizedText | null;
}

export interface BriefingSource extends Geography {
  id: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  accessedAt: string;
  expiresAt: string;
  role: 'official' | 'government' | 'trade_press' | 'measurement' | 'industry';
  method: { collection: string; notes: LocalizedText };
  independenceGroup: string;
  channel: 'buyer' | 'government' | 'industry' | 'outcome' | 'conversation';
}

export interface BriefingClaim extends Geography {
  id: string;
  kind: 'direct_buyer' | 'verified_context' | 'observed_outcome' | 'conversation';
  statement: LocalizedText;
  classification: EvidenceClassification;
  sourceIds: string[];
  decisionCritical: boolean;
}

export interface BuyerDoor extends Geography {
  id: string;
  name: string;
  appetite: LocalizedText;
  formats: LocalizedText;
  signal: 'high' | 'rising' | 'selective' | 'unknown';
  doorState: 'open' | 'limited' | 'unknown';
  claimIds: string[];
}

export type MatchField = 'genre' | 'subgenres' | 'themes' | 'tone' | 'logline';
export interface MatchTermGroup {
  fields: MatchField[];
  terms: string[];
}
export interface MatchRule {
  all: MatchTermGroup[];
  any: MatchTermGroup[];
}

export interface PortfolioOpportunity {
  id: string;
  label: LocalizedText;
  need: LocalizedText;
  timingBand: TimingBand[];
  action: DecisionAction;
  classification: EvidenceClassification;
  claimIds: string[];
  match: MatchRule;
  nextAction: LocalizedText;
}

export interface MarketAction {
  id: string;
  rank: number | null;
  action: DecisionAction | null;
  evidenceState: 'sufficient' | 'insufficient';
  title: LocalizedText;
  whyNow: LocalizedText;
  supportClaimIds: string[];
  strongestContradictionId: string | null;
  classification: EvidenceClassification;
  nextAction: LocalizedText;
  reversalCondition: LocalizedText;
  zeitgeistDerived: boolean;
}

export interface ZeitgeistStory extends Geography {
  id: string;
  state: 'available' | 'unavailable';
  title: LocalizedText;
  signalClass: 'conversation' | 'connector_unavailable';
  window: { start: string; end: string };
  conversationClaimIds: string[];
  contextClaimIds: string[];
  outcomeClaimIds: string[];
  sourceFamilies: LocalizedText[];
  classification: EvidenceClassification;
  doesNotProve: LocalizedText;
  alternativeExplanations: LocalizedText[];
  contradictionIds: string[];
  nextTest: LocalizedText;
}

export interface EvidenceDimension {
  status: EvidenceStatus;
  explanation: LocalizedText;
  sourceIds: string[];
  claimIds: string[];
}

export type EvidenceHealth = Record<
  | 'directness'
  | 'provenance'
  | 'independence'
  | 'coverage'
  | 'freshness'
  | 'contradiction'
  | 'knowledgeLimits',
  EvidenceDimension
>;

export interface IntelligenceBriefingSnapshot {
  schemaVersion: 2;
  snapshot: {
    id: string;
    status: 'reviewed_snapshot';
    asOf: string;
    periodStart: string;
    periodEnd: string;
    reviewedAt: string;
    territory: Geography;
    freshness: { status: 'current' | 'stale' | 'historical'; expiresAt: string };
    coverageState: 'complete' | 'partial' | 'insufficient';
    knowledgeLimits: LocalizedText;
  };
  sources: BriefingSource[];
  claims: BriefingClaim[];
  buyers: BuyerDoor[];
  zeitgeistStories: ZeitgeistStory[];
  opportunities: PortfolioOpportunity[];
  actions: MarketAction[];
  contradictions: Array<{
    id: string;
    statement: LocalizedText;
    claimIds: string[];
    resolved: boolean;
  }>;
  gaps: Array<{
    id: string;
    label: LocalizedText;
    impact: LocalizedText;
    connectorId: string | null;
  }>;
  connectors: Array<{
    id: string;
    label: string;
    status: 'available' | 'unavailable' | 'licensing_pending';
    lastChecked: string;
    notes: LocalizedText;
  }>;
  evidenceHealth: EvidenceHealth;
  ledger: { status: 'not_enough_history'; explanation: LocalizedText };
}

class SnapshotValidationError extends Error {
  readonly code: SnapshotValidationCode;

  constructor(code: SnapshotValidationCode) {
    super(code);
    this.code = code;
  }
}

const ACTIONS = new Set<DecisionAction>(['advance', 'investigate', 'acquire', 'watch', 'dismiss']);
const CLASSIFICATIONS = new Set<EvidenceClassification>([
  'confirmed',
  'strong_inference',
  'speculation',
  'unknown_proprietary',
]);
const EVIDENCE_STATUSES = new Set<EvidenceStatus>(['good', 'caution', 'weak', 'unknown']);
const TIMING_BANDS = new Set<TimingBand>(['wait', 'emerging', 'active', 'immediate']);
const MATCH_FIELDS = new Set<MatchField>(['genre', 'subgenres', 'themes', 'tone', 'logline']);
const TIMING_ORDER: Record<TimingBand, number> = { wait: 1, emerging: 2, active: 3, immediate: 4 };
const ISO_COUNTRY_CODES = new Set(`
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
  CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
  GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP
  KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT
  MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG
  UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`.trim().split(/\s+/));
const REQUIRED_ARTIFACT_PATHS = [
  'src/data/studio-pulse-market-snapshot.json',
  'public/research/studio-pulse-market-snapshot-2026-08-19.md',
] as const;

function fail(code: SnapshotValidationCode): never {
  throw new SnapshotValidationError(code);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_object');
  return value as Record<string, unknown>;
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const record = object(value);
  const actual = Object.keys(record);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) fail('unknown_field');
  return record;
}

function string(value: unknown, code: SnapshotValidationCode = 'invalid_metadata'): string {
  if (typeof value !== 'string' || !value.trim()) fail(code);
  return value;
}

function stringArray(value: unknown, allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) fail('invalid_metadata');
  const result = value.map((item) => string(item));
  if (new Set(result).size !== result.length) fail('invalid_metadata');
  return result;
}

function localized(value: unknown): LocalizedText {
  const record = exact(value, ['en', 'es-MX']);
  return {
    en: string(record.en, 'invalid_localization'),
    'es-MX': string(record['es-MX'], 'invalid_localization'),
  };
}

function isoDate(value: unknown): string {
  const date = string(value, 'invalid_date');
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) fail('invalid_date');
  return date;
}

function isoDateTime(value: unknown): string {
  const date = string(value, 'invalid_date');
  const parsed = new Date(date);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString() !== date.replace('Z', '.000Z')
  ) fail('invalid_date');
  return date;
}

function isIsoCountryCode(code: string): boolean {
  return ISO_COUNTRY_CODES.has(code);
}

function geography(value: unknown): Geography {
  const record = exact(value, ['scope', 'countryCodes', 'audienceDefinition']);
  if (!['country', 'regional', 'diaspora', 'global'].includes(String(record.scope))) fail('invalid_geography');
  const scope = record.scope as GeographyScope;
  const countryCodes = stringArray(record.countryCodes, true);
  if (countryCodes.some((code) => !isIsoCountryCode(code))) fail('invalid_geography');
  const audienceDefinition = record.audienceDefinition === null ? null : localized(record.audienceDefinition);
  if (
    (scope === 'country' && countryCodes.length !== 1) ||
    (scope === 'regional' && countryCodes.length < 2) ||
    (scope === 'diaspora' && (countryCodes.length < 1 || !audienceDefinition)) ||
    (scope === 'global' && countryCodes.length !== 0) ||
    (scope !== 'diaspora' && audienceDefinition !== null)
  ) fail('invalid_geography');
  return { scope, countryCodes, audienceDefinition };
}

function safeExternalUrl(value: unknown): string {
  const raw = string(value, 'invalid_url');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail('invalid_url');
  }
  const host = url.hostname.toLowerCase();
  const shorteners = new Set(['bit.ly', 'buff.ly', 'goo.gl', 'ow.ly', 't.co', 'tinyurl.com']);
  const rawSocialHosts = new Set([
    'facebook.com', 'instagram.com', 'reddit.com', 'tiktok.com', 'twitter.com', 'x.com',
  ]);
  if (
    url.protocol !== 'https:' || url.username || url.password || !host.includes('.') ||
    host === 'localhost' || host.endsWith('.localhost') ||
    [...shorteners].some((shortener) => host === shortener || host.endsWith(`.${shortener}`)) ||
    [...rawSocialHosts].some((socialHost) => host === socialHost || host.endsWith(`.${socialHost}`)) ||
    host.startsWith('[')
  ) fail('invalid_url');
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)?.slice(1).map(Number);
  if (ipv4) {
    const [a, b] = ipv4;
    if (
      ipv4.some((part) => part > 255) || a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0)
    ) fail('invalid_url');
  }
  return raw;
}

function uniqueIds(items: Array<{ id: string }>): void {
  if (new Set(items.map(({ id }) => id)).size !== items.length) fail('invalid_reference');
}

function references(ids: string[], available: Set<string>, allowEmpty = false): string[] {
  if ((!allowEmpty && ids.length === 0) || ids.some((id) => !available.has(id))) fail('invalid_reference');
  return ids;
}

function classification(value: unknown): EvidenceClassification {
  if (!CLASSIFICATIONS.has(value as EvidenceClassification)) fail('invalid_evidence');
  return value as EvidenceClassification;
}

function parseSource(value: unknown, asOf: string, reviewedAt: string): BriefingSource {
  const record = exact(value, [
    'id', 'title', 'publisher', 'url', 'publishedAt', 'accessedAt', 'expiresAt', 'role',
    'method', 'independenceGroup', 'channel', 'scope', 'countryCodes', 'audienceDefinition',
  ]);
  const method = exact(record.method, ['collection', 'notes']);
  const publishedAt = isoDate(record.publishedAt);
  const accessedAt = isoDate(record.accessedAt);
  const expiresAt = isoDate(record.expiresAt);
  if (publishedAt > asOf || accessedAt > reviewedAt.slice(0, 10) || expiresAt < publishedAt) fail('invalid_date');
  if (!['official', 'government', 'trade_press', 'measurement', 'industry'].includes(String(record.role))) fail('invalid_evidence');
  if (!['buyer', 'government', 'industry', 'outcome', 'conversation'].includes(String(record.channel))) fail('invalid_evidence');
  return {
    id: string(record.id), title: string(record.title), publisher: string(record.publisher),
    url: safeExternalUrl(record.url), publishedAt, accessedAt, expiresAt,
    role: record.role as BriefingSource['role'],
    method: { collection: string(method.collection), notes: localized(method.notes) },
    independenceGroup: string(record.independenceGroup),
    channel: record.channel as BriefingSource['channel'],
    ...geography({ scope: record.scope, countryCodes: record.countryCodes, audienceDefinition: record.audienceDefinition }),
  };
}

function parseClaim(value: unknown, sourceIds: Set<string>): BriefingClaim {
  const record = exact(value, [
    'id', 'kind', 'statement', 'classification', 'sourceIds', 'decisionCritical',
    'scope', 'countryCodes', 'audienceDefinition',
  ]);
  if (!['direct_buyer', 'verified_context', 'observed_outcome', 'conversation'].includes(String(record.kind))) fail('invalid_evidence');
  if (typeof record.decisionCritical !== 'boolean') fail('invalid_evidence');
  return {
    id: string(record.id), kind: record.kind as BriefingClaim['kind'],
    statement: localized(record.statement), classification: classification(record.classification),
    sourceIds: references(stringArray(record.sourceIds), sourceIds),
    decisionCritical: record.decisionCritical,
    ...geography({ scope: record.scope, countryCodes: record.countryCodes, audienceDefinition: record.audienceDefinition }),
  };
}

function parseMatchRule(value: unknown): MatchRule {
  const record = exact(value, ['all', 'any']);
  const parseGroups = (groups: unknown): MatchTermGroup[] => {
    if (!Array.isArray(groups)) fail('invalid_evidence');
    return groups.map((group) => {
      const item = exact(group, ['fields', 'terms']);
      const fields = stringArray(item.fields).map((field) => {
        if (!MATCH_FIELDS.has(field as MatchField)) fail('invalid_evidence');
        return field as MatchField;
      });
      return { fields, terms: stringArray(item.terms) };
    });
  };
  const all = parseGroups(record.all);
  const any = parseGroups(record.any);
  if (all.length === 0 && any.length === 0) fail('invalid_evidence');
  return { all, any };
}

export function validateIntelligenceSnapshot(value: unknown): IntelligenceBriefingSnapshot {
  const root = exact(value, [
    'schemaVersion', 'snapshot', 'sources', 'claims', 'buyers', 'zeitgeistStories',
    'opportunities', 'actions', 'contradictions', 'gaps', 'connectors', 'evidenceHealth', 'ledger',
  ]);
  if (root.schemaVersion !== 2) fail('schema_version');
  const metadata = exact(root.snapshot, [
    'id', 'status', 'asOf', 'periodStart', 'periodEnd', 'reviewedAt', 'territory',
    'freshness', 'coverageState', 'knowledgeLimits',
  ]);
  const asOf = isoDate(metadata.asOf);
  const periodStart = isoDate(metadata.periodStart);
  const periodEnd = isoDate(metadata.periodEnd);
  const reviewedAt = isoDateTime(metadata.reviewedAt);
  const freshness = exact(metadata.freshness, ['status', 'expiresAt']);
  const freshnessExpiry = isoDate(freshness.expiresAt);
  if (
    metadata.status !== 'reviewed_snapshot' ||
    !['current', 'stale', 'historical'].includes(String(freshness.status)) ||
    !['complete', 'partial', 'insufficient'].includes(String(metadata.coverageState)) ||
    periodStart > periodEnd || periodEnd > asOf || asOf > reviewedAt.slice(0, 10) || freshnessExpiry < asOf
  ) fail('invalid_metadata');
  const snapshot = {
    id: string(metadata.id), status: 'reviewed_snapshot' as const, asOf, periodStart, periodEnd, reviewedAt,
    territory: geography(metadata.territory),
    freshness: { status: freshness.status as IntelligenceBriefingSnapshot['snapshot']['freshness']['status'], expiresAt: freshnessExpiry },
    coverageState: metadata.coverageState as IntelligenceBriefingSnapshot['snapshot']['coverageState'],
    knowledgeLimits: localized(metadata.knowledgeLimits),
  };

  if (!Array.isArray(root.sources)) fail('invalid_evidence');
  const sources = root.sources.map((source) => parseSource(source, asOf, reviewedAt));
  uniqueIds(sources);
  const sourceIds = new Set(sources.map(({ id }) => id));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  if (!Array.isArray(root.claims)) fail('invalid_evidence');
  const claims = root.claims.map((claim) => parseClaim(claim, sourceIds));
  uniqueIds(claims);
  const claimIds = new Set(claims.map(({ id }) => id));
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const validateActionEvidence = (
    action: DecisionAction,
    supportClaims: BriefingClaim[],
    zeitgeistDerived: boolean,
  ) => {
    const staleCriticalEvidence = supportClaims.some(
      (claim) => claim.decisionCritical && claim.sourceIds.every((id) => sourceById.get(id)!.expiresAt < asOf),
    );
    if (action !== 'watch' && staleCriticalEvidence) fail('invalid_action');
    if (supportClaims.length > 0 && supportClaims.every(({ kind }) => kind === 'conversation') && action !== 'watch') fail('invalid_action');
    if (action === 'watch') return;
    const currentKinds = new Set(supportClaims
      .filter((claim) => claim.sourceIds.some((id) => sourceById.get(id)!.expiresAt >= asOf))
      .map(({ kind }) => kind));
    const validStrongEvidence = zeitgeistDerived
      ? currentKinds.has('conversation') && (currentKinds.has('verified_context') || currentKinds.has('observed_outcome'))
      : currentKinds.has('direct_buyer') || currentKinds.has('observed_outcome');
    if (!validStrongEvidence) fail('invalid_action');
  };

  if (!Array.isArray(root.buyers)) fail('invalid_evidence');
  const buyers = root.buyers.map((value): BuyerDoor => {
    const record = exact(value, [
      'id', 'name', 'appetite', 'formats', 'signal', 'doorState', 'claimIds',
      'scope', 'countryCodes', 'audienceDefinition',
    ]);
    if (!['high', 'rising', 'selective', 'unknown'].includes(String(record.signal))) fail('invalid_evidence');
    if (!['open', 'limited', 'unknown'].includes(String(record.doorState))) fail('invalid_evidence');
    return {
      id: string(record.id), name: string(record.name), appetite: localized(record.appetite),
      formats: localized(record.formats), signal: record.signal as BuyerDoor['signal'],
      doorState: record.doorState as BuyerDoor['doorState'],
      claimIds: references(stringArray(record.claimIds), claimIds),
      ...geography({ scope: record.scope, countryCodes: record.countryCodes, audienceDefinition: record.audienceDefinition }),
    };
  });
  uniqueIds(buyers);

  if (!Array.isArray(root.contradictions)) fail('invalid_evidence');
  const contradictions = root.contradictions.map((value) => {
    const record = exact(value, ['id', 'statement', 'claimIds', 'resolved']);
    if (typeof record.resolved !== 'boolean') fail('invalid_evidence');
    return { id: string(record.id), statement: localized(record.statement), claimIds: references(stringArray(record.claimIds), claimIds), resolved: record.resolved };
  });
  uniqueIds(contradictions);
  const contradictionIds = new Set(contradictions.map(({ id }) => id));

  if (!Array.isArray(root.zeitgeistStories)) fail('invalid_evidence');
  const zeitgeistStories = root.zeitgeistStories.map((value): ZeitgeistStory => {
    const record = exact(value, [
      'id', 'state', 'title', 'signalClass', 'window', 'conversationClaimIds',
      'contextClaimIds', 'outcomeClaimIds', 'sourceFamilies', 'classification',
      'doesNotProve', 'alternativeExplanations', 'contradictionIds', 'nextTest',
      'scope', 'countryCodes', 'audienceDefinition',
    ]);
    const window = exact(record.window, ['start', 'end']);
    const start = isoDate(window.start);
    const end = isoDate(window.end);
    if (end < start || end > asOf) fail('invalid_date');
    if (!['available', 'unavailable'].includes(String(record.state))) fail('invalid_evidence');
    if (!['conversation', 'connector_unavailable'].includes(String(record.signalClass))) fail('invalid_evidence');
    const conversationClaimIds = references(stringArray(record.conversationClaimIds, true), claimIds, true);
    const contextClaimIds = references(stringArray(record.contextClaimIds, true), claimIds, true);
    const outcomeClaimIds = references(stringArray(record.outcomeClaimIds, true), claimIds, true);
    if (
      (record.state === 'available') !== (conversationClaimIds.length > 0) ||
      (record.state === 'available' && contextClaimIds.length === 0) ||
      conversationClaimIds.some((id) => claimById.get(id)!.kind !== 'conversation') ||
      contextClaimIds.some((id) => claimById.get(id)!.kind !== 'verified_context') ||
      outcomeClaimIds.some((id) => claimById.get(id)!.kind !== 'observed_outcome')
    ) fail('invalid_evidence');
    if (!Array.isArray(record.alternativeExplanations) || record.alternativeExplanations.length < 2) fail('invalid_evidence');
    if (!Array.isArray(record.sourceFamilies) || record.sourceFamilies.length === 0) fail('invalid_evidence');
    return {
      id: string(record.id), state: record.state as ZeitgeistStory['state'], title: localized(record.title),
      signalClass: record.signalClass as ZeitgeistStory['signalClass'], window: { start, end }, conversationClaimIds,
      contextClaimIds,
      outcomeClaimIds,
      sourceFamilies: record.sourceFamilies.map(localized),
      classification: classification(record.classification),
      doesNotProve: localized(record.doesNotProve), alternativeExplanations: record.alternativeExplanations.map(localized),
      contradictionIds: references(stringArray(record.contradictionIds, true), contradictionIds, true),
      nextTest: localized(record.nextTest),
      ...geography({ scope: record.scope, countryCodes: record.countryCodes, audienceDefinition: record.audienceDefinition }),
    };
  });
  uniqueIds(zeitgeistStories);

  if (!Array.isArray(root.opportunities)) fail('invalid_evidence');
  const opportunities = root.opportunities.map((value): PortfolioOpportunity => {
    const record = exact(value, ['id', 'label', 'need', 'timingBand', 'action', 'classification', 'claimIds', 'match', 'nextAction']);
    if (!ACTIONS.has(record.action as DecisionAction)) fail('invalid_action');
    const timingBand = stringArray(record.timingBand).map((band) => {
      if (!TIMING_BANDS.has(band as TimingBand)) fail('invalid_timing');
      return band as TimingBand;
    });
    if (timingBand.length > 2 || (timingBand.length === 2 && TIMING_ORDER[timingBand[0]] > TIMING_ORDER[timingBand[1]])) fail('invalid_timing');
    const claimIdsForOpportunity = references(stringArray(record.claimIds), claimIds);
    validateActionEvidence(record.action as DecisionAction, claimIdsForOpportunity.map((id) => claimById.get(id)!), false);
    return {
      id: string(record.id), label: localized(record.label), need: localized(record.need), timingBand,
      action: record.action as DecisionAction, classification: classification(record.classification),
      claimIds: claimIdsForOpportunity, match: parseMatchRule(record.match),
      nextAction: localized(record.nextAction),
    };
  });
  uniqueIds(opportunities);

  if (!Array.isArray(root.actions)) fail('invalid_action');
  const actions = root.actions.map((value): MarketAction => {
    const record = exact(value, [
      'id', 'rank', 'action', 'evidenceState', 'title', 'whyNow', 'supportClaimIds',
      'strongestContradictionId', 'classification', 'nextAction', 'reversalCondition', 'zeitgeistDerived',
    ]);
    if (!['sufficient', 'insufficient'].includes(String(record.evidenceState)) || typeof record.zeitgeistDerived !== 'boolean') fail('invalid_action');
    const evidenceState = record.evidenceState as MarketAction['evidenceState'];
    const action = record.action === null ? null : record.action as DecisionAction;
    const rank = record.rank === null ? null : Number(record.rank);
    if (
      (action !== null && !ACTIONS.has(action)) ||
      (evidenceState === 'sufficient' && (!action || !Number.isInteger(rank) || !rank || rank < 1 || rank > 3)) ||
      (evidenceState === 'insufficient' && (action !== null || rank !== null))
    ) fail('invalid_action');
    const supportClaimIds = references(stringArray(record.supportClaimIds, true), claimIds, evidenceState === 'insufficient');
    const supportClaims = supportClaimIds.map((id) => claimById.get(id)!);
    if (evidenceState === 'sufficient') validateActionEvidence(action!, supportClaims, record.zeitgeistDerived);
    if (record.strongestContradictionId !== null && !contradictionIds.has(String(record.strongestContradictionId))) fail('invalid_reference');
    return {
      id: string(record.id), rank, action, evidenceState, title: localized(record.title), whyNow: localized(record.whyNow),
      supportClaimIds, strongestContradictionId: record.strongestContradictionId === null ? null : String(record.strongestContradictionId),
      classification: classification(record.classification), nextAction: localized(record.nextAction),
      reversalCondition: localized(record.reversalCondition), zeitgeistDerived: record.zeitgeistDerived,
    };
  });
  uniqueIds(actions);
  const rankedActions = actions.filter((action) => action.evidenceState === 'sufficient');
  if (rankedActions.length > 3 || new Set(rankedActions.map(({ rank }) => rank)).size !== rankedActions.length) fail('invalid_action');
  if (rankedActions.some((action, index) => action.rank !== index + 1)) fail('invalid_action');

  if (!Array.isArray(root.connectors)) fail('invalid_evidence');
  const connectors = root.connectors.map((value) => {
    const record = exact(value, ['id', 'label', 'status', 'lastChecked', 'notes']);
    if (!['available', 'unavailable', 'licensing_pending'].includes(String(record.status))) fail('invalid_evidence');
    const lastChecked = isoDate(record.lastChecked);
    if (lastChecked > reviewedAt.slice(0, 10)) fail('invalid_date');
    return {
      id: string(record.id), label: string(record.label),
      status: record.status as IntelligenceBriefingSnapshot['connectors'][number]['status'],
      lastChecked, notes: localized(record.notes),
    };
  });
  uniqueIds(connectors);
  const connectorIds = new Set(connectors.map(({ id }) => id));
  if (!Array.isArray(root.gaps)) fail('invalid_evidence');
  const gaps = root.gaps.map((value) => {
    const record = exact(value, ['id', 'label', 'impact', 'connectorId']);
    if (record.connectorId !== null && !connectorIds.has(String(record.connectorId))) fail('invalid_reference');
    return { id: string(record.id), label: localized(record.label), impact: localized(record.impact), connectorId: record.connectorId === null ? null : String(record.connectorId) };
  });
  uniqueIds(gaps);

  const healthRecord = exact(root.evidenceHealth, [
    'directness', 'provenance', 'independence', 'coverage', 'freshness', 'contradiction', 'knowledgeLimits',
  ]);
  const evidenceHealth = Object.fromEntries(Object.entries(healthRecord).map(([key, value]) => {
    const record = exact(value, ['status', 'explanation', 'sourceIds', 'claimIds']);
    if (!EVIDENCE_STATUSES.has(record.status as EvidenceStatus)) fail('invalid_evidence');
    return [key, {
      status: record.status as EvidenceStatus, explanation: localized(record.explanation),
      sourceIds: references(stringArray(record.sourceIds, true), sourceIds, true),
      claimIds: references(stringArray(record.claimIds, true), claimIds, true),
    }];
  })) as EvidenceHealth;
  const criticalClaims = claims.filter(({ decisionCritical }) => decisionCritical);
  const criticalSourceIds = new Set(criticalClaims.flatMap(({ sourceIds: ids }) => ids));
  const criticalSources = [...criticalSourceIds].map((id) => sourceById.get(id)!);
  const channels = new Set(sources.map(({ channel }) => channel));
  const expectedHealth: Record<keyof EvidenceHealth, EvidenceStatus> = {
    directness: criticalClaims.length === 0
      ? 'unknown'
      : criticalSources.every(({ role }) => role === 'official' || role === 'government')
        ? 'good'
        : 'caution',
    provenance: 'good',
    independence: criticalClaims.length === 0
      ? 'unknown'
      : new Set(criticalSources.map(({ independenceGroup }) => independenceGroup)).size < criticalSources.length
        ? 'caution'
        : 'good',
    coverage: channels.has('conversation') && channels.has('buyer') && channels.has('outcome')
      ? channels.has('government') && channels.has('industry') ? 'good' : 'caution'
      : 'weak',
    freshness: criticalClaims.some((claim) =>
      claim.sourceIds.every((id) => sourceById.get(id)!.expiresAt < asOf)) ? 'weak' : 'good',
    contradiction: contradictions.some(({ resolved }) => !resolved) ? 'caution' : 'good',
    knowledgeLimits: gaps.length === 0 ? 'good' : gaps.length <= 2 ? 'caution' : 'weak',
  };
  if ((Object.keys(expectedHealth) as Array<keyof EvidenceHealth>).some(
    (key) => evidenceHealth[key].status !== expectedHealth[key],
  )) fail('invalid_evidence');
  const ledgerRecord = exact(root.ledger, ['status', 'explanation']);
  if (ledgerRecord.status !== 'not_enough_history') fail('invalid_evidence');

  return {
    schemaVersion: 2, snapshot, sources, claims, buyers, zeitgeistStories, opportunities,
    actions, contradictions, gaps, connectors, evidenceHealth,
    ledger: { status: 'not_enough_history', explanation: localized(ledgerRecord.explanation) },
  };
}

export function parseIntelligenceSnapshot(value: unknown): {
  code: SnapshotValidationCode;
  snapshot?: IntelligenceBriefingSnapshot;
  snapshotId?: string;
} {
  const snapshotId =
    value && typeof value === 'object' && 'snapshot' in value && value.snapshot &&
    typeof value.snapshot === 'object' && 'id' in value.snapshot && typeof value.snapshot.id === 'string'
      ? value.snapshot.id : undefined;
  try {
    return { code: 'valid', snapshot: validateIntelligenceSnapshot(value), snapshotId };
  } catch (error) {
    return { code: error instanceof SnapshotValidationError ? error.code : 'invalid_object', snapshotId };
  }
}

export const INTELLIGENCE_BRIEFING_RESULT = parseIntelligenceSnapshot(marketSnapshotData);

export function localizedText(value: LocalizedText, language: string): string {
  return value[language.startsWith('es') ? 'es-MX' : 'en'];
}

function normalizedTokens(value: string): string[] {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').match(/[\p{L}\p{N}]+/gu) ?? [];
}

function containsTerm(value: string, term: string): boolean {
  const haystack = normalizedTokens(value);
  const needle = normalizedTokens(term);
  return needle.length > 0 && haystack.some((_, index) => needle.every((token, offset) => haystack[index + offset] === token));
}

function groupMatches(screenplay: Screenplay, group: MatchTermGroup): boolean {
  const values = group.fields.flatMap((field) => {
    const value = screenplay[field];
    return Array.isArray(value) ? value : [value];
  });
  return group.terms.some((term) => values.some((value) => containsTerm(String(value ?? ''), term)));
}

export function matchesOpportunity(screenplay: Screenplay, rule: MatchRule): boolean {
  return rule.all.every((group) => groupMatches(screenplay, group)) &&
    (rule.any.length === 0 || rule.any.some((group) => groupMatches(screenplay, group)));
}

export interface PortfolioProject {
  id: string;
  title: string;
  creativeScore: number | null;
  finalVerdict: string | null;
  rankable: boolean;
  opportunity: PortfolioOpportunity | null;
}

export function buildPortfolioOpportunity(
  screenplays: Screenplay[],
  opportunities: PortfolioOpportunity[],
): { matches: PortfolioProject[]; unmatched: PortfolioProject[]; unrankable: PortfolioProject[] } {
  const result = { matches: [] as PortfolioProject[], unmatched: [] as PortfolioProject[], unrankable: [] as PortfolioProject[] };
  for (const screenplay of screenplays) {
    const projection = screenplay.producerProjection;
    const verified = projection?.rankable === true && projection.trustStatus === 'verified';
    if (verified && projection.finalVerdict === 'pass') continue;
    const opportunity = verified ? opportunities.find(({ match }) => matchesOpportunity(screenplay, match)) ?? null : null;
    const project: PortfolioProject = {
      id: screenplay.id, title: screenplay.title, creativeScore: verified ? projection.finalScore : null,
      finalVerdict: verified ? projection.finalVerdict : null, rankable: verified, opportunity,
    };
    if (!verified) result.unrankable.push(project);
    else if (opportunity) result.matches.push(project);
    else result.unmatched.push(project);
  }
  return result;
}

export type SlateQueryState = 'loading' | 'authorization_error' | 'error' | 'empty' | 'ready';
export function getSlateQueryState(screenplays: Screenplay[] | undefined, isLoading: boolean, error: unknown): SlateQueryState {
  if (isLoading) return 'loading';
  if (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    return code.includes('permission-denied') ? 'authorization_error' : 'error';
  }
  return screenplays?.length ? 'ready' : 'empty';
}

export function weakestEvidenceDimensions(health: EvidenceHealth): Array<keyof EvidenceHealth> {
  const order: Record<EvidenceStatus, number> = { good: 0, caution: 1, weak: 2, unknown: 3 };
  const weakest = Math.max(...Object.values(health).map(({ status }) => order[status]));
  return (Object.keys(health) as Array<keyof EvidenceHealth>).filter((key) => order[health[key].status] === weakest);
}

async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function validatePublicationIntegrity(
  manifestValue: unknown,
  artifacts: Record<string, string | Uint8Array>,
): Promise<{ code: 'valid' | 'invalid_manifest' | 'manifest_mismatch' }> {
  try {
    const manifest = exact(manifestValue, ['schemaVersion', 'algorithm', 'artifacts']);
    if (manifest.schemaVersion !== 1 || manifest.algorithm !== 'sha256' || !Array.isArray(manifest.artifacts)) fail('invalid_manifest');
    const entries = manifest.artifacts.map((value) => {
      const entry = exact(value, ['path', 'sha256']);
      const path = string(entry.path, 'invalid_manifest');
      const hash = string(entry.sha256, 'invalid_manifest');
      if (!/^[a-f0-9]{64}$/.test(hash)) fail('invalid_manifest');
      return { path, hash };
    });
    if (
      entries.length !== REQUIRED_ARTIFACT_PATHS.length ||
      REQUIRED_ARTIFACT_PATHS.some((path) => !entries.some((entry) => entry.path === path))
    ) fail('invalid_manifest');
    for (const entry of entries) {
      if (!(entry.path in artifacts) || await sha256(artifacts[entry.path]) !== entry.hash) return { code: 'manifest_mismatch' };
    }
    const snapshotBytes = artifacts[REQUIRED_ARTIFACT_PATHS[0]];
    const snapshotText = typeof snapshotBytes === 'string' ? snapshotBytes : new TextDecoder().decode(snapshotBytes);
    validateIntelligenceSnapshot(JSON.parse(snapshotText) as unknown);
    return { code: 'valid' };
  } catch {
    return { code: 'invalid_manifest' };
  }
}
