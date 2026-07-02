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

export function getWeakAssessmentAreas(scores = {}) {
  return Object.entries({
    practicalTaskScore: scores.practicalTaskScore,
    quizScore: scores.quizScore,
  })
    .filter(([, score]) => Number(score) < 70)
    .sort(([, first], [, second]) => Number(first) - Number(second))
    .map(([field]) => SCORE_AREA_LABELS[field]);
}

function buildRepositorySummaryText(repositorySummary = {}) {
  // Keep the AI prompt compact by turning the repository analysis into a single
  // evidence summary instead of sending the full raw repository payload.
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
  const parts = [
    repositorySummary.summaryText,
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
  return {
    competencyTitle: competency.title,
    competencyCode: competency.code,
    benchmarkScore: assessment.benchmarkScore,
    finalScore: assessment.scores.finalScore,
    skillGap: assessment.skillGap,
    gapLevel: assessment.gapLevel,
    weakAreas: getWeakAssessmentAreas(assessment.scores),
    assessorComment: assessorComment || assessment.assessorComment || "",
    assessmentScores: {
      githubPracticalTaskScore: assessment.scores?.practicalTaskScore,
      theoryQuizScore: assessment.scores?.quizScore,
    },
    evidenceVerification: assessment.evidenceVerification || {},
    repositorySummary: buildRepositorySummaryText(
      assessment.evidence?.repositorySummary,
    ),
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

function buildRuleBasedRecommendationDraft(context) {
  const weakAreas = context.weakAreas?.length
    ? context.weakAreas.join(", ")
    : "the assessed competency";
  const priority = getPriorityFromGap(context.gapLevel);
  const actionItems = [
    `Improve ${weakAreas} with a focused practical exercise.`,
    "Fix failed repository checklist items and rerun the automated assessment.",
    "Add automated tests that prove the practical task works end to end.",
  ];

  if (context.gapLevel === "No Gap") {
    actionItems.unshift("Maintain the current standard by practicing a more advanced version of the task.");
  }

  return {
    message: `Automatic recommendation: final score ${context.finalScore}% against benchmark ${context.benchmarkScore}% produced a ${context.gapLevel}. Focus next on ${weakAreas}.`,
    actionItems,
    resources: [
      "Review the repository analysis checklist in the assessment report.",
      "Use the RTB competency requirements as the improvement checklist.",
    ],
    priority,
    provider: "rule_based",
    model: "local-rubric-v1",
    prompt: JSON.stringify(context),
    rawResponse: "",
  };
}

export async function generateAutomaticRecommendationDraft({
  assessment,
  competency,
}) {
  const context = buildRecommendationContext({ assessment, competency });

  try {
    return await generateAiRecommendationDraft(context);
  } catch (error) {
    return {
      ...buildRuleBasedRecommendationDraft(context),
      aiFallbackReason: error.message,
    };
  }
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
