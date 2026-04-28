#!/usr/bin/env node
/**
 * Seeds Paperclip Coverage Analyst issues into Firestore `coverage` collection.
 *
 * Fetches all done issues assigned to the Coverage Analyst agent,
 * reads their coverage documents, parses them, and writes structured
 * CoverageDoc records — idempotent via merge:true.
 *
 * Required env (auto-injected in agent context):
 *   GOOGLE_APPLICATION_CREDENTIALS_JSON
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

// ── Paperclip config ──────────────────────────────────────────────────────────
const apiUrl = process.env.PAPERCLIP_API_URL
const apiKey = process.env.PAPERCLIP_API_KEY
const companyId = process.env.PAPERCLIP_COMPANY_ID

if (!apiUrl || !apiKey || !companyId) {
  console.error('PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID required')
  process.exit(1)
}

const COVERAGE_AGENT_ID = 'eb0a5309-e457-445a-987a-bd991a3ea9bc'
const DOC_KEYS = ['coverage', 'coverage-report', 'report']

// ── Helpers ───────────────────────────────────────────────────────────────────

async function paperclipGet(path) {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
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

/**
 * Walk up the parent chain (max 3 levels) to find a projectId.
 * Returns null if not found.
 */
async function resolveProjectId(issue, depth = 0) {
  if (issue.projectId) return issue.projectId
  if (!issue.parentId || depth >= 3) return null
  const parent = await paperclipGet(`/api/issues/${issue.parentId}`)
  if (!parent) return null
  return resolveProjectId(parent, depth + 1)
}

/** Map verdict text to AnalystVerdict enum. */
function extractVerdict(body) {
  const upper = body.toUpperCase()
  // Look for explicit verdict lines first
  const verdictLine = body.match(/\*\*Verdict[:\*]*\*?\*?[:\s]+([A-Z][A-Z\s]+)/i)
    || body.match(/##\s+Verdict[:\s]+([A-Z][A-Z\s]+)/i)
    || body.match(/Verdict[:\s]+([A-Z][A-Z\s]+)/i)

  if (verdictLine) {
    const v = verdictLine[1].toUpperCase()
    if (v.includes('RECOMMEND')) return 'recommend'
    if (v.includes('CONSIDER')) return 'consider'
    if (v.includes('PASS')) return 'pass'
  }

  // Fall back to scanning the full body
  if (upper.includes('VERDICT: RECOMMEND') || upper.includes('VERDICT — RECOMMEND')) return 'recommend'
  if (upper.includes('VERDICT: CONSIDER') || upper.includes('VERDICT — CONSIDER')) return 'consider'
  if (upper.includes('VERDICT: PASS') || upper.includes('VERDICT — PASS')) return 'pass'
  if (upper.includes('RECOMMEND')) return 'recommend'
  if (upper.includes('CONSIDER')) return 'consider'
  if (upper.includes('PASS')) return 'pass'
  return 'pending'
}

/** Extract title name from document or issue title. */
function extractTitleName(issueTitle, body) {
  // Strip "Coverage -- " / "Coverage: " prefix
  const cleaned = issueTitle
    .replace(/^Coverage\s*[--:]+\s*/i, '')
    .replace(/^Stage Musical Coverage:\s*/i, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .trim()
  return cleaned
}

/** Extract synopsis / logline from coverage body. */
function extractSynopsis(body) {
  // Look for a Logline section
  const loglineSection = body.match(/##\s*\d*\.?\s*Logline\s*\n+([\s\S]{0,600}?)(?:\n##|\n---|\n\*\*|$)/i)
    || body.match(/\*\*Logline\*\*[:\s]+([\s\S]{0,400}?)(?:\n\n|\n##)/i)
  if (loglineSection) return loglineSection[1].trim().slice(0, 500)

  // Look for Synopsis section
  const synopsisSection = body.match(/##\s*\d*\.?\s*Synopsis\s*\n+([\s\S]{0,600}?)(?:\n##|\n---|\n\*\*|$)/i)
  if (synopsisSection) return synopsisSection[1].trim().slice(0, 500)

  // Look for Opening / High Concept section
  const openSection = body.match(/##\s*\d*\.?\s*Opening[^#\n]*\n+([\s\S]{0,400}?)(?:\n##)/i)
  if (openSection) return openSection[1].trim().slice(0, 500)

  // Fallback: first substantive paragraph
  const lines = body.split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('#') || t.startsWith('*') || t.startsWith('|') || t.startsWith('---')) continue
    if (t.length > 60) return t.slice(0, 500)
  }
  return ''
}

/** Extract notes (key findings / main analysis). */
function extractNotes(body) {
  // Try to find a "Key Findings" or numbered sections
  const m = body.match(/##\s*(?:\d+\.?\s+)?(?:Key (?:Findings|Notes)|Overall|Summary|Assessment|Analysis)[^\n]*\n+([\s\S]{0,800}?)(?:\n##|$)/i)
  if (m) return m[1].trim().slice(0, 800)

  // Fall back to first 600 chars of substantive content
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

// ── Fetch all coverage issues ─────────────────────────────────────────────────
const issuesRes = await paperclipGet(
  `/api/companies/${companyId}/issues?assigneeAgentId=${COVERAGE_AGENT_ID}&status=done,in_progress`
)
const issues = Array.isArray(issuesRes) ? issuesRes : []

if (!issues.length) {
  console.log('No coverage issues found.')
  process.exit(0)
}

console.log(`Found ${issues.length} coverage issues. Processing…\n`)

let written = 0
let skipped = 0

for (const issue of issues) {
  // Skip non-coverage issues (e.g. Gauntlet input, screen translatability)
  const titleLower = issue.title.toLowerCase()
  if (!titleLower.includes('coverage') && !titleLower.includes('coverage report')) {
    console.log(`  ⊘  ${issue.title.slice(0, 60)} — not a coverage doc, skipping`)
    skipped++
    continue
  }

  const docResult = await fetchFirstDocument(issue.id)
  if (!docResult) {
    console.log(`  ⚠  ${issue.title.slice(0, 60)} — no document, skipping`)
    skipped++
    continue
  }

  const { body } = docResult
  const titleId = await resolveProjectId(issue)

  const doc = {
    titleId: titleId ?? null,
    titleName: extractTitleName(issue.title, body),
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
  console.log(`  ✓ ${issue.identifier} — ${issue.title.slice(0, 55)} [${doc.verdict}]`)
  written++
}

console.log(`\nDone — ${written} coverage docs written, ${skipped} skipped.`)
process.exit(0)
