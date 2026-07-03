import Assessment from '../models/Assessment.js';
import Recommendation from '../models/Recommendation.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { AppError } from '../utils/errors.js';
import { summarizeAssessments } from './gapAnalysisService.js';
import { isLearnerRole } from '../constants/roles.js';

export async function generateGraduateReport(graduateId, generatedBy) {
  const graduate = await User.findById(graduateId);

  if (!graduate || !isLearnerRole(graduate.role)) {
    throw new AppError('Assessment user was not found', 404);
  }

  if (
    generatedBy &&
    isLearnerRole(generatedBy.role) &&
    String(generatedBy._id) !== String(graduate._id)
  ) {
    throw new AppError('You can only generate your own report', 403);
  }

  const assessments = await Assessment.find({
    graduate: graduateId,
    status: 'reviewed',
  })
    .populate('competency', 'title code category')
    .sort({ reviewedAt: -1, createdAt: -1 });

  if (assessments.length === 0) {
    throw new AppError('No completed assessments found for this user', 400);
  }

  const recommendations = await Recommendation.find({ graduate: graduateId });
  const summary = summarizeAssessments(assessments);
  const strengths = assessments
    .filter((assessment) => assessment.gapLevel === 'No Gap')
    .map((assessment) => assessment.competency.title);
  const weaknesses = assessments
    .filter((assessment) =>
      ['Moderate Gap', 'High Gap'].includes(assessment.gapLevel)
    )
    .map((assessment) => assessment.competency.title);
  const latestAssessment = assessments[0];
  const repositoryTaskReview = latestAssessment?.evidence?.repositorySummary?.taskReview;
  const rubricBreakdown =
    repositoryTaskReview?.checklist?.map((item) => ({
      label: item.label,
      score: item.passed ? item.weight : 0,
      explanation: item.passed
        ? item.evidence || 'Requirement passed.'
        : item.advice || item.evidence || 'Requirement needs improvement.',
    })) || [];

  const report = await Report.create({
    graduate: graduateId,
    generatedBy: generatedBy._id,
    organization: graduate.organization,
    title: `${graduate.name} Skills Gap Analysis Report`,
    summary: `Overall score: ${summary.overallScore}%. Average skill gap: ${summary.averageGap}%.`,
    assessments: assessments.map((assessment) => assessment._id),
    overallScore: summary.overallScore,
    overallGapLevel: summary.overallGapLevel,
    strengths,
    weaknesses,
    recommendations: recommendations.map((recommendation) => recommendation._id),
    repositoryAnalysisSummary:
      latestAssessment?.evidence?.repositorySummary?.summaryText ||
      repositoryTaskReview?.summary ||
      'Repository analysis summary was not available.',
    rubricBreakdown,
    finalConclusion:
      summary.overallGapLevel === 'No Gap'
        ? 'The user currently meets the RTB benchmark for the completed assessment evidence.'
        : `The user has a ${summary.overallGapLevel}. Follow the recommendations and resubmit improved repository evidence.`,
  });

  await Notification.create({
    recipient: graduateId,
    title: 'Report Generated',
    message: 'Your skills gap analysis report is ready.',
    type: 'report',
    link: '/graduate/reports',
  });

  return Report.findById(report._id)
    .populate('graduate', 'name email institution')
    .populate('generatedBy', 'name email role')
    .populate({
      path: 'assessments',
      populate: {
        path: 'competency',
        select: 'title code category',
      },
    })
    .populate({
      path: 'recommendations',
      populate: {
        path: 'competency',
        select: 'title code category',
      },
    });
}

export async function listReportsForUser(user) {
  if (!isLearnerRole(user.role)) {
    throw new AppError('Only assessment users can access reports', 403);
  }

  return Report.find({ graduate: user._id })
    .populate('graduate', 'name email institution')
    .populate('generatedBy', 'name email role')
    .populate({
      path: 'assessments',
      populate: {
        path: 'competency',
        select: 'title code category',
      },
    })
    .populate({
      path: 'recommendations',
      populate: {
        path: 'competency',
        select: 'title code category',
      },
    })
    .sort({ createdAt: -1 });
}

export async function getReportForUser(reportId, user) {
  if (!isLearnerRole(user.role)) {
    throw new AppError('Only assessment users can access reports', 403);
  }

  const report = await Report.findOne({ _id: reportId, graduate: user._id })
    .populate('graduate', 'name email institution')
    .populate('generatedBy', 'name email role')
    .populate({
      path: 'assessments',
      populate: {
        path: 'competency',
        select: 'title code category',
      },
    })
    .populate({
      path: 'recommendations',
      populate: {
        path: 'competency',
        select: 'title code category',
      },
    });

  if (!report) {
    throw new AppError('Report was not found', 404);
  }

  return report;
}

export async function updateReportById(reportId, payload, user) {
  if (!isLearnerRole(user.role)) {
    throw new AppError('Only assessment users can access reports', 403);
  }

  const allowedUpdates = ['title', 'summary', 'strengths', 'weaknesses'];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  const report = await Report.findOneAndUpdate({ _id: reportId, graduate: user._id }, updates, {
    new: true,
    runValidators: true,
  }).populate('graduate', 'name email institution');

  if (!report) {
    throw new AppError('Report was not found', 404);
  }

  return report;
}

export async function deleteReportForUser(reportId, user) {
  if (!isLearnerRole(user.role)) {
    throw new AppError('Only assessment users can access reports', 403);
  }

  const report = await Report.findOneAndDelete({ _id: reportId, graduate: user._id });

  if (!report) {
    throw new AppError('Report was not found', 404);
  }

  return report;
}
