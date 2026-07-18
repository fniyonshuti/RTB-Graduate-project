import Recommendation from "../models/Recommendation.js";
import User from "../models/User.js";
import { AppError } from "./errorService.js";
import { isLearnerRole, ROLES } from "../constants/roles.js";

function getPriorityFromGap(gapLevel) {
  if (gapLevel === "High Gap") return "high";
  if (gapLevel === "Moderate Gap") return "medium";
  return "low";
}

// Gemini prompt creation and API calls are kept with recommendation logic.

const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_RECOMMENDATION_MODEL ||
  "gemini-2.5-flash";

function safeString(value, defaultValue = "") {
  return String(value ?? defaultValue).trim();
}

function normalizeList(values = []) {
  return Array.isArray(values)
    ? values.map((value) => safeString(value)).filter(Boolean)
    : [];
}

function resourceSearchUrl() {
  return safeString(process.env.RESOURCE_SEARCH_URL);
}

function configuredLearningResourceUrls() {
  const rawValue = safeString(process.env.LEARNING_RESOURCE_URLS_JSON);
  if (!rawValue) return {};

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function configuredLearningResourceUrl(key) {
  return safeString(configuredLearningResourceUrls()[key]);
}

function buildSearchUrl(query) {
  const normalizedQuery = safeString(query);
  const configuredSearchUrl = resourceSearchUrl();
  if (!normalizedQuery || !configuredSearchUrl) return "";

  const encodedQuery = encodeURIComponent(normalizedQuery);

  if (configuredSearchUrl.includes("{query}")) {
    return configuredSearchUrl.replace("{query}", encodedQuery);
  }

  if (configuredSearchUrl.endsWith("=") || configuredSearchUrl.endsWith("/")) {
    return `${configuredSearchUrl}${encodedQuery}`;
  }

  const separator = configuredSearchUrl.includes("?") ? "&" : "?q=";
  return `${configuredSearchUrl}${separator}${encodedQuery}`;
}

const RESOURCE_TYPES = new Set([
  "video",
  "course",
  "documentation",
  "practice",
  "article",
  "tool",
  "other",
]);

function normalizeLearningResource(resource) {
  if (!resource) return null;

  if (typeof resource === "string") {
    const title = safeString(resource);
    if (!title) return null;
    const directUrl = title.match(/https:\/\/[^\s),;]+/i)?.[0] || "";
    return {
      type: "other",
      title,
      provider: "Search",
      url: directUrl || buildSearchUrl(title),
      searchQuery: title,
      skillArea: "General improvement",
      reason: "Suggested by Gemini as a helpful learning resource.",
    };
  }

  const type = safeString(resource.type || "other").toLowerCase();
  const title = safeString(resource.title || resource.name || resource.resource);
  const url = safeString(resource.url || resource.link);
  const searchQuery = safeString(resource.searchQuery || resource.query);

  if (!title && !url && !searchQuery) return null;

  const finalSearchQuery = searchQuery || title || url;
  return {
    type: RESOURCE_TYPES.has(type) ? type : "other",
    title: title || searchQuery || url,
    provider: safeString(resource.provider || resource.source || (url ? "" : "Search")),
    url: url || buildSearchUrl(finalSearchQuery),
    searchQuery: finalSearchQuery,
    skillArea: safeString(resource.skillArea || resource.area || "General improvement"),
    reason: safeString(resource.reason || resource.description || "Use this resource to address the measured skill gap."),
  };
}

function normalizeLearningResources(values = []) {
  return Array.isArray(values)
    ? values.map(normalizeLearningResource).filter(Boolean).slice(0, 6)
    : [];
}

function hasValidResourceLink(resource = {}) {
  return /^https:\/\//i.test(safeString(resource.url));
}

function resourceSummaryHasLink(summary = "") {
  return /https:\/\//i.test(safeString(summary));
}

function linkedLearningResources(values = []) {
  return normalizeLearningResources(values).filter(hasValidResourceLink);
}

function learningResourceToSummary(resource) {
  return [
    resource.type ? `${resource.type}:` : "Resource:",
    resource.title,
    resource.provider ? `(${resource.provider})` : "",
    resource.url || resource.searchQuery ? `- ${resource.url || resource.searchQuery}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}


function normalizeResourceSummaries(values = []) {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => {
      return learningResourceToSummary(normalizeLearningResource(value) || {});
    })
    .filter(Boolean)
    .slice(0, 6);
}

function buildGeminiUrl(apiKey) {
  const configuredUrl = safeString(process.env.GEMINI_RECOMMENDATION_API_URL);
  const geminiApiBaseUrl = safeString(process.env.GEMINI_API_BASE_URL).replace(
    /\/+$/,
    "",
  );

  if (!configuredUrl && !geminiApiBaseUrl) {
    throw new AppError(
      "GEMINI_API_BASE_URL or GEMINI_RECOMMENDATION_API_URL is required for Gemini recommendation generation",
      500,
    );
  }

  const url =
    configuredUrl ||
    `${geminiApiBaseUrl}/${DEFAULT_GEMINI_MODEL}:generateContent`;
  const separator = url.includes("?") ? "&" : "?";

  return `${url}${separator}key=${encodeURIComponent(apiKey)}`;
}

async function fetchGeminiJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const normalizedError = errorBody.toLowerCase();

    if (
      response.status === 429 ||
      normalizedError.includes("resource_exhausted") ||
      normalizedError.includes("quota")
    ) {
      throw new AppError(
        "Gemini recommendation quota is temporarily exhausted. Wait a few seconds, then click Generate Gemini recommendation again.",
        429,
      );
    }

    throw new AppError(
      `Gemini recommendation API returned ${response.status}. Check your Gemini API key, model, and request configuration.`,
      response.status,
    );
  }

  return response.json();
}

function extractResponseText(payload) {
  if (!payload) return "";

  if (typeof payload === "string") {
    return payload;
  }

  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n") ||
    ""
  );
}

function buildPrompt(context) {
  return [
    "You are an evidence-based recommendation engine for an ICT TVET skills gap analysis system.",
    "Return only valid JSON. Do not wrap the JSON in markdown fences.",
    "Return a single JSON object with exactly these keys: message, actionItems, resources, learningResources, priority.",
    "The message must be a concise learner-ready recommendation in plain language and must mention the gap level, final score, benchmark, strongest practical weakness, and at least one measured strength.",
    "For weak or poor performance, clearly explain what practical skill evidence is weak, what evidence is strong, and why the recommendation will close the measured gap.",
    "actionItems must be an array of 3 to 6 short, measurable improvement actions that tell the learner exactly what to fix, practice, retest, or submit next.",
    "Each action item must be directly connected to the weakest score area, failed repository checks, hidden expected-output test result, theory score, assessor comment, or benchmark gap.",
    "resources must be an array of 2 to 5 short resource summary strings and every resource summary must include a direct https URL.",
    "learningResources must be an array of 2 to 5 objects. Each object must include: type, title, provider, url, searchQuery, skillArea, reason. The url field is required and must be a valid https link.",
    "Resource type must be one of: video, course, documentation, practice, article, tool, other.",
    "Every learning resource must address a specific weak area, failed repository check, failed hidden test, theory weakness, security issue, or benchmark gap. Prefer beginner-friendly free resources with stable URLs; when unsure, use a search URL generated from a precise searchQuery and the configured RESOURCE_SEARCH_URL.",
    "Do not return a recommendation without learning resources. The resources are required because the learner must know exactly where to learn and practice to close the gap.",
    "priority must be one of low, medium, or high.",
    "Use the supplied RTB benchmark, final score, skill gap, gap meaning, weak areas, strengths, practical weaknesses, improvement priorities, repository evidence, repository summary, and automatic review note.",
    "Keep the recommendation aligned to the selected competency and the evidence reviewed.",
    "If the hidden expected-output test failed or was not configured, include a practical action that improves objective proof before resubmission.",
    "If GitHub/practical score is lower than theory score, focus first on implementation, tests, and repository evidence because the gap is mainly practical.",
    "If theory score is lower than practical score, focus first on concepts and applying those concepts in the code.",
    "If there is No Gap, recommend advanced practice, portfolio strengthening, and maintaining evidence quality instead of remediation.",
    "Do not invent facts, tools, scores, failures, or technologies that are not present in the context.",
    "Do not provide generic advice; every action must be observable, assessable, and written as a concrete action plan for closing the measured gap.",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function cleanJsonText(rawText) {
  return safeString(rawText)
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseDraftResponse(rawText, prompt, context = {}) {
  const trimmed = safeString(rawText);

  if (!trimmed) {
    throw new AppError("Gemini returned an empty recommendation response", 502);
  }

  try {
    const parsed = JSON.parse(cleanJsonText(trimmed));
    const actionItems = normalizeList(parsed.actionItems);
    const fallbackLearningResources = linkedLearningResources(
      context.suggestedLearningResources,
    );
    const geminiLearningResources = linkedLearningResources(
      parsed.learningResources || parsed.resources,
    );
    const finalLearningResources =
      geminiLearningResources.length > 0
        ? geminiLearningResources
        : fallbackLearningResources;
    const resourceSummaries = normalizeResourceSummaries(parsed.resources).filter(resourceSummaryHasLink);
    const resources = resourceSummaries.length >= 2
      ? resourceSummaries
      : finalLearningResources.map(learningResourceToSummary).filter(resourceSummaryHasLink);
    const priority = ["low", "medium", "high"].includes(parsed.priority)
      ? parsed.priority
      : "low";
    const message = safeString(parsed.message);

    if (!message) {
      throw new Error("Gemini JSON is missing message");
    }

    if (actionItems.length < 2) {
      throw new Error("Gemini JSON must include evidence-based action items");
    }

    if (finalLearningResources.length < 2 || resources.length < 2) {
      throw new Error("Gemini recommendation must include at least two practical learning resource links for the measured performance gap");
    }

    return {
      message,
      actionItems,
      resources,
      learningResources: finalLearningResources,
      priority,
      provider: "gemini",
      model: DEFAULT_GEMINI_MODEL,
      prompt,
      rawResponse: trimmed,
    };
  } catch {
    throw new AppError(
      "Gemini recommendation response was not valid JSON",
      502,
    );
  }
}

export async function generateAiRecommendationDraft(context) {
  const apiKey = safeString(process.env.GEMINI_API_KEY);

  if (!apiKey) {
    throw new AppError(
      "Gemini API key is required for recommendation generation",
      500,
    );
  }

  const prompt = buildPrompt(context);
  const payload = await fetchGeminiJson(buildGeminiUrl(apiKey), {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
  const rawResponse = extractResponseText(payload);

  return parseDraftResponse(rawResponse, prompt, context);
}

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


const LEARNING_RESOURCE_CATALOG = {
  practicalTaskScore: [
    {
      type: "course",
      title: "freeCodeCamp JavaScript Algorithms and Data Structures",
      provider: "freeCodeCamp",
      url: configuredLearningResourceUrl("freecodecamp_javascript_algorithms"),
      searchQuery: "freeCodeCamp JavaScript Algorithms and Data Structures",
      skillArea: "Programming fundamentals",
      reason: "Useful when practical code fails expected behavior or edge-case tests.",
    },
    {
      type: "documentation",
      title: "MDN JavaScript Guide",
      provider: "MDN Web Docs",
      url: configuredLearningResourceUrl("mdn_javascript_guide"),
      searchQuery: "MDN JavaScript Guide",
      skillArea: "JavaScript implementation",
      reason: "Helps strengthen syntax, data handling, functions, and control flow used in practical tasks.",
    },
    {
      type: "practice",
      title: "Build and test one small feature with input, output, validation, and error handling",
      provider: "Competra practice plan",
      url: configuredLearningResourceUrl("mdn_form_validation"),
      searchQuery: "practice building tested web app feature input validation error handling",
      skillArea: "Verified implementation",
      reason: "Directly improves objective proof before resubmission.",
    },
  ],
  frontend: [
    {
      type: "documentation",
      title: "React Learn",
      provider: "React",
      url: configuredLearningResourceUrl("react_learn"),
      searchQuery: "React official learn components forms state",
      skillArea: "Frontend UI",
      reason: "Useful when UI components, forms, state, or interaction evidence is weak.",
    },
    {
      type: "video",
      title: "React forms and state management tutorial",
      provider: "YouTube search",
      url: configuredLearningResourceUrl("react_input_reference"),
      searchQuery: "React forms state management validation tutorial",
      skillArea: "Frontend forms",
      reason: "Helps learners practice form handling and visible user feedback.",
    },
  ],
  backend: [
    {
      type: "documentation",
      title: "Express Routing Guide",
      provider: "Express.js",
      url: configuredLearningResourceUrl("express_routing_guide"),
      searchQuery: "Express routing guide controllers services validation",
      skillArea: "Backend APIs",
      reason: "Useful when API route or controller evidence is missing or incorrect.",
    },
    {
      type: "course",
      title: "Node.js and Express API course",
      provider: "freeCodeCamp / YouTube search",
      url: configuredLearningResourceUrl("freecodecamp_node_express_mongodb_api"),
      searchQuery: "Node.js Express REST API MongoDB JWT freeCodeCamp course",
      skillArea: "Backend API development",
      reason: "Supports practical API implementation and integration practice.",
    },
  ],
  database: [
    {
      type: "course",
      title: "MongoDB University Mongoose or Node.js learning path",
      provider: "MongoDB University",
      url: configuredLearningResourceUrl("mongodb_university"),
      searchQuery: "MongoDB University Node.js Mongoose CRUD",
      skillArea: "Database persistence",
      reason: "Useful when CRUD, schema, or persistence checks fail.",
    },
  ],
  authentication: [
    {
      type: "article",
      title: "OWASP Authentication Cheat Sheet",
      provider: "OWASP",
      url: configuredLearningResourceUrl("owasp_authentication_cheat_sheet"),
      searchQuery: "OWASP Authentication Cheat Sheet JWT password hashing",
      skillArea: "Secure authentication",
      reason: "Helps correct weak login, password, JWT, and protected-route implementations.",
    },
  ],
  testing: [
    {
      type: "documentation",
      title: "Jest Getting Started",
      provider: "Jest",
      url: configuredLearningResourceUrl("jest_getting_started"),
      searchQuery: "Jest getting started tests JavaScript",
      skillArea: "Automated tests",
      reason: "Useful when submitted tests or hidden tests fail.",
    },
    {
      type: "documentation",
      title: "Supertest API testing",
      provider: "npm / GitHub",
      url: configuredLearningResourceUrl("supertest_github"),
      searchQuery: "Supertest Express API testing examples",
      skillArea: "API integration testing",
      reason: "Helps learners prove API behavior with repeatable tests.",
    },
  ],
  security: [
    {
      type: "article",
      title: "OWASP Top 10 Web Application Security Risks",
      provider: "OWASP",
      url: configuredLearningResourceUrl("owasp_top_ten"),
      searchQuery: "OWASP Top 10 web application security risks",
      skillArea: "Security",
      reason: "Useful when security scan, hardcoded secret, or authentication checks fail.",
    },
  ],
  quizScore: [
    {
      type: "course",
      title: "CS50 Web Programming with Python and JavaScript",
      provider: "Harvard / edX",
      url: configuredLearningResourceUrl("cs50_web_programming"),
      searchQuery: "CS50 Web Programming Python JavaScript web development concepts",
      skillArea: "Web development theory",
      reason: "Helps connect theory concepts with practical implementation.",
    },
    {
      type: "documentation",
      title: "MDN Learn Web Development",
      provider: "MDN Web Docs",
      url: configuredLearningResourceUrl("mdn_learn_web_development"),
      searchQuery: "MDN Learn Web Development HTML CSS JavaScript HTTP",
      skillArea: "Web fundamentals",
      reason: "Good for revising core concepts missed in theory questions.",
    },
  ],
};

function buildSuggestedLearningResources(scoreImprovementPriorities = [], repositoryEvidenceSummary = {}) {
  const resources = [];
  const addResources = (key) => {
    (LEARNING_RESOURCE_CATALOG[key] || []).forEach((resource) => resources.push(resource));
  };

  scoreImprovementPriorities.forEach((priority) => {
    if (priority.area === SCORE_AREA_LABELS.practicalTaskScore) addResources("practicalTaskScore");
    if (priority.area === SCORE_AREA_LABELS.quizScore) addResources("quizScore");
  });

  const failedRequirements = repositoryEvidenceSummary.executableAssessment?.failedRequirements || [];
  failedRequirements.forEach((requirement) => {
    const competency = safeString(requirement.competency).toLowerCase();
    if (competency) addResources(competency);
    if (/security|secret|auth/i.test(requirement.title || requirement.error || "")) addResources("security");
  });

  if (repositoryEvidenceSummary.hiddenExpectedOutputTest?.passed === false) {
    addResources("testing");
    addResources("practicalTaskScore");
  }

  return Array.from(
    new Map(resources.map((resource) => [`${resource.type}:${resource.title}`, resource])).values(),
  ).slice(0, 8);
}

export function getWeakAssessmentAreas(scores = {}) {
  return Object.entries({
    practicalTaskScore: scores.practicalTaskScore,
    quizScore: scores.quizScore,
  })
    .filter(([, score]) => Number(score) < 70)
    .sort(([, first], [, second]) => Number(first) - Number(second))
    .map(([field]) => SCORE_AREA_LABELS[field]);
}

function explainGapLevelMeaning(gapLevel, skillGap) {
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

function classifyScoreBand(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return "not measured";
  if (numericScore >= 90) return "excellent";
  if (numericScore >= 80) return "competent";
  if (numericScore >= 70) return "acceptable but improvable";
  if (numericScore >= 50) return "weak";
  return "critical";
}

function buildScoreImprovementPriorities(scores = {}) {
  return Object.entries({
    practicalTaskScore: scores.practicalTaskScore,
    quizScore: scores.quizScore,
  })
    .map(([field, score]) => ({
      area: SCORE_AREA_LABELS[field],
      score: Number(score || 0),
      scoreBand: classifyScoreBand(score),
      improvementGuide: SCORE_AREA_IMPROVEMENT_GUIDE[field],
    }))
    .sort((first, second) => first.score - second.score);
}

function extractRepositoryEvidenceSummary(repositorySummary = {}) {
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

function buildMeasuredStrengths(scores = {}, repositoryEvidenceSummary = {}) {
  const strengths = [];
  const practicalScore = Number(scores.practicalTaskScore || 0);
  const quizScore = Number(scores.quizScore || 0);

  if (practicalScore >= 70) {
    strengths.push(`Practical/GitHub evidence scored ${practicalScore}%, showing usable implementation evidence.`);
  }

  if (quizScore >= 70) {
    strengths.push(`Theory evidence scored ${quizScore}%, showing acceptable conceptual understanding.`);
  }

  (repositoryEvidenceSummary.passedChecks || []).slice(0, 4).forEach((check) => {
    strengths.push(`Passed practical check: ${check.title}.`);
  });

  if (repositoryEvidenceSummary.executableAssessment?.eslintPassed) {
    strengths.push("Code quality evidence passed ESLint checks.");
  }

  if (repositoryEvidenceSummary.executableAssessment?.securityScanPassed) {
    strengths.push("Security evidence did not show critical scan failures.");
  }

  return strengths.length > 0
    ? strengths.slice(0, 6)
    : ["The learner completed the required assessment submission and provided evidence for review."];
}

function buildPracticalWeaknesses(scores = {}, repositoryEvidenceSummary = {}) {
  const weaknesses = [];
  const practicalScore = Number(scores.practicalTaskScore || 0);

  if (practicalScore < 70) {
    weaknesses.push(`Practical/GitHub score is ${practicalScore}%, so implementation evidence is below the expected competency level.`);
  }

  if (repositoryEvidenceSummary.hiddenExpectedOutputTest?.passed === false) {
    weaknesses.push("Hidden expected-output test failed, so the submitted code did not fully prove the practical task behavior.");
  }

  (repositoryEvidenceSummary.failedChecks || []).slice(0, 5).forEach((check) => {
    weaknesses.push(`Failed practical checklist item: ${check.title}. ${check.advice || check.evidence || "Improve this requirement before resubmission."}`);
  });

  (repositoryEvidenceSummary.executableAssessment?.failedRequirements || []).slice(0, 5).forEach((requirement) => {
    weaknesses.push(`Failed executable requirement: ${requirement.title || requirement.competency}. ${requirement.error || "Repository evidence did not satisfy this check."}`);
  });

  return weaknesses.length > 0
    ? weaknesses.slice(0, 8)
    : ["No major practical weakness was detected from the submitted repository evidence."];
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

// Recommendation context preparation
export function buildRecommendationContext({
  assessment,
  competency,
  assessorComment,
}) {
  // Gemini receives assessment facts and repository evidence, but scoring and
  // pass/fail decisions are already made by deterministic services.
  const repositoryEvidenceSummary = extractRepositoryEvidenceSummary(
    assessment.evidence?.repositorySummary,
  );
  const scoreImprovementPriorities = buildScoreImprovementPriorities(assessment.scores);
  const suggestedLearningResources = buildSuggestedLearningResources(
    scoreImprovementPriorities,
    repositoryEvidenceSummary,
  );

  return {
    competencyTitle: competency.title,
    competencyCode: competency.code,
    competencyCategory: competency.category,
    competencyDescription: competency.description,
    benchmarkScore: assessment.benchmarkScore,
    finalScore: assessment.scores.finalScore,
    skillGap: assessment.skillGap,
    gapLevel: assessment.gapLevel,
    gapMeaning: explainGapLevelMeaning(assessment.gapLevel, assessment.skillGap),
    weakAreas: getWeakAssessmentAreas(assessment.scores),
    scoreImprovementPriorities,
    strengths: buildMeasuredStrengths(assessment.scores, repositoryEvidenceSummary),
    practicalWeaknesses: buildPracticalWeaknesses(assessment.scores, repositoryEvidenceSummary),
    suggestedLearningResources,
    assessorComment: assessorComment || assessment.assessorComment || "",
    assessmentScores: {
      githubPracticalTaskScore: assessment.scores?.practicalTaskScore,
      githubPracticalTaskBand: classifyScoreBand(
        assessment.scores?.practicalTaskScore,
      ),
      theoryQuizScore: assessment.scores?.quizScore,
      theoryQuizBand: classifyScoreBand(assessment.scores?.quizScore),
    },
    evidenceVerification: assessment.evidenceVerification || {},
    repositoryEvidenceSummary,
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

// Recommendation persistence and approval
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
  const approvedLearningResources =
    recommendation.learningResources?.length > 0
      ? linkedLearningResources(recommendation.learningResources)
      : draft.learningResources?.length > 0
        ? linkedLearningResources(draft.learningResources)
        : linkedLearningResources(recommendation.resources || draft.resources || []);
  const resourceSummaries = normalizeResourceSummaries(
    recommendation.resources?.length > 0 ? recommendation.resources : draft.resources,
  ).filter(resourceSummaryHasLink);
  const approvedResources = resourceSummaries.length >= 2
    ? resourceSummaries
    : approvedLearningResources.map(learningResourceToSummary).filter(resourceSummaryHasLink);

  if (approvedLearningResources.length < 2 || approvedResources.length < 2) {
    throw new AppError(
      "Recommendation must include at least two learning resource links connected to the measured gap.",
      400,
    );
  }

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
      learningResources: approvedLearningResources || [],
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

class RecommendationService {
  getWeakAssessmentAreas = getWeakAssessmentAreas;
  buildRecommendationContext = buildRecommendationContext;
  generateDraftRecommendation = generateDraftRecommendation;
  generateAutomaticRecommendationDraft = generateAutomaticRecommendationDraft;
  listRecommendationsForUser = listRecommendationsForUser;
  getRecommendationForUser = getRecommendationForUser;
  updateRecommendationById = updateRecommendationById;
  deleteRecommendationById = deleteRecommendationById;
  upsertAssessmentRecommendation = upsertAssessmentRecommendation;
  buildRepositoryAssessmentRecommendations = buildRepositoryAssessmentRecommendations;
}

const recommendationService = new RecommendationService();

export default recommendationService;

