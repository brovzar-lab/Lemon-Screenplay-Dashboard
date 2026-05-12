#!/usr/bin/env node
/**
 * Google Drive upload helper for Lemon Studio agent deliverables.
 *
 * Uses the existing Firebase service account — no new credentials needed.
 * The service account must have Editor access to the Lemon Studio Drive folder
 * and the Drive API must be enabled on the Google Cloud project.
 *
 * Exports:
 *   buildCoverageDocx(doc)       → Promise<Buffer>
 *   buildMiDocx(report)          → Promise<Buffer>
 *   uploadCoverageToDrive(sa, doc)   → Promise<string>  (webViewLink)
 *   uploadMiToDrive(sa, report)      → Promise<string>  (webViewLink)
 */

import crypto from 'crypto'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TableRow, TableCell, Table,
  WidthType, ShadingType,
} from 'docx'

// Root "Lemon Studio" folder shared with the service account
export const DRIVE_ROOT_FOLDER_ID = '1DSa6EtiQvdvxADIu8bsJDpTcrtzx7AEg'

// ── JWT / OAuth2 ──────────────────────────────────────────────────────────────

let _token = null
let _tokenExpiry = 0

export async function getDriveToken(serviceAccount) {
  if (_token && Date.now() < _tokenExpiry - 60_000) return _token

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const signingInput = `${header}.${payload}`
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signingInput)
  const signature = sign.sign(serviceAccount.private_key, 'base64url')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${signature}`,
    }),
  })
  if (!res.ok) throw new Error(`Drive auth failed: ${await res.text()}`)
  const data = await res.json()
  _token = data.access_token
  _tokenExpiry = (now + 3600) * 1000
  return _token
}

// ── Folder helpers ────────────────────────────────────────────────────────────

const _folderCache = new Map()

async function ensureFolder(token, parentId, name) {
  const cacheKey = `${parentId}::${name}`
  if (_folderCache.has(cacheKey)) return _folderCache.get(cacheKey)

  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!listRes.ok) throw new Error(`Drive list failed: ${await listRes.text()}`)
  const list = await listRes.json()

  let folderId
  if (list.files.length > 0) {
    folderId = list.files[0].id
  } else {
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
    })
    if (!createRes.ok) throw new Error(`Drive mkdir "${name}" failed: ${await createRes.text()}`)
    folderId = (await createRes.json()).id
  }

  _folderCache.set(cacheKey, folderId)
  return folderId
}

async function resolvePath(token, rootId, ...parts) {
  let id = rootId
  for (const part of parts) id = await ensureFolder(token, id, part)
  return id
}

// ── File upload ───────────────────────────────────────────────────────────────

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

async function uploadDocx(token, folderId, filename, buffer) {
  const boundary = 'lemon_drive_mp_boundary'
  const meta = JSON.stringify({ name: filename, parents: [folderId] })

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ])

  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )
  if (!uploadRes.ok) throw new Error(`Drive upload failed: ${await uploadRes.text()}`)
  const file = await uploadRes.json()

  // Anyone with the link can view
  const permRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}/permissions`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }
  )
  if (!permRes.ok) throw new Error(`Drive share failed: ${await permRes.text()}`)

  return file.webViewLink
}

// ── DOCX generation (mirrors src/lib/exportDoc.ts for Node.js) ─────────────────

const GOLD = 'C8A800'
const BODY_FONT = 'Calibri'

function stripMarkdown(text) {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function docxSection(label, body) {
  const cleaned = stripMarkdown(body)
  if (!cleaned) return []
  return [
    new Paragraph({
      text: label,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 80 },
      run: { font: BODY_FONT, color: '555555', size: 20 },
    }),
    ...cleaned.split(/\n\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean).map(p =>
      new Paragraph({
        children: [new TextRun({ text: p, font: BODY_FONT, size: 22 })],
        spacing: { after: 160, line: 320 },
      })
    ),
  ]
}

function docxListSection(label, items) {
  if (!items.length) return []
  return [
    new Paragraph({ text: label, heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 80 } }),
    ...items.map(item =>
      new Paragraph({
        children: [new TextRun({ text: stripMarkdown(item), font: BODY_FONT, size: 22 })],
        bullet: { level: 0 },
        spacing: { after: 80, line: 300 },
      })
    ),
  ]
}

const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }

function docxHeader(docType, title, meta) {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: 'LEMON STUDIO', bold: true, color: GOLD, font: BODY_FONT, size: 16, allCaps: true }),
        new TextRun({ text: '   ' + docType, color: 'AAAAAA', font: BODY_FONT, size: 14 }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD } },
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, font: BODY_FONT, size: 36, color: '111111' })],
      spacing: { after: 160 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER, insideH: NONE_BORDER, insideV: NONE_BORDER },
      rows: [
        new TableRow({
          children: meta.map(([label, value]) =>
            new TableCell({
              width: { size: Math.floor(100 / meta.length), type: WidthType.PERCENTAGE },
              shading: { fill: 'F7F7F7', type: ShadingType.SOLID },
              borders: { top: NONE_BORDER, bottom: NONE_BORDER, left: NONE_BORDER, right: NONE_BORDER },
              children: [
                new Paragraph({ children: [new TextRun({ text: label, color: '999999', font: BODY_FONT, size: 16 })], spacing: { after: 40 } }),
                new Paragraph({ children: [new TextRun({ text: value, bold: true, font: BODY_FONT, size: 18, color: '222222' })], spacing: { after: 0 } }),
              ],
            })
          ),
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 240 } }),
  ]
}

const STYLES = (paragraphStyles) => ({
  default: { document: { run: { font: BODY_FONT, size: 22, color: '222222' } } },
  paragraphStyles: [{
    id: 'Heading2', name: 'Heading 2', basedOn: 'Normal',
    run: { font: BODY_FONT, size: 20, bold: true, color: '444444', allCaps: true },
    paragraph: { spacing: { before: 280, after: 80 } },
  }, ...(paragraphStyles || [])],
})

const PAGE_PROPS = { properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } } }

const CONFIDENTIAL = new Paragraph({
  children: [new TextRun({ text: 'Lemon Studio — Confidential', color: 'AAAAAA', font: BODY_FONT, size: 16 })],
  alignment: AlignmentType.CENTER,
  spacing: { before: 600 },
})

const VERDICT_LABEL = { recommend: 'Recommend', consider: 'Consider', pass: 'Pass', pending: 'Pending' }
const APPETITE_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }

export async function buildCoverageDocx(doc) {
  const wordDoc = new Document({
    styles: STYLES(),
    sections: [{
      ...PAGE_PROPS,
      children: [
        ...docxHeader('Coverage Report', doc.titleName, [
          ['Analyst', doc.analyst],
          ['Verdict', VERDICT_LABEL[doc.verdict] ?? doc.verdict],
          ['Date', fmtDate(doc.createdAt)],
        ]),
        ...(doc.synopsis ? docxSection('Synopsis', doc.synopsis) : []),
        ...(doc.notes    ? docxSection('Analyst Notes', doc.notes)    : []),
        CONFIDENTIAL,
      ],
    }],
  })
  return Packer.toBuffer(wordDoc)
}

export async function buildMiDocx(report) {
  const wordDoc = new Document({
    styles: STYLES(),
    sections: [{
      ...PAGE_PROPS,
      children: [
        ...docxHeader('Market Intelligence Report', report.title, [
          ['Platform', report.platform],
          ['Appetite', APPETITE_LABEL[report.platformAppetite] ?? report.platformAppetite],
          ['Genre', report.genre],
          ['Date', fmtDate(report.reportDate)],
        ]),
        ...(report.summary         ? docxSection('Summary', report.summary)                     : []),
        ...(report.trends.length   ? docxListSection('Key Trends', report.trends)               : []),
        ...(report.compTitles.length ? docxSection('Comp Titles', report.compTitles.join(', ')) : []),
        CONFIDENTIAL,
      ],
    }],
  })
  return Packer.toBuffer(wordDoc)
}

// ── Drive filename helpers ────────────────────────────────────────────────────

function driveDate(iso) { return new Date(iso).toISOString().slice(0, 10) }

// ── High-level upload functions ───────────────────────────────────────────────

export async function uploadCoverageToDrive(serviceAccount, doc) {
  const token = await getDriveToken(serviceAccount)
  const folderId = await resolvePath(token, DRIVE_ROOT_FOLDER_ID, 'Coverage', doc.titleName)
  const filename = `Coverage — ${doc.titleName} — ${driveDate(doc.createdAt)}.docx`
  const buffer = await buildCoverageDocx(doc)
  return uploadDocx(token, folderId, filename, buffer)
}

export async function uploadMiToDrive(serviceAccount, report) {
  const token = await getDriveToken(serviceAccount)
  const yearMonth = report.reportDate.slice(0, 7) // YYYY-MM
  const folderId = await resolvePath(token, DRIVE_ROOT_FOLDER_ID, 'Market Intelligence', yearMonth)
  const filename = `${report.title} — ${driveDate(report.reportDate)}.docx`
  const buffer = await buildMiDocx(report)
  return uploadDocx(token, folderId, filename, buffer)
}
