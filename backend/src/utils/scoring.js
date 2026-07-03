export const SCORE_WEIGHTS = {
  practicalTask: 0.7,
  quiz: 0.3,
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
    validation.scores.quizScore * SCORE_WEIGHTS.quiz;

  return Math.round(finalScore * 100) / 100;
}
