export const SCORE_WEIGHTS = {
  practicalTask: 0.5,
  quiz: 0.2,
  portfolio: 0.2,
  selfAssessment: 0.1,
};

function isValidScore(score) {
  return typeof score === 'number' && score >= 0 && score <= 100;
}

function normalizeScore(score) {
  const numberScore = Number(score);
  return Number.isFinite(numberScore) ? numberScore : null;
}

export function validateScoreInputs(scores) {
  const normalizedScores = {
    practicalTaskScore: normalizeScore(scores.practicalTaskScore),
    quizScore: normalizeScore(scores.quizScore),
    portfolioScore: normalizeScore(scores.portfolioScore),
    selfAssessmentScore: normalizeScore(scores.selfAssessmentScore),
  };

  const invalidField = Object.entries(normalizedScores).find(
    ([, score]) => !isValidScore(score)
  );

  if (invalidField) {
    return {
      isValid: false,
      field: invalidField[0],
    };
  }

  return {
    isValid: true,
    scores: normalizedScores,
  };
}

export function calculateWeightedScore(scores) {
  const validation = validateScoreInputs(scores);

  if (!validation.isValid) {
    throw new Error(`${validation.field} must be a number between 0 and 100`);
  }

  const finalScore =
    validation.scores.practicalTaskScore * SCORE_WEIGHTS.practicalTask +
    validation.scores.quizScore * SCORE_WEIGHTS.quiz +
    validation.scores.portfolioScore * SCORE_WEIGHTS.portfolio +
    validation.scores.selfAssessmentScore * SCORE_WEIGHTS.selfAssessment;

  return Math.round(finalScore * 100) / 100;
}
