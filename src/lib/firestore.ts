import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore'
import { db } from './firebase'
import { COLLECTIONS, type Title, type CoverageDoc, type MarketIntelReport } from '../types'

// ── Collection refs ──────────────────────────────────────────────────────────
export const titlesCol     = collection(db, COLLECTIONS.TITLES)
export const coverageCol   = collection(db, COLLECTIONS.COVERAGE)
export const miReportsCol  = collection(db, COLLECTIONS.MI_REPORTS)

// ── Fetch helpers ─────────────────────────────────────────────────────────────
function toDate(ts: Timestamp | string): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  return ts
}

export async function fetchTitles(constraints: QueryConstraint[] = []): Promise<Title[]> {
  const q = query(titlesCol, orderBy('updatedAt', 'desc'), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map(d => {
    const data = d.data()
    return {
      ...data,
      id: d.id,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    } as Title
  })
}

export async function fetchTitle(id: string): Promise<Title | null> {
  const snap = await getDoc(doc(titlesCol, id))
  if (!snap.exists()) return null
  const data = snap.data()
  return { ...data, id: snap.id, createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) } as Title
}

export async function fetchCoverageForTitle(titleId: string): Promise<CoverageDoc[]> {
  const q = query(coverageCol, where('titleId', '==', titleId), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as CoverageDoc)
}

export async function fetchMiReports(titleId?: string): Promise<MarketIntelReport[]> {
  const constraints: QueryConstraint[] = titleId
    ? [where('titleId', '==', titleId)]
    : []
  const q = query(miReportsCol, ...constraints, orderBy('reportDate', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...d.data(), id: d.id }) as MarketIntelReport)
}

// ── Active-slate summary (KPI bar) ────────────────────────────────────────────
export async function fetchKpiSummary() {
  const titles = await fetchTitles()
  return {
    total: titles.length,
    greenlit:    titles.filter(t => t.status === 'greenlit').length,
    active:      titles.filter(t => t.status === 'active').length,
    development: titles.filter(t => t.status === 'development').length,
    pitching:    titles.filter(t => t.pipelineStage === 'pitched' || t.pipelineStage === 'pitch_ready').length,
    hold:        titles.filter(t => t.status === 'hold').length,
  }
}
