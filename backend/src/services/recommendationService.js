import Recommendation from "../models/Recommendation.js";
import User from "../models/User.js";
import { getPriorityFromGap } from "../utils/gapClassifier.js";
import { AppError } from "../utils/errors.js";
import { generateAiRecommendationDraft } from "./aiRecommendationService.js";
import { isLearnerRole, ROLES } from "../constants/roles.js";

const SCORE_AREA_LABELS = {
  practicalTaskScore: "Practical/GitHub project",
  quizScore: "Theory questions",
};

const SCORE_AREA_IMPROVEMENT_GUIDE = {
  practicalTaskScore:
    "Improve the GitHub practical project by fixing failed hidden tests, completing missing task requirements, adding working frontend/backend/database/authentication behavior where required, and proving the solution with automated tests.",
  quizScore:
    "Improve theory understanding by revising the concepts missed in the quiz, especially the concepts connected to the selected competency and failed practical evidence.",
};

export function getWeakAssessmentAreas(scores = {}) {
  return Object.entries({
    practicalTaskScore: scores.practicalTaskScore,
    quizScore: scores.quizScore,
  })
    .filter(([, score]) => Number(score) < 70)
    .sort(([, first], [, second]) => Number(first) - Number(second))
    .map(([field]) => SCORE_AREA_LABELS[field]);
}

function getGapMeaning(gapLevel, skillGap) {
  if (gapLevel === "No Gap") {
    return "The learner meets or exceeds the benchmark. Recommendations should focus on maintaining competency and progressing to advanced practice.";
  }

  if (gapLevel === "Very Low Gap" || Number(skillGap) <= 5) {
    return "The learner is close to the benchmark. Recommendations should focus on small corrections and confidence-building practice.";
  }

  if (gapLevel === "Low Gap" || Number(skillGap) <= 15) {
    return "The learner has a manageable gap. Recommendations should focus on targeted improvement in the weakest evidence areas.";
  }

  if (gapLevel === "Moderate Gap" || Number(skillGap) <= 25) {
    return "The learner needs structured practice. Recommendations should include concrete remediation steps, repeated implementation practice, and retesting.";
  }

  return "The learner has a serious gap. Recommendations should prioritize foundational rebuilding, guided practice, and verified resubmission evidence.";
}

function getScoreBand(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return "not measured";
  if (numericScore >= 90) return "excellent";
  if (numericScore >= 80) return "competent";
  if (numericScore >= 70) return "acceptable but improvable";
  if (numericScore >= 50) return "weak";
  return "critical";
}

function buildImprovementPriorities(scores = {}) {
  return Object.entries({
    practicalTaskScore: scores.practicalTaskScore,
    quizScore: scores.quizScore,
  })
    .map(([field, score]) => ({
      area: SCORE_AREA_LABELS[field],
      score: Number(score || 0),
      scoreBand: getScoreBand(score),
      improvementGuide: SCORE_AREA_IMPROVEMENT_GUIDE[field],
    }))
    .sort((first, second) => first.score - second.score);
}

function extractRepositoryEvidence(repositorySummary = {}) {
  const taskReview = repositorySummary.taskReview || {};
  const repositoryAssessmentEvidence =
    taskReview.repositoryAssessmentEvidence || {};
  const checklist = Array.isArray(taskReview.checklist)
    ? taskReview.checklist
    : [];

  return {
    repositoryScore: taskReview.score,
    proofLevel: taskReview.proofLevel,
    hiddenExpectedOutputTest:
      checklist.find((item) => item.key === "instructor-task-tests") || null,
    failedChecks: checklist
      .filter((item) => !item.passed)
      .map((item) => ({
        title: item.label,
        evidence: item.evidence,
        advice: item.advice,
        weight: item.weight,
      }))
      .slice(0, 8),
    passedChecks: checklist
      .filter((item) => item.passed)
      .map((item) => ({
        title: item.label,
        evidence: item.evidence,
        weight: item.weight,
      }))
      .slice(0, 8),
    executableAssessment: {
      accuracyScore: repositoryAssessmentEvidence.accuracyScore,
      executionMode: repositoryAssessmentEvidence.executionMode,
      automatedChecks:
        Number.isFinite(repositoryAssessmentEvidence.passedTestCases) &&
        Number.isFinite(repositoryAssessmentEvidence.totalTestCases)
          ? `${repositoryAssessmentEvidence.passedTestCases}/${repositoryAssessmentEvidence.totalTestCases}`
          : "",
      eslintPassed: repositoryAssessmentEvidence.eslintResult?.success,
      securityScanPassed:
        repositoryAssessmentEvidence.securityScanResult?.success,
      failedRequirements:
        repositoryAssessmentEvidence.failedRequirements || [],
      competencyScores: repositoryAssessmentEvidence.competencyScores || {},
    },
  };
}

function buildRepositorySummaryText(repositorySummary = {}) {
  // Keep the AI prompt compact by turning the repository analysis into a single
  // evidence summary instead of sending the full raw repository payload.
  const taskReview = repositorySummary.taskReview || {};
  const repositoryAssessmentEvidence =
    taskReview.repositoryAssessmentEvidence || {};
  const sampledFiles = Array.isArray(repositorySummary.sampledSourceFiles)
    ? repositorySummary.sampledSourceFiles
        .map((file) =>
          [file.path, file.language, file.excerpt]
            .map((value) => String(value || "").trim())
            .filter(Boolean)
            .join(": "),
        )
        .filter(Boolean)
    : [];
  const passedChecks = Array.isArray(taskReview.checklist)
    ? taskReview.checklist
        .filter((item) => item.passed)
        .map((item) => `${item.label}: ${item.evidence || "passed"}`)
        .slice(0, 6)
    : [];
  const failedChecks = Array.isArray(taskReview.checklist)
    ? taskReview.checklist
        .filter((item) => !item.passed)
        .map((item) => `${item.label}: ${item.advice || item.evidence || "failed"}`)
        .slice(0, 6)
    : [];
  const failedExecutableRequirements = Array.isArray(
    repositoryAssessmentEvidence.failedRequirements,
  )
    ? repositoryAssessmentEvidence.failedRequirements
        .map((item) => `${item.title}: ${item.error || "failed"}`)
        .slice(0, 6)
    : [];
  const competencyScores = repositoryAssessmentEvidence.competencyScores
    ? Object.entries(repositoryAssessmentEvidence.competencyScores)
        .map(([name, score]) => `${name}: ${score}%`)
        .join(", ")
    : "";
  const parts = [
    repositorySummary.summaryText,
    taskReview.summary,
    taskReview.proofSummary,
    Number.isFinite(taskReview.score)
      ? `Practical GitHub task score: ${taskReview.score}%.`
      : "",
    Number.isFinite(repositoryAssessmentEvidence.accuracyScore)
      ? `Executable repository assessment accuracy: ${repositoryAssessmentEvidence.accuracyScore}%.`
      : "",
    repositoryAssessmentEvidence.executionMode
      ? `Execution mode: ${repositoryAssessmentEvidence.executionMode}.`
      : "",
    Array.isArray(repositoryAssessmentEvidence.detectedTechnologies) &&
    repositoryAssessmentEvidence.detectedTechnologies.length > 0
      ? `Detected technologies: ${repositoryAssessmentEvidence.detectedTechnologies.join(", ")}.`
      : "",
    Number.isFinite(repositoryAssessmentEvidence.passedTestCases) &&
    Number.isFinite(repositoryAssessmentEvidence.totalTestCases)
      ? `Automated tests/checks passed: ${repositoryAssessmentEvidence.passedTestCases}/${repositoryAssessmentEvidence.totalTestCases}.`
      : "",
    repositoryAssessmentEvidence.eslintResult
      ? `ESLint: ${repositoryAssessmentEvidence.eslintResult.success ? "passed" : "needs work"} with ${repositoryAssessmentEvidence.eslintResult.errors || 0} error(s) and ${repositoryAssessmentEvidence.eslintResult.warnings || 0} warning(s).`
      : "",
    repositoryAssessmentEvidence.securityScanResult
      ? `Security scan: ${repositoryAssessmentEvidence.securityScanResult.success ? "passed" : "needs work"} with ${repositoryAssessmentEvidence.securityScanResult.critical || 0} critical, ${repositoryAssessmentEvidence.securityScanResult.high || 0} high issue(s).`
      : "",
    competencyScores ? `Repository competency scores: ${competencyScores}.` : "",
    passedChecks.length > 0 ? `Passed checklist items: ${passedChecks.join(" | ")}` : "",
    failedChecks.length > 0 ? `Failed checklist items: ${failedChecks.join(" | ")}` : "",
    failedExecutableRequirements.length > 0
      ? `Failed executable requirements: ${failedExecutableRequirements.join(" | ")}`
      : "",
    Number.isFinite(repositorySummary.codeQualityScore)
      ? `Repository quality score: ${repositorySummary.codeQualityScore}%.`
      : "",
    Number.isFinite(repositorySummary.evidenceCompletenessScore)
      ? `Evidence completeness score: ${repositorySummary.evidenceCompletenessScore}%.`
      : "",
    Array.isArray(repositorySummary.riskFlags) &&
    repositorySummary.riskFlags.length > 0
      ? `Evidence risk flags: ${repositorySummary.riskFlags.join("; ")}`
      : "",
    repositorySummary.description,
    repositorySummary.readmeExcerpt
      ? `README excerpt: ${repositorySummary.readmeExcerpt}`
      : "",
    sampledFiles.length > 0
      ? `Sampled source files: ${sampledFiles.join(" | ")}`
      : "",
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return parts.join(" ");
}

export function buildRecommendationContext({
  assessment,
  competency,
  assessorComment,
}) {
  // Gemini receives assessment facts and repository evidence, but scoring and
  // pass/fail decisions are already made by deterministic services.
  const repositoryEvidence = extractRepositoryEvidence(
    assessment.evidence?.repositorySummary,
  );
  const improvementPriorities = buildImprovementPriorities(assessment.scores);

  return {
    competencyTitle: competency.title,
    competencyCode: competency.code,
    competencyCategory: competency.category,
    competencyDescription: competency.description,
    benchmarkScore: assessment.benchmarkScore,
    finalScore: assessment.scores.finalScore,
    skillGap: assessment.skillGap,
    gapLevel: assessment.gapLevel,
    gapMeaning: getGapMeaning(assessment.gapLevel, assessment.skillGap),
    weakAreas: getWeakAssessmentAreas(assessment.scores),
    improvementPriorities,
    assessorComment: assessorComment || assessment.assessorComment || "",
    assessmentScores: {
      githubPracticalTaskScore: assessment.scores?.practicalTaskScore,
      githubPracticalTaskBand: getScoreBand(
        assessment.scores?.practicalTaskScore,
      ),
      theoryQuizScore: assessment.scores?.quizScore,
      theoryQuizBand: getScoreBand(assessment.scores?.quizScore),
    },
    evidenceVerification: assessment.evidenceVerification || {},
    repositoryEvidence,
    repositorySummary: buildRepositorySummaryText(
      assessment.evidence?.repositorySummary,
    ),
    recommendationRules: [
      "Base every recommendation on the measured scores, skill gap, failed checks, hidden expected-output test result, repository evidence, and assessor comment.",
      "Prioritize the lowest scoring area first.",
      "If hidden expected-output tests failed, include an action to fix the behavior required by the practical task and rerun the tests.",
      "If theory score is weak, include one action for revising the related concepts and one action for applying the concepts in code.",
      "Do not invent technologies, failures, or evidence not present in this context.",
      "Avoid generic advice such as 'study more'; give specific, observable actions the learner can complete before resubmission.",
    ],
    assessmentId: assessment._id,
  };
}

export async function generateDraftRecommendation({
  assessment,
  competency,
  assessorComment,
}) {
  return generateAiRecommendationDraft(
    buildRecommendationContext({ assessment, competency, assessorComment }),
  );
}

export async function generateAutomaticRecommendationDraft({
  assessment,
  competency,
}) {
  const context = buildRecommendationContext({ assessment, competency });

  return generateAiRecommendationDraft(context);
}

async function learnerIdsForOrganization(user) {
  return User.distinct("_id", {
    organization: user.organization?._id || user.organization,
  });
}

export async function listRecommendationsForUser(user, filters = {}) {
  const query = {};

  if (isLearnerRole(user.role)) query.graduate = user._id;
  if (user.role === ROLES.ORGANIZATION_ADMIN) {
    query.graduate = { $in: await learnerIdsForOrganization(user) };
  }
  if (filters.graduate && !isLearnerRole(user.role)) {
    query.graduate = filters.graduate;
  }
  if (filters.competency) query.competency = filters.competency;

  return Recommendation.find(query)
    .populate("graduate", "name email institution")
    .populate("competency", "title code category")
    .populate("assessor", "name email institution")
    .sort({ createdAt: -1 });
}

export async function getRecommendationForUser(recommendationId, user) {
  const query = isLearnerRole(user.role)
    ? { _id: recommendationId, graduate: user._id }
    : user.role === ROLES.ORGANIZATION_ADMIN
      ? {
          _id: recommendationId,
          graduate: { $in: await learnerIdsForOrganization(user) },
        }
      : { _id: recommendationId };
  const recommendation = await Recommendation.findOne(query)
    .populate("graduate", "name email institution")
    .populate("competency", "title code category")
    .populate("assessor", "name email institution");

  if (!recommendation) {
    throw new AppError("Recommendation was not found", 404);
  }

  return recommendation;
}

export async function updateRecommendationById(recommendationId, payload) {
  const allowedUpdates = [
    "message",
    "actionItems",
    "resources",
    "priority",
    "isApproved",
  ];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  const recommendation = await Recommendation.findByIdAndUpdate(
    recommendationId,
    updates,
    { new: true, runValidators: true },
  )
    .populate("graduate", "name email institution")
    .populate("competency", "title code category")
    .populate("assessor", "name email institution");

  if (!recommendation) {
    throw new AppError("Recommendation was not found", 404);
  }

  return recommendation;
}

export async function deleteRecommendationById(recommendationId) {
  const recommendation =
    await Recommendation.findByIdAndDelete(recommendationId);

  if (!recommendation) {
    throw new AppError("Recommendation was not found", 404);
  }

  return recommendation;
}

export async function upsertAssessmentRecommendation({
  assessment,
  assessorId,
  recommendation = {},
}) {
  const draft = recommendation.geminiDraft || recommendation.automaticDraft;

  if (!draft || !draft.message) {
    throw new AppError(
      "An automatic recommendation draft is required before saving the assessment.",
      400,
    );
  }

  const priority = draft.priority || getPriorityFromGap(assessment.gapLevel);
  const approvedMessage = recommendation.message || draft.message;
  const approvedActionItems =
    recommendation.actionItems?.length > 0
      ? recommendation.actionItems
      : draft.actionItems?.length > 0
        ? draft.actionItems
        : [];
  const approvedResources =
    recommendation.resources?.length > 0
      ? recommendation.resources
      : draft.resources;

  return Recommendation.findOneAndUpdate(
    { assessment: assessment._id },
    {
      assessment: assessment._id,
      graduate: assessment.graduate,
      competency: assessment.competency,
      assessor: assessorId,
      gapLevel: assessment.gapLevel,
      draftMessage: draft.message,
      message: approvedMessage,
      actionItems: approvedActionItems,
      resources: approvedResources || [],
      priority,
      aiProvider: draft.provider,
      aiModel: draft.model,
      aiPrompt: draft.prompt || "",
      aiRawResponse: draft.rawResponse || "",
      approvedBy: assessorId,
      approvedAt: new Date(),
      isApproved: true,
    },
    { new: true, upsert: true, runValidators: true },
  );
}

export function buildRepositoryAssessmentRecommendations(result = {}) {
  const recommendations = [];
  const failedRequirements = result.failedRequirements || [];
  const competencyScores = result.competencyScores || {};

  if (result.assessorValidationRequired) {
    recommendations.push(
      "Add objective automated tests so the system can verify requirements automatically with stronger evidence.",
    );
  }

  if (competencyScores.frontend < 70) {
    recommendations.push(
      "Improve frontend evidence by adding working pages, forms, event handlers, and clear user feedback for the practical task.",
    );
  }

  if (competencyScores.backend < 70) {
    recommendations.push(
      "Improve backend evidence by adding real API routes, controllers, services, validation, and clear responses for the required task.",
    );
  }

  if (competencyScores.database < 70) {
    recommendations.push(
      "Improve database evidence by using proper MongoDB/Mongoose schemas and CRUD operations connected to the task workflow.",
    );
  }

  if (competencyScores.authentication < 70) {
    recommendations.push(
      "Strengthen authentication by implementing secure registration, login, password hashing, JWT handling, and protected routes where required.",
    );
  }

  if (competencyScores.testing < 70) {
    recommendations.push(
      "Add Jest, Supertest, Playwright, or Cypress tests that prove the task works from API and user-interface levels.",
    );
  }

  if (failedRequirements.length > 0) {
    recommendations.push(
      `Fix failed requirements: ${failedRequirements
        .map((item) => item.title)
        .slice(0, 5)
        .join("; ")}.`,
    );
  }

  if (result.eslintResult?.errors > 0) {
    recommendations.push(
      "Resolve ESLint errors because they reduce code quality and may indicate broken or unsafe implementation.",
    );
  }

  return [...new Set(recommendations)];
}
