import { calculateWeightedScore, validateScoreInputs } from '../utils/scoring.js';
import { calculateSkillGap, classifyGap } from '../utils/gapClassifier.js';
import { AppError } from '../utils/errors.js';

export function analyzeCompetency(scores, benchmarkScore) {
  const validation = validateScoreInputs(scores);

  if (!validation.isValid) {
    throw new AppError(`${validation.field} must be a number between 0 and 100`, 400);
  }

  const benchmark = Number(benchmarkScore);

  if (!Number.isFinite(benchmark) || benchmark < 0 || benchmark > 100) {
    throw new AppError('Benchmark score must be a number between 0 and 100', 400);
  }

  const finalScore = calculateWeightedScore(validation.scores);
  const skillGap = calculateSkillGap(benchmark, finalScore);
  const gapLevel = classifyGap(skillGap);

  return {
    scores: {
      ...validation.scores,
      finalScore,
    },
    benchmarkScore: benchmark,
    skillGap,
    gapLevel,
  };
}

export function summarizeAssessments(assessments) {
  const reviewed = assessments.filter((assessment) => assessment.status === 'reviewed');

  if (reviewed.length === 0) {
    return {
      overallScore: 0,
      averageGap: 0,
      overallGapLevel: 'Not Available',
    };
  }

  const totalScore = reviewed.reduce(
    (sum, assessment) => sum + (assessment.scores.finalScore || 0),
    0
  );
  const totalGap = reviewed.reduce(
    (sum, assessment) => sum + (assessment.skillGap || 0),
    0
  );
  const averageGap = Math.round((totalGap / reviewed.length) * 100) / 100;

  return {
    overallScore: Math.round((totalScore / reviewed.length) * 100) / 100,
    averageGap,
    overallGapLevel: classifyGap(averageGap),
  };
}
