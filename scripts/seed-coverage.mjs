#!/usr/bin/env node
/**
 * Seeds Paperclip Coverage Analyst issues into Firestore `coverage` collection.
 * Uses projectId-first matching, falling back to name-based fuzzy match.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
if (!credJson) { console.error('GOOGLE_APPLICATION_CREDENTIALS_JSON not set'); process.exit(1) }
const serviceAccount = JSON.parse(credJson)
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id })
}
const db = getFirestore()

const apiUrl    = process.env.PAPERCLIP_API_URL
const apiKey    = process.env.PAPERCLIP_API_KEY
const companyId = process.env.PAPERCLIP_COMPANY_ID
if (!apiUrl || !apiKey || !companyId) {
  console.error('PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID required')
  process.exit(1)
}

const COVERAGE_AGENT_ID = 'eb0a5309-e457-445a-987a-bd991a3ea9bc'
const DOC_KEYS = ['coverage', 'coverage-report', 'report']

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

function normalize(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitleFromCoverageTitle(issueTitle) {
  let t = issueTitle
  t = t.replace(/^(Coverage|Coverage Report|Coverage Analysis)[:\s—-]+/i, '')
  t = t.replace(/^Stage Musical Coverage:\s*/i, '')
  t = t.replace(/\s*[-—]+\s*(full professional|screen translatability|show bible|shared creative|spanish translation)[^)]*$/i, '')
  t = t.replace(/\s*\([^)]{0,60}\)\s*$/, '')
  return t.trim()
}

function findProjectId(name, lookup) {
  const norm = normalize(name)
  if (!norm || norm.length < 3) return null
  if (lookup[norm]) return lookup[norm]
  for (const [key, id] of Object.entries(lookup)) {
    if (key.includes(norm) || norm.includes(key)) return id
  }
  const queryWords = norm.split(' ').filter(w => w.length > 2)
  let bestMatch = null, bestScore = 1
  for (const [key, id] of Object.entries(lookup)) {
    const keyWords = key.split(' ').filter(w => w.length > 2)
    const common = queryWords.filter(w => keyWords.includes(w)).length
    if (common > bestScore) { bestScore = common; bestMatch = id }
  }
  return bestMatch
}

async function resolveProjectId(issue, depth = 0) {
  if (issue.projectId) return issue.projectId
  if (!issue.parentId || depth >= 3) return null
  const parent = await paperclipGet(`/api/issues/${issue.parentId}`)
  if (!parent) return null
  return resolveProjectId(parent, depth + 1)
}

function extractVerdict(body) {
  const verdictLine = body.match(/\*\*Verdict[:\*]*\*?\*?[:\s]+([A-Z][A-Z\s]+)/i)
    || body.match(/##\s+Verdict[:\s]+([A-Z][A-Z\s]+)/i)
    || body.match(/Verdict[:\s]+([A-Z][A-Z\s]+)/i)
  if (verdictLine) {
    const v = verdictLine[1].toUpperCase()
    if (v.includes('RECOMMEND')) return 'recommend'
    if (v.includes('CONSIDER')) return 'consider'
    if (v.includes('PASS')) return 'pass'
  }
  const upper = body.toUpperCase()
  if (upper.includes('VERDICT: RECOMMEND') || upper.includes('VERDICT — RECOMMEND') || upper.includes('VERDICT: STRONG RECOMMEND')) return 'recommend'
  if (upper.includes('VERDICT: CONSIDER') || upper.includes('VERDICT — CONSIDER')) return 'consider'
  if (upper.includes('VERDICT: PASS') || upper.includes('VERDICT — PASS')) return 'pass'
  if (upper.includes('RECOMMEND')) return 'recommend'
  if (upper.includes('CONSIDER')) return 'consider'
  if (upper.includes('PASS')) return 'pass'
  return 'pending'
}

function extractSynopsis(body) {
  const logline = body.match(/##\s*\d*\.?\s*Logline\s*\n+([\s\S]{0,600}?)(?:\n##|\n---|\n\*\*|$)/i)
    || body.match(/\*\*Logline\*\*[:\s]+([\s\S]{0,400}?)(?:\n\n|\n##)/i)
  if (logline) return logline[1].trim().slice(0, 500)
  const synopsis = body.match(/##\s*\d*\.?\s*Synopsis\s*\n+([\s\S]{0,600}?)(?:\n##|\n---|\n\*\*|$)/i)
  if (synopsis) return synopsis[1].trim().slice(0, 500)
  const opening = body.match(/##\s*\d*\.?\s*Opening[^#\n]*\n+([\s\S]{0,400}?)(?:\n##)/i)
  if (opening) return opening[1].trim().slice(0, 500)
  for (const line of body.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('*') || t.startsWith('|') || t.startsWith('---')) continue
    if (t.length > 60) return t.slice(0, 500)
  }
  return ''
}

function extractNotes(body) {
  const m = body.match(/##\s*(?:\d+\.?\s+)?(?:Key (?:Findings|Notes)|Overall|Summary|Assessment|Analysis)[^\n]*\n+([\s\S]{0,800}?)(?:\n##|$)/i)
  if (m) return m[1].trim().slice(0, 800)
  const lines = body.split('\n')
  const notes = []
  let inMeta = true
  for (const line of lines) {
    const t = line.trim()
    if (inMeta && (t.startsWith('**') || t.startsWith('#') || t.startsWith('---') || !t)) continue
    inMeta = false
    if (t) notes.push(t)
    if (notes.join(' ').length > 600) break
  }
  return notes.join(' ').slice(0, 800)
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

// ── Fetch all coverage issues ─────────────────────────────────────────────────
const issuesRes = await paperclipGet(
  `/api/companies/${companyId}/issues?assigneeAgentId=${COVERAGE_AGENT_ID}&status=done,in_progress`
)
const issues = Array.isArray(issuesRes) ? issuesRes : []
console.log(`Found ${issues.length} coverage issues. Processing…\n`)

let written = 0, skipped = 0

for (const issue of issues) {
  const titleLower = issue.title.toLowerCase()
  if (!titleLower.includes('coverage')) {
    console.log(`  ⊘  ${issue.title.slice(0, 60)} — not a coverage doc, skipping`)
    skipped++; continue
  }

  const docResult = await fetchFirstDocument(issue.id)
  if (!docResult) {
    console.log(`  ⚠  ${issue.title.slice(0, 60)} — no document, skipping`)
    skipped++; continue
  }

  const { body } = docResult

  // Resolve titleId: direct projectId, then parent chain, then name match
  let titleId = null
  const directId = await resolveProjectId(issue)
  if (directId) {
    titleId = directId
  } else {
    const extractedName = extractTitleFromCoverageTitle(issue.title)
    const matched = findProjectId(extractedName, nameLookup)
    if (matched) titleId = matched
  }

  const titleName = extractTitleFromCoverageTitle(issue.title)

  const doc = {
    titleId,
    titleName: titleName || issue.title,
    analyst: 'Coverage Analyst',
    verdict: extractVerdict(body),
    synopsis: extractSynopsis(body),
    notes: extractNotes(body),
    pdfUrl: null,
    createdAt: issue.createdAt,
    paperclipIssueId: issue.id,
    paperclipIdentifier: issue.identifier,
  }

  await db.collection('coverage').doc(issue.id).set(doc, { merge: true })
  const matchNote = titleId ? `→ ${titleId.slice(0,8)}` : '→ general'
  console.log(`  ✓ ${issue.identifier} — ${issue.title.slice(0, 55)} [${doc.verdict}] ${matchNote}`)
  written++
}

console.log(`\nDone — ${written} coverage docs written, ${skipped} skipped.`)
process.exit(0)
