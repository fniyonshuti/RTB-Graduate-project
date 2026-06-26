import Assessment from "../models/Assessment.js";
import Benchmark from "../models/Benchmark.js";
import Competency from "../models/Competency.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { AppError } from "../utils/errors.js";
import { analyzeCompetency } from "./gapAnalysisService.js";
import {
  buildRecommendationContext,
  generateDraftRecommendation,
  upsertAssessmentRecommendation,
} from "./recommendationService.js";
import {
  summarizeGitHubRepository,
  validateGitHubRepositoryUrl,
} from "./repositoryAnalysisService.js";

function populateAssessment(query) {
  return query
    .populate("graduate", "name email institution role")
    .populate("assessor", "name email institution role")
    .populate(
      "competency",
      "title code category description expectedEvidence practicalTasks theoryQuestions portfolioRequirements rubricCriteria",
    );
}

function hideCorrectAnswersFromAssessment(assessment) {
  const data = assessment.toObject ? assessment.toObject() : assessment;

  if (data.competency?.theoryQuestions) {
    data.competency.theoryQuestions = data.competency.theoryQuestions.map(
      (question) => {
        const { correctAnswer, ...safeQuestion } = question;
        return safeQuestion;
      },
    );
  }

  return data;
}

function normalizeAnswer(value = "") {
  return String(value).trim().toLowerCase();
}

function calculateTheoryResult(competency, submittedAnswers = []) {
  const questions = competency.theoryQuestions || [];
  const totalPoints = questions.reduce(
    (sum, question) => sum + question.points,
    0,
  );

  if (questions.length === 0 || totalPoints === 0) {
    return {
      quizScore: 0,
      theoryAnswers: [],
      quizAnswers: "",
    };
  }

  const theoryAnswers = questions.map((question) => {
    const submitted = submittedAnswers.find(
      (answer) => String(answer.questionId) === String(question._id),
    );
    const answerText = submitted?.answer || "";
    const isObjective =
      question.type === "multiple_choice" && question.correctAnswer;
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
    0,
  );

  return {
    quizScore: Math.round((awardedPoints / totalPoints) * 10000) / 100,
    theoryAnswers,
    quizAnswers: theoryAnswers
      .map((answer) => `${answer.question}: ${answer.answer || "No answer"}`)
      .join("\n"),
  };
}

function validateAssessmentSubmission({
  competency,
  payload,
  theoryResult,
  selectedTask,
}) {
  const theoryQuestions = competency.theoryQuestions || [];
  const missingTheoryAnswer = theoryQuestions.find((question) => {
    const answer = (payload.theoryAnswers || []).find(
      (item) => String(item.questionId) === String(question._id),
    );
    return !String(answer?.answer || "").trim();
  });

  if (missingTheoryAnswer) {
    throw new AppError(
      "All theory questions must be answered before submission",
      400,
    );
  }

  const hasGitHubUrl = Boolean(payload.githubRepositoryUrl);
  const hasPracticalText = Boolean(String(payload.practicalTask || "").trim());
  const hasUploadedEvidence = (payload.evidenceFiles || []).length > 0;
  const hasPortfolioEvidence =
    Boolean(String(payload.portfolioLink || "").trim()) ||
    Boolean(String(payload.projectDescription || "").trim()) ||
    hasUploadedEvidence;

  if (!hasGitHubUrl) {
    throw new AppError(
      "GitHub repository URL is required for ICT skills assessment",
      400,
    );
  }

  validateGitHubRepositoryUrl(payload.githubRepositoryUrl);

  if (selectedTask && !hasPracticalText && !hasUploadedEvidence) {
    throw new AppError(
      "Submit a practical answer summary or uploaded practical project file for assessor review",
      400,
    );
  }

  if (!hasPortfolioEvidence) {
    throw new AppError(
      "Portfolio evidence or project description is required",
      400,
    );
  }

  if (!Number.isFinite(Number(payload.selfAssessmentScore))) {
    throw new AppError("Self-assessment score is required", 400);
  }

  if (theoryQuestions.length > 0 && theoryResult.theoryAnswers.length === 0) {
    throw new AppError("Theory answers are required for this competency", 400);
  }
}

export async function submitAssessment(graduateId, payload) {
  const competency = await Competency.findById(payload.competency);

  if (!competency || !competency.isActive) {
    throw new AppError("Active competency was not found", 404);
  }

  const selectedTask =
    competency.practicalTasks.find(
      (task) => String(task._id) === String(payload.practicalTaskId),
    ) || competency.practicalTasks[0];
  const theoryResult = calculateTheoryResult(
    competency,
    payload.theoryAnswers || [],
  );
  validateAssessmentSubmission({
    competency,
    payload,
    theoryResult,
    selectedTask,
  });
  const repositorySummary = payload.githubRepositoryUrl
    ? await summarizeGitHubRepository(payload.githubRepositoryUrl)
    : null;

  const assessment = await Assessment.create({
    graduate: graduateId,
    competency: competency._id,
    evidence: {
      practicalSubmissionMode: payload.practicalSubmissionMode || "direct_test",
      practicalTaskId: selectedTask?._id,
      practicalTaskTitle: selectedTask?.title,
      practicalTaskInstructions: selectedTask?.instructions,
      practicalTask: payload.practicalTask,
      githubRepositoryUrl: payload.githubRepositoryUrl,
      repositorySummary,
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
    status: "submitted",
  });

  const graduate = await User.findById(graduateId);
  const assessorQuery = { role: "assessor", isActive: true };

  if (graduate?.institution) {
    assessorQuery.institution = graduate.institution;
  }

  let assessors = await User.find(assessorQuery);

  if (assessors.length === 0 && graduate?.institution) {
    assessors = await User.find({ role: "assessor", isActive: true });
  }

  if (assessors.length > 0) {
    await Notification.insertMany(
      assessors.map((assessor) => ({
        recipient: assessor._id,
        title: "New Assessment Submitted",
        message: `${graduate?.name || "A graduate"} submitted ${competency.title} for review.`,
        type: "assessment",
        link: "/assessor/assessments",
      })),
    );
  }

  return populateAssessment(Assessment.findById(assessment._id));
}

export async function listAssessments(user, filters = {}) {
  const query = {};

  if (user.role === "graduate") {
    query.graduate = user._id;
  }

  if (user.role === "assessor") {
    query.status = filters.status || {
      $in: ["submitted", "under_review", "reviewed"],
    };
  }

  if (filters.status && user.role !== "assessor") {
    query.status = filters.status;
  }

  if (filters.competency) {
    query.competency = filters.competency;
  }

  const assessments = await populateAssessment(
    Assessment.find(query).sort({ createdAt: -1 }),
  );

  return user.role === "graduate"
    ? assessments.map(hideCorrectAnswersFromAssessment)
    : assessments;
}

export async function getAssessmentById(assessmentId, user) {
  const assessment = await populateAssessment(
    Assessment.findById(assessmentId),
  );

  if (!assessment) {
    throw new AppError("Assessment was not found", 404);
  }

  if (
    user.role === "graduate" &&
    assessment.graduate._id.toString() !== user._id.toString()
  ) {
    throw new AppError("You can only view your own assessments", 403);
  }

  return user.role === "graduate"
    ? hideCorrectAnswersFromAssessment(assessment)
    : assessment;
}

export async function reviewAssessment(assessmentId, assessorId, payload) {
  const assessment = await Assessment.findById(assessmentId);

  if (!assessment) {
    throw new AppError("Assessment was not found", 404);
  }

  const competency = await Competency.findById(assessment.competency);

  if (!competency) {
    throw new AppError("Assessment competency was not found", 404);
  }

  const benchmark = await Benchmark.findOne({
    competency: assessment.competency,
    isActive: true,
  }).sort({ effectiveFrom: -1, createdAt: -1 });

  if (!benchmark) {
    throw new AppError(
      "Active RTB benchmark was not found for this competency",
      400,
    );
  }

  const analysis = analyzeCompetency(
    {
      practicalTaskScore: payload.practicalTaskScore,
      quizScore: payload.quizScore ?? assessment.scores.quizScore,
      portfolioScore: payload.portfolioScore,
      selfAssessmentScore:
        payload.selfAssessmentScore ?? assessment.evidence.selfAssessmentScore,
    },
    benchmark.requiredScore,
  );

  assessment.assessor = assessorId;
  assessment.scores = analysis.scores;
  assessment.benchmarkScore = analysis.benchmarkScore;
  assessment.skillGap = analysis.skillGap;
  assessment.gapLevel = analysis.gapLevel;
  assessment.assessorComment = payload.assessorComment;
  assessment.status = "reviewed";
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
    title: "Assessment Reviewed",
    message: `Your ${competency.title} assessment has been reviewed. Gap level: ${assessment.gapLevel}.`,
    type: "assessment",
    link: `/graduate/results`,
  });

  const reviewedAssessment = await populateAssessment(
    Assessment.findById(assessment._id),
  );

  return {
    assessment: reviewedAssessment,
    recommendation,
  };
}

export async function previewRecommendationDraft(assessmentId, payload) {
  const assessment = await Assessment.findById(assessmentId);

  if (!assessment) {
    throw new AppError("Assessment was not found", 404);
  }

  const competency = await Competency.findById(assessment.competency);

  if (!competency) {
    throw new AppError("Assessment competency was not found", 404);
  }

  const benchmark = await Benchmark.findOne({
    competency: assessment.competency,
    isActive: true,
  }).sort({ effectiveFrom: -1, createdAt: -1 });

  if (!benchmark) {
    throw new AppError(
      "Active RTB benchmark was not found for this competency",
      400,
    );
  }

  const analysis = analyzeCompetency(
    {
      practicalTaskScore: payload.practicalTaskScore,
      quizScore: payload.quizScore ?? assessment.scores.quizScore,
      portfolioScore: payload.portfolioScore,
      selfAssessmentScore:
        payload.selfAssessmentScore ?? assessment.evidence.selfAssessmentScore,
    },
    benchmark.requiredScore,
  );

  const draftAssessment = {
    ...assessment.toObject(),
    scores: analysis.scores,
    benchmarkScore: analysis.benchmarkScore,
    skillGap: analysis.skillGap,
    gapLevel: analysis.gapLevel,
    assessorComment:
      payload.assessorComment || assessment.assessorComment || "",
  };

  const draft = await generateDraftRecommendation({
    assessment: draftAssessment,
    competency,
    assessorComment: payload.assessorComment,
  });

  return {
    assessmentId,
    competency: {
      id: competency._id,
      title: competency.title,
      code: competency.code,
    },
    benchmarkScore: analysis.benchmarkScore,
    finalScore: analysis.scores.finalScore,
    skillGap: analysis.skillGap,
    gapLevel: analysis.gapLevel,
    recommendation: {
      draftMessage: draft.message,
      message: draft.message,
      actionItems: draft.actionItems,
      resources: draft.resources,
      priority: draft.priority,
      provider: draft.provider,
      model: draft.model,
    },
    context: buildRecommendationContext({
      assessment: draftAssessment,
      competency,
      assessorComment: payload.assessorComment,
    }),
  };
}

export async function getGraduateResults(graduateId) {
  const assessments = await populateAssessment(
    Assessment.find({ graduate: graduateId, status: "reviewed" }).sort({
      reviewedAt: -1,
    }),
  );

  return assessments.map(hideCorrectAnswersFromAssessment);
}
