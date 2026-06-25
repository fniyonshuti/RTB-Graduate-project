import User from '../models/User.js';
import Competency from '../models/Competency.js';
import Assessment from '../models/Assessment.js';
import Recommendation from '../models/Recommendation.js';
import { summarizeAssessments } from './gapAnalysisService.js';

export async function getGraduateDashboard(userId) {
  const assessments = await Assessment.find({ graduate: userId }).populate(
    'competency',
    'title code category'
  );
  const reviewedAssessments = assessments.filter(
    (assessment) => assessment.status === 'reviewed'
  );
  const summary = summarizeAssessments(reviewedAssessments);
  const highGapCount = reviewedAssessments.filter(
    (assessment) => assessment.gapLevel === 'High Gap'
  ).length;
  const latestRecommendations = await Recommendation.find({ graduate: userId })
    .populate('competency', 'title code')
    .sort({ createdAt: -1 })
    .limit(5);

  return {
    ...summary,
    assessmentsSubmitted: assessments.length,
    competenciesAssessed: reviewedAssessments.length,
    highGapCount,
    recentAssessments: assessments.slice(0, 5),
    latestRecommendations,
  };
}

export async function getAssessorDashboard() {
  const [pendingReviews, reviewedAssessments, highGapCases] = await Promise.all([
    Assessment.countDocuments({ status: { $in: ['submitted', 'under_review'] } }),
    Assessment.countDocuments({ status: 'reviewed' }),
    Assessment.countDocuments({ gapLevel: 'High Gap' }),
  ]);

  const recentSubmissions = await Assessment.find({
    status: { $in: ['submitted', 'under_review'] },
  })
    .populate('graduate', 'name institution')
    .populate('competency', 'title code')
    .sort({ createdAt: -1 })
    .limit(5);

  return {
    pendingReviews,
    reviewedAssessments,
    highGapCases,
    recentSubmissions,
  };
}

export async function getAdminDashboard() {
  const [
    totalGraduates,
    totalAssessors,
    totalCompetencies,
    reviewedAssessments,
  ] = await Promise.all([
    User.countDocuments({ role: 'graduate' }),
    User.countDocuments({ role: 'assessor' }),
    Competency.countDocuments({ isActive: true }),
    Assessment.find({ status: 'reviewed' }),
  ]);

  const summary = summarizeAssessments(reviewedAssessments);
  const gapDistribution = reviewedAssessments.reduce((distribution, item) => {
    distribution[item.gapLevel] = (distribution[item.gapLevel] || 0) + 1;
    return distribution;
  }, {});

  return {
    totalGraduates,
    totalAssessors,
    totalCompetencies,
    averageSkillGap: summary.averageGap,
    overallGapLevel: summary.overallGapLevel,
    gapDistribution,
  };
}
