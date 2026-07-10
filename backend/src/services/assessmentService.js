import Assessment from "../models/Assessment.js";
import Benchmark from "../models/Benchmark.js";
import Competency from "../models/Competency.js";
import Notification from "../models/Notification.js";
import Recommendation from "../models/Recommendation.js";
import User from "../models/User.js";
import { AppError } from "./errorService.js";
import { isLearnerRole, ROLES } from "../constants/roles.js";
import {
  buildRecommendationContext,
  generateAutomaticRecommendationDraft,
  generateDraftRecommendation,
  upsertAssessmentRecommendation,
} from "./recommendationService.js";
import {
  assessGithubRepository,
  reviewGitHubRepositoryForTask,
  validateGitHubRepositoryUrl,
} from "./githubService.js";
import { generateGraduateReport } from "./reportService.js";

// Assessment scoring and gap analysis are part of assessment logic.

export const SCORE_WEIGHTS = {
  practicalTask: 0.7,
  quiz: 0.3,
};

function isValidScore(score) {
  return typeof score === "number" && score >= 0 && score <= 100;
}

function normalizeScore(score) {
  const numberScore = Number(score);
  return Number.isFinite(numberScore) ? numberScore : null;
}

export function validateScoreInputs(scores) {
  const normalizedScores = {
    practicalTaskScore: normalizeScore(scores.practicalTaskScore),
    quizScore: normalizeScore(scores.quizScore),
  };
  const invalidField = Object.entries(normalizedScores).find(([, score]) => !isValidScore(score));
  if (invalidField) return { isValid: false, field: invalidField[0] };
  return { isValid: true, scores: normalizedScores };
}

export function calculateWeightedScore(scores) {
  const validation = validateScoreInputs(scores);
  if (!validation.isValid) throw new Error(`${validation.field} must be a number between 0 and 100`);
  const finalScore =
    validation.scores.practicalTaskScore * SCORE_WEIGHTS.practicalTask +
    validation.scores.quizScore * SCORE_WEIGHTS.quiz;
  return Math.round(finalScore * 100) / 100;
}

export function calculateSkillGap(benchmarkScore, finalScore) {
  const gap = Number(benchmarkScore) - Number(finalScore);
  return Math.max(Math.round(gap * 100) / 100, 0);
}

export function classifyGap(skillGap) {
  if (skillGap === 0) return "No Gap";
  if (skillGap <= 5) return "Very Low Gap";
  if (skillGap <= 15) return "Low Gap";
  if (skillGap <= 25) return "Moderate Gap";
  return "High Gap";
}

export function getPriorityFromGap(gapLevel) {
  if (gapLevel === "High Gap") return "high";
  if (gapLevel === "Moderate Gap") return "medium";
  return "low";
}

export function analyzeCompetency(scores, benchmarkScore) {
  const validation = validateScoreInputs(scores);
  if (!validation.isValid) throw new AppError(`${validation.field} must be a number between 0 and 100`, 400);
  const benchmark = Number(benchmarkScore);
  if (!Number.isFinite(benchmark) || benchmark < 0 || benchmark > 100) {
    throw new AppError("Benchmark score must be a number between 0 and 100", 400);
  }
  const finalScore = calculateWeightedScore(validation.scores);
  const skillGap = calculateSkillGap(benchmark, finalScore);
  const gapLevel = classifyGap(skillGap);
  return { scores: { ...validation.scores, finalScore }, benchmarkScore: benchmark, skillGap, gapLevel };
}

export function summarizeAssessments(assessments) {
  const reviewed = assessments.filter((assessment) => assessment.status === "reviewed");
  if (reviewed.length === 0) {
    return { overallScore: 0, averageGap: 0, overallGapLevel: "Not Available" };
  }
  const totalScore = reviewed.reduce((sum, assessment) => sum + (assessment.scores.finalScore || 0), 0);
  const totalGap = reviewed.reduce((sum, assessment) => sum + (assessment.skillGap || 0), 0);
  const averageGap = Math.round((totalGap / reviewed.length) * 100) / 100;
  return {
    overallScore: Math.round((totalScore / reviewed.length) * 100) / 100,
    averageGap,
    overallGapLevel: classifyGap(averageGap),
  };
}


// Assessment query presentation
function populateAssessmentRelations(query) {
  return query
    .populate("graduate", "name email institution role organization")
    .populate("organization", "name district type status")
    .populate("assessor", "name email institution role organization")
    .populate(
      "competency",
      "title code category description expectedEvidence practicalTasks theoryQuestions",
    );
}

function removeCorrectTheoryAnswers(assessment) {
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

// Theory answer scoring
function normalizeTheoryAnswerText(value = "") {
  return String(value).trim().toLowerCase();
}

const THEORY_ANSWER_STOP_WORDS = new Set([
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

function extractMeaningfulTheoryAnswerTokens(value = "") {
  return normalizeTheoryAnswerText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !THEORY_ANSWER_STOP_WORDS.has(token));
}

function scoreShortTheoryAnswer({ answerText, expectedAnswer, points }) {
  const expectedTokens = [...new Set(extractMeaningfulTheoryAnswerTokens(expectedAnswer))];

  if (expectedTokens.length === 0) return 0;

  const answerTokens = new Set(extractMeaningfulTheoryAnswerTokens(answerText));
  const matchedTokens = expectedTokens.filter((token) =>
    answerTokens.has(token),
  );
  const coverage = matchedTokens.length / expectedTokens.length;

  if (coverage < 0.35) return 0;

  return Math.round(points * Math.min(coverage, 1) * 100) / 100;
}

function calculateTheoryQuestionResult(competency, submittedAnswers = []) {
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
      normalizeTheoryAnswerText(answerText) === normalizeTheoryAnswerText(question.correctAnswer);
    const pointsAwarded = isObjective
      ? isCorrect
        ? question.points
        : 0
      : scoreShortTheoryAnswer({
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

// Assessment submission validation
function resolveAssessmentReviewScores({ assessment, payload }) {
  return {
    practicalRepositoryScore: payload.practicalRepositoryScore,
    quizScore: payload.quizScore ?? assessment.scores.quizScore,
  };
}

function validateAssessmentEvidenceSubmission({ competency, payload, theoryScoringResult }) {
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

  if (theoryQuestions.length > 0 && theoryScoringResult.theoryAnswers.length === 0) {
    throw new AppError("Theory answers are required for this competency", 400);
  }
}

export async function submitAssessment(user, payload) {
  const competency = await Competency.findById(payload.competency);

  if (!competency || !competency.isActive) {
    throw new AppError("Active competency was not found", 404);
  }

  const selectedPracticalTask =
    competency.practicalTasks.find(
      (task) => String(task._id) === String(payload.practicalTaskId),
    ) || competency.practicalTasks[0];
  const theoryScoringResult = calculateTheoryQuestionResult(
    competency,
    payload.theoryAnswers || [],
  );
  validateAssessmentEvidenceSubmission({
    competency,
    payload,
    theoryScoringResult,
  });
  const submittedRepositoryTaskReview = payload.repositoryTaskReview
    ? null
    : await previewRepositoryTaskReview(
        {
          competency: competency._id,
          practicalTaskId: selectedPracticalTask?._id,
          githubRepositoryUrl: payload.githubRepositoryUrl,
        },
        user,
      );
  const staticRepositoryTaskReview = submittedRepositoryTaskReview
    ? submittedRepositoryTaskReview
    : await reviewGitHubRepositoryForTask({
        repositoryUrl: payload.githubRepositoryUrl,
        competency,
        practicalTask: selectedPracticalTask,
      });
  const repositoryEvidenceSummary = staticRepositoryTaskReview?.repositoryEvidenceSummary || null;

  if (repositoryEvidenceSummary && payload.repositoryTaskReview) {
    repositoryEvidenceSummary.taskReview = payload.repositoryTaskReview;
  } else if (repositoryEvidenceSummary && staticRepositoryTaskReview?.taskReview) {
    repositoryEvidenceSummary.taskReview = staticRepositoryTaskReview.taskReview;
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

  const practicalRepositoryScore = Number(repositoryEvidenceSummary?.taskReview?.score || 0);
  const skillGapAnalysis = analyzeCompetency(
    {
      practicalRepositoryScore,
      quizScore: theoryScoringResult.quizScore,
    },
    benchmark.requiredScore,
  );
  const automaticAssessmentComment =
    "Automatically reviewed using repository skillGapAnalysis, automated checks, theory answers, and RTB benchmark comparison.";
  const evidenceVerification = {
    githubReviewed: true,
    practicalEvidenceReviewed: true,
    theoryReviewed: true,
    authenticityNotes:
      "No human assessor review was used. Repository evidence was checked by the automated assessment engine.",
  };
  const automaticDraft = await generateAutomaticRecommendationDraft({
    assessment: {
      scores: skillGapAnalysis.scores,
      benchmarkScore: skillGapAnalysis.benchmarkScore,
      skillGap: skillGapAnalysis.skillGap,
      gapLevel: skillGapAnalysis.gapLevel,
      evidence: { repositoryEvidenceSummary },
      automaticAssessmentComment,
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
      practicalTaskId: selectedPracticalTask?._id,
      practicalTaskTitle: selectedPracticalTask?.title,
      practicalTaskInstructions: selectedPracticalTask?.instructions,
      practicalTask: payload.practicalTask,
      githubRepositoryUrl: payload.githubRepositoryUrl,
      repositoryEvidenceSummary,
      quizAnswers: theoryScoringResult.quizAnswers || payload.quizAnswers,
      theoryAnswers: theoryScoringResult.theoryAnswers,
      fileUrls: payload.fileUrls || [],
      evidenceFiles: payload.evidenceFiles || [],
    },
    scores: skillGapAnalysis.scores,
    benchmarkScore: skillGapAnalysis.benchmarkScore,
    skillGap: skillGapAnalysis.skillGap,
    gapLevel: skillGapAnalysis.gapLevel,
    status: "reviewed",
    automaticAssessmentComment,
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

  return populateAssessmentRelations(Assessment.findById(assessment._id));
}

// Repository review normalization
function convertRepositoryAssessmentToChecklist(repositoryAssessment) {
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

function buildStaticRepositoryReviewFallback({
  payload,
  competency,
  selectedPracticalTask,
  error,
}) {
  // Static review failures should still produce a review-shaped response.
  // This lets the graduate see actionable feedback instead of a broken page.
  const message =
    error?.message ||
    "GitHub static repository review failed before producing a result.";

  return {
    repositoryEvidenceSummary: {
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
      taskId: selectedPracticalTask?._id,
      taskTitle: selectedPracticalTask?.title || competency?.title || "Practical task",
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

  const selectedPracticalTask =
    competency.practicalTasks.find(
      (task) => String(task._id) === String(payload.practicalTaskId),
    ) || competency.practicalTasks[0];

  if (!selectedPracticalTask) {
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
    practicalTask: selectedPracticalTask,
  }).catch((error) =>
    buildStaticRepositoryReviewFallback({ payload, competency, selectedPracticalTask, error }),
  );
  // The executable assessment is best-effort: Docker, cloning, or dependency
  // failures lower the automatic score but do not block the user from seeing
  // static repository feedback.
  const repositoryAssessment = await assessGithubRepository({
    repositoryUrl: payload.githubRepositoryUrl,
    competencyId: competency._id,
    practicalTaskId: selectedPracticalTask._id,
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
  const checklist = convertRepositoryAssessmentToChecklist(repositoryAssessment);
  const passedCount = checklist.filter((item) => item.passed).length;

  return {
    repositoryEvidenceSummary: {
      ...staticReview.repositoryEvidenceSummary,
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

  const assessments = await populateAssessmentRelations(
    Assessment.find(query).sort({ createdAt: -1 }),
  );

  return isLearnerRole(user.role)
    ? assessments.map(removeCorrectTheoryAnswers)
    : assessments;
}

export async function getAssessmentById(assessmentId, user) {
  const assessment = await populateAssessmentRelations(
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
    ? removeCorrectTheoryAnswers(assessment)
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
    ? ["evidence", "status", "automaticAssessmentComment", "evidenceVerification"]
    : ["evidence", "status"];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  const updated = await Assessment.findByIdAndUpdate(assessmentId, updates, {
    new: true,
    runValidators: true,
  });

  return populateAssessmentRelations(Assessment.findById(updated._id));
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

  const assessorReviewScores = resolveAssessmentReviewScores({ assessment, payload });
  const skillGapAnalysis = analyzeCompetency(assessorReviewScores, benchmark.requiredScore);

  assessment.assessor = assessorId;
  assessment.reviewMode = "manual_legacy";
  assessment.reviewedBySystem = false;
  assessment.scores = skillGapAnalysis.scores;
  assessment.benchmarkScore = skillGapAnalysis.benchmarkScore;
  assessment.skillGap = skillGapAnalysis.skillGap;
  assessment.gapLevel = skillGapAnalysis.gapLevel;
  assessment.automaticAssessmentComment = payload.automaticAssessmentComment;
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

  const reviewedAssessment = await populateAssessmentRelations(
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

  const assessorReviewScores = resolveAssessmentReviewScores({ assessment, payload });
  const skillGapAnalysis = analyzeCompetency(assessorReviewScores, benchmark.requiredScore);

  const draftAssessment = {
    ...assessment.toObject(),
    scores: skillGapAnalysis.scores,
    benchmarkScore: skillGapAnalysis.benchmarkScore,
    skillGap: skillGapAnalysis.skillGap,
    gapLevel: skillGapAnalysis.gapLevel,
    automaticAssessmentComment:
      payload.automaticAssessmentComment || assessment.automaticAssessmentComment || "",
    evidenceVerification: payload.evidenceVerification,
  };

  const draft = await generateDraftRecommendation({
    assessment: draftAssessment,
    competency,
    automaticAssessmentComment: payload.automaticAssessmentComment,
  });

  return {
    assessmentId,
    competency: {
      id: competency._id,
      title: competency.title,
      code: competency.code,
    },
    benchmarkScore: skillGapAnalysis.benchmarkScore,
    finalScore: skillGapAnalysis.scores.finalScore,
    skillGap: skillGapAnalysis.skillGap,
    gapLevel: skillGapAnalysis.gapLevel,
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
      automaticAssessmentComment: payload.automaticAssessmentComment,
    }),
  };
}

export async function getGraduateResults(graduateId) {
  const assessments = await populateAssessmentRelations(
    Assessment.find({ graduate: graduateId, status: "reviewed" }).sort({
      reviewedAt: -1,
    }),
  );

  return assessments.map(removeCorrectTheoryAnswers);
}

class AssessmentService {
  submitAssessment = submitAssessment;
  previewRepositoryTaskReview = previewRepositoryTaskReview;
  listAssessments = listAssessments;
  getAssessmentById = getAssessmentById;
  updateAssessmentById = updateAssessmentById;
  deleteAssessmentById = deleteAssessmentById;
  reviewAssessment = reviewAssessment;
  previewRecommendationDraft = previewRecommendationDraft;
  getGraduateResults = getGraduateResults;
}

const assessmentService = new AssessmentService();

export default assessmentService;
