import User from '../models/User.js';
import Competency from '../models/Competency.js';
import Assessment from '../models/Assessment.js';
import Recommendation from '../models/Recommendation.js';
import Benchmark from '../models/Benchmark.js';
import { summarizeAssessments } from './gapAnalysisService.js';
import { ROLES, LEARNER_ROLES, USER_ROLE_VALUES, displayRole } from '../constants/roles.js';

function countBy(items, getKey) {
  return items.reduce((summary, item) => {
    const key = getKey(item);
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {});
}

function assessmentStatusDistribution(assessments) {
  return Object.entries(countBy(assessments, (assessment) => assessment.status)).map(
    ([name, value]) => ({ name, value }),
  );
}

function gapDistribution(assessments) {
  return countBy(assessments, (assessment) => assessment.gapLevel);
}

function competencyScoreChart(assessments) {
  return assessments
    .filter((assessment) => assessment.status === 'reviewed')
    .reduce((summary, assessment) => {
      const competencyName =
        assessment.competency?.code ||
        assessment.competency?.title ||
        'Competency';
      const existing = summary.find((item) => item.name === competencyName);

      if (existing) {
        existing.totalScore += Number(assessment.scores?.finalScore || 0);
        existing.totalGap += Number(assessment.skillGap || 0);
        existing.count += 1;
      } else {
        summary.push({
          name: competencyName,
          totalScore: Number(assessment.scores?.finalScore || 0),
          totalGap: Number(assessment.skillGap || 0),
          count: 1,
        });
      }

      return summary;
    }, [])
    .map((item) => ({
      name: item.name,
      score: Math.round((item.totalScore / item.count) * 100) / 100,
      gap: Math.round((item.totalGap / item.count) * 100) / 100,
    }))
    .sort((a, b) => b.score - a.score);
}

async function roleDistributionChart(organizationFilter) {
  const roleCounts = await Promise.all(
    USER_ROLE_VALUES.map(async (role) => ({
      role,
      name: displayRole(role),
      value: await User.countDocuments({ role, ...organizationFilter }),
    })),
  );

  return roleCounts.filter((item) => item.value > 0);
}

export async function getGraduateDashboard(userId) {
  const assessments = await Assessment.find({ graduate: userId })
    .populate('competency', 'title code category')
    .sort({ createdAt: -1 });
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
    assessmentStatusDistribution: assessmentStatusDistribution(assessments),
    reviewedCompetencyScores: competencyScoreChart(reviewedAssessments),
    skillGapByCompetency: competencyScoreChart(reviewedAssessments),
    latestRecommendations,
  };
}

export async function getAdminDashboard(user) {
  const isOrganizationScoped = user.role === ROLES.ORGANIZATION_ADMIN;
  const organizationFilter =
    isOrganizationScoped
      ? { organization: user.organization?._id || user.organization }
      : {};
  const [
    totalGraduates,
    totalOrganizationUsers,
    totalOrganizationAdmins,
    totalAdmins,
    totalCompetencies,
    activeBenchmarkCompetencyIds,
    roleDistribution,
    allAssessments,
    reviewedAssessments,
  ] = await Promise.all([
    User.countDocuments({ role: { $in: LEARNER_ROLES }, ...organizationFilter }),
    User.countDocuments({ role: ROLES.ORGANIZATION_USER, ...organizationFilter }),
    User.countDocuments({ role: ROLES.ORGANIZATION_ADMIN, ...organizationFilter }),
    isOrganizationScoped
      ? Promise.resolve(0)
      : User.countDocuments({ role: ROLES.ADMIN }),
    Competency.countDocuments({ isActive: true }),
    Benchmark.distinct('competency', { isActive: true }),
    roleDistributionChart(organizationFilter),
    Assessment.find({ ...organizationFilter }).populate('competency', 'title code category'),
    Assessment.find({ status: 'reviewed', ...organizationFilter }).populate(
      'competency',
      'title code category',
    ),
  ]);

  const summary = summarizeAssessments(reviewedAssessments);
  const benchmarkedCompetencies = activeBenchmarkCompetencyIds.length;

  return {
    scope: isOrganizationScoped ? 'organization' : 'system',
    organization: isOrganizationScoped ? user.organization : undefined,
    totalGraduates,
    totalOrganizationUsers,
    totalOrganizationAdmins,
    totalAdmins,
    totalCompetencies,
    roleDistribution,
    averageSkillGap: summary.averageGap,
    overallGapLevel: summary.overallGapLevel,
    gapDistribution: gapDistribution(reviewedAssessments),
    assessmentStatusDistribution: assessmentStatusDistribution(allAssessments),
    scoreByCompetency: competencyScoreChart(reviewedAssessments),
    benchmarkCoverage: [
      { name: 'With benchmark', count: benchmarkedCompetencies },
      {
        name: 'Missing benchmark',
        count: Math.max(totalCompetencies - benchmarkedCompetencies, 0),
      },
    ],
  };
}
