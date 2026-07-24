import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import type { OrganizationUserPerformance } from '../types'
import { formatDate, formatPercent } from './gapLevels'
import {
  COLORS,
  MARGIN,
  drawFooter,
  drawHeaderBand,
  drawStatCards,
  gapTone,
  sanitizeFileName,
  sectionTitle,
  withLastAutoTableY,
} from './pdfKit'

const NEEDS_SUPPORT_GAP_LEVELS = new Set(['Moderate Gap', 'High Gap'])

function exportFileBaseName(organizationName?: string) {
  return sanitizeFileName(`${organizationName || 'organization'}-user-performance`)
}

export function buildOrganizationPerformancePdf(
  rows: OrganizationUserPerformance[],
  organizationName?: string,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const generatedAt = new Date().toISOString()

  let y = drawHeaderBand(doc, 'Organization User Performance Report', [
    organizationName ? `Organization: ${organizationName}` : null,
    `Generated: ${formatDate(generatedAt)}`,
  ])

  const scoredRows = rows.filter((row) => row.averageScore !== undefined)
  const averageScore =
    scoredRows.length > 0
      ? scoredRows.reduce((sum, row) => sum + (row.averageScore || 0), 0) / scoredRows.length
      : undefined
  const needsSupportCount = rows.filter((row) => NEEDS_SUPPORT_GAP_LEVELS.has(row.gapLevel)).length

  y = drawStatCards(doc, y, [
    { label: 'Users', value: String(rows.length), tone: COLORS.primary },
    {
      label: 'Average Score',
      value: averageScore !== undefined ? formatPercent(averageScore) : 'N/A',
      tone: COLORS.primary,
    },
    {
      label: 'Users Needing Support',
      value: String(needsSupportCount),
      tone: needsSupportCount > 0 ? COLORS.danger : COLORS.success,
    },
  ])

  y = sectionTitle(doc, 'User Performance', y)
  autoTable(doc, {
    startY: y,
    head: [['Name', 'Email', 'Assessments', 'Reviewed', 'Average Score', 'Gap Level', 'Last Activity']],
    body:
      rows.length > 0
        ? rows.map((row) => [
            row.name || '-',
            row.email || '-',
            String(row.assessmentsCount),
            String(row.reviewedCount),
            row.averageScore !== undefined ? formatPercent(row.averageScore) : 'N/A',
            row.gapLevel,
            row.lastActivity ? formatDate(row.lastActivity) : 'N/A',
          ])
        : [['-', 'No organization users found.', '-', '-', '-', '-', '-']],
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
      1: { cellWidth: 46 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const tone = gapTone(String(data.cell.raw))
        data.cell.styles.textColor = tone.fg
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  withLastAutoTableY(doc)

  drawFooter(doc, 'Competra - Competency Tracking & Assessment Platform')

  return doc
}

export function downloadOrganizationPerformancePdf(
  rows: OrganizationUserPerformance[],
  organizationName?: string,
) {
  const doc = buildOrganizationPerformancePdf(rows, organizationName)
  doc.save(`${exportFileBaseName(organizationName)}.pdf`)
}

export function downloadOrganizationPerformanceExcel(
  rows: OrganizationUserPerformance[],
  organizationName?: string,
) {
  const worksheetData = rows.map((row) => ({
    Name: row.name,
    Email: row.email,
    Assessments: row.assessmentsCount,
    Reviewed: row.reviewedCount,
    'Average Score (%)': row.averageScore !== undefined ? Math.round(row.averageScore * 100) / 100 : 'N/A',
    'Gap Level': row.gapLevel,
    'Last Activity': row.lastActivity ? formatDate(row.lastActivity) : 'N/A',
  }))

  const worksheet = XLSX.utils.json_to_sheet(worksheetData)
  worksheet['!cols'] = [
    { wch: 24 },
    { wch: 30 },
    { wch: 13 },
    { wch: 11 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Performance')
  XLSX.writeFile(workbook, `${exportFileBaseName(organizationName)}.xlsx`)
}
