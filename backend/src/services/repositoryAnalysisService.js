import { AppError } from "../utils/errors.js";

const GITHUB_REPO_PATTERN =
  /^https?:\/\/(www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/)?$/;

const SUPPORTED_CODE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".html",
  ".css",
  ".scss",
  ".json",
  ".py",
  ".java",
  ".php",
  ".cs",
  ".cpp",
  ".c",
  ".sql",
  ".md",
]);

const TEST_FILE_PATTERN = /(^|\/)(test|tests|__tests__|spec)(\/|\.|-|_)/i;
const CONFIG_FILE_PATTERN =
  /(^|\/)(package\.json|vite\.config\.[jt]s|webpack\.config\.[jt]s|tsconfig\.json|eslint\.config\.[jt]s|\.eslintrc(\.json)?|requirements\.txt|pom\.xml|composer\.json)$/i;
const PACKAGE_FILE_PATTERN = /(^|\/)package\.json$/i;
const CI_WORKFLOW_PATTERN = /^\.github\/workflows\/.+\.(ya?ml)$/i;

const STOP_WORDS = new Set([
  "and",
  "the",
  "with",
  "that",
  "this",
  "from",
  "must",
  "your",
  "into",
  "using",
  "work",
  "task",
  "module",
  "project",
  "system",
  "include",
  "create",
  "build",
  "allows",
  "should",
  "would",
  "there",
  "their",
  "have",
  "will",
  "also",
  "such",
  "each",
]);

const FUNCTIONAL_SIGNAL_GROUPS = [
  {
    key: "authentication",
    label: "authentication",
    terms: [
      "login",
      "register",
      "signup",
      "signin",
      "jwt",
      "token",
      "bcrypt",
      "password",
      "auth",
    ],
    patterns: [
      /\b(jwt|jsonwebtoken|bcrypt|passport)\b/i,
      /\b(login|register|signup|signin)\b/i,
    ],
  },
  {
    key: "api",
    label: "backend API routes",
    terms: [
      "api",
      "route",
      "endpoint",
      "controller",
      "express",
      "request",
      "response",
    ],
    patterns: [
      /\b(router|express|app)\.(get|post|put|patch|delete)\b/i,
      /\b(req|res)\b/i,
    ],
  },
  {
    key: "database",
    label: "database persistence",
    terms: [
      "database",
      "mongodb",
      "mongoose",
      "schema",
      "model",
      "save",
      "find",
      "update",
    ],
    patterns: [
      /\b(mongoose|mongodb|schema|model)\b/i,
      /\.(save|find|findOne|create|updateOne|findByIdAndUpdate)\b/i,
    ],
  },
  {
    key: "frontend",
    label: "frontend UI/forms",
    terms: [
      "form",
      "input",
      "button",
      "component",
      "page",
      "dashboard",
      "profile",
      "submit",
    ],
    patterns: [
      /<(form|input|button|select|textarea)\b/i,
      /\b(useState|onSubmit|onChange|component)\b/i,
    ],
  },
  {
    key: "crud",
    label: "CRUD operations",
    terms: ["create", "read", "update", "delete", "edit", "view", "manage"],
    patterns: [
      /\b(create|read|update|delete|edit|view|manage)\b/i,
      /\.(post|get|put|patch|delete)\b/i,
    ],
  },
  {
    key: "validation",
    label: "validation and error handling",
    terms: [
      "validate",
      "validation",
      "required",
      "error",
      "success",
      "message",
    ],
    patterns: [
      /\b(validate|validation|required|try\s*{|catch\s*\(|throw new Error|status\()\b/i,
    ],
  },
  {
    key: "security",
    label: "security/protected access",
    terms: [
      "protected",
      "authorization",
      "middleware",
      "role",
      "permission",
      "secure",
    ],
    patterns: [
      /\b(authorization|authenticate|authorize|middleware|protected|role|permission)\b/i,
    ],
  },
  {
    key: "testing",
    label: "testing evidence",
    terms: ["test", "testing", "spec", "describe", "expect"],
    patterns: [/\b(describe|it|test|expect)\s*\(/i, /\.(test|spec)\.[jt]sx?$/i],
  },
];

function envNumber(name, defaultValue) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function githubApiBaseUrl() {
  return trimTrailingSlash(
    process.env.GITHUB_API_BASE_URL || "https://api.github.com",
  );
}

function githubRawBaseUrl() {
  return trimTrailingSlash(
    process.env.GITHUB_RAW_BASE_URL || "https://raw.githubusercontent.com",
  );
}

function getExtension(path = "") {
  const match = path.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function withTimeout(ms = envNumber("GITHUB_REQUEST_TIMEOUT_MS", 10000)) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
}

function buildGitHubHeaders(accept) {
  const headers = {
    Accept: accept,
    "User-Agent": "rtb-skills-gap-analysis-tool",
    "X-GitHub-Api-Version": process.env.GITHUB_API_VERSION || "2022-11-28",
  };

  const githubToken = String(process.env.GITHUB_TOKEN || "").trim();

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  return headers;
}

async function fetchGitHubJson(url) {
  const { controller, timeout } = withTimeout();

  try {
    const response = await fetch(url, {
      headers: buildGitHubHeaders("application/vnd.github+json"),
      signal: controller.signal,
    });

    if (!response.ok) {
      const hint =
        response.status === 404
          ? "Repository was not found. Check the owner/repo URL, repository privacy, and GITHUB_TOKEN access."
          : response.status === 401 || response.status === 403
            ? "GitHub authentication failed or rate limit was reached. Check GITHUB_TOKEN and token permissions."
            : "GitHub request failed.";
      throw new Error(`GitHub API returned ${response.status}. ${hint}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGitHubText(url) {
  const { controller, timeout } = withTimeout();

  try {
    const response = await fetch(url, {
      headers: buildGitHubHeaders("text/plain"),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub raw content returned ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function compactText(value = "", maxLength = 1200) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function parsePackageScripts(packageContent = "") {
  try {
    const packageJson = JSON.parse(packageContent || "{}");
    const scripts = packageJson?.scripts || {};

    return {
      scripts,
      testScriptFound:
        typeof scripts.test === "string" && scripts.test.trim().length > 0,
      buildScriptFound:
        typeof scripts.build === "string" && scripts.build.trim().length > 0,
    };
  } catch {
    return {
      scripts: {},
      testScriptFound: false,
      buildScriptFound: false,
    };
  }
}

function summarizeWorkflowRuns(runs = []) {
  const latestRun = Array.isArray(runs) && runs.length > 0 ? runs[0] : null;

  return {
    ciRunFound: Boolean(latestRun),
    ciRunName: latestRun?.name || "",
    ciRunStatus: latestRun?.status || "",
    ciRunConclusion: latestRun?.conclusion || "",
    ciRunUrl: latestRun?.html_url || "",
    ciRunUpdatedAt: latestRun?.updated_at || latestRun?.created_at || "",
    ciPassing:
      latestRun?.status === "completed" && latestRun?.conclusion === "success",
  };
}

function extractKeywords(...values) {
  const text = values.join(" ").toLowerCase();
  const words = text.match(/[a-z0-9]{4,}/g) || [];
  const uniqueWords = [...new Set(words)]
    .filter((word) => !STOP_WORDS.has(word))
    .slice(0, 18);

  return uniqueWords;
}

function normalizeSearchText(...values) {
  return values
    .join(" ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function includesAny(text, terms = []) {
  return terms.some((term) => text.includes(term));
}

function patternMatches(text, patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

function scoreRatio(matched, total) {
  return total > 0 ? Math.round((matched / total) * 10000) / 100 : 100;
}

function sortSourceFilesForReview(files = [], taskKeywords = []) {
  return [...files].sort((left, right) => {
    const scoreFile = (file) => {
      const path = String(file.path || "").toLowerCase();
      const keywordScore = taskKeywords.filter((keyword) =>
        path.includes(keyword),
      ).length;
      const testScore = TEST_FILE_PATTERN.test(path) ? 4 : 0;
      const configScore = CONFIG_FILE_PATTERN.test(path) ? 3 : 0;
      const sourceScore = [
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".py",
        ".java",
        ".php",
      ].includes(getExtension(path))
        ? 2
        : 0;
      const readmePenalty = getExtension(path) === ".md" ? -1 : 0;

      return (
        keywordScore * 5 + testScore + configScore + sourceScore + readmePenalty
      );
    };

    return scoreFile(right) - scoreFile(left);
  });
}

function evaluateTaskImplementation({
  repositorySummary,
  competency,
  practicalTask,
  taskKeywords,
}) {
  // Static implementation review estimates task alignment from source excerpts.
  // It is intentionally evidence-based, not a claim that the code fully works.
  const sourceFiles = repositorySummary.sampledSourceFiles || [];
  const sourceText = normalizeSearchText(
    ...sourceFiles.map(
      (file) => `${file.path} ${file.language} ${file.excerpt}`,
    ),
  );
  const taskText = normalizeSearchText(
    competency?.title || "",
    competency?.description || "",
    practicalTask?.title || "",
    practicalTask?.instructions || "",
    practicalTask?.deliverables || "",
  );
  const implementationKeywordMatches = taskKeywords.filter((keyword) =>
    sourceText.includes(keyword),
  );
  const implementationKeywordRate = scoreRatio(
    implementationKeywordMatches.length,
    taskKeywords.length,
  );
  const expectedSignalGroups = FUNCTIONAL_SIGNAL_GROUPS.filter((group) =>
    includesAny(taskText, group.terms),
  );
  const detectedSignalGroups = FUNCTIONAL_SIGNAL_GROUPS.filter(
    (group) =>
      includesAny(sourceText, group.terms) ||
      patternMatches(sourceText, group.patterns),
  );
  const expectedGroupsToCheck =
    expectedSignalGroups.length > 0
      ? expectedSignalGroups
      : FUNCTIONAL_SIGNAL_GROUPS.filter((group) =>
          ["api", "database", "frontend", "crud", "validation"].includes(
            group.key,
          ),
        );
  // When the task text does not clearly name a domain, check core app-building
  // signals so generic tasks still require real implementation evidence.
  const matchedExpectedGroups = expectedGroupsToCheck.filter((group) =>
    detectedSignalGroups.some((detected) => detected.key === group.key),
  );
  const functionalCoverageRate = scoreRatio(
    matchedExpectedGroups.length,
    expectedGroupsToCheck.length,
  );
  const actionVerbs = [
    "register",
    "login",
    "logout",
    "create",
    "view",
    "read",
    "update",
    "edit",
    "delete",
    "submit",
    "save",
    "validate",
    "upload",
    "download",
    "generate",
    "calculate",
    "manage",
    "search",
    "filter",
    "approve",
    "review",
  ];
  const expectedActions = actionVerbs.filter((verb) => taskText.includes(verb));
  const matchedActions = expectedActions.filter((verb) =>
    sourceText.includes(verb),
  );
  const actionCoverageRate = scoreRatio(
    matchedActions.length,
    expectedActions.length,
  );
  const hasRuntimeIntegration = [
    /\b(fetch|axios)\s*\(/i,
    /\b(router|express|app)\.(get|post|put|patch|delete)\b/i,
    /\.(save|find|findOne|create|updateOne|findByIdAndUpdate)\b/i,
    /<form\b|onSubmit|onChange|useState/i,
  ].filter((pattern) => pattern.test(sourceText)).length;
  const implementationEvidenceScore = Math.round(
    implementationKeywordRate * 0.35 +
      functionalCoverageRate * 0.35 +
      actionCoverageRate * 0.15 +
      Math.min(hasRuntimeIntegration, 3) * 5,
  );
  const detectedLabels = detectedSignalGroups.map((group) => group.label);
  const missingExpectedLabels = expectedGroupsToCheck
    .filter(
      (group) =>
        !matchedExpectedGroups.some((matched) => matched.key === group.key),
    )
    .map((group) => group.label);

  return {
    sourceFilesReviewed: sourceFiles.length,
    implementationKeywordMatches,
    implementationKeywordRate,
    expectedFunctionalAreas: expectedGroupsToCheck.map((group) => group.label),
    detectedFunctionalAreas: detectedLabels,
    missingFunctionalAreas: missingExpectedLabels,
    functionalCoverageRate,
    expectedActions,
    matchedActions,
    actionCoverageRate,
    hasRuntimeIntegration,
    implementationEvidenceScore: Math.min(100, implementationEvidenceScore),
  };
}

function calculateChecklistScore(checks) {
  // Checklist weights add up to 100 today, but this formula also stays correct
  // if future checks rebalance the weights.
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const earnedWeight = checks.reduce(
    (sum, check) => sum + (check.passed ? check.weight : 0),
    0,
  );

  return totalWeight > 0
    ? Math.round((earnedWeight / totalWeight) * 10000) / 100
    : 0;
}

function fileLanguage(path = "") {
  const extension = getExtension(path);
  const map = {
    ".js": "JavaScript",
    ".jsx": "React JavaScript",
    ".ts": "TypeScript",
    ".tsx": "React TypeScript",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".json": "JSON",
    ".py": "Python",
    ".java": "Java",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".sql": "SQL",
    ".md": "Markdown",
  };

  return map[extension] || extension.replace(".", "").toUpperCase() || "Text";
}

function scoreRepositoryEvidence({
  repository,
  readmeFound,
  readmeContent,
  supportedFiles,
  files,
  commits,
  languages,
}) {
  const hasSourceFiles = supportedFiles.length > 0;
  const hasMultipleFiles = supportedFiles.length >= 5;
  const hasMultipleLanguages = Object.keys(languages || {}).length >= 2;
  const hasCommits = Array.isArray(commits) && commits.length > 0;
  const hasRecentActivity =
    hasCommits &&
    commits.some((commit) => {
      const date = new Date(commit.commit?.author?.date || 0);
      const ageInDays = (Date.now() - date.getTime()) / 86400000;
      return Number.isFinite(ageInDays) && ageInDays <= 365;
    });
  const hasConfigFile = files.some((file) =>
    CONFIG_FILE_PATTERN.test(file.path),
  );
  const hasTests = files.some((file) => TEST_FILE_PATTERN.test(file.path));
  const hasDocumentationDepth = compactText(readmeContent, 3000).length >= 400;

  const qualityChecks = [
    {
      passed: hasSourceFiles,
      weight: 25,
      note: "Supported source files detected.",
    },
    {
      passed: hasMultipleFiles,
      weight: 15,
      note: "Project contains several implementation files.",
    },
    {
      passed: hasConfigFile,
      weight: 15,
      note: "Project configuration/dependency file detected.",
    },
    { passed: hasTests, weight: 15, note: "Test/spec files detected." },
    { passed: readmeFound, weight: 15, note: "README documentation detected." },
    { passed: hasCommits, weight: 10, note: "Commit history is available." },
    {
      passed: hasMultipleLanguages,
      weight: 5,
      note: "Multiple relevant file types/languages detected.",
    },
  ];
  const completenessChecks = [
    { passed: readmeFound, weight: 25 },
    { passed: hasDocumentationDepth, weight: 20 },
    { passed: hasSourceFiles, weight: 25 },
    { passed: hasConfigFile, weight: 15 },
    { passed: hasCommits, weight: 15 },
  ];
  const codeQualityScore = qualityChecks.reduce(
    (sum, check) => sum + (check.passed ? check.weight : 0),
    0,
  );
  const evidenceCompletenessScore = completenessChecks.reduce(
    (sum, check) => sum + (check.passed ? check.weight : 0),
    0,
  );
  const riskFlags = [
    !repository.description ? "Repository has no description." : "",
    !readmeFound ? "README documentation is missing." : "",
    !hasDocumentationDepth && readmeFound
      ? "README is present but may not explain the project deeply."
      : "",
    !hasSourceFiles ? "No supported source files were detected." : "",
    !hasConfigFile
      ? "No dependency/configuration file was detected for reproducible setup."
      : "",
    !hasTests ? "No automated test/spec files were detected." : "",
    !hasRecentActivity
      ? "Recent development activity could not be confirmed."
      : "",
  ].filter(Boolean);
  const positiveNotes = qualityChecks
    .filter((check) => check.passed)
    .map((check) => check.note);

  return {
    codeQualityScore,
    evidenceCompletenessScore,
    riskFlags,
    positiveNotes,
  };
}

export function parseGitHubRepositoryUrl(url = "") {
  const trimmedUrl = String(url).trim();
  const match = trimmedUrl.match(GITHUB_REPO_PATTERN);

  if (!match) {
    return null;
  }

  return {
    url: trimmedUrl,
    owner: match[2],
    repo: match[3],
  };
}

export function validateGitHubRepositoryUrl(url = "") {
  if (!url) return null;

  const parsed = parseGitHubRepositoryUrl(url);

  if (!parsed) {
    throw new AppError(
      "GitHub repository URL must be a valid GitHub repository link",
      400,
    );
  }

  return parsed;
}

export async function summarizeGitHubRepository(url = "") {
  const parsed = validateGitHubRepositoryUrl(url);

  if (!parsed) return null;

  const base = `${githubApiBaseUrl()}/repos/${parsed.owner}/${parsed.repo}`;

  try {
    const repository = await fetchGitHubJson(base);
    const [languages, commits, tree, workflowRuns] = await Promise.all([
      fetchGitHubJson(`${base}/languages`).catch(() => ({})),
      fetchGitHubJson(`${base}/commits?per_page=5`).catch(() => []),
      fetchGitHubJson(
        `${base}/git/trees/${repository.default_branch}?recursive=1`,
      ).catch(() => ({ tree: [] })),
      fetchGitHubJson(`${base}/actions/runs?per_page=5`).catch(() => ({
        workflow_runs: [],
      })),
    ]);

    const files = Array.isArray(tree.tree)
      ? tree.tree.filter((item) => item.type === "blob")
      : [];
    const supportedFiles = files.filter((file) =>
      SUPPORTED_CODE_EXTENSIONS.has(getExtension(file.path)),
    );
    const extensionCounts = supportedFiles.reduce((counts, file) => {
      const extension = getExtension(file.path) || "unknown";
      counts[extension] = (counts[extension] || 0) + 1;
      return counts;
    }, {});
    const supportedFileTypes = Object.entries(extensionCounts).map(
      ([extension, count]) => ({
        extension,
        count,
      }),
    );
    const setupFileFound = files.some((file) =>
      CONFIG_FILE_PATTERN.test(file.path),
    );
    const testFileFound = files.some((file) =>
      TEST_FILE_PATTERN.test(file.path),
    );
    const ciWorkflowFound = files.some((file) =>
      CI_WORKFLOW_PATTERN.test(file.path),
    );
    const packageFile = files.find((file) =>
      PACKAGE_FILE_PATTERN.test(file.path),
    );
    const packageContent = packageFile
      ? await fetchGitHubText(
          `${githubRawBaseUrl()}/${parsed.owner}/${parsed.repo}/${repository.default_branch}/${packageFile.path}`,
        ).catch(() => "")
      : "";
    const packageScripts = parsePackageScripts(packageContent);
    const ciSummary = summarizeWorkflowRuns(workflowRuns.workflow_runs || []);
    const readmeFound = files.some((file) =>
      file.path.toLowerCase().split("/").pop()?.startsWith("readme"),
    );
    const readmeFile = files.find((file) =>
      file.path.toLowerCase().split("/").pop()?.startsWith("readme"),
    );
    const readmeUrl = readmeFile
      ? `${githubRawBaseUrl()}/${parsed.owner}/${parsed.repo}/${repository.default_branch}/${readmeFile.path}`
      : "";
    const readmeContent = readmeUrl
      ? await fetchGitHubText(readmeUrl).catch(() => "")
      : "";
    const evidenceScore = scoreRepositoryEvidence({
      repository,
      readmeFound,
      readmeContent,
      supportedFiles,
      files,
      commits,
      languages,
    });
    const maxSampledFiles = envNumber("GITHUB_MAX_SAMPLED_FILES", 20);
    const reviewKeywords = extractKeywords(
      repository.description || "",
      readmeContent || "",
      parsed.repo || "",
    );
    const filesForReview = sortSourceFilesForReview(
      supportedFiles,
      reviewKeywords,
    );
    const sampledSourceFiles = await Promise.all(
      filesForReview.slice(0, maxSampledFiles).map(async (file) => {
        const rawUrl = `${githubRawBaseUrl()}/${parsed.owner}/${parsed.repo}/${repository.default_branch}/${file.path}`;
        const content = await fetchGitHubText(rawUrl).catch(() => "");

        return {
          path: file.path,
          language: fileLanguage(file.path),
          size: file.size || 0,
          excerpt: compactText(content, 900),
        };
      }),
    );
    const notes = [
      readmeFound
        ? "README file found for project explanation."
        : "README file was not detected and should be improved before resubmission.",
      supportedFiles.length > 0
        ? `${supportedFiles.length} supported code/documentation files detected.`
        : "No supported code files were detected by automatic analysis.",
      Array.isArray(commits) && commits.length > 0
        ? `${commits.length} recent commit(s) available for automatic evidence review.`
        : "Recent commit history could not be confirmed automatically.",
      `Repository quality score: ${evidenceScore.codeQualityScore}%.`,
      `Evidence completeness score: ${evidenceScore.evidenceCompletenessScore}%.`,
      packageScripts.testScriptFound
        ? "Package test script detected."
        : "Package test script was not detected.",
      packageScripts.buildScriptFound
        ? "Package build script detected."
        : "Package build script was not detected.",
      ciWorkflowFound
        ? "GitHub Actions workflow file detected."
        : "GitHub Actions workflow file was not detected.",
      ciSummary.ciPassing
        ? "Latest GitHub Actions run completed successfully."
        : ciSummary.ciRunFound
          ? `Latest GitHub Actions run status: ${ciSummary.ciRunStatus || "unknown"} / ${ciSummary.ciRunConclusion || "unknown"}.`
          : "No GitHub Actions run result was found.",
      ...evidenceScore.positiveNotes,
    ];

    return {
      ...parsed,
      isValid: true,
      fetchStatus: "fetched",
      analyzedAt: new Date(),
      description: repository.description || "",
      defaultBranch: repository.default_branch,
      stars: repository.stargazers_count || 0,
      forks: repository.forks_count || 0,
      languages: Object.keys(languages || {}),
      readmeFound,
      readmeExcerpt: compactText(readmeContent, 1500),
      recentCommits: Array.isArray(commits)
        ? commits.map((commit) => ({
            message: commit.commit?.message || "",
            author: commit.commit?.author?.name || "",
            date: commit.commit?.author?.date || "",
          }))
        : [],
      supportedFileCount: supportedFiles.length,
      supportedFileTypes,
      setupFileFound,
      testFileFound,
      packageScripts: packageScripts.scripts,
      testScriptFound: packageScripts.testScriptFound,
      buildScriptFound: packageScripts.buildScriptFound,
      ciWorkflowFound,
      ciRunFound: ciSummary.ciRunFound,
      ciRunName: ciSummary.ciRunName,
      ciRunStatus: ciSummary.ciRunStatus,
      ciRunConclusion: ciSummary.ciRunConclusion,
      ciRunUrl: ciSummary.ciRunUrl,
      ciRunUpdatedAt: ciSummary.ciRunUpdatedAt,
      ciPassing: ciSummary.ciPassing,
      codeQualityScore: evidenceScore.codeQualityScore,
      evidenceCompletenessScore: evidenceScore.evidenceCompletenessScore,
      riskFlags: evidenceScore.riskFlags,
      sampledSourceFiles,
      topLevelItems: files
        .filter((file) => !file.path.includes("/"))
        .slice(0, 12)
        .map((file) => file.path),
      codeQualityNotes: notes,
      summaryText: `${parsed.owner}/${parsed.repo} was verified and analyzed through the GitHub API. ${notes.join(" ")}`,
    };
  } catch (error) {
    throw new AppError(
      `GitHub repository could not be verified or analyzed: ${error.message}`,
      400,
    );
  }
}

export async function reviewGitHubRepositoryForTask({
  repositoryUrl,
  competency,
  practicalTask,
}) {
  const repositorySummary = await summarizeGitHubRepository(repositoryUrl);
  // Keywords come from the official competency/task definition. Matching these
  // against README and code helps detect unrelated repositories early.
  const taskKeywords = extractKeywords(
    competency?.title || "",
    competency?.description || "",
    practicalTask?.title || "",
    practicalTask?.instructions || "",
    practicalTask?.deliverables || "",
  );
  const searchableText = [
    repositorySummary.description,
    repositorySummary.readmeExcerpt,
    repositorySummary.summaryText,
    ...(repositorySummary.sampledSourceFiles || []).map(
      (file) => `${file.path} ${file.language} ${file.excerpt}`,
    ),
    ...(repositorySummary.topLevelItems || []),
  ]
    .join(" ")
    .toLowerCase();
  const matchedTaskKeywords = taskKeywords.filter((keyword) =>
    searchableText.includes(keyword),
  );
  const taskKeywordMatchRate =
    taskKeywords.length > 0
      ? Math.round((matchedTaskKeywords.length / taskKeywords.length) * 10000) /
        100
      : 100;
  const hasConfigFile = repositorySummary.setupFileFound === true;
  const hasCommits = (repositorySummary.recentCommits || []).length > 0;
  const riskCount = (repositorySummary.riskFlags || []).length;
  const automatedProofSignals = [
    repositorySummary.testFileFound === true,
    repositorySummary.testScriptFound === true,
    repositorySummary.buildScriptFound === true,
    repositorySummary.ciWorkflowFound === true,
    repositorySummary.ciPassing === true,
  ].filter(Boolean).length;
  const automatedProofPassed =
    repositorySummary.ciPassing === true ||
    (repositorySummary.testFileFound === true &&
      repositorySummary.testScriptFound === true &&
      repositorySummary.buildScriptFound === true);
  const implementationReview = evaluateTaskImplementation({
    repositorySummary,
    competency,
    practicalTask,
    taskKeywords,
  });
  // Each checklist item is a weighted rule. Failed items contribute their
  // advice to "Improve before submission" in the frontend.
  const checklist = [
    {
      key: "repositoryAccessible",
      label: "Repository is accessible and verified",
      passed: repositorySummary.isValid === true,
      weight: 5,
      evidence: `${repositorySummary.owner}/${repositorySummary.repo}`,
      advice:
        "Provide a valid GitHub repository URL that the system can access.",
    },
    {
      key: "taskKeywordsMatched",
      label: "Repository content is related to the selected practical task",
      passed: taskKeywordMatchRate >= 35,
      weight: 8,
      evidence: `${matchedTaskKeywords.length}/${taskKeywords.length} task keyword(s) matched: ${matchedTaskKeywords.join(", ") || "none"}`,
      advice:
        "Update the README and project files so they clearly show the selected task requirements and deliverables.",
    },
    {
      key: "taskImplementationEvidence",
      label: "Source code implements the selected practical task requirements",
      passed: implementationReview.implementationEvidenceScore >= 60,
      weight: 25,
      evidence: `${implementationReview.implementationKeywordMatches.length}/${taskKeywords.length} task keyword(s) found in reviewed source code. Implementation evidence score: ${implementationReview.implementationEvidenceScore}%.`,
      advice:
        "Implement the actual task requirements in source code, not only in README text or file names.",
    },
    {
      key: "functionalBehaviorDetected",
      label: "Expected functional behavior is visible in code",
      passed: implementationReview.functionalCoverageRate >= 60,
      weight: 20,
      evidence: `${implementationReview.functionalCoverageRate}% functional coverage. Detected: ${implementationReview.detectedFunctionalAreas.join(", ") || "none"}. Missing: ${implementationReview.missingFunctionalAreas.join(", ") || "none"}.`,
      advice:
        "Add working code for the required behavior such as forms, API routes, database operations, CRUD, authentication, validation, or role protection based on the task.",
    },
    {
      key: "runtimeIntegrationDetected",
      label:
        "Code shows runnable integration between UI, API, or database logic",
      passed: implementationReview.hasRuntimeIntegration >= 2,
      weight: 12,
      evidence: `${implementationReview.hasRuntimeIntegration}/4 runtime integration signal(s) detected from UI forms, API calls/routes, and database operations.`,
      advice:
        "Connect the task implementation through real UI handlers, API endpoints, and database operations where required.",
    },
    {
      key: "validationSecurityDetected",
      label: "Validation, error handling, or protected access is implemented",
      passed:
        implementationReview.detectedFunctionalAreas.includes(
          "validation and error handling",
        ) ||
        implementationReview.detectedFunctionalAreas.includes(
          "security/protected access",
        ),
      weight: 10,
      evidence: `Detected functional areas: ${implementationReview.detectedFunctionalAreas.join(", ") || "none"}.`,
      advice:
        "Add input validation, clear success/error handling, and protected access logic where the task requires secure behavior.",
    },
    {
      key: "automatedProofFound",
      label: "Automated proof shows the task can be tested or built",
      passed: automatedProofPassed,
      weight: 15,
      evidence: [
        `Test files: ${repositorySummary.testFileFound ? "yes" : "no"}`,
        `test script: ${repositorySummary.testScriptFound ? "yes" : "no"}`,
        `build script: ${repositorySummary.buildScriptFound ? "yes" : "no"}`,
        `GitHub Actions workflow: ${repositorySummary.ciWorkflowFound ? "yes" : "no"}`,
        `latest CI passing: ${repositorySummary.ciPassing ? "yes" : "no"}`,
      ].join(", "),
      advice:
        "Add task-specific tests, npm test/build scripts, and a passing GitHub Actions workflow to prove the submitted code works.",
    },
    {
      key: "projectCanBeSetUp",
      label: "Project setup/configuration is available",
      passed: Boolean(hasConfigFile),
      weight: 3,
      evidence: hasConfigFile
        ? "Dependency/configuration file detected."
        : "No dependency/configuration file detected.",
      advice:
        "Add setup files such as package.json, requirements.txt, tsconfig.json, or relevant project configuration.",
    },
    {
      key: "developmentActivityVerified",
      label: "Commit history supports authentic development activity",
      passed: hasCommits && riskCount <= 2,
      weight: 2,
      evidence:
        riskCount > 0
          ? `${repositorySummary.recentCommits?.length || 0} recent commit(s). Risks: ${repositorySummary.riskFlags.join("; ")}`
          : `${repositorySummary.recentCommits?.length || 0} recent commit(s). No major risk flags detected.`,
      advice:
        "Commit work progressively and resolve missing documentation, tests, setup, or weak activity evidence before submitting.",
    },
  ];
  const score = calculateChecklistScore(checklist);
  const passedCount = checklist.filter((item) => item.passed).length;
  const failedCount = checklist.length - passedCount;
  const feedback = checklist
    .filter((item) => !item.passed)
    .map((item) => item.advice);
  const proofLevel = automatedProofPassed
    ? repositorySummary.ciPassing
      ? "Verified by passing GitHub Actions CI"
      : "Supported by repository test and build scripts"
    : "Implementation evidence only; not proven by automated execution";
  const proofSummary = automatedProofPassed
    ? "The repository includes automated proof signals that support the practical task result."
    : "The repository shows implementation evidence, but it does not yet prove the task by passing automated tests or CI.";

  return {
    repositorySummary,
    taskReview: {
      taskId: practicalTask?._id,
      taskTitle: practicalTask?.title || competency?.title || "Practical task",
      score,
      pointsEarned: Math.round((score / 100) * 10000) / 100,
      pointsPossible: 100,
      passedCount,
      failedCount,
      checklist,
      taskKeywords,
      matchedTaskKeywords,
      taskKeywordMatchRate,
      implementationReview,
      automatedProofSignals,
      automatedProofPassed,
      proofLevel,
      proofSummary,
      feedback,
      reviewedAt: new Date(),
      summary: `Automatic repository review scored ${score}% with ${passedCount}/${checklist.length} checklist item(s) passed. ${proofSummary}`,
    },
  };
}
