import Assessment from "../models/Assessment.js";
import Benchmark from "../models/Benchmark.js";
import Competency from "../models/Competency.js";
import Notification from "../models/Notification.js";
import Recommendation from "../models/Recommendation.js";
import User from "../models/User.js";
import { AppError } from "../utils/errors.js";
import { analyzeCompetency } from "./gapAnalysisService.js";
import { isLearnerRole, ROLES } from "../constants/roles.js";
import {
  buildRecommendationContext,
  generateAutomaticRecommendationDraft,
  generateDraftRecommendation,
  upsertAssessmentRecommendation,
} from "./recommendationService.js";
import {
  reviewGitHubRepositoryForTask,
  validateGitHubRepositoryUrl,
} from "./repositoryAnalysisService.js";
import { assessGithubRepository } from "./repositoryAssessmentService.js";
import { generateGraduateReport } from "./reportService.js";

function populateAssessment(query) {
  return query
    .populate("graduate", "name email institution role organization")
    .populate("organization", "name district type status")
    .populate("assessor", "name email institution role organization")
    .populate(
      "competency",
      "title code category description expectedEvidence practicalTasks theoryQuestions",
    );
}

function hideCorrectAnswersFromAssessment(assessment) {
  const data = assessment.toObject ? assessment.toObject() : assessment;

  if (data.competency?.theoryQuestions) {
    data.competency.theoryQuestions = data.competency.theoryQuestions.map(
      (question) => {
        const safeQuestion = { ...question };
        delete safeQuestion.correctAnswer;
        delete safeQuestion.expectedAnswer;
        return safeQuestion;
      },
    );
  }

  return data;
}

function normalizeAnswer(value = "") {
  return String(value).trim().toLowerCase();
}

const THEORY_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
  "are",
  "was",
  "were",
  "has",
  "have",
  "into",
  "data",
  "user",
  "users",
  "system",
  "application",
]);

function tokenizeTheoryAnswer(value = "") {
  return normalizeAnswer(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !THEORY_STOP_WORDS.has(token));
}

function scoreShortAnswer({ answerText, expectedAnswer, points }) {
  const expectedTokens = [...new Set(tokenizeTheoryAnswer(expectedAnswer))];

  if (expectedTokens.length === 0) return 0;

  const answerTokens = new Set(tokenizeTheoryAnswer(answerText));
  const matchedTokens = expectedTokens.filter((token) =>
    answerTokens.has(token),
  );
  const coverage = matchedTokens.length / expectedTokens.length;

  if (coverage < 0.35) return 0;

  return Math.round(points * Math.min(coverage, 1) * 100) / 100;
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
    const pointsAwarded = isObjective
      ? isCorrect
        ? question.points
        : 0
      : scoreShortAnswer({
          answerText,
          expectedAnswer: question.expectedAnswer,
          points: question.points,
        });

    return {
      questionId: question._id,
      question: question.question,
      answer: answerText,
      isCorrect: isObjective ? isCorrect : pointsAwarded === question.points,
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

function resolveReviewScores({ assessment, payload }) {
  return {
    practicalTaskScore: payload.practicalTaskScore,
    quizScore: payload.quizScore ?? assessment.scores.quizScore,
  };
}

function validateAssessmentSubmission({ competency, payload, theoryResult }) {
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
  if (!hasGitHubUrl) {
    throw new AppError(
      "GitHub repository URL is required for ICT skills assessment",
      400,
    );
  }

  validateGitHubRepositoryUrl(payload.githubRepositoryUrl);

  if (theoryQuestions.length > 0 && theoryResult.theoryAnswers.length === 0) {
    throw new AppError("Theory answers are required for this competency", 400);
  }
}

export async function submitAssessment(user, payload) {
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
  });
  const repositoryReview = payload.repositoryTaskReview
    ? null
    : await previewRepositoryTaskReview(
        {
          competency: competency._id,
          practicalTaskId: selectedTask?._id,
          githubRepositoryUrl: payload.githubRepositoryUrl,
        },
        user,
      );
  const staticRepositoryReview = repositoryReview
    ? repositoryReview
    : await reviewGitHubRepositoryForTask({
        repositoryUrl: payload.githubRepositoryUrl,
        competency,
        practicalTask: selectedTask,
      });
  const repositorySummary = staticRepositoryReview?.repositorySummary || null;

  if (repositorySummary && payload.repositoryTaskReview) {
    repositorySummary.taskReview = payload.repositoryTaskReview;
  } else if (repositorySummary && staticRepositoryReview?.taskReview) {
    repositorySummary.taskReview = staticRepositoryReview.taskReview;
  }

  const graduate = await User.findById(user._id);

  if (!graduate || !isLearnerRole(graduate.role)) {
    throw new AppError("Only normal users and organization users can submit assessments", 403);
  }

  const benchmark = await Benchmark.findOne({
    competency: competency._id,
    isActive: true,
  }).sort({ effectiveFrom: -1, createdAt: -1 });

  if (!benchmark) {
    throw new AppError(
      "Active RTB benchmark was not found for this competency",
      400,
    );
  }

  const practicalTaskScore = Number(repositorySummary?.taskReview?.score || 0);
  const analysis = analyzeCompetency(
    {
      practicalTaskScore,
      quizScore: theoryResult.quizScore,
    },
    benchmark.requiredScore,
  );
  const assessorComment =
    "Automatically reviewed using repository analysis, automated checks, theory answers, and RTB benchmark comparison.";
  const evidenceVerification = {
    githubReviewed: true,
    practicalEvidenceReviewed: true,
    theoryReviewed: true,
    authenticityNotes:
      "No human assessor review was used. Repository evidence was checked by the automated assessment engine.",
  };
  const automaticDraft = await generateAutomaticRecommendationDraft({
    assessment: {
      scores: analysis.scores,
      benchmarkScore: analysis.benchmarkScore,
      skillGap: analysis.skillGap,
      gapLevel: analysis.gapLevel,
      evidence: { repositorySummary },
      assessorComment,
      evidenceVerification,
    },
    competency,
  });

  const assessment = await Assessment.create({
    graduate: graduate._id,
    organization: graduate?.organization,
    competency: competency._id,
    reviewMode: "automatic",
    reviewedBySystem: true,
    scoringEngineVersion: "automatic-rubric-v1",
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
      fileUrls: payload.fileUrls || [],
      evidenceFiles: payload.evidenceFiles || [],
    },
    scores: analysis.scores,
    benchmarkScore: analysis.benchmarkScore,
    skillGap: analysis.skillGap,
    gapLevel: analysis.gapLevel,
    status: "reviewed",
    assessorComment,
    evidenceVerification,
    reviewedAt: new Date(),
  });

  await upsertAssessmentRecommendation({
    assessment,
    assessorId: user._id,
    recommendation: { automaticDraft },
  });

  await Notification.create({
    recipient: graduate._id,
    title: "Automatic Assessment Completed",
    message: `${competency.title} was scored instantly. Gap level: ${assessment.gapLevel}.`,
    type: "assessment",
    link: "/graduate/results",
  });

  await generateGraduateReport(graduate._id, user).catch(() => null);

  return populateAssessment(Assessment.findById(assessment._id));
}

function repositoryAssessmentToChecklist(repositoryAssessment) {
  // Convert the executable repository assessment into the same checklist shape
  // used by the static GitHub review, so the frontend can render one result.
  const passed = (repositoryAssessment.passedRequirements || []).map(
    (item) => ({
      key: item.id || item.title,
      label: item.title,
      passed: true,
      weight: item.weight || 1,
      evidence: item.evidence || "Requirement passed.",
      advice: "",
    }),
  );
  const failed = (repositoryAssessment.failedRequirements || []).map(
    (item) => ({
      key: item.id || item.title,
      label: item.title,
      passed: false,
      weight: item.weight || 1,
      evidence: item.error || "Requirement failed.",
      advice:
        item.error ||
        "Fix this failed requirement and run the repository assessment again.",
    }),
  );

  const checklist = [...passed, ...failed];

  if (checklist.length === 0) {
    return [
      {
        key: "repositoryAssessmentUnavailable",
        label: "Repository assessment produced objective checks",
        passed: false,
        weight: 1,
        evidence:
          repositoryAssessment.errorMessage ||
          "Repository assessment did not produce objective checks.",
        advice:
          "Check GitHub access, Docker Desktop status, backend logs, and practical task test configuration.",
      },
    ];
  }

  return checklist;
}

function buildStaticReviewFallback({
  payload,
  competency,
  selectedTask,
  error,
}) {
  // Static review failures should still produce a review-shaped response.
  // This lets the graduate see actionable feedback instead of a broken page.
  const message =
    error?.message ||
    "GitHub static repository review failed before producing a result.";

  return {
    repositorySummary: {
      url: payload.githubRepositoryUrl,
      owner: "",
      repo: "",
      isValid: false,
      fetchStatus: "failed",
      analyzedAt: new Date(),
      description: "",
      languages: [],
      readmeFound: false,
      readmeExcerpt: "",
      recentCommits: [],
      supportedFileCount: 0,
      supportedFileTypes: [],
      codeQualityScore: 0,
      evidenceCompletenessScore: 0,
      riskFlags: [message],
      sampledSourceFiles: [],
      topLevelItems: [],
      codeQualityNotes: [message],
      summaryText: message,
    },
    taskReview: {
      taskId: selectedTask?._id,
      taskTitle: selectedTask?.title || competency?.title || "Practical task",
      score: 0,
      pointsEarned: 0,
      pointsPossible: 100,
      passedCount: 0,
      failedCount: 1,
      checklist: [
        {
          key: "githubStaticReview",
          label: "GitHub repository could be verified and inspected",
          passed: false,
          weight: 1,
          evidence: message,
          advice:
            "Check the repository URL, GitHub token access, internet connection, and GitHub API availability.",
        },
      ],
      taskKeywords: [],
      matchedTaskKeywords: [],
      taskKeywordMatchRate: 0,
      feedback: [
        "Repository static review failed. Fix repository access and run review again.",
      ],
      reviewedAt: new Date(),
      summary: message,
    },
  };
}

export async function previewRepositoryTaskReview(payload, user) {
  const competency = await Competency.findById(payload.competency);

  if (!competency || !competency.isActive) {
    throw new AppError("Active competency was not found", 404);
  }

  const selectedTask =
    competency.practicalTasks.find(
      (task) => String(task._id) === String(payload.practicalTaskId),
    ) || competency.practicalTasks[0];

  if (!selectedTask) {
    throw new AppError("Practical task was not found for this competency", 404);
  }

  if (!payload.githubRepositoryUrl) {
    throw new AppError(
      "GitHub repository URL is required for task review",
      400,
    );
  }

  const staticReview = await reviewGitHubRepositoryForTask({
    repositoryUrl: payload.githubRepositoryUrl,
    competency,
    practicalTask: selectedTask,
  }).catch((error) =>
    buildStaticReviewFallback({ payload, competency, selectedTask, error }),
  );
  // The executable assessment is best-effort: Docker, cloning, or dependency
  // failures lower the automatic score but do not block the user from seeing
  // static repository feedback.
  const repositoryAssessment = await assessGithubRepository({
    repositoryUrl: payload.githubRepositoryUrl,
    competencyId: competency._id,
    practicalTaskId: selectedTask._id,
    user,
  }).catch((error) => ({
    _id: undefined,
    verificationStatus: "failed",
    accuracyScore: 0,
    passedTestCases: 0,
    totalTestCases: 1,
    passedWeight: 0,
    totalWeight: 10,
    passedRequirements: [],
    failedRequirements: [
      {
        id: "repository-assessment-engine",
        title: "Repository execution assessment completed",
        competency: "testing",
        passed: false,
        evidence: "",
        weight: 10,
        error:
          error.message ||
          "Repository execution assessment failed before producing a result.",
      },
    ],
    competencyScores: {},
    recommendations: [
      "Check the backend terminal, Docker Desktop status, GitHub repository access, and instructor test configuration, then run repository review again.",
    ],
    assessorValidationRequired: false,
    errorMessage: error.message,
  }));
  const checklist = repositoryAssessmentToChecklist(repositoryAssessment);
  const passedCount = checklist.filter((item) => item.passed).length;

  return {
    repositorySummary: {
      ...staticReview.repositorySummary,
      repositoryAssessmentResult: repositoryAssessment,
    },
    taskReview: {
      ...staticReview.taskReview,
      score: repositoryAssessment.accuracyScore,
      pointsEarned: repositoryAssessment.accuracyScore,
      passedCount,
      failedCount: checklist.length - passedCount,
      checklist,
      automatedProofPassed:
        repositoryAssessment.verificationStatus === "verified" &&
        repositoryAssessment.assessorValidationRequired === false,
      proofLevel:
        repositoryAssessment.assessorValidationRequired === false
          ? "Verified by instructor automated tests"
          : "Objective checks completed with limited automatic evidence",
      proofSummary:
        repositoryAssessment.verificationStatus === "verified"
          ? `Accuracy score is weighted from ${repositoryAssessment.passedWeight || 0}/${repositoryAssessment.totalWeight || 0} objective points across ${repositoryAssessment.passedTestCases}/${repositoryAssessment.totalTestCases} checks.`
          : repositoryAssessment.errorMessage ||
            "Repository assessment failed.",
      repositoryAssessmentResultId: repositoryAssessment._id,
      repositoryAssessmentEvidence: {
        verificationStatus: repositoryAssessment.verificationStatus,
        executionMode: repositoryAssessment.executionMode,
        projectType: repositoryAssessment.projectType,
        detectedTechnologies: repositoryAssessment.detectedTechnologies || [],
        totalTestCases: repositoryAssessment.totalTestCases,
        passedTestCases: repositoryAssessment.passedTestCases,
        totalWeight: repositoryAssessment.totalWeight,
        passedWeight: repositoryAssessment.passedWeight,
        accuracyScore: repositoryAssessment.accuracyScore,
        gapClassification: repositoryAssessment.gapClassification,
        eslintResult: repositoryAssessment.eslintResult,
        securityScanResult: repositoryAssessment.securityScanResult,
        passedRequirements: (repositoryAssessment.passedRequirements || []).map(
          (item) => ({
            title: item.title,
            competency: item.competency,
            evidence: item.evidence,
            weight: item.weight,
          }),
        ),
        failedRequirements: (repositoryAssessment.failedRequirements || []).map(
          (item) => ({
            title: item.title,
            competency: item.competency,
            error: item.error,
            weight: item.weight,
          }),
        ),
        assessorValidationRequired:
          repositoryAssessment.assessorValidationRequired,
      },
      competencyScores: repositoryAssessment.competencyScores,
      recommendations: repositoryAssessment.recommendations,
      summary: `Real repository assessment scored ${repositoryAssessment.accuracyScore}% from ${repositoryAssessment.passedWeight || 0}/${repositoryAssessment.totalWeight || 0} weighted objective points across ${repositoryAssessment.passedTestCases}/${repositoryAssessment.totalTestCases} check(s).`,
    },
  };
}

export async function listAssessments(user, filters = {}) {
  const query = {};

  if (isLearnerRole(user.role)) {
    query.graduate = user._id;
  }

  if (user.role === ROLES.ORGANIZATION_ADMIN) {
    if (!user.organization) {
      throw new AppError(
        "Organization administrator is not linked to an organization",
        403,
      );
    }
    query.organization = user.organization._id || user.organization;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.competency) {
    query.competency = filters.competency;
  }

  const assessments = await populateAssessment(
    Assessment.find(query).sort({ createdAt: -1 }),
  );

  return isLearnerRole(user.role)
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
    isLearnerRole(user.role) &&
    assessment.graduate._id.toString() !== user._id.toString()
  ) {
    throw new AppError("You can only view your own assessments", 403);
  }

  if (
    user.role === ROLES.ORGANIZATION_ADMIN &&
    String(assessment.organization?._id || assessment.organization) !==
      String(user.organization?._id || user.organization)
  ) {
    throw new AppError(
      "You can only view assessments for your organization",
      403,
    );
  }

  return isLearnerRole(user.role)
    ? hideCorrectAnswersFromAssessment(assessment)
    : assessment;
}

export async function updateAssessmentById(assessmentId, user, payload) {
  const assessment = await Assessment.findById(assessmentId);

  if (!assessment) {
    throw new AppError("Assessment was not found", 404);
  }

  const isOwner = String(assessment.graduate) === String(user._id);

  if (isLearnerRole(user.role) && !isOwner) {
    throw new AppError("You are not allowed to update this assessment", 403);
  }

  if (
    user.role === ROLES.ORGANIZATION_ADMIN &&
    String(assessment.organization) !==
      String(user.organization?._id || user.organization)
  ) {
    throw new AppError(
      "You can only update assessments for your organization",
      403,
    );
  }

  if (isLearnerRole(user.role) && assessment.status === "reviewed") {
    throw new AppError(
      "Reviewed assessments cannot be edited by learners",
      400,
    );
  }

  const allowedUpdates = [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.ORGANIZATION_ADMIN].includes(user.role)
    ? ["evidence", "status", "assessorComment", "evidenceVerification"]
    : ["evidence", "status"];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  const updated = await Assessment.findByIdAndUpdate(assessmentId, updates, {
    new: true,
    runValidators: true,
  });

  return populateAssessment(Assessment.findById(updated._id));
}

export async function deleteAssessmentById(assessmentId, user) {
  const assessment = await Assessment.findById(assessmentId);

  if (!assessment) {
    throw new AppError("Assessment was not found", 404);
  }

  const isOwner = String(assessment.graduate) === String(user._id);

  if (isLearnerRole(user.role) && !isOwner) {
    throw new AppError("You are not allowed to delete this assessment", 403);
  }

  if (
    user.role === ROLES.ORGANIZATION_ADMIN &&
    String(assessment.organization) !==
      String(user.organization?._id || user.organization)
  ) {
    throw new AppError(
      "You can only delete assessments for your organization",
      403,
    );
  }

  if (isLearnerRole(user.role) && assessment.status === "reviewed") {
    throw new AppError(
      "Reviewed assessments cannot be deleted by learners",
      400,
    );
  }

  await Assessment.findByIdAndDelete(assessmentId);
  await Recommendation.deleteMany({ assessment: assessmentId });

  return assessment;
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

  const reviewScores = resolveReviewScores({ assessment, payload });
  const analysis = analyzeCompetency(reviewScores, benchmark.requiredScore);

  assessment.assessor = assessorId;
  assessment.reviewMode = "manual_legacy";
  assessment.reviewedBySystem = false;
  assessment.scores = analysis.scores;
  assessment.benchmarkScore = analysis.benchmarkScore;
  assessment.skillGap = analysis.skillGap;
  assessment.gapLevel = analysis.gapLevel;
  assessment.assessorComment = payload.assessorComment;
  assessment.evidenceVerification = {
    githubReviewed: Boolean(payload.evidenceVerification?.githubReviewed),
    practicalEvidenceReviewed: Boolean(
      payload.evidenceVerification?.practicalEvidenceReviewed,
    ),
    theoryReviewed: Boolean(payload.evidenceVerification?.theoryReviewed),
    authenticityNotes: payload.evidenceVerification?.authenticityNotes || "",
  };
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

  const assessor = await User.findById(assessorId).select("_id role");
  await generateGraduateReport(assessment.graduate, assessor).catch(() => null);

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

  const reviewScores = resolveReviewScores({ assessment, payload });
  const analysis = analyzeCompetency(reviewScores, benchmark.requiredScore);

  const draftAssessment = {
    ...assessment.toObject(),
    scores: analysis.scores,
    benchmarkScore: analysis.benchmarkScore,
    skillGap: analysis.skillGap,
    gapLevel: analysis.gapLevel,
    assessorComment:
      payload.assessorComment || assessment.assessorComment || "",
    evidenceVerification: payload.evidenceVerification,
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
      prompt: draft.prompt,
      rawResponse: draft.rawResponse,
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
