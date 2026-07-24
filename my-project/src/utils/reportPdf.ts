import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Report } from '../types'
import { formatDate, formatPercent } from './gapLevels'

type RGB = [number, number, number]

const COLORS = {
  primary: [0, 119, 182] as RGB,
  primaryDark: [3, 78, 123] as RGB,
  ink: [15, 23, 42] as RGB,
  muted: [100, 116, 139] as RGB,
  border: [226, 232, 240] as RGB,
  panel: [248, 250, 252] as RGB,
  success: [5, 150, 105] as RGB,
  successBg: [236, 253, 245] as RGB,
  amber: [180, 83, 9] as RGB,
  amberBg: [255, 251, 235] as RGB,
  danger: [190, 18, 60] as RGB,
  dangerBg: [255, 241, 242] as RGB,
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 14
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_Y = PAGE_HEIGHT - 14

function gapTone(level: string | undefined): { fg: RGB; bg: RGB } {
  switch (level) {
    case 'No Gap':
    case 'Very Low Gap':
      return { fg: COLORS.success, bg: COLORS.successBg }
    case 'Low Gap':
    case 'Moderate Gap':
      return { fg: COLORS.amber, bg: COLORS.amberBg }
    case 'High Gap':
      return { fg: COLORS.danger, bg: COLORS.dangerBg }
    default:
      return { fg: COLORS.muted, bg: COLORS.panel }
  }
}

function withLastAutoTableY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? MARGIN
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 4) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  y = ensureSpace(doc, y, 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(...COLORS.ink)
  doc.text(text, MARGIN, y)
  doc.setDrawColor(...COLORS.primary)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, y + 1.8, MARGIN + 22, y + 1.8)
  return y + 8
}

function drawStatCards(
  doc: jsPDF,
  y: number,
  stats: { label: string; value: string; tone: RGB }[],
): number {
  const gap = 5
  const cardHeight = 20
  const cardWidth = (CONTENT_WIDTH - gap * (stats.length - 1)) / stats.length
  y = ensureSpace(doc, y, cardHeight + 4)

  stats.forEach((stat, index) => {
    const x = MARGIN + index * (cardWidth + gap)
    doc.setDrawColor(...COLORS.border)
    doc.setFillColor(...COLORS.panel)
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...stat.tone)
    doc.text(stat.value, x + 4, y + 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text(stat.label, x + 4, y + 16)
  })

  return y + cardHeight + 8
}

function drawBulletColumn(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  items: string[],
  toneColor: RGB,
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...toneColor)
  doc.text(title, x, y)
  let cursorY = y + 5.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.ink)

  if (items.length === 0) {
    doc.text('None recorded.', x, cursorY)
    cursorY += 4.6
  } else {
    items.forEach((item) => {
      const lines = doc.splitTextToSize(`• ${item}`, width)
      doc.text(lines, x, cursorY)
      cursorY += lines.length * 4.6
    })
  }

  return cursorY
}

export function buildReportPdf(report: Report): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const title = report.title || 'Skills Gap Analysis Report'

  // Header band
  const headerHeight = 30
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, PAGE_WIDTH, headerHeight, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  const titleLines = doc.splitTextToSize(title, CONTENT_WIDTH)
  doc.text(titleLines, MARGIN, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const metaLine = [
    report.graduate?.name ? `Graduate: ${report.graduate.name}` : null,
    report.graduate?.institution ? `Institution: ${report.graduate.institution}` : null,
    `Generated: ${formatDate(report.createdAt)}`,
  ]
    .filter(Boolean)
    .join('   |   ')
  doc.text(metaLine, MARGIN, headerHeight - 6)

  let y = headerHeight + 10

  // Executive summary
  y = sectionTitle(doc, 'Executive Summary', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COLORS.ink)
  const summaryLines = doc.splitTextToSize(
    report.summary || 'No summary available.',
    CONTENT_WIDTH,
  )
  y = ensureSpace(doc, y, summaryLines.length * 4.8 + 6)
  doc.text(summaryLines, MARGIN, y)
  y += summaryLines.length * 4.8 + 8

  // Headline stats
  const overallTone = gapTone(report.overallGapLevel).fg
  y = drawStatCards(doc, y, [
    { label: 'Overall Score', value: formatPercent(report.overallScore), tone: COLORS.primary },
    { label: 'Overall Gap Level', value: report.overallGapLevel || 'N/A', tone: overallTone },
    {
      label: 'Assessments Included',
      value: String(report.assessments?.length ?? 0),
      tone: COLORS.primary,
    },
  ])

  // Strengths / weaknesses
  const columnGap = 6
  const columnWidth = (CONTENT_WIDTH - columnGap) / 2
  const strengthsColumnX = MARGIN
  const weaknessesColumnX = MARGIN + columnWidth + columnGap
  const estimatedBulletHeight =
    Math.max(report.strengths?.length ?? 1, report.weaknesses?.length ?? 1) * 10 + 12
  y = ensureSpace(doc, y, estimatedBulletHeight)
  const strengthsEndY = drawBulletColumn(
    doc,
    strengthsColumnX,
    y,
    columnWidth,
    'Strengths',
    report.strengths || [],
    COLORS.success,
  )
  const weaknessesEndY = drawBulletColumn(
    doc,
    weaknessesColumnX,
    y,
    columnWidth,
    'Areas To Improve',
    report.weaknesses || [],
    COLORS.danger,
  )
  y = Math.max(strengthsEndY, weaknessesEndY) + 6

  // Competency results table
  y = sectionTitle(doc, 'Competency Results', y)
  const assessments = report.assessments || []
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Competency', 'Score', 'Benchmark', 'Gap', 'Gap Level', 'Assessor Comment']],
    body:
      assessments.length > 0
        ? assessments.map((assessment) => [
            assessment.competency?.code || '-',
            assessment.competency?.title || '-',
            formatPercent(assessment.scores?.finalScore),
            formatPercent(assessment.benchmarkScore),
            formatPercent(assessment.skillGap),
            assessment.gapLevel || '-',
            assessment.assessorComment || '-',
          ])
        : [['-', 'No assessment results found.', '-', '-', '-', '-', '-']],
    theme: 'grid',
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.4,
      textColor: COLORS.ink,
      lineColor: COLORS.border,
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLORS.panel },
    columnStyles: {
      1: { cellWidth: 34 },
      6: { cellWidth: 44 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const tone = gapTone(String(data.cell.raw))
        data.cell.styles.textColor = tone.fg
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  y = withLastAutoTableY(doc) + 10

  // Rubric breakdown table
  y = sectionTitle(doc, 'Rubric Breakdown (Defense Evidence)', y)
  const rubricBreakdown = report.rubricBreakdown || []
  autoTable(doc, {
    startY: y,
    head: [['Requirement', 'Score', 'Confidence', 'Evidence']],
    body:
      rubricBreakdown.length > 0
        ? rubricBreakdown.map((item) => [
            item.label || '-',
            String(item.score ?? '-'),
            item.confidence === 'estimated' ? 'Estimated' : 'Verified',
            item.explanation || '-',
          ])
        : [['-', '-', '-', 'No rubric breakdown available.']],
    theme: 'grid',
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8.5,
      cellPadding: 2.4,
      textColor: COLORS.ink,
      lineColor: COLORS.border,
      lineWidth: 0.15,
      overflow: 'linebreak',
    },
    headStyles: { fillColor: COLORS.primaryDark, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLORS.panel },
    columnStyles: {
      0: { cellWidth: 46 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
    },
  })
  y = withLastAutoTableY(doc) + 10

  // Final conclusion
  y = sectionTitle(doc, 'Final Conclusion', y)
  const conclusionText = report.finalConclusion || 'No final conclusion available.'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const conclusionLines = doc.splitTextToSize(conclusionText, CONTENT_WIDTH - 8)
  const conclusionBoxHeight = conclusionLines.length * 4.8 + 8
  y = ensureSpace(doc, y, conclusionBoxHeight)
  doc.setDrawColor(...COLORS.border)
  doc.setFillColor(...COLORS.panel)
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, conclusionBoxHeight, 2, 2, 'FD')
  doc.setTextColor(...COLORS.ink)
  doc.text(conclusionLines, MARGIN + 4, y + 6)

  // Footer on every page
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, FOOTER_Y, PAGE_WIDTH - MARGIN, FOOTER_Y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text('Competra - Competency Tracking & Assessment Platform', MARGIN, FOOTER_Y + 5)
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, FOOTER_Y + 5, {
      align: 'right',
    })
  }

  return doc
}

export function downloadReportPdf(report: Report) {
  const doc = buildReportPdf(report)
  const fileName = `${(report.title || 'skills-gap-report')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase()}.pdf`
  doc.save(fileName)
}
