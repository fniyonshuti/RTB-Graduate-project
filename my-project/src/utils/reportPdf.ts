import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Assessment, Report } from '../types'
import { formatDate, formatPercent } from './gapLevels'
import {
  COLORS,
  CONTENT_WIDTH,
  MARGIN,
  drawFooter,
  drawHeaderBand,
  drawInsightList,
  drawStatCards,
  ensureSpace,
  gapTone,
  sanitizeFileName,
  sectionTitle,
  withLastAutoTableY,
} from './pdfKit'

const STRONG_GAP_LEVELS = new Set(['No Gap', 'Very Low Gap'])

function competencyRecommendation(report: Report, assessment: Assessment) {
  return (report.recommendations || []).find(
    (recommendation) => recommendation.competency?._id === assessment.competency?._id,
  )
}

export function buildReportPdf(report: Report): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const title = report.title || 'Skills Gap Analysis Report'

  let y = drawHeaderBand(doc, title, [
    report.graduate?.name ? `Graduate: ${report.graduate.name}` : null,
    report.graduate?.institution ? `Institution: ${report.graduate.institution}` : null,
    `Generated: ${formatDate(report.createdAt)}`,
  ])

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

  const assessments = report.assessments || []
  const strongAssessments = assessments.filter(
    (assessment) => assessment.gapLevel && STRONG_GAP_LEVELS.has(assessment.gapLevel),
  )
  const weakAssessments = assessments.filter(
    (assessment) => assessment.gapLevel && !STRONG_GAP_LEVELS.has(assessment.gapLevel),
  )

  // Strengths
  y = drawInsightList(
    doc,
    y,
    'Strengths',
    COLORS.success,
    COLORS.successBg,
    strongAssessments.map((assessment) => ({
      heading: `${assessment.competency?.title || 'Competency'}  -  ${formatPercent(assessment.scores?.finalScore)}`,
      detail:
        competencyRecommendation(report, assessment)?.message ||
        `Meets the RTB benchmark of ${formatPercent(assessment.benchmarkScore)} with no significant skill gap. Consistent, reliable performance in this competency.`,
    })),
    'No standout strengths recorded yet.',
  )

  // Areas to improve
  y = drawInsightList(
    doc,
    y,
    'Areas To Improve',
    COLORS.danger,
    COLORS.dangerBg,
    weakAssessments.map((assessment) => ({
      heading: `${assessment.competency?.title || 'Competency'}  -  ${assessment.gapLevel || 'Gap identified'}`,
      detail:
        competencyRecommendation(report, assessment)?.message ||
        `Score of ${formatPercent(assessment.scores?.finalScore)} falls short of the ${formatPercent(assessment.benchmarkScore)} RTB benchmark. Review the recommended learning resources and resubmit improved evidence.`,
    })),
    'No improvement areas recorded - great work across every assessed competency.',
  )

  // Competency results table
  y = sectionTitle(doc, 'Competency Results', y)
  autoTable(doc, {
    startY: y,
    head: [['Code', 'Competency', 'Score', 'Benchmark', 'Gap', 'Gap Level', 'Recommendation']],
    body:
      assessments.length > 0
        ? assessments.map((assessment) => [
            assessment.competency?.code || '-',
            assessment.competency?.title || '-',
            formatPercent(assessment.scores?.finalScore),
            formatPercent(assessment.benchmarkScore),
            formatPercent(assessment.skillGap),
            assessment.gapLevel || '-',
            competencyRecommendation(report, assessment)?.message || 'No recommendation needed.',
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

  drawFooter(doc, 'Competra - Competency Tracking & Assessment Platform')

  return doc
}

export function downloadReportPdf(report: Report) {
  const doc = buildReportPdf(report)
  doc.save(`${sanitizeFileName(report.title || 'skills-gap-report')}.pdf`)
}
