import Assessment from '../models/Assessment.js';
import Recommendation from '../models/Recommendation.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { AppError } from '../utils/errors.js';
import { summarizeAssessments } from './gapAnalysisService.js';

function organizationIdOf(user) {
  return user?.organization?._id || user?.organization;
}

function assertSameOrganization(user, resourceOrganization) {
  if (
    user.role === 'org_admin' &&
    String(resourceOrganization || '') !== String(organizationIdOf(user) || '')
  ) {
    throw new AppError('You can only manage reports for your organization', 403);
  }
}

export async function generateGraduateReport(graduateId, generatedBy) {
  const graduate = await User.findById(graduateId);

  if (!graduate || graduate.role !== 'graduate') {
    throw new AppError('Graduate was not found', 404);
  }

  assertSameOrganization(generatedBy, graduate.organization);

  const assessments = await Assessment.find({
    graduate: graduateId,
    status: 'reviewed',
  }).populate('competency', 'title code category');

  if (assessments.length === 0) {
    throw new AppError('No reviewed assessments found for this graduate', 400);
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
  const query =
    user.role === 'graduate'
      ? { graduate: user._id }
      : user.role === 'org_admin'
        ? { organization: organizationIdOf(user) }
        : {};

  return Report.find(query)
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
  const query =
    user.role === 'graduate'
      ? { _id: reportId, graduate: user._id }
      : user.role === 'org_admin'
        ? { _id: reportId, organization: organizationIdOf(user) }
        : { _id: reportId };
  const report = await Report.findOne(query)
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
  const allowedUpdates = ['title', 'summary', 'strengths', 'weaknesses'];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  const query =
    user.role === 'org_admin'
      ? { _id: reportId, organization: organizationIdOf(user) }
      : { _id: reportId };

  const report = await Report.findOneAndUpdate(query, updates, {
    new: true,
    runValidators: true,
  }).populate('graduate', 'name email institution');

  if (!report) {
    throw new AppError('Report was not found', 404);
  }

  return report;
}

export async function deleteReportForUser(reportId, user) {
  const query =
    user.role === 'graduate'
      ? { _id: reportId, graduate: user._id }
      : user.role === 'org_admin'
        ? { _id: reportId, organization: organizationIdOf(user) }
        : { _id: reportId };
  const report = await Report.findOneAndDelete(query);

  if (!report) {
    throw new AppError('Report was not found', 404);
  }

  return report;
}
