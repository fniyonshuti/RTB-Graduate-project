import { describe, expect, it } from 'vitest'
import { formatDate, formatPercent, readableStatus } from '../../src/utils/gapLevels'

describe('gap level formatting utilities', () => {
  it('formats percentages without losing decimal precision', () => {
    expect(formatPercent(87.456)).toBe('87.46%')
    expect(formatPercent(70)).toBe('70%')
  })

  it('returns N/A for missing or invalid percentages', () => {
    expect(formatPercent(undefined)).toBe('N/A')
    expect(formatPercent(Number.NaN)).toBe('N/A')
  })

  it('formats ISO dates for display', () => {
    expect(formatDate('2026-07-01T12:00:00.000Z')).toBe('Jul 1, 2026')
  })

  it('converts API status keys into readable text', () => {
    expect(readableStatus('pending_review')).toBe('Pending Review')
  })
})
