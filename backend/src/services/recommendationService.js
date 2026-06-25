import Recommendation from '../models/Recommendation.js';
import { getPriorityFromGap } from '../utils/gapClassifier.js';

export function generateDefaultRecommendation(competencyTitle, gapLevel) {
  if (gapLevel === 'No Gap') {
    return `You have met the RTB benchmark for ${competencyTitle}. Continue building advanced practical projects to maintain your strength.`;
  }

  if (gapLevel === 'Low Gap') {
    return `You are close to the RTB benchmark for ${competencyTitle}. Review the weak areas and complete additional practice tasks.`;
  }

  if (gapLevel === 'Moderate Gap') {
    return `You need targeted improvement in ${competencyTitle}. Complete practical exercises, request feedback, and repeat the assessment after practice.`;
  }

  return `You need intensive support in ${competencyTitle}. Start with foundational practice, guided lab work, and close assessor follow-up.`;
}

export async function upsertAssessmentRecommendation({
  assessment,
  competency,
  assessorId,
  recommendation = {},
}) {
  const message =
    recommendation.message ||
    generateDefaultRecommendation(competency.title, assessment.gapLevel);

  const priority =
    recommendation.priority || getPriorityFromGap(assessment.gapLevel);

  return Recommendation.findOneAndUpdate(
    { assessment: assessment._id },
    {
      assessment: assessment._id,
      graduate: assessment.graduate,
      competency: assessment.competency,
      assessor: assessorId,
      gapLevel: assessment.gapLevel,
      message,
      actionItems: recommendation.actionItems || [],
      resources: recommendation.resources || [],
      priority,
    },
    { new: true, upsert: true, runValidators: true }
  );
}
