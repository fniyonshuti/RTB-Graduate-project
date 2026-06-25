import Assessment from '../models/Assessment.js';
import Benchmark from '../models/Benchmark.js';
import Competency from '../models/Competency.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { analyzeCompetency } from './gapAnalysisService.js';
import { upsertAssessmentRecommendation } from './recommendationService.js';

function populateAssessment(query) {
  return query
    .populate('graduate', 'name email institution role')
    .populate('assessor', 'name email institution role')
    .populate(
      'competency',
      'title code category description expectedEvidence practicalTasks theoryQuestions portfolioRequirements rubricCriteria'
    );
}

function hideCorrectAnswersFromAssessment(assessment) {
  const data = assessment.toObject ? assessment.toObject() : assessment;

  if (data.competency?.theoryQuestions) {
    data.competency.theoryQuestions = data.competency.theoryQuestions.map((question) => {
      const { correctAnswer, ...safeQuestion } = question;
      return safeQuestion;
    });
  }

  return data;
}

function normalizeAnswer(value = '') {
  return String(value).trim().toLowerCase();
}

function calculateTheoryResult(competency, submittedAnswers = []) {
  const questions = competency.theoryQuestions || [];
  const totalPoints = questions.reduce((sum, question) => sum + question.points, 0);

  if (questions.length === 0 || totalPoints === 0) {
    return {
      quizScore: 0,
      theoryAnswers: [],
      quizAnswers: '',
    };
  }

  const theoryAnswers = questions.map((question) => {
    const submitted = submittedAnswers.find(
      (answer) => String(answer.questionId) === String(question._id)
    );
    const answerText = submitted?.answer || '';
    const isObjective = question.type === 'multiple_choice' && question.correctAnswer;
    const isCorrect =
      isObjective &&
      normalizeAnswer(answerText) === normalizeAnswer(question.correctAnswer);
    const pointsAwarded = isCorrect ? question.points : 0;

    return {
      questionId: question._id,
      question: question.question,
      answer: answerText,
      correctAnswer: question.correctAnswer,
      isCorrect: isObjective ? isCorrect : undefined,
      pointsAwarded,
      pointsPossible: question.points,
    };
  });

  const awardedPoints = theoryAnswers.reduce(
    (sum, answer) => sum + answer.pointsAwarded,
    0
  );

  return {
    quizScore: Math.round((awardedPoints / totalPoints) * 10000) / 100,
    theoryAnswers,
    quizAnswers: theoryAnswers
      .map((answer) => `${answer.question}: ${answer.answer || 'No answer'}`)
      .join('\n'),
  };
}

export async function submitAssessment(graduateId, payload) {
  const competency = await Competency.findById(payload.competency);

  if (!competency || !competency.isActive) {
    throw new AppError('Active competency was not found', 404);
  }

  const selectedTask =
    competency.practicalTasks.find(
      (task) => String(task._id) === String(payload.practicalTaskId)
    ) || competency.practicalTasks[0];
  const theoryResult = calculateTheoryResult(
    competency,
    payload.theoryAnswers || []
  );

  const assessment = await Assessment.create({
    graduate: graduateId,
    competency: competency._id,
    evidence: {
      practicalSubmissionMode: payload.practicalSubmissionMode || 'direct_test',
      practicalTaskId: selectedTask?._id,
      practicalTaskTitle: selectedTask?.title,
      practicalTaskInstructions: selectedTask?.instructions,
      practicalTask: payload.practicalTask,
      quizAnswers: theoryResult.quizAnswers || payload.quizAnswers,
      theoryAnswers: theoryResult.theoryAnswers,
      portfolioLink: payload.portfolioLink,
      projectDescription: payload.projectDescription,
      fileUrls: payload.fileUrls || [],
      evidenceFiles: payload.evidenceFiles || [],
      selfAssessmentScore: payload.selfAssessmentScore,
    },
    scores: {
      quizScore: theoryResult.quizScore,
      selfAssessmentScore: payload.selfAssessmentScore,
    },
    status: 'submitted',
  });

  const graduate = await User.findById(graduateId);
  const assessorQuery = { role: 'assessor', isActive: true };

  if (graduate?.institution) {
    assessorQuery.institution = graduate.institution;
  }

  let assessors = await User.find(assessorQuery);

  if (assessors.length === 0 && graduate?.institution) {
    assessors = await User.find({ role: 'assessor', isActive: true });
  }

  if (assessors.length > 0) {
    await Notification.insertMany(
      assessors.map((assessor) => ({
        recipient: assessor._id,
        title: 'New Assessment Submitted',
        message: `${graduate?.name || 'A graduate'} submitted ${competency.title} for review.`,
        type: 'assessment',
        link: '/assessor/assessments',
      }))
    );
  }

  return populateAssessment(Assessment.findById(assessment._id));
}

export async function listAssessments(user, filters = {}) {
  const query = {};

  if (user.role === 'graduate') {
    query.graduate = user._id;
  }

  if (user.role === 'assessor') {
    query.status = filters.status || { $in: ['submitted', 'under_review', 'reviewed'] };
  }

  if (filters.status && user.role !== 'assessor') {
    query.status = filters.status;
  }

  if (filters.competency) {
    query.competency = filters.competency;
  }

  const assessments = await populateAssessment(
    Assessment.find(query).sort({ createdAt: -1 })
  );

  return user.role === 'graduate'
    ? assessments.map(hideCorrectAnswersFromAssessment)
    : assessments;
}

export async function getAssessmentById(assessmentId, user) {
  const assessment = await populateAssessment(Assessment.findById(assessmentId));

  if (!assessment) {
    throw new AppError('Assessment was not found', 404);
  }

  if (
    user.role === 'graduate' &&
    assessment.graduate._id.toString() !== user._id.toString()
  ) {
    throw new AppError('You can only view your own assessments', 403);
  }

  return user.role === 'graduate'
    ? hideCorrectAnswersFromAssessment(assessment)
    : assessment;
}

export async function reviewAssessment(assessmentId, assessorId, payload) {
  const assessment = await Assessment.findById(assessmentId);

  if (!assessment) {
    throw new AppError('Assessment was not found', 404);
  }

  const competency = await Competency.findById(assessment.competency);

  if (!competency) {
    throw new AppError('Assessment competency was not found', 404);
  }

  const benchmark = await Benchmark.findOne({
    competency: assessment.competency,
    isActive: true,
  }).sort({ effectiveFrom: -1, createdAt: -1 });

  if (!benchmark) {
    throw new AppError('Active RTB benchmark was not found for this competency', 400);
  }

  const analysis = analyzeCompetency(
    {
      practicalTaskScore: payload.practicalTaskScore,
      quizScore: payload.quizScore ?? assessment.scores.quizScore,
      portfolioScore: payload.portfolioScore,
      selfAssessmentScore:
        payload.selfAssessmentScore ?? assessment.evidence.selfAssessmentScore,
    },
    benchmark.requiredScore
  );

  assessment.assessor = assessorId;
  assessment.scores = analysis.scores;
  assessment.benchmarkScore = analysis.benchmarkScore;
  assessment.skillGap = analysis.skillGap;
  assessment.gapLevel = analysis.gapLevel;
  assessment.assessorComment = payload.assessorComment;
  assessment.status = 'reviewed';
  assessment.reviewedAt = new Date();

  await assessment.save();

  const recommendation = await upsertAssessmentRecommendation({
    assessment,
    competency,
    assessorId,
    recommendation: payload.recommendation,
  });

  await Notification.create({
    recipient: assessment.graduate,
    title: 'Assessment Reviewed',
    message: `Your ${competency.title} assessment has been reviewed. Gap level: ${assessment.gapLevel}.`,
    type: 'assessment',
    link: `/graduate/results`,
  });

  const reviewedAssessment = await populateAssessment(
    Assessment.findById(assessment._id)
  );

  return {
    assessment: reviewedAssessment,
    recommendation,
  };
}

export async function getGraduateResults(graduateId) {
  const assessments = await populateAssessment(
    Assessment.find({ graduate: graduateId, status: 'reviewed' }).sort({
      reviewedAt: -1,
    })
  );

  return assessments.map(hideCorrectAnswersFromAssessment);
}
