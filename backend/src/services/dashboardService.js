import User from '../models/User.js';
import Competency from '../models/Competency.js';
import Assessment from '../models/Assessment.js';
import Recommendation from '../models/Recommendation.js';
import { summarizeAssessments } from './gapAnalysisService.js';
import { ROLES, LEARNER_ROLES } from '../constants/roles.js';

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

export async function getAdminDashboard(user) {
  const organizationFilter =
    user.role === ROLES.ORGANIZATION_ADMIN
      ? { organization: user.organization?._id || user.organization }
      : {};
  const [
    totalGraduates,
    totalOrganizationUsers,
    totalOrganizationAdmins,
    totalAdmins,
    totalCompetencies,
    reviewedAssessments,
  ] = await Promise.all([
    User.countDocuments({ role: { $in: LEARNER_ROLES }, ...organizationFilter }),
    User.countDocuments({ role: ROLES.ORGANIZATION_USER, ...organizationFilter }),
    User.countDocuments({ role: ROLES.ORGANIZATION_ADMIN, ...organizationFilter }),
    User.countDocuments({ role: ROLES.ADMIN }),
    Competency.countDocuments({ isActive: true }),
    Assessment.find({ status: 'reviewed', ...organizationFilter }),
  ]);

  const summary = summarizeAssessments(reviewedAssessments);
  const gapDistribution = reviewedAssessments.reduce((distribution, item) => {
    distribution[item.gapLevel] = (distribution[item.gapLevel] || 0) + 1;
    return distribution;
  }, {});

  return {
    totalGraduates,
    totalOrganizationUsers,
    totalOrganizationAdmins,
    totalAdmins,
    totalCompetencies,
    averageSkillGap: summary.averageGap,
    overallGapLevel: summary.overallGapLevel,
    gapDistribution,
  };
}
