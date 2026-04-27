import { create } from 'zustand'
import { fetchTitles, fetchKpiSummary } from '../lib/firestore'
import type { Title } from '../types'

interface KpiSummary {
  total: number
  greenlit: number
  active: number
  development: number
  pitching: number
  hold: number
  killed: number
}

interface TitleState {
  titles: Title[]
  kpi: KpiSummary | null
  loading: boolean
  error: string | null
  load: () => Promise<void>
  refresh: () => Promise<void>
}

export const useTitleStore = create<TitleState>((set, get) => ({
  titles: [],
  kpi: null,
  loading: false,
  error: null,

  load: async () => {
    if (get().titles.length > 0) return   // already loaded
    return get().refresh()
  },

  refresh: async () => {
    set({ loading: true, error: null })
    try {
      const [titles, kpi] = await Promise.all([fetchTitles(), fetchKpiSummary()])
      set({ titles, kpi, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },
}))
