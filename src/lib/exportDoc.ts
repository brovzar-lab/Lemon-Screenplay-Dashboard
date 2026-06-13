import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TableRow,
  TableCell,
  Table,
  WidthType,
  ShadingType,
} from 'docx'
import { jsPDF } from 'jspdf'
import type { CoverageDoc, MarketIntelReport } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')          // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')    // bold
    .replace(/\*(.+?)\*/g, '$1')        // italic
    .replace(/__(.+?)__/g, '$1')        // bold alt
    .replace(/_(.+?)_/g, '$1')          // italic alt
    .replace(/~~(.+?)~~/g, '$1')        // strikethrough
    .replace(/`{1,3}[^`]*`{1,3}/g, '')  // code
    .replace(/^\s*[-*+]\s+/gm, '')      // unordered lists
    .replace(/^\s*\d+\.\s+/gm, '')      // ordered lists
    .replace(/^\s*>\s+/gm, '')          // blockquotes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1') // images
    .replace(/\n{3,}/g, '\n\n')         // excess blank lines
    .trim()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function safeFilename(name: string, suffix: string, ext: string): string {
  return `${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60)}-${suffix}.${ext}`
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const VERDICT_LABEL: Record<string, string> = {
  recommend: 'Recommend',
  consider:  'Consider',
  pass:      'Pass',
  pending:   'Pending',
}

const APPETITE_LABEL: Record<string, string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
}

// ── PDF shared helpers ────────────────────────────────────────────────────────

const PDF_MARGIN = 20
const PDF_LINE_HEIGHT = 7
const PDF_BODY_SIZE = 10
const PDF_PAGE_WIDTH = 210  // A4

function pdfAddSection(
  pdf: jsPDF,
  label: string,
  body: string,
  y: number,
): number {
  const usable = PDF_PAGE_WIDTH - PDF_MARGIN * 2
  const cleaned = stripMarkdown(body)
  if (!cleaned) return y

  // Section label
  if (y + 14 > 275) { pdf.addPage(); y = PDF_MARGIN }
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(120, 120, 120)
  pdf.text(label.toUpperCase(), PDF_MARGIN, y)
  y += 4

  // Light rule
  pdf.setDrawColor(220, 220, 220)
  pdf.line(PDF_MARGIN, y, PDF_PAGE_WIDTH - PDF_MARGIN, y)
  y += 5

  // Body text
  pdf.setFontSize(PDF_BODY_SIZE)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(40, 40, 40)
  const lines = pdf.splitTextToSize(cleaned, usable) as string[]
  for (const line of lines) {
    if (y + PDF_LINE_HEIGHT > 275) { pdf.addPage(); y = PDF_MARGIN }
    pdf.text(line, PDF_MARGIN, y)
    y += PDF_LINE_HEIGHT
  }
  return y + 6
}

function pdfAddListSection(
  pdf: jsPDF,
  label: string,
  items: string[],
  y: number,
): number {
  if (!items.length) return y
  const usable = PDF_PAGE_WIDTH - PDF_MARGIN * 2 - 6

  if (y + 14 > 275) { pdf.addPage(); y = PDF_MARGIN }
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(120, 120, 120)
  pdf.text(label.toUpperCase(), PDF_MARGIN, y)
  y += 4

  pdf.setDrawColor(220, 220, 220)
  pdf.line(PDF_MARGIN, y, PDF_PAGE_WIDTH - PDF_MARGIN, y)
  y += 5

  pdf.setFontSize(PDF_BODY_SIZE)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(40, 40, 40)
  for (const item of items) {
    const cleaned = stripMarkdown(item)
    const lines = pdf.splitTextToSize(cleaned, usable) as string[]
    if (y + PDF_LINE_HEIGHT > 275) { pdf.addPage(); y = PDF_MARGIN }
    pdf.text('•', PDF_MARGIN, y)
    pdf.text(lines[0], PDF_MARGIN + 6, y)
    y += PDF_LINE_HEIGHT
    for (let i = 1; i < lines.length; i++) {
      if (y + PDF_LINE_HEIGHT > 275) { pdf.addPage(); y = PDF_MARGIN }
      pdf.text(lines[i], PDF_MARGIN + 6, y)
      y += PDF_LINE_HEIGHT
    }
  }
  return y + 6
}

function pdfHeader(pdf: jsPDF, docType: string, title: string): number {
  let y = PDF_MARGIN

  // Studio wordmark
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(180, 150, 0)
  pdf.text('LEMON STUDIO', PDF_MARGIN, y)

  // Document type (right-aligned)
  pdf.setTextColor(150, 150, 150)
  const typeWidth = pdf.getTextWidth(docType)
  pdf.text(docType, PDF_PAGE_WIDTH - PDF_MARGIN - typeWidth, y)
  y += 5

  // Heavy rule
  pdf.setDrawColor(200, 170, 0)
  pdf.setLineWidth(0.8)
  pdf.line(PDF_MARGIN, y, PDF_PAGE_WIDTH - PDF_MARGIN, y)
  pdf.setLineWidth(0.2)
  y += 8

  // Document title
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(20, 20, 20)
  const titleLines = pdf.splitTextToSize(title, PDF_PAGE_WIDTH - PDF_MARGIN * 2) as string[]
  for (const line of titleLines) {
    pdf.text(line, PDF_MARGIN, y)
    y += 9
  }
  return y + 4
}

function pdfMetaRow(pdf: jsPDF, pairs: [string, string][], y: number): number {
  pdf.setFontSize(8.5)
  let x = PDF_MARGIN
  const colW = (PDF_PAGE_WIDTH - PDF_MARGIN * 2) / pairs.length
  for (const [label, value] of pairs) {
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(130, 130, 130)
    pdf.text(label, x, y)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(40, 40, 40)
    pdf.text(value, x, y + 5)
    x += colW
  }
  return y + 14
}

// ── DOCX shared helpers ───────────────────────────────────────────────────────

const DOCX_HEADING_COLOR = 'C8A800'
const DOCX_BODY_FONT = 'Calibri'
const DOCX_HEADING_FONT = 'Calibri'

function docxSection(label: string, body: string) {
  const cleaned = stripMarkdown(body)
  if (!cleaned) return []
  const paragraphs = cleaned.split(/\n\n+/).map(p => p.replace(/\n/g, ' ').trim()).filter(Boolean)
  return [
    new Paragraph({
      text: label,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 80 },
      run: { font: DOCX_HEADING_FONT, color: '555555', size: 20 },
    }),
    ...paragraphs.map(p =>
      new Paragraph({
        children: [new TextRun({ text: p, font: DOCX_BODY_FONT, size: 22 })],
        spacing: { after: 160, line: 320 },
      })
    ),
  ]
}

function docxListSection(label: string, items: string[]) {
  if (!items.length) return []
  return [
    new Paragraph({
      text: label,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 80 },
    }),
    ...items.map(item =>
      new Paragraph({
        children: [new TextRun({ text: stripMarkdown(item), font: DOCX_BODY_FONT, size: 22 })],
        bullet: { level: 0 },
        spacing: { after: 80, line: 300 },
      })
    ),
  ]
}

function docxHeader(docType: string, title: string, meta: [string, string][]) {
  return [
    // Studio wordmark
    new Paragraph({
      children: [
        new TextRun({
          text: 'LEMON STUDIO',
          bold: true,
          color: DOCX_HEADING_COLOR,
          font: DOCX_HEADING_FONT,
          size: 16,
          allCaps: true,
        }),
        new TextRun({ text: '   ' + docType, color: 'AAAAAA', font: DOCX_BODY_FONT, size: 14 }),
      ],
      spacing: { after: 80 },
    }),
    // Horizontal rule
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C8A800' } },
      spacing: { after: 200 },
    }),
    // Title
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, font: DOCX_HEADING_FONT, size: 36, color: '111111' })],
      spacing: { after: 160 },
    }),
    // Meta table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      },
      rows: [
        new TableRow({
          children: meta.map(([label, value]) =>
            new TableCell({
              width: { size: Math.floor(100 / meta.length), type: WidthType.PERCENTAGE },
              shading: { fill: 'F7F7F7', type: ShadingType.SOLID },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: label, color: '999999', font: DOCX_BODY_FONT, size: 16 })],
                  spacing: { after: 40 },
                }),
                new Paragraph({
                  children: [new TextRun({ text: value, bold: true, font: DOCX_BODY_FONT, size: 18, color: '222222' })],
                  spacing: { after: 0 },
                }),
              ],
            })
          ),
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 240 } }),
  ]
}

// ── Coverage: PDF ─────────────────────────────────────────────────────────────

export function exportCoverageAsPdf(doc: CoverageDoc): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = pdfHeader(pdf, 'COVERAGE REPORT', doc.titleName)

  y = pdfMetaRow(pdf, [
    ['Analyst',  doc.analyst],
    ['Verdict',  VERDICT_LABEL[doc.verdict] ?? doc.verdict],
    ['Date',     formatDate(doc.createdAt)],
  ], y)

  if (doc.synopsis) y = pdfAddSection(pdf, 'Synopsis', doc.synopsis, y)
  if (doc.notes)    y = pdfAddSection(pdf, 'Analyst Notes', doc.notes, y)

  // Footer on each page
  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(7)
    pdf.setTextColor(180, 180, 180)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Lemon Studio — Confidential', PDF_MARGIN, 287)
    pdf.text(`${i} / ${pageCount}`, PDF_PAGE_WIDTH - PDF_MARGIN, 287, { align: 'right' })
  }

  pdf.save(safeFilename(doc.titleName, 'coverage', 'pdf'))
}

// ── Coverage: Word ────────────────────────────────────────────────────────────

export async function exportCoverageAsDocx(doc: CoverageDoc): Promise<void> {
  const wordDoc = new Document({
    styles: {
      default: {
        document: { run: { font: DOCX_BODY_FONT, size: 22, color: '222222' } },
      },
      paragraphStyles: [
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          run: { font: DOCX_HEADING_FONT, size: 20, bold: true, color: '444444', allCaps: true },
          paragraph: { spacing: { before: 280, after: 80 } },
        },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children: [
        ...docxHeader('Coverage Report', doc.titleName, [
          ['Analyst', doc.analyst],
          ['Verdict',  VERDICT_LABEL[doc.verdict] ?? doc.verdict],
          ['Date',     formatDate(doc.createdAt)],
        ]),
        ...(doc.synopsis ? docxSection('Synopsis', doc.synopsis) : []),
        ...(doc.notes    ? docxSection('Analyst Notes', doc.notes)    : []),
        // Confidentiality footer note
        new Paragraph({
          children: [new TextRun({ text: 'Lemon Studio — Confidential', color: 'AAAAAA', font: DOCX_BODY_FONT, size: 16 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 600 },
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(wordDoc)
  triggerDownload(blob, safeFilename(doc.titleName, 'coverage', 'docx'))
}

// ── MI Report: PDF ────────────────────────────────────────────────────────────

export function exportMiAsPdf(report: MarketIntelReport): void {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = pdfHeader(pdf, 'MARKET INTELLIGENCE REPORT', report.title)

  y = pdfMetaRow(pdf, [
    ['Platform',  report.platform],
    ['Appetite',  APPETITE_LABEL[report.platformAppetite] ?? report.platformAppetite],
    ['Genre',     report.genre],
    ['Date',      formatDate(report.reportDate)],
  ], y)

  if (report.summary)                y = pdfAddSection(pdf, 'Summary', report.summary, y)
  if (report.trends.length)          y = pdfAddListSection(pdf, 'Key Trends', report.trends, y)
  if (report.compTitles.length) {
    y = pdfAddSection(pdf, 'Comp Titles', report.compTitles.join(', '), y)
  }

  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setFontSize(7)
    pdf.setTextColor(180, 180, 180)
    pdf.setFont('helvetica', 'normal')
    pdf.text('Lemon Studio — Confidential', PDF_MARGIN, 287)
    pdf.text(`${i} / ${pageCount}`, PDF_PAGE_WIDTH - PDF_MARGIN, 287, { align: 'right' })
  }

  pdf.save(safeFilename(report.title, 'mi-report', 'pdf'))
}

// ── MI Report: Word ───────────────────────────────────────────────────────────

export async function exportMiAsDocx(report: MarketIntelReport): Promise<void> {
  const wordDoc = new Document({
    styles: {
      default: {
        document: { run: { font: DOCX_BODY_FONT, size: 22, color: '222222' } },
      },
      paragraphStyles: [
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          run: { font: DOCX_HEADING_FONT, size: 20, bold: true, color: '444444', allCaps: true },
          paragraph: { spacing: { before: 280, after: 80 } },
        },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      children: [
        ...docxHeader('Market Intelligence Report', report.title, [
          ['Platform',  report.platform],
          ['Appetite',  APPETITE_LABEL[report.platformAppetite] ?? report.platformAppetite],
          ['Genre',     report.genre],
          ['Date',      formatDate(report.reportDate)],
        ]),
        ...(report.summary ? docxSection('Summary', report.summary) : []),
        ...(report.trends.length ? docxListSection('Key Trends', report.trends) : []),
        ...(report.compTitles.length
          ? docxSection('Comp Titles', report.compTitles.join(', '))
          : []),
        new Paragraph({
          children: [new TextRun({ text: 'Lemon Studio — Confidential', color: 'AAAAAA', font: DOCX_BODY_FONT, size: 16 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 600 },
        }),
      ],
    }],
  })

  const blob = await Packer.toBlob(wordDoc)
  triggerDownload(blob, safeFilename(report.title, 'mi-report', 'docx'))
}
