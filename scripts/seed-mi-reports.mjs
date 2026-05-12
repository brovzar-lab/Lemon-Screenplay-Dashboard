#!/usr/bin/env node
/**
 * Seeds Paperclip MI-agent issues into Firestore `mi_reports` collection.
 * Uses projectId-first matching, falling back to name-based fuzzy match
 * against the Paperclip projects list. Batch/sweep reports with no clear
 * single-title match are stored with titleId: null (general reports).
 * Also uploads new DOCX deliverables to Google Drive and posts the share URL
 * as a comment on the originating Paperclip issue.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { uploadMiToDrive } from './drive-upload.mjs'

// ── Firebase init ─────────────────────────────────────────────────────────────
const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
if (!credJson) { console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set'); process.exit(1) }
const serviceAccount = JSON.parse(credJson)
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id })
}
const db = getFirestore()

const apiUrl  = process.env.PAPERCLIP_API_URL
const apiKey  = process.env.PAPERCLIP_API_KEY
const companyId = process.env.PAPERCLIP_COMPANY_ID
if (!apiUrl || !apiKey || !companyId) {
  console.error('PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID required')
  process.exit(1)
}

const MI_AGENT_ID = '746a13cf-076a-455b-93e6-d23d6cb34a86'
const DOC_KEYS = ['mi-validation', 'mi-analysis', 'market-validation', 'deep-dive', 'report']

// Batch/sweep project IDs that are NOT individual title projects
const BATCH_PROJECT_IDS = new Set([
  '2d0848ca-a42b-45b1-80a7-296de14df533',
  'fdf57212-38f1-43c2-92c5-c4069fe7516f',
])

const SKIP_NAMES = new Set([
  'Lemon Studio Dashboard', 'Studio Operations', 'TEST DEAL', 'Idea Vault',
  'SMOKE TEST — Greenlight Queue Feature Film',
])

// ── Helpers ───────────────────────────────────────────────────────────────────

async function paperclipGet(path) {
  const res = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) return null
  return res.json()
}

async function fetchFirstDocument(issueId) {
  for (const key of DOC_KEYS) {
    const doc = await paperclipGet(`/api/issues/${issueId}/documents/${key}`)
    if (doc?.body) return { key, body: doc.body }
  }
  return null
}

/** Normalize a name for fuzzy matching: lowercase, strip accents, remove punctuation */
function normalize(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')                     // punctuation → spaces
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract the title portion from an MI issue title. */
function extractTitleFromIssueTitle(issueTitle) {
  // Patterns: "MI Validation — TITLE", "TITLE -- MI Validation", "MI Analysis: TITLE —"
  let t = issueTitle
  t = t.replace(/^(MI Validation|MI Analysis|Market Intelligence|Market validation)[:\s—-]+/i, '')
  t = t.replace(/[—-]+\s*(MI Validation|MI Analysis|Market Intelligence|full deep-dive|Market Comps.*)/i, '')
  t = t.replace(/^(IP Morning Sweep|Concept Morning Sweep|IP Monday Sweep)[^—\-]*(—|-)\s*/i, '')
  // Remove parenthetical suffixes like "(Netflix)", "(Korean Horror Remake, Netflix)"
  t = t.replace(/\s*\([^)]{0,60}\)\s*$/, '')
  return t.trim()
}

/** Find the best matching project ID from the name lookup. Returns null if no match. */
function findProjectId(name, lookup) {
  const norm = normalize(name)
  if (!norm || norm.length < 3) return null

  // 1. Exact match
  if (lookup[norm]) return lookup[norm]

  // 2. Lookup key contains the normalized name
  for (const [key, id] of Object.entries(lookup)) {
    if (key === norm) return id
    if (key.includes(norm) || norm.includes(key)) return id
  }

  // 3. Word overlap (>=2 significant words in common)
  const queryWords = norm.split(' ').filter(w => w.length > 2)
  let bestMatch = null
  let bestScore = 1
  for (const [key, id] of Object.entries(lookup)) {
    const keyWords = key.split(' ').filter(w => w.length > 2)
    const common = queryWords.filter(w => keyWords.includes(w)).length
    if (common > bestScore) { bestScore = common; bestMatch = id }
  }
  return bestMatch
}

function extractDate(body) {
  const m = body.match(/\*\*Date[:\*]*\*?\*?[:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2})/i)
    || body.match(/Date[:\s]+([A-Z][a-z]+ [0-9]{1,2},? [0-9]{4})/i)
    || body.match(/Date[:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2})/i)
  if (!m) return null
  try { return new Date(m[1]).toISOString().slice(0, 10) } catch { return null }
}

function extractAppetite(body) {
  if (/platform appetite[:\s]+high|appetite[:\s]+high|strong appetite|appetite confirmed/i.test(body)) return 'high'
  if (/platform appetite[:\s]+medium|appetite[:\s]+medium|moderate appetite/i.test(body)) return 'medium'
  if (/platform appetite[:\s]+low|appetite[:\s]+low|limited appetite|no appetite/i.test(body)) return 'low'
  const b = body.toLowerCase()
  if (/\badvance\b/.test(b) && !/no advance|do not advance/.test(b)) return 'high'
  if (/conditional advance|flag concerns|conditional/i.test(body)) return 'medium'
  if (/\bpass\b|\bdo not advance\b|not viable/i.test(body)) return 'low'
  return 'medium'
}

function extractPlatform(title, body) {
  for (const p of ['Netflix', 'Apple TV+', 'HBO Max', 'Amazon Prime', 'Disney+', 'Theatrical']) {
    if (title.includes(p) || body.includes(p)) return p
  }
  return 'Other'
}

function extractSummary(body) {
  const lines = body.split('\n')
  let started = false
  const summaryLines = []
  for (const line of lines) {
    const t = line.trim()
    if (!t) { if (started && summaryLines.length > 0) break; continue }
    if (t.startsWith('#') || t.startsWith('=') || t.startsWith('**Date') ||
        t.startsWith('**Issue') || t.startsWith('**Analyst') || t.startsWith('**Format') ||
        t.startsWith('**Prepared') || t.startsWith('---') || t.startsWith('**Card') ||
        t.startsWith('Requested by') || t.startsWith('Date:') || t.startsWith('Searches')) continue
    started = true
    summaryLines.push(t)
    if (summaryLines.join(' ').length > 500) break
  }
  return summaryLines.join(' ').slice(0, 600)
}

function extractTrends(body) {
  const trends = []
  for (const line of body.split('\n')) {
    const t = line.trim()
    const m = t.match(/^[-*•]\s+(.+)$/) || t.match(/^\d+\.\s+(.+)$/)
    if (m) {
      const text = m[1].replace(/\*\*/g, '').trim()
      if (text.length > 10 && text.length < 200) trends.push(text)
    }
  }
  return trends.slice(0, 8)
}

function extractCompTitles(body) {
  const comps = []
  const section = body.match(/comp[s\s]+titles?[:\s]+([\s\S]{0,800}?)(?:\n##|\n---|\n\*\*|$)/i)
  if (!section) return comps
  for (const line of section[1].split('\n')) {
    const m = line.trim().match(/^[-*•]\s+(.+)$/) || line.trim().match(/^\d+\.\s+(.+)$/)
    if (m) comps.push(m[1].replace(/\*\*/g, '').trim().slice(0, 100))
  }
  return comps.slice(0, 6)
}

function extractGenre(title, body) {
  for (const g of ['Horror', 'Comedy', 'Drama', 'Thriller', 'Musical', 'Documentary', 'True Crime', 'Romance']) {
    if (title.toLowerCase().includes(g.toLowerCase()) || body.toLowerCase().includes(g.toLowerCase())) {
      return g.toLowerCase()
    }
  }
  return 'drama'
}

// ── Paperclip comment helper ──────────────────────────────────────────────────

async function postDriveComment(issueId, driveUrl, identifier, reportTitle) {
  if (!apiUrl || !apiKey) return
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  if (process.env.PAPERCLIP_RUN_ID) headers['X-Paperclip-Run-Id'] = process.env.PAPERCLIP_RUN_ID
  const body = `📄 **MI report delivered to Google Drive**\n\n- **Report:** ${reportTitle}\n- **File:** [${reportTitle}.docx](${driveUrl})\n- **Source:** [${identifier}](/LEMA/issues/${identifier})`
  await fetch(`${apiUrl}/api/issues/${issueId}/comments`, {
    method: 'POST', headers, body: JSON.stringify({ body }),
  })
}

// ── Build project name→id lookup ──────────────────────────────────────────────
const projectsRes = await paperclipGet(`/api/companies/${companyId}/projects`)
const projects = Array.isArray(projectsRes) ? projectsRes : []
const nameLookup = {}
for (const p of projects) {
  if (!SKIP_NAMES.has(p.name) && p.name) {
    nameLookup[normalize(p.name)] = p.id
  }
}
console.log(`Loaded ${Object.keys(nameLookup).length} projects for name matching.\n`)

// ── Fetch all MI issues ────────────────────────────────────────────────────────
const issuesRes = await paperclipGet(
  `/api/companies/${companyId}/issues?assigneeAgentId=${MI_AGENT_ID}&status=done,in_progress`
)
const issues = Array.isArray(issuesRes) ? issuesRes : []
console.log(`Found ${issues.length} MI issues. Processing…\n`)

let written = 0, skipped = 0

for (const issue of issues) {
  const docResult = await fetchFirstDocument(issue.id)
  if (!docResult) {
    console.log(`  ⚠  ${issue.title.slice(0, 60)} — no document, skipping`)
    skipped++; continue
  }

  const { body } = docResult

  // Resolve titleId: direct projectId first, then name match
  let titleId = null
  if (issue.projectId && !BATCH_PROJECT_IDS.has(issue.projectId)) {
    titleId = issue.projectId
  } else {
    const extractedName = extractTitleFromIssueTitle(issue.title)
    const matched = findProjectId(extractedName, nameLookup)
    if (matched) titleId = matched
  }

  const reportDate = extractDate(body) ?? issue.createdAt.slice(0, 10)

  const doc = {
    titleId,
    agentId: MI_AGENT_ID,
    title: issue.title,
    platform: extractPlatform(issue.title, body),
    genre: extractGenre(issue.title, body),
    summary: extractSummary(body),
    trends: extractTrends(body),
    compTitles: extractCompTitles(body),
    platformAppetite: extractAppetite(body),
    reportDate,
    createdAt: issue.createdAt,
    paperclipIssueId: issue.id,
    paperclipIdentifier: issue.identifier,
  }

  // Drive upload — skip if already uploaded (merge:true preserves existing driveUrl)
  const existing = await db.collection('mi_reports').doc(issue.id).get()
  if (!existing.exists || !existing.data()?.driveUrl) {
    try {
      const driveUrl = await uploadMiToDrive(serviceAccount, doc)
      doc.driveUrl = driveUrl
      await postDriveComment(issue.id, driveUrl, issue.identifier, doc.title)
      console.log(`  ☁  Drive → ${driveUrl.slice(0, 60)}…`)
    } catch (err) {
      console.warn(`  ⚠  Drive upload failed: ${err.message}`)
    }
  } else {
    doc.driveUrl = existing.data().driveUrl
  }

  await db.collection('mi_reports').doc(issue.id).set(doc, { merge: true })
  const matchNote = titleId ? `→ ${titleId.slice(0,8)}` : '→ general'
  console.log(`  ✓ ${issue.identifier} — ${issue.title.slice(0, 50)} [${doc.platformAppetite}] ${matchNote}`)
  written++
}

console.log(`\nDone — ${written} MI reports written, ${skipped} skipped.`)
process.exit(0)
