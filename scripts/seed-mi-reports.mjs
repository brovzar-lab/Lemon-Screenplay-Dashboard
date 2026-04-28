#!/usr/bin/env node
/**
 * Seeds Paperclip MI-agent issues into Firestore `mi_reports` collection.
 *
 * Fetches all done issues assigned to the Marketing Intelligence agent,
 * reads their report documents, parses them, and writes structured
 * MarketIntelReport docs — idempotent via merge:true.
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

const MI_AGENT_ID = '746a13cf-076a-455b-93e6-d23d6cb34a86'
// Document keys tried in order
const DOC_KEYS = ['mi-validation', 'mi-analysis', 'market-validation', 'deep-dive', 'report']

// ── Helpers ───────────────────────────────────────────────────────────────────

async function paperclipGet(path) {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  if (!res.ok) return null
  return res.json()
}

/** Try each known doc key until one returns a body. */
async function fetchFirstDocument(issueId) {
  for (const key of DOC_KEYS) {
    const doc = await paperclipGet(`/api/issues/${issueId}/documents/${key}`)
    if (doc?.body) return { key, body: doc.body }
  }
  return null
}

/** Extract date string from document header (e.g. "**Date:** 2026-04-27"). */
function extractDate(body) {
  const m = body.match(/\*\*Date[:\*]*\*?\*?[:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2})/i)
    || body.match(/Date[:\s]+([A-Z][a-z]+ [0-9]{1,2},? [0-9]{4})/i)
    || body.match(/Date[:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2})/i)
  if (!m) return null
  try { return new Date(m[1]).toISOString().slice(0, 10) } catch { return null }
}

/**
 * Map document verdict text to platformAppetite (high/medium/low).
 * Looks for explicit appetite mentions or overall verdict indicators.
 */
function extractAppetite(body) {
  const b = body.toLowerCase()
  // Explicit appetite statements
  if (/platform appetite[:\s]+high|appetite[:\s]+high|strong appetite|appetite confirmed/i.test(body)) return 'high'
  if (/platform appetite[:\s]+medium|appetite[:\s]+medium|moderate appetite/i.test(body)) return 'medium'
  if (/platform appetite[:\s]+low|appetite[:\s]+low|limited appetite|no appetite/i.test(body)) return 'low'
  // Verdict-based mapping
  if (/\badvance\b/.test(b) && !/no advance|do not advance/.test(b)) return 'high'
  if (/conditional advance|flag concerns|conditional/i.test(body)) return 'medium'
  if (/\bpass\b|\bdo not advance\b|not viable/i.test(body)) return 'low'
  return 'medium'
}

/** Extract platform from issue title or document body. */
function extractPlatform(title, body) {
  const platforms = ['Netflix', 'Apple TV+', 'HBO Max', 'Amazon Prime', 'Disney+', 'Theatrical']
  for (const p of platforms) {
    if (title.includes(p) || body.includes(p)) return p
  }
  return 'Other'
}

/** Extract a clean summary (first substantive paragraph after metadata header). */
function extractSummary(body) {
  // Strip leading metadata lines (lines starting with # or ** or = or Date:)
  const lines = body.split('\n')
  let started = false
  const summaryLines = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (started && summaryLines.length > 0) break // stop at first blank after content
      continue
    }
    // Skip header/metadata lines
    if (trimmed.startsWith('#') || trimmed.startsWith('=') || trimmed.startsWith('**Date') ||
        trimmed.startsWith('**Issue') || trimmed.startsWith('**Analyst') ||
        trimmed.startsWith('**Format') || trimmed.startsWith('**Prepared') ||
        trimmed.startsWith('---') || trimmed.startsWith('**Card') ||
        trimmed.startsWith('Requested by') || trimmed.startsWith('Date:') ||
        trimmed.startsWith('Searches conducted')) {
      continue
    }
    started = true
    summaryLines.push(trimmed)
    if (summaryLines.join(' ').length > 500) break
  }

  return summaryLines.join(' ').slice(0, 600)
}

/** Extract bullet-point trend items. */
function extractTrends(body) {
  const trends = []
  const lines = body.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Match markdown bullets and numbered list items
    const m = trimmed.match(/^[-*•]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/)
    if (m) {
      const text = m[1].replace(/\*\*/g, '').trim()
      if (text.length > 10 && text.length < 200) {
        trends.push(text)
      }
    }
  }
  // Return first 8 significant trends
  return trends.slice(0, 8)
}

/** Extract comp titles from document. */
function extractCompTitles(body) {
  const comps = []
  const compSection = body.match(/comp[s\s]+titles?[:\s]+([\s\S]{0,800}?)(?:\n##|\n---|\n\*\*|$)/i)
  if (!compSection) return comps

  const lines = compSection[1].split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^[-*•]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/)
    if (m) comps.push(m[1].replace(/\*\*/g, '').trim().slice(0, 100))
  }
  return comps.slice(0, 6)
}

/** Extract genre from issue title or body. */
function extractGenre(title, body) {
  const genres = ['Horror', 'Comedy', 'Drama', 'Thriller', 'Musical', 'Documentary', 'True Crime', 'Romance', 'Action']
  for (const g of genres) {
    if (title.toLowerCase().includes(g.toLowerCase()) || body.toLowerCase().includes(g.toLowerCase())) {
      return g.toLowerCase()
    }
  }
  return 'drama'
}

// ── Fetch all MI issues ────────────────────────────────────────────────────────
const issuesRes = await paperclipGet(
  `/api/companies/${companyId}/issues?assigneeAgentId=${MI_AGENT_ID}&status=done,in_progress`
)
const issues = Array.isArray(issuesRes) ? issuesRes : []

if (!issues.length) {
  console.log('No MI issues found.')
  process.exit(0)
}

console.log(`Found ${issues.length} MI issues. Processing…\n`)

let written = 0
let skipped = 0

for (const issue of issues) {
  const docResult = await fetchFirstDocument(issue.id)
  if (!docResult) {
    console.log(`  ⚠  ${issue.title.slice(0, 60)} — no document found, skipping`)
    skipped++
    continue
  }

  const { body } = docResult
  const rawDate = extractDate(body)
  const reportDate = rawDate ?? issue.createdAt.slice(0, 10)

  const doc = {
    titleId: issue.projectId ?? null,
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

  await db.collection('mi_reports').doc(issue.id).set(doc, { merge: true })
  console.log(`  ✓ ${issue.identifier} — ${issue.title.slice(0, 55)} [${doc.platformAppetite}]`)
  written++
}

console.log(`\nDone — ${written} MI reports written, ${skipped} skipped.`)
process.exit(0)
