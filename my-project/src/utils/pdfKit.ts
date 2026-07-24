import type jsPDF from 'jspdf'

export type RGB = [number, number, number]

export const COLORS = {
  primary: [0, 119, 182] as RGB,
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

export const PAGE_WIDTH = 210
export const PAGE_HEIGHT = 297
export const MARGIN = 14
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
export const FOOTER_Y = PAGE_HEIGHT - 14

export function gapTone(level: string | undefined): { fg: RGB; bg: RGB } {
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

export function withLastAutoTableY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? MARGIN
}

export function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 4) {
    doc.addPage()
    return MARGIN
  }
  return y
}

export function sectionTitle(doc: jsPDF, text: string, y: number): number {
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

export function drawHeaderBand(
  doc: jsPDF,
  title: string,
  metaParts: (string | null | undefined | false)[],
): number {
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
  doc.text(metaParts.filter(Boolean).join('   |   '), MARGIN, headerHeight - 6)
  return headerHeight + 10
}

export function drawStatCards(
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

export function drawInsightList(
  doc: jsPDF,
  y: number,
  title: string,
  toneColor: RGB,
  toneBg: RGB,
  entries: { heading: string; detail: string }[],
  emptyText: string,
): number {
  y = sectionTitle(doc, title, y)

  if (entries.length === 0) {
    y = ensureSpace(doc, y, 8)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLORS.muted)
    doc.text(emptyText, MARGIN, y)
    return y + 8
  }

  entries.forEach((entry) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const detailLines = doc.splitTextToSize(entry.detail, CONTENT_WIDTH - 12)
    const blockHeight = detailLines.length * 4.3 + 11
    y = ensureSpace(doc, y, blockHeight)

    doc.setFillColor(...toneBg)
    doc.setDrawColor(...COLORS.border)
    doc.roundedRect(MARGIN, y - 4.5, CONTENT_WIDTH, blockHeight - 2, 1.5, 1.5, 'FD')
    doc.setFillColor(...toneColor)
    doc.circle(MARGIN + 4, y - 0.5, 1.1, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...COLORS.ink)
    doc.text(entry.heading, MARGIN + 8, y)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.muted)
    doc.text(detailLines, MARGIN + 8, y + 4.6)

    y += blockHeight + 4
  })

  return y + 2
}

export function drawFooter(doc: jsPDF, brandLine: string): void {
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...COLORS.border)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, FOOTER_Y, PAGE_WIDTH - MARGIN, FOOTER_Y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text(brandLine, MARGIN, FOOTER_Y + 5)
    doc.text(`Page ${page} of ${pageCount}`, PAGE_WIDTH - MARGIN, FOOTER_Y + 5, {
      align: 'right',
    })
  }
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
}
