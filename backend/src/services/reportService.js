import Assessment from '../models/Assessment.js';
import Recommendation from '../models/Recommendation.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { AppError } from '../utils/errors.js';
import { summarizeAssessments } from './gapAnalysisService.js';

export async function generateGraduateReport(graduateId, generatedBy) {
  const graduate = await User.findById(graduateId);

  if (!graduate || graduate.role !== 'graduate') {
    throw new AppError('Graduate was not found', 404);
  }

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
    generatedBy,
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
  const query = user.role === 'graduate' ? { graduate: user._id } : {};

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
