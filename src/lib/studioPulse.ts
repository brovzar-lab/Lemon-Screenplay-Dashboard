import type { Screenplay } from '@/types';
import { selectProducerLookCandidates } from '@/lib/developmentOpportunity';
import marketSnapshotData from '@/data/studio-pulse-market-snapshot.json';

export type TerritoryId = 'mexico' | 'us-latino' | 'latin-america' | 'spain' | 'global';
export type MarketSignal = 'high' | 'rising' | 'selective' | 'unknown';

export interface MarketBuyer {
  id: string;
  name: string;
  appetite: string;
  formats: string;
  signal: MarketSignal;
  matchQuery: string;
  confidence?: 'high' | 'medium' | 'low';
  evidenceIds?: string[];
  notes?: string;
}

export interface MarketDemand {
  id: string;
  label: string;
  index: number;
  matchQuery: string;
  confidence?: 'high' | 'medium' | 'low';
  evidenceIds?: string[];
}

export interface MarketTerritory {
  id: TerritoryId;
  label: string;
  buyers: MarketBuyer[];
  demands: MarketDemand[];
}

export interface MarketSnapshot {
  schemaVersion: 1;
  asOf: string;
  status: 'research_snapshot';
  territories: MarketTerritory[];
}

const territoryIds = new Set<TerritoryId>(['mexico', 'us-latino', 'latin-america', 'spain', 'global']);
const marketSignals = new Set<MarketSignal>(['high', 'rising', 'selective', 'unknown']);

function parseMarketSnapshot(value: unknown): MarketSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Studio Pulse snapshot must be an object.');
  const snapshot = value as Partial<MarketSnapshot>;
  if (snapshot.schemaVersion !== 1 || snapshot.status !== 'research_snapshot' || !/^\d{4}-\d{2}-\d{2}$/.test(snapshot.asOf ?? '')) {
    throw new Error('Studio Pulse snapshot metadata is invalid.');
  }
  if (!Array.isArray(snapshot.territories) || snapshot.territories.length !== territoryIds.size) {
    throw new Error('Studio Pulse snapshot must contain all five territories.');
  }
  for (const territory of snapshot.territories) {
    if (!territoryIds.has(territory.id) || !territory.label || !territory.buyers.length || !territory.demands.length) {
      throw new Error(`Studio Pulse territory ${territory.id || 'unknown'} is incomplete.`);
    }
    for (const buyer of territory.buyers) {
      if (!buyer.id || !buyer.name || !buyer.appetite || !buyer.formats || !marketSignals.has(buyer.signal) || !buyer.matchQuery) {
        throw new Error(`Studio Pulse buyer data is incomplete in ${territory.id}.`);
      }
    }
    for (const demand of territory.demands) {
      if (!demand.id || !demand.label || !demand.matchQuery || !Number.isInteger(demand.index) || demand.index < 0 || demand.index > 100) {
        throw new Error(`Studio Pulse demand data is invalid in ${territory.id}.`);
      }
    }
  }
  return snapshot as MarketSnapshot;
}

export const STUDIO_PULSE_MARKET_SNAPSHOT = parseMarketSnapshot(marketSnapshotData);

function matchesMarket(screenplay: Screenplay, query: string): boolean {
  const searchable = [
    screenplay.genre,
    ...screenplay.subgenres,
    ...screenplay.themes,
    screenplay.logline,
    screenplay.tone,
  ]
    .join(' ')
    .toLocaleLowerCase();
  return searchable.includes(query.toLocaleLowerCase());
}

function needsAttention(screenplay: Screenplay): boolean {
  return (
    screenplay.analysisQuality?.status === 'partial' ||
    screenplay.producerProjection?.trustStatus === 'incomplete' ||
    screenplay.producerProjection?.trustStatus === 'legacy_unverified' ||
    screenplay.producerProjection?.warnings.some((warning) => warning.severity === 'blocking') === true
  );
}

function isCompleteV9(screenplay: Screenplay): boolean {
  return /(^|\D)v?9(\D|$)/i.test(screenplay.analysisVersion) && screenplay.analysisQuality?.status !== 'partial';
}

export function buildStudioPulse(screenplays: Screenplay[], territory: MarketTerritory) {
  const attention = screenplays.filter(needsAttention);
  const completeV9 = screenplays.filter(isCompleteV9);
  const ready = screenplays.filter(
    (screenplay) =>
      isCompleteV9(screenplay) && !needsAttention(screenplay) && screenplay.recommendation !== 'pass',
  );
  const producerLook = selectProducerLookCandidates(screenplays, new Map(), screenplays.length);
  const eligible = screenplays.filter((screenplay) => screenplay.recommendation !== 'pass');
  const matching = (query: string) => eligible.filter((screenplay) => matchesMarket(screenplay, query));
  const buyerFits = territory.buyers.map((buyer) => ({ ...buyer, fitCount: matching(buyer.matchQuery).length }));
  const demandFits = territory.demands.map((demand) => ({
    ...demand,
    fitCount: matching(demand.matchQuery).length,
  }));
  const highestDemand = demandFits.reduce((best, demand) =>
    demand.index > best.index ? demand : best,
  );

  return {
    activeProjects: screenplays.length,
    v9Complete: completeV9.length,
    v9CompletePercent: screenplays.length ? Math.round((completeV9.length / screenplays.length) * 100) : 0,
    readyForReview: ready.length,
    needsAttention: attention.length,
    producerLook: producerLook.length,
    buyerFits,
    demandFits,
    uniqueLemonFits: new Set(
      eligible
        .filter((screenplay) => territory.demands.some((demand) => matchesMarket(screenplay, demand.matchQuery)))
        .map((screenplay) => screenplay.projectId ?? screenplay.id),
    ).size,
    highestDemand,
    highestDemandReady: ready.filter((screenplay) => matchesMarket(screenplay, highestDemand.matchQuery)).length,
  };
}
