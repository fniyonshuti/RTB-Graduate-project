export function calculateSkillGap(benchmarkScore, finalScore) {
  const gap = Number(benchmarkScore) - Number(finalScore);
  return Math.max(Math.round(gap * 100) / 100, 0);
}

export function classifyGap(skillGap) {
  if (skillGap === 0) return 'No Gap';
  if (skillGap <= 5) return 'Very Low Gap';
  if (skillGap <= 15) return 'Low Gap';
  if (skillGap <= 25) return 'Moderate Gap';
  return 'High Gap';
}

export function getPriorityFromGap(gapLevel) {
  if (gapLevel === 'High Gap') return 'high';
  if (gapLevel === 'Moderate Gap') return 'medium';
  return 'low';
}
