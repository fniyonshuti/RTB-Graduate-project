import type { GapLevel } from '../types'

export const gapLevelStyles: Record<GapLevel, string> = {
  'No Gap': 'gap-no',
  'Very Low Gap': 'gap-very-low',
  'Low Gap': 'gap-low',
  'Moderate Gap': 'gap-moderate',
  'High Gap': 'gap-high',
  'Not Reviewed': 'gap-neutral',
}

export function formatPercent(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return 'N/A'
  return `${Math.round(value * 100) / 100}%`
}

export function formatDate(value: string | undefined) {
  if (!value) return 'N/A'
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function readableStatus(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
