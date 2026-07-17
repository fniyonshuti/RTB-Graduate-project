import Assessment from "../models/Assessment.js";
import Benchmark from "../models/Benchmark.js";
import Competency from "../models/Competency.js";
import Checklist from "../models/Checklist.js";
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
import {
  buildAssessmentResultUrl,
  sendAssessmentResultEmail,
} from "./emailService.js";

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

function resultNotificationLink(assessmentId) {
  return `/results/${assessmentId}`;
}

async function notifyAssessmentResultReady({ assessment, competency, graduate, recommendation }) {
  const graduateUser = graduate?.email
    ? graduate
    : await User.findById(assessment.graduate).select('name email isActive');

  if (!graduateUser || !graduateUser.isActive) return;

  const notificationLink = resultNotificationLink(assessment._id);
  const existingNotification = await Notification.findOne({
    recipient: graduateUser._id,
    type: 'assessment',
    link: notificationLink,
  });

  if (!existingNotification) {
    await Notification.create({
      recipient: graduateUser._id,
      title: 'Assessment Result Ready',
      message: `Your ${competency.title} assessment result is ready. Gap level: ${assessment.gapLevel}.`,
      type: 'assessment',
      link: notificationLink,
    });
  }

  if (assessment.resultEmail?.sentAt) return;

  try {
    const emailResult = await sendAssessmentResultEmail({
      to: graduateUser.email,
      name: graduateUser.name,
      competencyTitle: competency.title,
      finalScore: assessment.scores?.finalScore,
      benchmarkScore: assessment.benchmarkScore,
      skillGap: assessment.skillGap,
      gapLevel: assessment.gapLevel,
      priority: recommendation?.priority || getPriorityFromGap(assessment.gapLevel),
      recommendationSummary: recommendation?.message,
      completedAt: assessment.reviewedAt || assessment.updatedAt,
      resultLink: buildAssessmentResultUrl(assessment._id),
    });

    assessment.resultEmail = {
      sentAt: new Date(),
      provider: emailResult.provider,
      messageId: emailResult.messageId,
      failedAt: undefined,
      failureReason: undefined,
    };
    await assessment.save();
  } catch (error) {
    const failureReason = error?.message || 'Assessment result email failed';
    console.error('Assessment result email failed after result save', {
      assessmentId: String(assessment._id),
      graduateId: String(graduateUser._id),
      message: failureReason,
    });
    assessment.resultEmail = {
      ...(assessment.resultEmail || {}),
      failedAt: new Date(),
      failureReason: failureReason.slice(0, 500),
    };
    await assessment.save().catch(() => null);
  }
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
    practicalTaskScore:
      payload.practicalTaskScore ??
      payload.practicalRepositoryScore ??
      assessment.scores.practicalTaskScore,
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
  const backendRepositoryTaskReview = await previewRepositoryTaskReview(
    {
      competency: competency._id,
      practicalTaskId: selectedPracticalTask?._id,
      githubRepositoryUrl: payload.githubRepositoryUrl,
    },
    user,
  );
  const staticRepositoryTaskReview = backendRepositoryTaskReview;
  const repositoryEvidenceSummary = staticRepositoryTaskReview?.repositoryEvidenceSummary || null;

  if (repositoryEvidenceSummary && staticRepositoryTaskReview?.taskReview) {
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
      practicalTaskScore: practicalRepositoryScore,
      quizScore: theoryScoringResult.quizScore,
    },
    benchmark.requiredScore,
  );
  const automaticAssessmentComment =
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

  const recommendation = await upsertAssessmentRecommendation({
    assessment,
    assessorId: user._id,
    recommendation: { automaticDraft },
  });

  await notifyAssessmentResultReady({
    assessment,
    competency,
    graduate,
    recommendation,
  });

  await generateGraduateReport(graduate._id, user).catch(() => null);

  return populateAssessmentRelations(Assessment.findById(assessment._id));
}

function roundReviewScore(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.round(numericValue * 100) / 100 : 0;
}

function clampReviewScore(value, min = 0, max = 100) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return min;
  return Math.min(Math.max(numericValue, min), max);
}

function enrichChecklistScore(item) {
  const weight = clampReviewScore(item.weight || 1, 1, 100);
  const maxScore = clampReviewScore(item.maxScore || item.weight || 1, 1, 100);
  const scoreAwarded = clampReviewScore(
    item.scoreAwarded ?? (item.passed ? maxScore : 0),
    0,
    maxScore,
  );
  const weightedScore = roundReviewScore((scoreAwarded / maxScore) * weight);

  return {
    ...item,
    weight,
    maxScore,
    scoreAwarded,
    weightedScore,
    passed: item.passed ?? scoreAwarded >= maxScore * 0.7,
  };
}

function calculateRepositoryReviewTotals(checklist = []) {
  const pointsPossible = roundReviewScore(
    checklist.reduce((sum, item) => sum + Number(item.weight || 0), 0),
  );
  const pointsEarned = roundReviewScore(
    checklist.reduce((sum, item) => sum + Number(item.weightedScore || 0), 0),
  );

  return {
    pointsEarned,
    pointsPossible,
    score: pointsPossible > 0 ? roundReviewScore((pointsEarned / pointsPossible) * 100) : 0,
  };
}

function requirementEvidenceScore(requirements = []) {
  const totalWeight = requirements.reduce((sum, item) => sum + Number(item.weight || 1), 0);
  const passedWeight = requirements
    .filter((item) => item.passed)
    .reduce((sum, item) => sum + Number(item.weight || 1), 0);
  return totalWeight > 0 ? roundReviewScore((passedWeight / totalWeight) * 100) : 0;
}

function checklistTerms(item = {}) {
  return [item.title, item.description, item.category, item.validationType]
    .join(' ')
    .toLowerCase();
}
const CHECKLIST_STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "this",
  "that",
  "task",
  "project",
  "code",
  "using",
  "implement",
  "implemented",
]);

function checklistKeywords(item = {}) {
  return checklistTerms(item)
    .split(/[^a-z0-9_]+/i)
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length > 3 && !CHECKLIST_STOP_WORDS.has(term));
}

function repositorySourceText(staticReview = {}) {
  const repositorySummary = staticReview.repositorySummary || staticReview.repositoryEvidenceSummary || {};
  return [
    repositorySummary.description,
    repositorySummary.readmeExcerpt,
    repositorySummary.summaryText,
    ...(repositorySummary.topLevelItems || []),
    ...(repositorySummary.sampledSourceFiles || []).map(
      (file) => `${file.path || ""} ${file.language || ""} ${file.excerpt || ""}`,
    ),
  ]
    .join(" ")
    .toLowerCase();
}

function scoreChecklistSourceMatch(checklistItem, staticReview) {
  const keywords = checklistKeywords(checklistItem);
  if (keywords.length === 0) return 0;

  const sourceText = repositorySourceText(staticReview);
  if (!sourceText) return 0;

  const matchedKeywords = keywords.filter((keyword) => sourceText.includes(keyword));
  return roundReviewScore((matchedKeywords.length / keywords.length) * 100);
}

function relatedRequirementsForChecklist(repositoryAssessment = {}, item = {}) {
  const requirements = [
    ...(repositoryAssessment.passedRequirements || []).map((requirement) => ({ ...requirement, passed: true })),
    ...(repositoryAssessment.failedRequirements || []).map((requirement) => ({ ...requirement, passed: false })),
  ];
  const terms = checklistTerms(item);
  const category = String(item.category || '').toLowerCase();
  const related = requirements.filter((requirement) => {
    const text = [requirement.id, requirement.title, requirement.competency, requirement.evidence, requirement.error]
      .join(' ')
      .toLowerCase();
    return (category && text.includes(category)) || terms.split(/\s+/).some((term) => term.length > 4 && text.includes(term));
  });

  return related.length > 0 ? related : requirements;
}

function scoreChecklistEvidence({ checklistItem, staticReview, repositoryAssessment }) {
  const validationType = String(checklistItem.validationType || 'implementation_review');
  const category = String(checklistItem.category || 'general').toLowerCase();
  const implementationReview = staticReview.taskReview?.implementationReview || {};
  const competencyScore = Number(repositoryAssessment.competencyScores?.[category] || 0);
  const relatedRequirements = relatedRequirementsForChecklist(repositoryAssessment, checklistItem);

  if (validationType === 'eslint') {
    const eslintResult = repositoryAssessment.eslintResult || {};
    if (eslintResult.available === false) return { percent: 0, evidence: eslintResult.output || 'ESLint was not available.' };
    const percent = eslintResult.success && Number(eslintResult.errors || 0) === 0
      ? 100
      : Math.max(0, 100 - Number(eslintResult.errors || 0) * 25 - Number(eslintResult.warnings || 0) * 5);
    return { percent, evidence: `ESLint errors: ${eslintResult.errors || 0}, warnings: ${eslintResult.warnings || 0}.` };
  }

  if (validationType === 'security_scan') {
    const security = repositoryAssessment.securityScanResult || {};
    if (security.available === false) return { percent: 0, evidence: security.output || 'Security scan was not available.' };
    const secretCount = (security.secretFindings || []).length;
    const percent = security.success
      ? 100
      : Math.max(0, 100 - Number(security.critical || 0) * 50 - Number(security.high || 0) * 25 - secretCount * 40);
    return { percent, evidence: `Security scan: ${security.critical || 0} critical, ${security.high || 0} high, ${secretCount} secret finding(s).` };
  }

  if (validationType === 'repository_scan') {
    const percent = roundReviewScore((Number(staticReview.taskReview?.taskKeywordMatchRate || 0) + Number(staticReview.taskReview?.score || 0)) / 2);
    return { percent, evidence: `Repository task keyword match: ${staticReview.taskReview?.taskKeywordMatchRate || 0}%. Static review score: ${staticReview.taskReview?.score || 0}%.` };
  }

  if (validationType === 'hidden_test' || validationType === 'automated_test') {
    const testRequirements = relatedRequirements.filter((requirement) => /test|build|e2b|execution|sandbox|stage/i.test(`${requirement.id || ''} ${requirement.title || ''}`));
    const percent = testRequirements.length > 0
      ? requirementEvidenceScore(testRequirements)
      : Number(repositoryAssessment.accuracyScore || 0);
    return { percent, evidence: `${repositoryAssessment.passedTestCases || 0}/${repositoryAssessment.totalTestCases || 0} objective repository check(s) passed.` };
  }

  if (validationType === 'manual_review') {
    const percent = Math.max(Number(implementationReview.implementationEvidenceScore || 0), competencyScore);
    return { percent, evidence: 'Automatic evidence is shown for assessor confirmation because this checklist row needs human validation.' };
  }

  const sourceMatchScore = scoreChecklistSourceMatch(checklistItem, staticReview);
  const evidenceValues = [
    implementationReview.implementationEvidenceScore,
    implementationReview.functionalCoverageRate,
    implementationReview.actionCoverageRate,
    competencyScore,
    sourceMatchScore,
  ].map(Number).filter((value) => Number.isFinite(value) && value > 0);
  const implementationPercent = evidenceValues.length > 0
    ? roundReviewScore(evidenceValues.reduce((sum, value) => sum + value, 0) / evidenceValues.length)
    : Number(repositoryAssessment.accuracyScore || 0);

  return {
    percent: implementationPercent,
    evidence: `Checklist-code match: ${sourceMatchScore}%. Implementation evidence: ${implementationReview.implementationEvidenceScore || 0}%. Functional coverage: ${implementationReview.functionalCoverageRate || 0}%. Category score: ${competencyScore || 0}%.`,
  };
}

async function loadAdminChecklistRubric(competency, practicalTask) {
  const checklistDocument = await Checklist.findOne({
    competency: competency._id,
    practicalTaskId: practicalTask._id,
    isActive: true,
  }).lean();

  const checklistItems = checklistDocument?.items?.length
    ? checklistDocument.items
    : practicalTask.reviewChecklist;
  const rubric = Array.isArray(checklistItems)
    ? checklistItems.filter((item) => item?.title)
    : [];

  if (rubric.length === 0) {
    throw new AppError(
      "Repository review checklist is not configured for this practical task. Ask an admin to open Review Checklists and add a 100-point checklist before reviewing a repository.",
      400,
    );
  }

  return rubric;
}

function buildAdminWeightedChecklist({ rubric, staticReview, repositoryAssessment }) {
  return rubric.map((item, index) => {
    const weight = clampReviewScore(item.weight || 10, 1, 100);
    const maxScore = clampReviewScore(item.maxScore || 10, 1, 100);
    const { percent, evidence } = scoreChecklistEvidence({ checklistItem: item, staticReview, repositoryAssessment });
    const scoreAwarded = roundReviewScore((clampReviewScore(percent) / 100) * maxScore);
    const threshold = clampReviewScore(item.successThreshold ?? 70, 0, 100);

    return enrichChecklistScore({
      key: item.key || `admin-checklist-${index + 1}`,
      label: item.title,
      passed: percent >= threshold,
      weight,
      maxScore,
      scoreAwarded,
      validationType: item.validationType || 'implementation_review',
      category: item.category || 'general',
      evidence: item.description ? `${item.description} ${evidence}` : evidence,
      advice:
        percent >= threshold
          ? ''
          : item.feedbackWhenFailed || 'Improve this checklist requirement and run repository review again.',
    });
  });
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
      checklist: [],
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

  const adminChecklistRubric = await loadAdminChecklistRubric(competency, selectedPracticalTask);

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
      "Check E2B_API_KEY, GitHub repository access, dependency setup, and instructor test configuration, then run repository review again.",
    ],
    assessorValidationRequired: false,
    errorMessage: error.message,
  }));
  const checklist = buildAdminWeightedChecklist({
    rubric: adminChecklistRubric,
    staticReview,
    repositoryAssessment,
  });
  const reviewTotals = calculateRepositoryReviewTotals(checklist);
  const passedCount = checklist.filter((item) => item.passed).length;

  return {
    repositoryEvidenceSummary: {
      ...staticReview.repositoryEvidenceSummary,
      repositoryAssessmentResult: repositoryAssessment,
    },
    taskReview: {
      ...staticReview.taskReview,
      score: reviewTotals.score,
      pointsEarned: reviewTotals.pointsEarned,
      pointsPossible: reviewTotals.pointsPossible,
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
      summary: `Repository review scored ${reviewTotals.score}% from ${reviewTotals.pointsEarned}/${reviewTotals.pointsPossible} weighted checklist point(s). Objective engine evidence: ${repositoryAssessment.passedWeight || 0}/${repositoryAssessment.totalWeight || 0} points across ${repositoryAssessment.passedTestCases}/${repositoryAssessment.totalTestCases} check(s).`,
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

  const graduate = await User.findById(assessment.graduate).select("name email isActive");
  await notifyAssessmentResultReady({
    assessment,
    competency,
    graduate,
    recommendation,
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
      learningResources: draft.learningResources || [],
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

export async function getGraduateResultById(graduateId, assessmentId) {
  const assessment = await populateAssessmentRelations(
    Assessment.findOne({ _id: assessmentId, graduate: graduateId, status: "reviewed" }),
  );

  if (!assessment) {
    throw new AppError("Assessment result was not found", 404);
  }

  return removeCorrectTheoryAnswers(assessment);
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
  getGraduateResultById = getGraduateResultById;
}

const assessmentService = new AssessmentService();

export default assessmentService;







