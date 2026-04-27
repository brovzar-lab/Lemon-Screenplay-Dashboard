export type Platform =
  | 'Netflix'
  | 'Apple TV+'
  | 'HBO Max'
  | 'Amazon Prime'
  | 'Disney+'
  | 'Theatrical'
  | 'Other'

export type SlateStatus = 'active' | 'hold' | 'development' | 'greenlit' | 'killed'

export type PipelineStage =
  | 'ip_scouting'
  | 'optioned'
  | 'treatment'
  | 'pilot_script'
  | 'series_bible'
  | 'pitch_ready'
  | 'pitched'
  | 'negotiation'
  | 'greenlit'

export type Format = 'feature_film' | 'limited_series' | 'series' | 'documentary'

export type AnalystVerdict = 'recommend' | 'pass' | 'consider' | 'pending'

/** Core title document — one per project/IP */
export interface Title {
  id: string
  name: string
  logline: string
  format: Format
  genre: string[]
  platform: Platform
  status: SlateStatus
  pipelineStage: PipelineStage
  owner: string
  keyDates: {
    optionExpiry?: string   // ISO date
    pitchDate?: string
    greenlitDate?: string
    premiereDate?: string
  }
  coverageRefs: string[]    // CoverageDoc ids
  miReportRefs: string[]    // MarketIntelReport ids
  blockers: string[]        // free-text blocker notes
  createdAt: string
  updatedAt: string
}

/** Coverage document for a title */
export interface CoverageDoc {
  id: string
  titleId: string
  titleName: string
  analyst: string
  verdict: AnalystVerdict
  synopsis: string
  notes: string
  pdfUrl?: string
  createdAt: string
}

/** Market intelligence report */
export interface MarketIntelReport {
  id: string
  titleId?: string          // null = general market report
  agentId?: string          // Paperclip agent that generated it
  title: string
  platform: Platform
  genre: string
  summary: string
  trends: string[]
  compTitles: string[]
  platformAppetite: 'high' | 'medium' | 'low'
  reportDate: string
  createdAt: string
}

/** Firestore collection paths */
export const COLLECTIONS = {
  TITLES: 'titles',
  COVERAGE: 'coverage',
  MI_REPORTS: 'mi_reports',
  TEAM_MEMBERS: 'team_members',
} as const
