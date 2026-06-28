import Recommendation from "../models/Recommendation.js";
import { getPriorityFromGap } from "../utils/gapClassifier.js";
import { generateAiRecommendationDraft } from "./aiRecommendationService.js";

const SCORE_AREA_LABELS = {
  practicalTaskScore: "Practical/GitHub project",
  quizScore: "Theory questions",
  portfolioScore: "Portfolio evidence",
  selfAssessmentScore: "Self-assessment confidence",
};

export function getWeakAssessmentAreas(scores = {}) {
  return Object.entries({
    practicalTaskScore: scores.practicalTaskScore,
    quizScore: scores.quizScore,
    portfolioScore: scores.portfolioScore,
    selfAssessmentScore: scores.selfAssessmentScore,
  })
    .filter(([, score]) => Number(score) < 70)
    .sort(([, first], [, second]) => Number(first) - Number(second))
    .map(([field]) => SCORE_AREA_LABELS[field]);
}

function buildRepositorySummaryText(repositorySummary = {}) {
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

function buildRubricSummary(rubricScores = []) {
  return rubricScores
    .map((criterion) =>
      [
        criterion.name,
        `score ${criterion.score}%`,
        `weight ${criterion.weight}%`,
        criterion.comment ? `comment: ${criterion.comment}` : "",
      ]
        .filter(Boolean)
        .join(" - "),
    )
    .join(" | ");
}

export function buildRecommendationContext({
  assessment,
  competency,
  assessorComment,
}) {
  return {
    competencyTitle: competency.title,
    competencyCode: competency.code,
    benchmarkScore: assessment.benchmarkScore,
    finalScore: assessment.scores.finalScore,
    skillGap: assessment.skillGap,
    gapLevel: assessment.gapLevel,
    weakAreas: getWeakAssessmentAreas(assessment.scores),
    assessorComment: assessorComment || assessment.assessorComment || "",
    rubricScores: buildRubricSummary(assessment.scores?.rubricScores || []),
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

export function listRecommendationsForUser(user, filters = {}) {
  const query = {};

  if (user.role === "graduate") query.graduate = user._id;
  if (filters.graduate && user.role !== "graduate") {
    query.graduate = filters.graduate;
  }
  if (filters.competency) query.competency = filters.competency;

  return Recommendation.find(query)
    .populate("graduate", "name email institution")
    .populate("competency", "title code category")
    .populate("assessor", "name email institution")
    .sort({ createdAt: -1 });
}

export function generateDraftActionItems(assessment) {
  const weakAreas = getWeakAssessmentAreas(assessment.scores);

  if (assessment.gapLevel === "No Gap") {
    return [
      "Maintain competency through advanced project practice.",
      "Keep portfolio evidence updated for future employment opportunities.",
    ];
  }

  const actions = weakAreas.map(
    (area) =>
      `Improve ${area.toLowerCase()} through targeted practice and assessor feedback.`,
  );

  if (assessment.gapLevel === "High Gap") {
    actions.push(
      "Schedule guided lab sessions and repeat the competency assessment after practice.",
    );
  }

  return actions.length > 0
    ? actions
    : [
        "Review assessor comments and complete additional RTB-aligned practice tasks.",
      ];
}

export async function upsertAssessmentRecommendation({
  assessment,
  competency,
  assessorId,
  recommendation = {},
}) {
  const priority =
    recommendation.priority || getPriorityFromGap(assessment.gapLevel);
  const draft = await generateDraftRecommendation({ assessment, competency });
  const approvedMessage = recommendation.message || draft.message;
  const approvedActionItems =
    recommendation.actionItems?.length > 0
      ? recommendation.actionItems
      : draft.actionItems?.length > 0
        ? draft.actionItems
        : generateDraftActionItems(assessment);
  const approvedResources =
    recommendation.resources?.length > 0 ? recommendation.resources : draft.resources;

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
      aiPrompt: draft.prompt,
      aiRawResponse: draft.rawResponse,
      approvedBy: assessorId,
      approvedAt: new Date(),
      isApproved: true,
    },
    { new: true, upsert: true, runValidators: true },
  );
}
