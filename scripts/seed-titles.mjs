#!/usr/bin/env node
/**
 * Backfills Paperclip project data into the Firestore `titles` collection.
 *
 * Fetches all company projects from the Paperclip API and writes each one as
 * a document in `titles`, using the project ID as the document ID so reruns
 * are idempotent (merge: true).
 *
 * Required env:
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON  — full service account JSON (stringified)
 *   PAPERCLIP_API_URL
 *   PAPERCLIP_API_KEY
 *   PAPERCLIP_COMPANY_ID
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// ── Firebase init ─────────────────────────────────────────────────────────────
const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
if (!credJson) { console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set'); process.exit(1) }
const serviceAccount = JSON.parse(credJson)
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id })
}
const db = getFirestore()

// ── Fetch Paperclip projects ───────────────────────────────────────────────────
const apiUrl = process.env.PAPERCLIP_API_URL
const apiKey = process.env.PAPERCLIP_API_KEY
const companyId = process.env.PAPERCLIP_COMPANY_ID

if (!apiUrl || !apiKey || !companyId) {
  console.error('PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID required')
  process.exit(1)
}

const res = await fetch(`${apiUrl}/api/companies/${companyId}/projects`, {
  headers: { Authorization: `Bearer ${apiKey}` }
})
const projects = await res.json()
if (!Array.isArray(projects)) {
  console.error('Unexpected API response:', JSON.stringify(projects).slice(0, 200))
  process.exit(1)
}

// ── Skip non-studio projects ───────────────────────────────────────────────────
const SKIP_NAMES = new Set([
  'Lemon Studio Dashboard',
  'Studio Operations',
  'TEST DEAL',
  'Idea Vault',
  'SMOKE TEST — Greenlight Queue Feature Film',
])

// ── Status mapping ─────────────────────────────────────────────────────────────
function mapStatus(p) {
  if (p.devStage === 'killed' || p.killReason || p.status === 'cancelled') return 'killed'
  if (p.queueStatus === 'archived') return 'hold'
  if (p.status === 'in_progress') return 'active'
  return 'development'
}

function mapPipelineStage(devStage) {
  const map = {
    intake: 'ip_scouting',
    pitch_ready: 'pitch_ready',
    pitched: 'pitched',
    negotiation: 'negotiation',
    greenlit: 'greenlit',
    // killed intentionally omitted — killed projects are excluded from pipeline
  }
  return map[devStage] ?? 'ip_scouting'
}

function mapFormat(raw) {
  if (!raw) return 'feature_film'
  const r = raw.toLowerCase()
  if (r.includes('limited')) return 'limited_series'
  if (r.includes('series') || r.includes('show')) return 'series'
  if (r.includes('doc')) return 'documentary'
  return 'feature_film'
}

function parseGenreArray(genreStr) {
  if (!genreStr) return []
  return genreStr.split(/[/,|]/).map(g => g.trim().toLowerCase()).filter(Boolean)
}

// ── Seed ───────────────────────────────────────────────────────────────────────
let written = 0
let skipped = 0
let deleted = 0

for (const p of projects) {
  const isKilled = p.devStage === 'killed' || p.killReason || p.status === 'cancelled'
  if (isKilled) {
    // Explicitly purge any stale killed-project document from Firestore
    const ref = db.collection('titles').doc(p.id)
    const snap = await ref.get()
    if (snap.exists) {
      await ref.delete()
      console.log(`✗ ${p.name} [killed — deleted from Firestore]`)
      deleted++
    } else {
      skipped++
    }
    continue
  }
  if (SKIP_NAMES.has(p.name) || !p.platform && !p.genre && !p.pitchSynopsis) {
    skipped++
    continue
  }

  const doc = {
    name: p.name,
    logline: p.pitchSynopsis ?? '',
    format: mapFormat(p.format),
    genre: parseGenreArray(p.genre),
    platform: p.platform ?? 'Unknown',
    status: mapStatus(p),
    pipelineStage: mapPipelineStage(p.devStage),
    owner: p.leadAgentName ?? '',
    blockers: [],
    coverageRefs: [],
    miReportRefs: [],
    keyDates: {},
    comps: p.comps ?? '',
    whyNow: p.whyNow ?? '',
    whyLemon: p.whyLemon ?? '',
    storySynopsis: p.storySynopsis ?? '',
    sourceType: p.sourceType ?? 'original',
    rightsStatus: p.rightsStatus ?? 'owned',
    hodRecommendation: p.hodRecommendation ?? null,
    paperclipProjectId: p.id,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }

  await db.collection('titles').doc(p.id).set(doc, { merge: true })
  console.log(`✓ ${p.name} [${doc.status}]`)
  written++
}

console.log(`\nDone — ${written} titles written, ${deleted} killed deleted, ${skipped} skipped.`)
process.exit(0)
