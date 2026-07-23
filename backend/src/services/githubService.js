import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import { Sandbox } from 'e2b';
import Competency from '../models/Competency.js';
import RepositoryAssessmentResult from '../models/RepositoryAssessmentResult.js';
import { isLearnerRole, ROLES } from '../constants/roles.js';
import { AppError } from './errorService.js';
import { buildRepositoryAssessmentRecommendations } from './recommendationService.js';

dotenv.config({ quiet: true });

// GitHub, repository execution, and repository assessment logic lives here.

async function cleanupTempFolder(folderPath) {
  if (!folderPath) return;
  await fs.rm(folderPath, { recursive: true, force: true }).catch(() => null);
}


export function runCommand(command, args = [], options = {}) {
  const timeoutMs = options.timeoutMs || 30000;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new AppError(`Command timed out after ${timeoutMs}ms: ${command}`, 408));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new AppError(`Command failed to start: ${command}. ${error.message}`, 500));
    });

    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        command,
        args,
        exitCode,
        stdout: stdout.slice(-20000),
        stderr: stderr.slice(-20000),
        success: exitCode === 0,
      });
    });
  });
}

function githubWebBaseUrl() {
  const value = String(process.env.GITHUB_WEB_BASE_URL || '').replace(/\/+$/, '');

  if (!value) {
    throw new AppError('GITHUB_WEB_BASE_URL is required for GitHub repository URLs.', 500);
  }

  return value;
}

export function parseGithubUrl(url = '') {
  const normalizedUrl = String(url || '').trim();

  try {
    const parsedUrl = new URL(normalizedUrl);
    const configuredHost = new URL(githubWebBaseUrl()).hostname.replace(/^www\./, '');
    const submittedHost = parsedUrl.hostname.replace(/^www\./, '');
    const [owner, rawRepo] = parsedUrl.pathname.split('/').filter(Boolean);
    const repo = rawRepo?.replace(/\.git$/i, '');

    if (submittedHost !== configuredHost || !owner || !repo) {
      throw new Error('Invalid GitHub repository URL');
    }

    return {
      url: normalizedUrl,
      owner,
      repo,
      fullName: `${owner}/${repo}`,
      cloneUrl: `${githubWebBaseUrl()}/${owner}/${repo}.git`,
    };
  } catch {
    throw new AppError('GitHub repository URL must be a valid owner/repository link.', 400);
  }
}

function githubHeaders() {
  const githubToken = process.env.GITHUB_TOKEN || '';
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'rtb-skills-gap-analysis-tool',
  };

  if (githubToken) {
    headers.Authorization = `Bearer ${githubToken}`;
  }

  return headers;
}

function withGitHubTimeout() {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.GITHUB_REQUEST_TIMEOUT_MS) || 10000,
  );

  return { controller, timeout };
}

function authenticatedCloneUrl(parsed) {
  const githubToken = process.env.GITHUB_TOKEN || '';
  if (!githubToken) return parsed.cloneUrl;
  const githubWebBaseUrl = String(process.env.GITHUB_WEB_BASE_URL || '').replace(/\/+$/, '');

  if (!githubWebBaseUrl) {
    throw new AppError('GITHUB_WEB_BASE_URL is required to clone private repositories', 500);
  }

  const cloneBaseUrl = new URL(githubWebBaseUrl);
  cloneBaseUrl.username = 'x-access-token';
  cloneBaseUrl.password = githubToken;

  return `${cloneBaseUrl.toString().replace(/\/+$/, '')}/${parsed.owner}/${parsed.repo}.git`;
}

export async function verifyGithubRepository(repositoryUrl) {
  const parsed = parseGithubUrl(repositoryUrl);
  const { controller, timeout } = withGitHubTimeout();
  let response;

  try {
    const githubApiUrl = String(
      process.env.GITHUB_API_URL || process.env.GITHUB_API_BASE_URL || '',
    ).replace(/\/+$/, '');

    if (!githubApiUrl) {
      throw new AppError('GITHUB_API_URL or GITHUB_API_BASE_URL is required', 500);
    }

    response = await fetch(`${githubApiUrl}/repos/${parsed.owner}/${parsed.repo}`, {
      headers: githubHeaders(),
      signal: controller.signal,
    });
  } catch (error) {
    const cause = error.cause?.message ? ` Detail: ${error.cause.message}` : '';
    const message =
      error.name === 'AbortError'
        ? 'GitHub repository verification timed out. Check internet connection or GitHub availability.'
        : `GitHub API could not be reached. Check internet access, DNS, GITHUB_API_URL, firewall/proxy settings, or try again later.${cause}`;
    throw new AppError(message, 400);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const message =
      response.status === 404
        ? 'Repository was not found or the configured GitHub token cannot access it.'
        : `GitHub API returned ${response.status}.`;
    throw new AppError(message, 400);
  }

  const repository = await response.json();

  return {
    ...parsed,
    defaultBranch: repository.default_branch,
    private: repository.private,
    description: repository.description || '',
    htmlUrl: repository.html_url,
  };
}

export async function cloneGithubRepository(repositoryUrl) {
  const repository = await verifyGithubRepository(repositoryUrl);
  const tempRepositoryDir = path.resolve(
    process.cwd(),
    process.env.TEMP_REPOSITORY_DIR || 'tmp/repositories',
  );
  const repositoryAnalysisTimeoutMs =
    Number(process.env.REPOSITORY_ANALYSIS_TIMEOUT_MS) || 120000;
  await fs.mkdir(tempRepositoryDir, { recursive: true });

  const folderName = `${repository.owner}-${repository.repo}-${crypto.randomUUID()}`;
  const destination = path.join(tempRepositoryDir, folderName);
  const cloneUrl = authenticatedCloneUrl(repository);

  const cloneResult = await runCommand(
    'git',
    ['clone', '--depth', '1', cloneUrl, destination],
    {
      timeoutMs: repositoryAnalysisTimeoutMs,
    },
  );

  if (!cloneResult.success) {
    throw new AppError(
      `Repository clone failed. ${cloneResult.stderr || cloneResult.stdout}`,
      400,
    );
  }

  return {
    repository,
    localPath: destination,
    cloneResult: {
      ...cloneResult,
      args: ['clone', '--depth', '1', repository.cloneUrl, destination],
    },
  };
}

const SOURCE_EXTENSIONS = new Set([
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
  ".sql",
  ".md",
]);

const COMPETENCY_RULES = {
  frontend: [/react|vite|component|useState|onSubmit|<form|<button|<input/i],
  backend: [
    /express|router\.(get|post|put|patch|delete)|app\.(get|post|put|patch|delete)|controller|service/i,
  ],
  database: [
    /mongoose|mongodb|schema|model|findOne|findById|save\(|create\(|updateOne/i,
  ],
  authentication: [
    /jwt|jsonwebtoken|bcrypt|login|register|authorization|authenticate|protected/i,
  ],
  testing: [
    /describe\(|it\(|test\(|expect\(|supertest|playwright|cypress|jest/i,
  ],
  documentation: [/readme|installation|usage|api|endpoint|setup/i],
  deployment: [
    /dockerfile|render|vercel|netlify|railway|github actions|\.github\/workflows/i,
  ],
};

function getExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function listFiles(rootPath, currentPath = rootPath, output = []) {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (
      [".git", "node_modules", "dist", "build", ".next", "coverage"].includes(
        entry.name,
      )
    ) {
      continue;
    }

    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      await listFiles(rootPath, fullPath, output);
    } else {
      output.push({
        absolutePath: fullPath,
        relativePath: path.relative(rootPath, fullPath).replaceAll("\\", "/"),
      });
    }
  }

  return output;
}

async function readSampledSource(files) {
  const sourceFiles = files
    .filter((file) => SOURCE_EXTENSIONS.has(getExtension(file.relativePath)))
    .slice(0, 80);

  const samples = [];
  for (const file of sourceFiles) {
    const content = await fs
      .readFile(file.absolutePath, "utf8")
      .catch(() => "");
    samples.push({
      path: file.relativePath,
      content: content.slice(0, 6000),
    });
  }

  return samples;
}

function detectTechnologies({ packageJson, files, sourceText }) {
  const dependencies = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };
  const names = Object.keys(dependencies);
  const technologies = new Set();

  for (const name of names) {
    if (
      [
        "react",
        "vite",
        "express",
        "mongoose",
        "mongodb",
        "jsonwebtoken",
        "bcryptjs",
        "bcrypt",
        "jest",
        "supertest",
        "@playwright/test",
        "cypress",
      ].includes(name)
    ) {
      technologies.add(name);
    }
  }

  if (files.some((file) => file.relativePath.toLowerCase() === "dockerfile"))
    technologies.add("docker");
  if (files.some((file) => file.relativePath.startsWith(".github/workflows/")))
    technologies.add("github-actions");
  if (/tailwind/i.test(sourceText)) technologies.add("tailwind");

  return [...technologies];
}

function buildRequirementChecks({ taskText, sourceText, files }) {
  const normalizedTask = taskText.toLowerCase();
  // These rules are broad evidence checks. They decide whether a task appears
  // to need frontend/backend/database/auth/etc. work, then look for matching
  // implementation signals in the submitted repository.
  const rules = [
    {
      id: "frontend-ui",
      title: "Frontend/UI requirement implemented",
      competency: "frontend",
      expected:
        /frontend|ui|form|page|dashboard|component|button|input|profile/.test(
          normalizedTask,
        ),
      passed: COMPETENCY_RULES.frontend.some((rule) => rule.test(sourceText)),
      evidence: "Frontend code, forms, handlers, or components detected.",
    },
    {
      id: "backend-api",
      title: "Backend/API requirement implemented",
      competency: "backend",
      expected: /backend|api|endpoint|route|server|controller/.test(
        normalizedTask,
      ),
      passed: COMPETENCY_RULES.backend.some((rule) => rule.test(sourceText)),
      evidence: "Express routes, controllers, or API handlers detected.",
    },
    {
      id: "database",
      title: "Database persistence implemented",
      competency: "database",
      expected: /database|mongodb|mongoose|save|profile|record|store/.test(
        normalizedTask,
      ),
      passed: COMPETENCY_RULES.database.some((rule) => rule.test(sourceText)),
      evidence: "MongoDB/Mongoose persistence code detected.",
    },
    {
      id: "authentication",
      title: "Authentication/security implemented",
      competency: "authentication",
      expected: /auth|login|register|jwt|protected|password|role/.test(
        normalizedTask,
      ),
      passed: COMPETENCY_RULES.authentication.some((rule) =>
        rule.test(sourceText),
      ),
      evidence:
        "Authentication, JWT, password, or protected access code detected.",
    },
    {
      id: "testing",
      title: "Automated tests included",
      competency: "testing",
      expected: true,
      passed:
        COMPETENCY_RULES.testing.some((rule) => rule.test(sourceText)) ||
        files.some((file) =>
          /\.(test|spec)\.[jt]sx?$/i.test(file.relativePath),
        ),
      evidence: "Automated test files or test syntax detected.",
    },
    {
      id: "documentation",
      title: "Project documentation provided",
      competency: "documentation",
      expected: true,
      passed: files.some((file) =>
        file.relativePath.toLowerCase().includes("readme"),
      ),
      evidence: "README/documentation file detected.",
    },
    {
      id: "deployment",
      title: "Deployment or CI configuration provided",
      competency: "deployment",
      expected: /deploy|deployment|ci|build|production/.test(normalizedTask),
      passed: COMPETENCY_RULES.deployment.some((rule) => rule.test(sourceText)),
      evidence: "Deployment, Docker, or GitHub Actions evidence detected.",
    },
  ];

  return rules
    .filter((rule) => rule.expected)
    .map((rule) => ({
      ...rule,
      error: rule.passed ? "" : `Missing evidence for: ${rule.title}`,
    }));
}

export async function analyzeRepository(localPath, task = {}) {
  const files = await listFiles(localPath);
  const packageJsonPath = path.join(localPath, "package.json");
  const packageJson = await readJson(packageJsonPath);
  const hasPackageJson = Boolean(packageJson);
  const readmeFound = await exists(path.join(localPath, "README.md"));
  const sampledSource = await readSampledSource(files);
  const sourceText = sampledSource
    .map((file) => `${file.path}\n${file.content}`)
    .join("\n")
    .toLowerCase();
  const taskText = [
    task.title,
    task.instructions,
    task.deliverables,
    task.description,
  ]
    .filter(Boolean)
    .join(" ");
  const requirementChecks = buildRequirementChecks({
    taskText,
    sourceText,
    files,
  });

  return {
    projectType: hasPackageJson ? "node" : "unknown",
    packageJson,
    packageManager: files.some((file) => file.relativePath === "yarn.lock")
      ? "yarn"
      : files.some((file) => file.relativePath === "pnpm-lock.yaml")
        ? "pnpm"
        : "npm",
    hasPackageJson,
    readmeFound,
    fileCount: files.length,
    sourceFileCount: sampledSource.length,
    detectedTechnologies: detectTechnologies({
      packageJson,
      files,
      sourceText,
    }),
    packageScripts: packageJson?.scripts || {},
    requirementChecks,
    sampledSource: sampledSource.map((file) => ({
      path: file.path,
      excerpt: file.content.slice(0, 500),
    })),
  };
}

const E2B_REPOSITORY_PATH = '/home/user/competra-repository';

function repositoryAnalysisTimeoutMs() {
  return Number(process.env.REPOSITORY_ANALYSIS_TIMEOUT_MS) || 120000;
}

function e2bSandboxTimeoutMs() {
  return Number(process.env.E2B_SANDBOX_TIMEOUT_MS) || 300000;
}

function requireE2bApiKey() {
  if (!process.env.E2B_API_KEY) {
    throw new AppError('E2B_API_KEY is required for isolated repository assessment.', 500);
  }
}

function toCommandResult(name, command, result, startedAt) {
  return {
    name,
    command,
    success: Number(result.exitCode || 0) === 0,
    exitCode: Number(result.exitCode || 0),
    stdout: String(result.stdout || '').slice(-20000),
    stderr: String(result.stderr || result.error || '').slice(-20000),
    durationMs: Date.now() - startedAt,
  };
}

function toFailedCommandResult(name, command, error, startedAt) {
  return {
    name,
    command,
    success: false,
    exitCode: Number(error.exitCode || 1),
    stdout: String(error.stdout || '').slice(-20000),
    stderr: String(error.stderr || error.message || 'Command failed in E2B sandbox.').slice(-20000),
    durationMs: Date.now() - startedAt,
  };
}

function safeSandboxWorkingDirectory(repositoryPath, workingDirectory = '.') {
  const segments = String(workingDirectory || '.')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);

  if (segments.includes('..')) {
    throw new AppError('competra.json workingDirectory cannot escape the repository.', 400);
  }

  return segments.length > 0 ? path.posix.join(repositoryPath, ...segments) : repositoryPath;
}

async function createE2bSandbox() {
  requireE2bApiKey();
  return Sandbox.create({ timeoutMs: e2bSandboxTimeoutMs() });
}

async function runE2bCommand({
  name,
  sandbox,
  repositoryPath = E2B_REPOSITORY_PATH,
  workingDirectory = '.',
  command,
  timeoutMs = repositoryAnalysisTimeoutMs(),
}) {
  if (!command) return null;

  const startedAt = Date.now();
  const cwd = safeSandboxWorkingDirectory(repositoryPath, workingDirectory);

  try {
    // E2B is the only sandbox used to execute untrusted repository commands.
    const result = await sandbox.commands.run(command, { cwd, timeoutMs });
    return toCommandResult(name, command, result, startedAt);
  } catch (error) {
    return toFailedCommandResult(name, command, error, startedAt);
  }
}

async function createE2bRepositoryContext(repository) {
  const sandbox = await createE2bSandbox();
  const startedAt = Date.now();

  try {
    const cloneResult = await sandbox.git.clone(repository.cloneUrl, {
      path: E2B_REPOSITORY_PATH,
      depth: 1,
      username: process.env.GITHUB_TOKEN ? 'x-access-token' : undefined,
      password: process.env.GITHUB_TOKEN || undefined,
      timeoutMs: repositoryAnalysisTimeoutMs(),
    });

    return {
      sandbox,
      repositoryPath: E2B_REPOSITORY_PATH,
      cloneResult: toCommandResult(
        'Clone repository in E2B sandbox',
        'git clone --depth 1 ' + repository.cloneUrl + ' ' + E2B_REPOSITORY_PATH,
        cloneResult,
        startedAt,
      ),
    };
  } catch (error) {
    await sandbox.kill().catch(() => null);
    throw new AppError(
      'Repository clone failed inside E2B sandbox. ' + (error.stderr || error.message || ''),
      400,
    );
  }
}

async function cleanupE2bSandbox(sandbox) {
  if (!sandbox) return;
  await sandbox.kill().catch(() => null);
}

async function writeInstructorTestFilesToSandbox(sandbox, repositoryPath, testFiles = []) {
  const writtenFiles = [];

  for (const testFile of testFiles) {
    if (!testFile?.path || !testFile?.content) continue;

    const normalizedPath = String(testFile.path).replace(/\\/g, '/');
    const segments = normalizedPath.split('/').filter(Boolean);

    if (segments.includes('..')) {
      throw new AppError('Unsafe instructor test path rejected: ' + testFile.path, 400);
    }

    await sandbox.files.write(path.posix.join(repositoryPath, ...segments), testFile.content);
    writtenFiles.push(testFile.path);
  }

  return writtenFiles;
}

const SUPPORTED_SUBMISSION_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'node',
  'nodejs',
  'python',
]);

const LANGUAGE_ADAPTERS = {
  javascript: { runtime: 'node' },
  typescript: { runtime: 'node' },
  node: { runtime: 'node' },
  nodejs: { runtime: 'node' },
  python: { runtime: 'python' },
};

function normalizeSubmissionLanguage(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeProtocol(value = '') {
  return String(value || '').trim().toLowerCase().replace(/-/g, '_');
}

function getSafeWorkingDirectory(localPath, workingDirectory = '.') {
  const targetPath = path.resolve(localPath, workingDirectory || '.');
  const relativePath = path.relative(localPath, targetPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new AppError('competra.json workingDirectory cannot escape the repository.', 400);
  }

  return targetPath;
}

async function readSubmissionManifest(localPath) {
  const manifestPath = path.join(localPath, 'competra.json');

  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    return { manifest, path: 'competra.json' };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { manifest: null, path: 'competra.json' };
    }

    throw new AppError('competra.json exists but is not valid JSON.', 400);
  }
}

function commandOrEmpty(value) {
  return String(value || '').trim();
}

function buildDefaultExecutionCommand(manifest) {
  const mainEntry = commandOrEmpty(manifest.mainEntry || manifest.mainEntryPoint);
  const language = normalizeSubmissionLanguage(manifest.language);

  if (manifest.runCommand) return commandOrEmpty(manifest.runCommand);
  if (manifest.startCommand && normalizeProtocol(manifest.inputOutputProtocol || manifest.protocol) === 'stdin_stdout') {
    return commandOrEmpty(manifest.startCommand);
  }
  if (!mainEntry) return '';
  if (['javascript', 'typescript', 'node', 'nodejs'].includes(language)) return `node ${mainEntry}`;
  if (language === 'python') return `python ${mainEntry}`;
  return '';
}

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

// Admins author requiredApiRoutes as plain strings ("POST /api/register") so the
// checklist stays easy to edit; this is the one place that shape is parsed into
// the method/path pair the sandbox HTTP check actually needs.
export function parseRequiredApiRoute(value = '') {
  const trimmed = String(value || '').trim();
  const [firstWord, ...rest] = trimmed.split(/\s+/);
  const candidateMethod = String(firstWord || '').toUpperCase();

  if (HTTP_METHODS.has(candidateMethod) && rest.length > 0) {
    const restPath = rest.join(' ');
    return {
      method: candidateMethod,
      path: restPath.startsWith('/') ? restPath : `/${restPath}`,
      raw: trimmed,
    };
  }

  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return { method: 'GET', path, raw: trimmed };
}

function defaultMainEntryFor(language) {
  return language === 'python' ? 'main.py' : 'main.js';
}

function defaultRunCommandFor(language, mainEntry) {
  return language === 'python' ? `python ${mainEntry}` : `node ${mainEntry}`;
}

// Generates a ready-to-copy competra.json so a learner never has to reverse
// engineer the manifest schema from documentation that does not exist for them.
export function buildManifestTemplate(practicalTask = {}) {
  const language = normalizeSubmissionLanguage((practicalTask.allowedLanguages || [])[0]) || 'javascript';
  const protocol = normalizeProtocol(practicalTask.executionInterface) || 'instructor_tests';
  const mainEntry = defaultMainEntryFor(language);

  const template = {
    language,
    inputOutputProtocol: protocol,
    workingDirectory: '.',
  };

  if (protocol === 'rest_api') {
    template.startCommand = defaultRunCommandFor(language, mainEntry);
    template.port = 3000;
  } else if (protocol === 'stdin_stdout') {
    template.mainEntry = mainEntry;
    template.runCommand = defaultRunCommandFor(language, mainEntry);
  } else {
    template.mainEntry = mainEntry;
    template.testCommand = language === 'python' ? 'pytest' : 'npm test';
  }

  return template;
}

// The learner-facing contract for a practical task: everything needed to know
// how to format a submission so the automatic checks can actually run, without
// ever exposing hidden test content (only a count, so integrity is preserved).
export function buildSubmissionContract(practicalTask = {}) {
  const publicTestCases = (practicalTask.publicTestCases || []).map((testCase) => ({
    id: testCase.id || '',
    title: testCase.title || '',
    input: testCase.input || '',
    expectedOutput: testCase.expectedOutput || '',
    validator: testCase.validator || 'normalized_text',
  }));

  return {
    manifestFileName: 'competra.json',
    allowedLanguages: practicalTask.allowedLanguages || [],
    executionInterface: practicalTask.executionInterface || 'instructor_tests',
    manifestTemplate: buildManifestTemplate(practicalTask),
    publicTestCases,
    requiredApiRoutes: (practicalTask.requiredApiRoutes || []).map(parseRequiredApiRoute),
    hiddenTestCaseCount: (practicalTask.hiddenTestCases || []).length,
  };
}

function validateSubmissionManifest(manifest, practicalTask = {}) {
  const checks = [];

  if (!manifest) {
    return {
      manifest: null,
      adapter: null,
      workingDirectory: '.',
      executionCommand: '',
      protocol: '',
      checks: [
        {
          id: 'competra-manifest',
          title: 'Submission includes competra.json execution manifest',
          competency: 'documentation',
          passed: false,
          evidence: '',
          error: 'Missing competra.json. The system cannot reliably execute arbitrary code without a submission contract.',
          weight: 12,
        },
      ],
      assessorValidationRequired: true,
    };
  }

  const language = normalizeSubmissionLanguage(manifest.language);
  const protocol = normalizeProtocol(manifest.inputOutputProtocol || manifest.protocol || practicalTask.executionInterface);
  const adapter = LANGUAGE_ADAPTERS[language];
  const allowedLanguages = (practicalTask.allowedLanguages || [])
    .map(normalizeSubmissionLanguage)
    .filter(Boolean);
  const executionCommand = buildDefaultExecutionCommand(manifest);

  checks.push({
    id: 'competra-manifest',
    title: 'Submission includes competra.json execution manifest',
    competency: 'documentation',
    passed: true,
    evidence: 'competra.json was found and parsed.',
    error: '',
    weight: 12,
  });
  checks.push({
    id: 'supported-language-adapter',
    title: 'Submission language has a supported execution adapter',
    competency: 'deployment',
    passed: Boolean(adapter) && SUPPORTED_SUBMISSION_LANGUAGES.has(language),
    evidence: adapter ? `${language} adapter selected.` : '',
    error: adapter ? '' : `Unsupported language '${language || 'not provided'}'. Supported MVP languages are JavaScript/TypeScript and Python.`,
    weight: 12,
  });
  checks.push({
    id: 'task-language-compliance',
    title: 'Submission language is allowed for the practical task',
    competency: 'documentation',
    passed: allowedLanguages.length === 0 || allowedLanguages.includes(language),
    evidence: allowedLanguages.length > 0 ? `${language} is listed in task allowedLanguages.` : 'Task does not restrict languages.',
    error: allowedLanguages.length === 0 || allowedLanguages.includes(language) ? '' : `${language} is not allowed for this task.`,
    weight: 8,
  });
  checks.push({
    id: 'observable-execution-contract',
    title: 'Submission exposes an observable execution interface',
    competency: 'testing',
    passed: ['stdin_stdout', 'rest_api', 'cli', 'frontend', 'instructor_tests'].includes(protocol),
    evidence: protocol ? `Protocol: ${protocol}.` : '',
    error: protocol ? `Unsupported protocol '${protocol}'.` : 'inputOutputProtocol is required in competra.json.',
    weight: 10,
  });
  checks.push({
    id: 'execution-command-defined',
    title: 'Submission defines how the evaluator should execute it',
    competency: 'deployment',
    passed: Boolean(executionCommand || manifest.testCommand || manifest.startCommand),
    evidence: executionCommand || manifest.testCommand || manifest.startCommand || '',
    error: 'Provide runCommand, startCommand, testCommand, or mainEntry in competra.json.',
    weight: 10,
  });

  if (protocol === 'rest_api') {
    checks.push({
      id: 'rest-api-port-declared',
      title: 'Submission declares the port its server listens on',
      competency: 'deployment',
      passed: Number.isInteger(manifest.port) && manifest.port > 0,
      evidence: manifest.port ? `Declared port: ${manifest.port}.` : '',
      error: 'Provide a numeric "port" in competra.json so the evaluator can reach the running server.',
      weight: 8,
    });
  }

  return {
    manifest: { ...manifest, language, inputOutputProtocol: protocol },
    adapter,
    workingDirectory: manifest.workingDirectory || '.',
    executionCommand,
    protocol,
    checks,
    assessorValidationRequired: checks.some((check) => !check.passed),
  };
}

async function runManifestCommand({
  name,
  sandbox,
  repositoryPath = E2B_REPOSITORY_PATH,
  workingDirectory = '.',
  command,
  timeoutMs,
}) {
  return runE2bCommand({
    name,
    sandbox,
    repositoryPath,
    workingDirectory,
    command,
    timeoutMs,
  });
}

function normalizeEvaluatorOutput(value = '') {
  return String(value || '').replace(/\r\n/g, '\n').trim().replace(/[ \t]+/g, ' ');
}

function compareTestOutput(actual, expected, validator = 'normalized_text', tolerance = 0) {
  if (validator === 'exact_text') return String(actual).trim() === String(expected).trim();

  if (validator === 'numeric') {
    const actualNumber = Number(String(actual).trim());
    const expectedNumber = Number(String(expected).trim());
    return Number.isFinite(actualNumber) &&
      Number.isFinite(expectedNumber) &&
      Math.abs(actualNumber - expectedNumber) <= Number(tolerance || 0);
  }

  if (validator === 'json') {
    try {
      return JSON.stringify(JSON.parse(actual)) === JSON.stringify(JSON.parse(expected));
    } catch {
      return false;
    }
  }

  return normalizeEvaluatorOutput(actual) === normalizeEvaluatorOutput(expected);
}

function normalizeTaskTestCases(practicalTask = {}) {
  const publicTests = (practicalTask.publicTestCases || []).map((testCase, index) => ({
    ...testCase,
    id: testCase.id || `public-${index + 1}`,
    isHidden: false,
  }));
  const hiddenTests = (practicalTask.hiddenTestCases || []).map((testCase, index) => ({
    ...testCase,
    id: testCase.id || `hidden-${index + 1}`,
    isHidden: true,
  }));

  return [...publicTests, ...hiddenTests];
}

async function writeBlackBoxInput({ sandbox, repositoryPath, index, input = '' }) {
  const relativePath = '.competra-runtime/input-' + index + '.txt';
  await sandbox.files.write(path.posix.join(repositoryPath, relativePath), String(input ?? ''));
  return relativePath;
}

async function runBlackBoxStdoutTests({ sandbox, repositoryPath, contract, practicalTask }) {
  const testCases = [];
  const commandResults = [];
  const configuredTests = normalizeTaskTestCases(practicalTask);

  if (contract.protocol !== 'stdin_stdout' || !contract.executionCommand || configuredTests.length === 0) {
    return { testCases, commandResults };
  }

  for (const [index, testCase] of configuredTests.entries()) {
    const inputPath = await writeBlackBoxInput({ sandbox, repositoryPath, index, input: testCase.input });
    const command = contract.executionCommand + ' < ' + inputPath;
    const commandResult = await runManifestCommand({
      name: (testCase.isHidden ? 'Hidden' : 'Public') + ' black-box test: ' + (testCase.title || testCase.id),
      sandbox,
      repositoryPath,
      workingDirectory: contract.workingDirectory,
      command,
      timeoutMs: Number(practicalTask.timeLimitMs || contract.manifest.timeout || 10000),
    }).catch((error) => ({
      name: (testCase.isHidden ? 'Hidden' : 'Public') + ' black-box test: ' + (testCase.title || testCase.id),
      command,
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: error.message,
      durationMs: 0,
    }));
    const passed = commandResult.success && compareTestOutput(
      commandResult.stdout,
      testCase.expectedOutput,
      testCase.validator,
      testCase.tolerance,
    );

    commandResults.push(commandResult);
    testCases.push({
      id: 'black-box-' + (testCase.isHidden ? 'hidden' : 'public') + '-' + testCase.id,
      title: (testCase.isHidden ? 'Hidden' : 'Public') + ' platform-owned correctness test passed',
      competency: 'testing',
      passed,
      weight: Number(testCase.weight || (testCase.isHidden ? 18 : 10)),
      evidence: passed
        ? 'Observed output matched the platform-owned validator.'
        : testCase.isHidden
          ? 'Hidden test failed. Inputs and expected outputs are hidden to preserve assessment integrity.'
          : 'Expected ' + JSON.stringify(testCase.expectedOutput) + ', received ' + JSON.stringify(commandResult.stdout.trim()) + '.',
      error: passed
        ? ''
        : commandResult.stderr || 'Output did not satisfy the task validator.',
    });
  }

  return { testCases, commandResults };
}

const REST_API_READY_POLL_ATTEMPTS = 10;
const REST_API_READY_POLL_DELAY_MS = 750;

async function waitForRestApiServerReady(baseUrl) {
  for (let attempt = 1; attempt <= REST_API_READY_POLL_ATTEMPTS; attempt += 1) {
    try {
      await fetch(baseUrl, { method: 'GET' });
      return true;
    } catch {
      if (attempt === REST_API_READY_POLL_ATTEMPTS) return false;
      await new Promise((resolve) => setTimeout(resolve, REST_API_READY_POLL_DELAY_MS));
    }
  }

  return false;
}

// Behavioral proof for rest_api submissions: start the learner's server in the
// sandbox, reach it from outside via E2B's port forwarding, and confirm every
// admin-declared required route actually responds. This never inspects source
// code, so it works the same regardless of language or file layout.
async function runBlackBoxRestApiTests({ sandbox, contract, practicalTask }) {
  const testCases = [];
  const commandResults = [];
  const routes = (practicalTask.requiredApiRoutes || [])
    .map(parseRequiredApiRoute)
    .filter((route) => route.path);
  const startCommand = commandOrEmpty(contract.manifest?.startCommand);
  const port = Number(contract.manifest?.port);
  const portIsValid = Number.isInteger(port) && port > 0;

  if (contract.protocol !== 'rest_api' || !startCommand || !portIsValid || routes.length === 0) {
    return { testCases, commandResults };
  }

  let serverHandle;

  try {
    serverHandle = await sandbox.commands.run(startCommand, {
      cwd: safeSandboxWorkingDirectory(E2B_REPOSITORY_PATH, contract.workingDirectory),
      background: true,
    });
  } catch (error) {
    testCases.push({
      id: 'rest-api-server-start',
      title: 'REST API server starts from the manifest startCommand',
      competency: 'deployment',
      passed: false,
      weight: 10,
      evidence: '',
      error: error.message || 'Server failed to start in the sandbox.',
    });
    return { testCases, commandResults };
  }

  try {
    const baseUrl = `https://${sandbox.getHost(port)}`;
    const isReady = await waitForRestApiServerReady(baseUrl);

    testCases.push({
      id: 'rest-api-server-start',
      title: 'REST API server starts and listens on the declared port',
      competency: 'deployment',
      passed: isReady,
      weight: 10,
      evidence: isReady ? `Server responded on declared port ${port}.` : '',
      error: isReady
        ? ''
        : `No response from port ${port} within ${REST_API_READY_POLL_ATTEMPTS * REST_API_READY_POLL_DELAY_MS}ms. Check that competra.json's startCommand binds to this port.`,
    });

    if (!isReady) {
      return { testCases, commandResults };
    }

    for (const route of routes) {
      const startedRequestAt = Date.now();
      const requestLabel = `${route.method} ${route.path}`;

      try {
        const response = await fetch(`${baseUrl}${route.path}`, { method: route.method });
        const passed = response.status < 500 && response.status !== 404;

        commandResults.push({
          name: `REST API check: ${requestLabel}`,
          command: requestLabel,
          success: passed,
          exitCode: passed ? 0 : 1,
          stdout: `HTTP ${response.status}`,
          stderr: passed ? '' : `HTTP ${response.status}`,
          durationMs: Date.now() - startedRequestAt,
        });
        testCases.push({
          id: `rest-api-route-${route.method.toLowerCase()}-${route.path}`,
          title: `Required endpoint ${requestLabel} responds`,
          competency: 'backend',
          passed,
          weight: 10,
          evidence: passed ? `Received HTTP ${response.status} from ${requestLabel}.` : '',
          error: passed
            ? ''
            : `Received HTTP ${response.status} from ${requestLabel}. Expected a response other than 404/5xx.`,
        });
      } catch (error) {
        commandResults.push({
          name: `REST API check: ${requestLabel}`,
          command: requestLabel,
          success: false,
          exitCode: 1,
          stdout: '',
          stderr: error.message || 'Request failed.',
          durationMs: Date.now() - startedRequestAt,
        });
        testCases.push({
          id: `rest-api-route-${route.method.toLowerCase()}-${route.path}`,
          title: `Required endpoint ${requestLabel} responds`,
          competency: 'backend',
          passed: false,
          weight: 10,
          evidence: '',
          error: error.message || `Request to ${requestLabel} failed.`,
        });
      }
    }

    return { testCases, commandResults };
  } finally {
    await serverHandle.kill().catch(() => null);
  }
}

async function evaluateSubmissionContract({ localPath, practicalTask, analysis, e2bContext }) {
  const { manifest } = await readSubmissionManifest(localPath);
  const contract = validateSubmissionManifest(manifest, practicalTask);
  const commandResults = [];
  const testCases = [...contract.checks];
  const securityNotes = manifest
    ? ['competra.json was used as the submission execution contract.']
    : ['No competra.json was found; automatic execution is limited and assessor validation is required.'];

  if (!contract.adapter) {
    return {
      ...contract,
      executionMode: 'static_only',
      commandResults,
      testCases,
      securityNotes,
    };
  }

  const timeoutMs = Number(practicalTask.timeLimitMs || contract.manifest.timeout || repositoryAnalysisTimeoutMs());

  const installCommand = commandOrEmpty(contract.manifest.installCommand) ||
    (analysis.projectType === 'node' && analysis.hasPackageJson ? 'npm install --ignore-scripts' : '');
  const buildCommand = commandOrEmpty(contract.manifest.buildCommand);
  const userTestCommand = commandOrEmpty(contract.manifest.testCommand);

  for (const commandConfig of [
    { name: 'Install dependencies from manifest', command: installCommand },
    { name: 'Build project from manifest', command: buildCommand },
    { name: 'Run user-written tests from manifest', command: userTestCommand },
  ]) {
    if (!commandConfig.command) continue;
    commandResults.push(
      await runManifestCommand({
        name: commandConfig.name,
        sandbox: e2bContext.sandbox,
        repositoryPath: e2bContext.repositoryPath,
        workingDirectory: contract.workingDirectory,
        command: commandConfig.command,
        timeoutMs,
      }).catch((error) => ({
        name: commandConfig.name,
        command: commandConfig.command,
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        durationMs: 0,
      })),
    );
  }

  const installResult = commandResults.find((result) => result.name === 'Install dependencies from manifest');
  const buildResult = commandResults.find((result) => result.name === 'Build project from manifest');
  const userTestResult = commandResults.find((result) => result.name === 'Run user-written tests from manifest');

  if (installCommand) {
    testCases.push({
      id: 'manifest-dependency-install',
      title: 'Manifest install command completed',
      competency: 'deployment',
      passed: Boolean(installResult?.success),
      evidence: installResult?.success ? 'Install command completed in sandbox.' : '',
      error: installResult?.success ? '' : installResult?.stderr || 'Manifest install command failed.',
      weight: 8,
    });
  }

  if (buildCommand) {
    testCases.push({
      id: 'manifest-build-command',
      title: 'Manifest build command completed',
      competency: 'deployment',
      passed: Boolean(buildResult?.success),
      evidence: buildResult?.success ? 'Build command completed in sandbox.' : '',
      error: buildResult?.success ? '' : buildResult?.stderr || 'Manifest build command failed.',
      weight: 8,
    });
  }

  if (userTestCommand) {
    testCases.push({
      id: 'manifest-user-tests',
      title: 'User-written tests ran from manifest',
      competency: 'testing',
      passed: Boolean(userTestResult?.success),
      evidence: userTestResult?.success ? 'User-written tests passed. These are secondary evidence, not the main correctness proof.' : '',
      error: userTestResult?.success ? '' : userTestResult?.stderr || 'User-written tests failed or were not runnable.',
      weight: 5,
    });
  }

  const blackBoxResult = await runBlackBoxStdoutTests({
    sandbox: e2bContext.sandbox,
    repositoryPath: e2bContext.repositoryPath,
    contract,
    practicalTask,
  });
  const restApiResult = await runBlackBoxRestApiTests({
    sandbox: e2bContext.sandbox,
    contract,
    practicalTask,
  });

  return {
    ...contract,
    executionMode: 'e2b',
    commandResults: [...commandResults, ...blackBoxResult.commandResults, ...restApiResult.commandResults],
    testCases: [...testCases, ...blackBoxResult.testCases, ...restApiResult.testCases],
    securityNotes,
  };
}

export async function runRepositoryTests(localPath, analysis, practicalTask = {}, e2bContext) {
  const commandResults = [];
  const testCases = [];
  const securityNotes = [
    'Repository commands run only inside an E2B isolated sandbox.',
  ];
  const instructorTestFiles = practicalTask.automatedTestFiles || [];
  const instructorTestCommand = String(practicalTask.automatedTestCommand || '').trim();
  const hasInstructorTests =
    instructorTestFiles.length > 0 && instructorTestCommand.length > 0;

  if (!e2bContext?.sandbox) {
    throw new AppError('E2B sandbox was not created for repository assessment.', 500);
  }

  const contractEvaluation = await evaluateSubmissionContract({
    localPath,
    practicalTask,
    analysis,
    e2bContext,
  });

  commandResults.push(...contractEvaluation.commandResults);
  testCases.push(...contractEvaluation.testCases);
  securityNotes.push(...contractEvaluation.securityNotes);

  const manifestLanguage = contractEvaluation.manifest?.language;
  const shouldRunLegacyNodeChecks =
    analysis.projectType === 'node' &&
    (!manifestLanguage || ['javascript', 'typescript', 'node', 'nodejs'].includes(manifestLanguage));

  if (!shouldRunLegacyNodeChecks) {
    return {
      executionMode: contractEvaluation.executionMode || 'e2b',
      totalTestCases: testCases.length,
      passedTestCases: testCases.filter((test) => test.passed).length,
      commandResults,
      testCases,
      assessorValidationRequired: contractEvaluation.assessorValidationRequired,
      securityNotes,
      submissionManifest: contractEvaluation.manifest,
    };
  }

  const hasTestScript = typeof analysis.packageScripts.test === 'string';
  const hasBuildScript = typeof analysis.packageScripts.build === 'string';
  let writtenInstructorTests = [];

  commandResults.push(
    await runE2bCommand({
      name: 'Install dependencies',
      sandbox: e2bContext.sandbox,
      repositoryPath: e2bContext.repositoryPath,
      command: 'npm install --ignore-scripts',
    }),
  );

  if (hasInstructorTests) {
    try {
      // Hidden instructor tests prove whether the repository solves the task.
      writtenInstructorTests = await writeInstructorTestFilesToSandbox(
        e2bContext.sandbox,
        e2bContext.repositoryPath,
        instructorTestFiles,
      );
    } catch (error) {
      commandResults.push({
        name: 'Prepare instructor task tests',
        command: 'write instructor test files',
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        durationMs: 0,
      });
    }
  }

  if (hasBuildScript) {
    commandResults.push(
      await runE2bCommand({
        name: 'Build project',
        sandbox: e2bContext.sandbox,
        repositoryPath: e2bContext.repositoryPath,
        command: 'npm run build --if-present',
      }),
    );
  }

  if (hasTestScript) {
    commandResults.push(
      await runE2bCommand({
        name: 'Run submitted automated tests',
        sandbox: e2bContext.sandbox,
        repositoryPath: e2bContext.repositoryPath,
        command: 'npm test -- --runInBand',
      }),
    );
  }

  if (hasInstructorTests && writtenInstructorTests.length > 0) {
    commandResults.push(
      await runE2bCommand({
        name: 'Run instructor task tests',
        sandbox: e2bContext.sandbox,
        repositoryPath: e2bContext.repositoryPath,
        command: instructorTestCommand,
      }),
    );
  }

  const installResult = commandResults.find((result) => result.name === 'Install dependencies');
  const buildResult = commandResults.find((result) => result.name === 'Build project');
  const submittedTestResult = commandResults.find(
    (result) => result.name === 'Run submitted automated tests',
  );
  const instructorTestResult = commandResults.find(
    (result) => result.name === 'Run instructor task tests',
  );

  testCases.push({
    id: 'dependency-install',
    title: 'Dependencies install successfully',
    competency: 'deployment',
    passed: Boolean(installResult?.success),
    evidence: installResult?.success ? 'npm install completed successfully in E2B.' : '',
    error: installResult?.success ? '' : installResult?.stderr || 'Dependency installation failed in E2B.',
  });

  if (hasBuildScript) {
    testCases.push({
      id: 'build-script',
      title: 'Project builds successfully',
      competency: 'deployment',
      passed: Boolean(buildResult?.success),
      evidence: buildResult?.success ? 'Build command completed successfully in E2B.' : '',
      error: buildResult?.success ? '' : buildResult?.stderr || 'Build failed in E2B.',
    });
  }

  testCases.push({
    id: 'submitted-automated-tests',
    title: 'Graduate-submitted automated tests pass',
    competency: 'testing',
    passed: Boolean(submittedTestResult?.success),
    evidence: submittedTestResult?.success ? 'npm test completed successfully in E2B.' : '',
    error: submittedTestResult?.success
      ? ''
      : hasTestScript
        ? submittedTestResult?.stderr || 'Submitted automated tests failed in E2B.'
        : 'No npm test script was found.',
  });

  testCases.push({
    id: 'instructor-task-tests',
    title: 'Instructor-defined practical task tests pass',
    competency: 'testing',
    passed: Boolean(instructorTestResult?.success),
    evidence: instructorTestResult?.success
      ? 'Instructor tests passed in E2B. Files injected: ' + writtenInstructorTests.join(', ') + '.'
      : '',
    error: instructorTestResult?.success
      ? ''
      : hasInstructorTests
        ? instructorTestResult?.stderr || 'Instructor-defined tests failed in E2B.'
        : 'No instructor-defined task tests were configured for this practical task.',
  });

  return {
    executionMode: 'e2b',
    totalTestCases: testCases.length,
    passedTestCases: testCases.filter((test) => test.passed).length,
    commandResults,
    testCases,
    assessorValidationRequired:
      contractEvaluation.assessorValidationRequired || !hasTestScript || !hasInstructorTests,
    securityNotes,
    submissionManifest: contractEvaluation.manifest,
  };
}

function parseEslintOutput(output = '') {
  try {
    const results = JSON.parse(output || '[]');
    return results.reduce(
      (summary, item) => ({
        errors: summary.errors + Number(item.errorCount || 0),
        warnings: summary.warnings + Number(item.warningCount || 0),
      }),
      { errors: 0, warnings: 0 },
    );
  } catch {
    return { errors: 0, warnings: 0 };
  }
}

export async function runEslint(localPath, analysis, e2bContext) {
  if (analysis.projectType !== 'node') {
    return {
      available: false,
      success: false,
      errors: 0,
      warnings: 0,
      output: 'ESLint was skipped because the project is not detected as a Node.js project.',
    };
  }

  if (!e2bContext?.sandbox) {
    return {
      available: true,
      success: false,
      errors: 0,
      warnings: 0,
      output: 'ESLint could not run because the E2B sandbox was not available.',
    };
  }

  const hasLintScript = typeof analysis.packageScripts.lint === 'string';
  const shellCommand = hasLintScript ? 'npm run lint -- --format json' : 'npx eslint . --format json';
  const result = await runE2bCommand({
    name: 'Run ESLint code quality scan',
    sandbox: e2bContext.sandbox,
    repositoryPath: e2bContext.repositoryPath,
    command: shellCommand,
  });
  const parsed = parseEslintOutput(result.stdout);

  return {
    available: true,
    success: result.success,
    errors: parsed.errors,
    warnings: parsed.warnings,
    output: (result.stdout || result.stderr || (shellCommand + ' produced no output.')).slice(-12000),
  };
}

const SECRET_PATTERNS = [
  {
    label: 'Hardcoded JWT secret',
    pattern: /(JWT_SECRET|jwtSecret)\s*[:=]\s*['"][^'"]{8,}/i,
  },
  {
    label: 'MongoDB connection string',
    pattern: /mongodb(\+srv)?:\/\/[^"'\s]+/i,
  },
  {
    label: 'Generic API key',
    pattern: /(API_KEY|SECRET_KEY|ACCESS_TOKEN|GITHUB_TOKEN)\s*[:=]\s*['"][^'"]{8,}/i,
  },
  {
    label: 'Private key',
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  },
];

function parseNpmAudit(output = '') {
  try {
    const parsed = JSON.parse(output || '{}');
    const vulnerabilities = parsed.metadata?.vulnerabilities || {};
    const high = Number(vulnerabilities.high || 0);
    const critical = Number(vulnerabilities.critical || 0);

    return {
      high,
      critical,
      total: Number(vulnerabilities.total || high + critical),
    };
  } catch {
    return {
      high: 0,
      critical: 0,
      total: 0,
    };
  }
}

function scanForSecrets(analysis) {
  const sourceText = (analysis.sampledSource || [])
    .map((file) => file.path + '\n' + (file.excerpt || ''))
    .join('\n');

  return SECRET_PATTERNS.filter((rule) => rule.pattern.test(sourceText)).map(
    (rule) => rule.label,
  );
}

export async function runSecurityScan(localPath, analysis, e2bContext) {
  const secretFindings = scanForSecrets(analysis);

  if (analysis.projectType !== 'node') {
    return {
      available: false,
      success: secretFindings.length === 0,
      high: 0,
      critical: 0,
      total: 0,
      secretFindings,
      output: 'Dependency security scan skipped because the project is not detected as a Node.js project.',
    };
  }

  if (!e2bContext?.sandbox) {
    return {
      available: true,
      success: false,
      high: 0,
      critical: 0,
      total: 0,
      secretFindings,
      output: 'Security scan could not run because the E2B sandbox was not available.',
    };
  }

  const result = await runE2bCommand({
    name: 'Run dependency security scan',
    sandbox: e2bContext.sandbox,
    repositoryPath: e2bContext.repositoryPath,
    command: 'npm audit --json --audit-level=high',
  });
  const audit = parseNpmAudit(result.stdout);
  const success =
    audit.high === 0 && audit.critical === 0 && secretFindings.length === 0;

  return {
    available: true,
    success,
    high: audit.high,
    critical: audit.critical,
    total: audit.total,
    secretFindings,
    output: (result.stdout || result.stderr || 'npm audit produced no output.').slice(-12000),
  };
}

const COMPETENCY_KEYS = [
  'frontend',
  'backend',
  'database',
  'authentication',
  'testing',
  'documentation',
  'deployment',
];

const DEFAULT_CHECK_WEIGHT = 5;

// These weights make the repository assessment score defensible: behavioral
// proof is worth more than static signals, and instructor tests carry the most
// weight because they verify the exact practical task.
export const OBJECTIVE_CHECK_WEIGHTS = {
  'frontend-ui': 8,
  'backend-api': 8,
  database: 8,
  authentication: 8,
  testing: 6,
  documentation: 4,
  deployment: 4,
  'dependency-install': 8,
  'build-script': 10,
  'submitted-automated-tests': 12,
  'instructor-task-tests': 20,
  'e2b-isolation': 8,
  'automated-tests-stage': 8,
  'e2b-execution-stage': 6,
  'eslint-stage': 8,
  'security-scan-stage': 10,
  'automatic-validation-stage': 8,
  'repository-assessment-engine': 10,
};

export function classifyAccuracy(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Competent';
  if (score >= 60) return 'Moderate Gap';
  return 'High Gap';
}

function roundScore(score) {
  // Keep score precision stable for reports, badges, and stored assessment rows.
  return Math.round(score * 100) / 100;
}

function normalizeCheck(check) {
  return {
    ...check,
    weight:
      Number(check.weight) > 0
        ? Number(check.weight)
        : OBJECTIVE_CHECK_WEIGHTS[check.id] || DEFAULT_CHECK_WEIGHT,
  };
}

function calculateWeightedAccuracy(checks) {
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0);
  const passedWeight = checks.reduce(
    (sum, check) => sum + (check.passed ? check.weight : 0),
    0,
  );

  return {
    totalWeight,
    passedWeight,
    accuracyScore:
      totalWeight > 0 ? roundScore((passedWeight / totalWeight) * 100) : 0,
  };
}

export function scoreRepositoryAssessment({
  staticChecks = [],
  testCases = [],
  eslintResult,
  securityScanResult,
}) {
  // Pipeline checks convert tool outcomes into the same pass/fail shape as
  // static requirements, so the final score can be computed uniformly.
  const pipelineChecks = [
    {
      id: 'automated-tests-stage',
      title: 'Automated tests were executed and passed',
      competency: 'testing',
      weight: OBJECTIVE_CHECK_WEIGHTS['automated-tests-stage'],
      passed:
        testCases.some((check) => check.id === 'submitted-automated-tests' && check.passed) ||
        testCases.some((check) => check.id === 'instructor-task-tests' && check.passed),
      evidence: 'Graduate or instructor automated tests passed.',
      error: 'No passing automated test evidence was found.',
    },
    {
      id: 'e2b-execution-stage',
      title: 'Repository was executed safely through E2B',
      competency: 'deployment',
      weight: OBJECTIVE_CHECK_WEIGHTS['e2b-execution-stage'],
      passed:
        testCases.some((check) => check.id === 'dependency-install' && check.passed) ||
        testCases.some((check) => check.id === 'build-script' && check.passed),
      evidence: 'E2B sandbox dependency/build execution completed.',
      error: 'E2B sandbox execution did not complete successfully.',
    },
    {
      id: 'eslint-stage',
      title: 'ESLint code quality scan passed',
      competency: 'testing',
      weight: OBJECTIVE_CHECK_WEIGHTS['eslint-stage'],
      passed:
        eslintResult?.available === true &&
        eslintResult?.success === true &&
        Number(eslintResult?.errors || 0) === 0,
      evidence: 'ESLint completed without errors.',
      error:
        eslintResult?.available === false
          ? 'ESLint was not available for this project.'
          : `ESLint reported ${eslintResult?.errors || 0} error(s) and ${eslintResult?.warnings || 0} warning(s).`,
    },
    {
      id: 'security-scan-stage',
      title: 'Security scan passed',
      competency: 'authentication',
      weight: OBJECTIVE_CHECK_WEIGHTS['security-scan-stage'],
      passed: securityScanResult?.success === true,
      evidence: 'No high/critical dependency vulnerabilities or hardcoded secret patterns were detected.',
      error:
        securityScanResult?.available === false
          ? securityScanResult?.output || 'Security scan was not available.'
          : `Security scan found ${securityScanResult?.critical || 0} critical, ${securityScanResult?.high || 0} high vulnerability issue(s), and ${(securityScanResult?.secretFindings || []).length} secret finding(s).`,
    },
    {
      id: 'automatic-validation-stage',
      title: 'Automatic repository validation completed',
      competency: 'documentation',
      weight: OBJECTIVE_CHECK_WEIGHTS['automatic-validation-stage'],
      passed: true,
      evidence: 'The system completed the automated repository scoring pipeline.',
      error: 'Automatic repository scoring did not complete.',
    },
  ];
  // Normalize every check to an explicit weight so score changes can be
  // explained from the stored passed/failed requirements.
  const objectiveChecks = [...staticChecks, ...testCases, ...pipelineChecks].map(
    normalizeCheck,
  );
  const totalTestCases = objectiveChecks.length;
  const passedTestCases = objectiveChecks.filter((check) => check.passed).length;
  const { totalWeight, passedWeight, accuracyScore } =
    calculateWeightedAccuracy(objectiveChecks);
  const competencyScores = {};

  for (const key of COMPETENCY_KEYS) {
    // Per-competency scores show where the submission is weak, not just whether
    // the overall repository passed.
    const related = objectiveChecks.filter((check) => check.competency === key);
    competencyScores[key] = calculateWeightedAccuracy(related).accuracyScore;
  }

  return {
    totalTestCases,
    passedTestCases,
    totalWeight,
    passedWeight,
    accuracyScore,
    gapClassification: classifyAccuracy(accuracyScore),
    competencyScores,
    passedRequirements: objectiveChecks.filter((check) => check.passed),
    failedRequirements: objectiveChecks.filter((check) => !check.passed),
  };
}

function findPracticalTask(competency, practicalTaskId) {
  if (!competency || !practicalTaskId) return null;
  return competency.practicalTasks?.find(
    (task) => String(task._id) === String(practicalTaskId),
  );
}

export async function assessGithubRepository({
  repositoryUrl,
  competencyId,
  practicalTaskId,
  user,
}) {
  let localPath = '';
  let e2bContext = null;

  try {
    // This path performs objective checks by cloning and executing the repo.
    // Static GitHub review runs elsewhere; this service is the executable proof layer.
    const competency = competencyId
      ? await Competency.findById(competencyId)
      : null;
    const practicalTask = findPracticalTask(competency, practicalTaskId);

    if (competencyId && !competency) {
      throw new AppError('Competency was not found.', 404);
    }

    const cloned = await cloneGithubRepository(repositoryUrl);
    localPath = cloned.localPath;
    e2bContext = await createE2bRepositoryContext(cloned.repository);

    // Reduce the competency/practical task to the text the analyzer needs for
    // rule-based requirement detection.
    const task = {
      title: practicalTask?.title || competency?.title || '',
      instructions: practicalTask?.instructions || '',
      deliverables: practicalTask?.deliverables || '',
      description: competency?.description || '',
    };
    const analysis = await analyzeRepository(localPath, task);
    const testResult = await runRepositoryTests(localPath, analysis, practicalTask || {}, e2bContext);
    const eslintResult = await runEslint(localPath, analysis, e2bContext);
    const securityScanResult = await runSecurityScan(localPath, analysis, e2bContext);
    // Final scoring combines static requirement checks, executed tests, lint,
    // and security scan evidence into one explainable automatic result.
    const score = scoreRepositoryAssessment({
      staticChecks: analysis.requirementChecks,
      testCases: testResult.testCases,
      eslintResult,
      securityScanResult,
    });
    const draftResult = {
      graduate: user?._id,
      organization: user?.organization?._id || user?.organization,
      competency: competency?._id,
      practicalTaskId: practicalTask?._id,
      repositoryUrl,
      owner: cloned.repository.owner,
      repo: cloned.repository.repo,
      verificationStatus: 'verified',
      executionMode: testResult.executionMode,
      projectType: analysis.projectType,
      detectedTechnologies: analysis.detectedTechnologies,
      submissionManifest: testResult.submissionManifest || null,
      evaluatorResult: {
        status: 'completed',
        language: testResult.submissionManifest?.language || analysis.projectType,
        executionMode: testResult.executionMode,
        correctness: {
          score: score.accuracyScore,
          passed: score.passedTestCases,
          failed: score.totalTestCases - score.passedTestCases,
          total: score.totalTestCases,
        },
        failedRequirements: score.failedRequirements.map((item) => item.id || item.title),
        build: {
          success: !score.failedRequirements.some((item) => item.id === 'build-script' || item.id === 'manifest-build-command'),
        },
        security: securityScanResult,
        quality: eslintResult,
      },
      totalTestCases: score.totalTestCases,
      passedTestCases: score.passedTestCases,
      totalWeight: score.totalWeight,
      passedWeight: score.passedWeight,
      accuracyScore: score.accuracyScore,
      gapClassification: score.gapClassification,
      competencyScores: score.competencyScores,
      passedRequirements: score.passedRequirements,
      failedRequirements: score.failedRequirements,
      staticChecks: analysis.requirementChecks,
      commandResults: [
        e2bContext.cloneResult,
        ...testResult.commandResults,
      ],
      eslintResult,
      securityScanResult,
      assessorReviewStatus: 'approved',
      automaticReviewStatus: 'completed',
      assessorValidationRequired: false,
      securityNotes: testResult.securityNotes,
    };

    draftResult.recommendations =
      buildRepositoryAssessmentRecommendations(draftResult);

    return RepositoryAssessmentResult.create(draftResult);
  } catch (error) {
    // Preserve a failed assessment result instead of losing the review attempt.
    // This gives users a concrete reason to fix access/setup and resubmit.
    const failedRequirement = {
      id: 'repository-assessment-engine',
      title: 'Repository assessment engine completed',
      competency: 'testing',
      passed: false,
      evidence: '',
      weight: 10,
      error:
        error.message ||
        'Repository assessment failed before objective checks could be completed.',
    };
    const result = await RepositoryAssessmentResult.create({
      graduate: user?._id,
      organization: user?.organization?._id || user?.organization,
      competency: competencyId,
      practicalTaskId,
      repositoryUrl,
      verificationStatus: 'failed',
      executionMode: 'failed',
      totalTestCases: 1,
      passedTestCases: 0,
      totalWeight: failedRequirement.weight || 10,
      passedWeight: 0,
      accuracyScore: 0,
      gapClassification: 'High Gap',
      submissionManifest: null,
      evaluatorResult: {
        status: 'failed',
        error: error.message || 'Repository assessment failed before objective checks could be completed.',
        correctness: { score: 0, passed: 0, failed: 1, total: 1 },
      },
      competencyScores: {
        frontend: 0,
        backend: 0,
        database: 0,
        authentication: 0,
        testing: 0,
        documentation: 0,
        deployment: 0,
      },
      passedRequirements: [],
      failedRequirements: [failedRequirement],
      staticChecks: [failedRequirement],
      assessorReviewStatus: 'returned',
      automaticReviewStatus: 'failed',
      assessorValidationRequired: false,
      errorMessage: error.message,
      recommendations: [
        'Fix repository access, project setup, dependencies, or automated tests, then run the assessment again.',
      ],
      securityNotes: [
        'The system did not invent an accuracy score because objective repository execution or verification failed.',
      ],
    });

    return result;
  } finally {
    // Cloned submissions may contain untrusted code; always remove the temp copy.
    await cleanupE2bSandbox(e2bContext?.sandbox);
    await cleanupTempFolder(localPath);
  }
}

export function listRepositoryAssessmentResults(user) {
  const query = isLearnerRole(user.role)
    ? { graduate: user._id }
    : user.role === ROLES.ORGANIZATION_ADMIN
      ? { organization: user.organization?._id || user.organization }
      : {};
  return RepositoryAssessmentResult.find(query)
    .populate('graduate', 'name email institution')
    .populate('competency', 'title code category')
    .sort({ createdAt: -1 });
}

export async function getRepositoryAssessmentResult(resultId, user) {
  const query = isLearnerRole(user.role)
    ? { _id: resultId, graduate: user._id }
    : user.role === ROLES.ORGANIZATION_ADMIN
      ? { _id: resultId, organization: user.organization?._id || user.organization }
      : { _id: resultId };
  const result = await RepositoryAssessmentResult.findOne(query)
    .populate('graduate', 'name email institution')
    .populate('competency', 'title code category');

  if (!result) {
    throw new AppError('Repository assessment result was not found.', 404);
  }

  return result;
}

export async function updateRepositoryAssessmentResult(resultId, payload) {
  const allowedUpdates = [
    'recommendations',
    'securityNotes',
  ];
  const updates = {};

  allowedUpdates.forEach((field) => {
    if (payload[field] !== undefined) updates[field] = payload[field];
  });

  const result = await RepositoryAssessmentResult.findByIdAndUpdate(
    resultId,
    updates,
    { new: true, runValidators: true },
  )
    .populate('graduate', 'name email institution')
    .populate('competency', 'title code category');

  if (!result) {
    throw new AppError('Repository assessment result was not found.', 404);
  }

  return result;
}

export async function deleteRepositoryAssessmentResult(resultId, user) {
  const query = isLearnerRole(user.role)
    ? { _id: resultId, graduate: user._id }
    : user.role === ROLES.ORGANIZATION_ADMIN
      ? { _id: resultId, organization: user.organization?._id || user.organization }
      : { _id: resultId };
  const result = await RepositoryAssessmentResult.findOneAndDelete(query);

  if (!result) {
    throw new AppError('Repository assessment result was not found.', 404);
  }

  return result;
}

class GitHubService {
  parseGithubUrl = parseGithubUrl;
  verifyGithubRepository = verifyGithubRepository;
  cloneGithubRepository = cloneGithubRepository;
  analyzeRepository = analyzeRepository;
  runRepositoryTests = runRepositoryTests;
  runEslint = runEslint;
  runSecurityScan = runSecurityScan;
  scoreRepositoryAssessment = scoreRepositoryAssessment;
  parseGitHubRepositoryUrl = parseGitHubRepositoryUrl;
  validateGitHubRepositoryUrl = validateGitHubRepositoryUrl;
  parseRequiredApiRoute = parseRequiredApiRoute;
  buildManifestTemplate = buildManifestTemplate;
  buildSubmissionContract = buildSubmissionContract;
  summarizeGitHubRepository = summarizeGitHubRepository;
  reviewGitHubRepositoryForTask = reviewGitHubRepositoryForTask;
  assessGithubRepository = assessGithubRepository;
  listRepositoryAssessmentResults = listRepositoryAssessmentResults;
  getRepositoryAssessmentResult = getRepositoryAssessmentResult;
  updateRepositoryAssessmentResult = updateRepositoryAssessmentResult;
  deleteRepositoryAssessmentResult = deleteRepositoryAssessmentResult;
}

const githubService = new GitHubService();

export default githubService;

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

// GitHub API configuration
function readNumericEnvironmentValue(name, defaultValue) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : defaultValue;
}

function removeTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function requireConfiguredUrl(name) {
  const value = removeTrailingSlash(process.env[name]);

  if (!value) {
    throw new AppError(`${name} is required for GitHub repository analysis`, 500);
  }

  return value;
}

function getGitHubApiBaseUrl() {
  return requireConfiguredUrl("GITHUB_API_BASE_URL");
}

function getGitHubRawFileBaseUrl() {
  return requireConfiguredUrl("GITHUB_RAW_BASE_URL");
}

function getFileExtension(path = "") {
  const match = path.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : "";
}

function createRequestTimeoutController(ms = readNumericEnvironmentValue("GITHUB_REQUEST_TIMEOUT_MS", 10000)) {
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
  const { controller, timeout } = createRequestTimeoutController();

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
  const { controller, timeout } = createRequestTimeoutController();

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

function truncateLongText(value = "", maxLength = 1200) {
  return String(value).replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function parsePackageScripts(packageManifestContent = "") {
  try {
    const packageJson = JSON.parse(packageManifestContent || "{}");
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

function calculateRatioScore(matched, total) {
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
      ].includes(getFileExtension(path))
        ? 2
        : 0;
      const readmePenalty = getFileExtension(path) === ".md" ? -1 : 0;

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
  const implementationKeywordRate = calculateRatioScore(
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
  const functionalCoverageRate = calculateRatioScore(
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
  const actionCoverageRate = calculateRatioScore(
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

function detectLanguageFromFilePath(path = "") {
  const extension = getFileExtension(path);
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

// Repository evidence scoring
function scoreRepositoryEvidence({
  repository,
  readmeFound,
  readmeDocumentContent,
  supportedSourceFiles,
  repositoryFiles,
  commits,
  languages,
}) {
  const hasSourceFiles = supportedSourceFiles.length > 0;
  const hasMultipleFiles = supportedSourceFiles.length >= 5;
  const hasMultipleLanguages = Object.keys(languages || {}).length >= 2;
  const hasCommits = Array.isArray(commits) && commits.length > 0;
  const hasRecentActivity =
    hasCommits &&
    commits.some((commit) => {
      const date = new Date(commit.commit?.author?.date || 0);
      const ageInDays = (Date.now() - date.getTime()) / 86400000;
      return Number.isFinite(ageInDays) && ageInDays <= 365;
    });
  const hasConfigFile = repositoryFiles.some((file) =>
    CONFIG_FILE_PATTERN.test(file.path),
  );
  const hasTests = repositoryFiles.some((file) => TEST_FILE_PATTERN.test(file.path));
  const hasDocumentationDepth = truncateLongText(readmeDocumentContent, 3000).length >= 400;

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

  try {
    const parsedUrl = new URL(trimmedUrl);
    const configuredHost = new URL(requireConfiguredUrl("GITHUB_WEB_BASE_URL")).hostname.replace(
      /^www\./,
      "",
    );
    const submittedHost = parsedUrl.hostname.replace(/^www\./, "");
    const [owner, rawRepo] = parsedUrl.pathname.split("/").filter(Boolean);
    const repo = rawRepo?.replace(/\.git$/i, "");

    if (submittedHost !== configuredHost || !owner || !repo) {
      return null;
    }

    return {
      url: trimmedUrl,
      owner,
      repo,
    };
  } catch {
    return null;
  }
}

export function validateGitHubRepositoryUrl(url = "") {
  if (!url) return null;

  const parsedRepositoryUrl = parseGitHubRepositoryUrl(url);

  if (!parsedRepositoryUrl) {
    throw new AppError(
      "GitHub repository URL must be a valid GitHub repository link",
      400,
    );
  }

  return parsedRepositoryUrl;
}

// Public repository analysis workflow
export async function summarizeGitHubRepository(url = "") {
  const parsedRepositoryUrl = validateGitHubRepositoryUrl(url);

  if (!parsedRepositoryUrl) return null;

  const repositoryApiUrl = `${getGitHubApiBaseUrl()}/repos/${parsedRepositoryUrl.owner}/${parsedRepositoryUrl.repo}`;

  try {
    const repository = await fetchGitHubJson(repositoryApiUrl);
    const [languages, commits, tree, workflowRuns] = await Promise.all([
      fetchGitHubJson(`${repositoryApiUrl}/languages`).catch(() => ({})),
      fetchGitHubJson(`${repositoryApiUrl}/commits?per_page=5`).catch(() => []),
      fetchGitHubJson(
        `${repositoryApiUrl}/git/trees/${repository.default_branch}?recursive=1`,
      ).catch(() => ({ tree: [] })),
      fetchGitHubJson(`${repositoryApiUrl}/actions/runs?per_page=5`).catch(() => ({
        workflow_runs: [],
      })),
    ]);

    const repositoryFiles = Array.isArray(tree.tree)
      ? tree.tree.filter((item) => item.type === "blob")
      : [];
    const supportedSourceFiles = repositoryFiles.filter((file) =>
      SUPPORTED_CODE_EXTENSIONS.has(getFileExtension(file.path)),
    );
    const extensionCounts = supportedSourceFiles.reduce((counts, file) => {
      const extension = getFileExtension(file.path) || "unknown";
      counts[extension] = (counts[extension] || 0) + 1;
      return counts;
    }, {});
    const supportedFileTypes = Object.entries(extensionCounts).map(
      ([extension, count]) => ({
        extension,
        count,
      }),
    );
    const setupFileFound = repositoryFiles.some((file) =>
      CONFIG_FILE_PATTERN.test(file.path),
    );
    const testFileFound = repositoryFiles.some((file) =>
      TEST_FILE_PATTERN.test(file.path),
    );
    const ciWorkflowFound = repositoryFiles.some((file) =>
      CI_WORKFLOW_PATTERN.test(file.path),
    );
    const packageManifestFile = repositoryFiles.find((file) =>
      PACKAGE_FILE_PATTERN.test(file.path),
    );
    const packageManifestContent = packageManifestFile
      ? await fetchGitHubText(
          `${getGitHubRawFileBaseUrl()}/${parsedRepositoryUrl.owner}/${parsedRepositoryUrl.repo}/${repository.default_branch}/${packageManifestFile.path}`,
        ).catch(() => "")
      : "";
    const packageScripts = parsePackageScripts(packageManifestContent);
    const ciSummary = summarizeWorkflowRuns(workflowRuns.workflow_runs || []);
    const readmeFound = repositoryFiles.some((file) =>
      file.path.toLowerCase().split("/").pop()?.startsWith("readme"),
    );
    const readmeDocumentFile = repositoryFiles.find((file) =>
      file.path.toLowerCase().split("/").pop()?.startsWith("readme"),
    );
    const readmeUrl = readmeDocumentFile
      ? `${getGitHubRawFileBaseUrl()}/${parsedRepositoryUrl.owner}/${parsedRepositoryUrl.repo}/${repository.default_branch}/${readmeDocumentFile.path}`
      : "";
    const readmeDocumentContent = readmeUrl
      ? await fetchGitHubText(readmeUrl).catch(() => "")
      : "";
    const repositoryEvidenceScore = scoreRepositoryEvidence({
      repository,
      readmeFound,
      readmeDocumentContent,
      supportedSourceFiles,
      repositoryFiles,
      commits,
      languages,
    });
    const maxSampledFiles = readNumericEnvironmentValue("GITHUB_MAX_SAMPLED_FILES", 20);
    const reviewKeywords = extractKeywords(
      repository.description || "",
      readmeDocumentContent || "",
      parsedRepositoryUrl.repo || "",
    );
    const filesForReview = sortSourceFilesForReview(
      supportedSourceFiles,
      reviewKeywords,
    );
    const sampledSourceFiles = await Promise.all(
      filesForReview.slice(0, maxSampledFiles).map(async (file) => {
        const rawUrl = `${getGitHubRawFileBaseUrl()}/${parsedRepositoryUrl.owner}/${parsedRepositoryUrl.repo}/${repository.default_branch}/${file.path}`;
        const content = await fetchGitHubText(rawUrl).catch(() => "");

        return {
          path: file.path,
          language: detectLanguageFromFilePath(file.path),
          size: file.size || 0,
          excerpt: truncateLongText(content, 900),
        };
      }),
    );
    const repositoryReviewNotes = [
      readmeFound
        ? "README file found for project explanation."
        : "README file was not detected and should be improved before resubmission.",
      supportedSourceFiles.length > 0
        ? `${supportedSourceFiles.length} supported code/documentation files detected.`
        : "No supported code files were detected by automatic analysis.",
      Array.isArray(commits) && commits.length > 0
        ? `${commits.length} recent commit(s) available for automatic evidence review.`
        : "Recent commit history could not be confirmed automatically.",
      `Repository quality score: ${repositoryEvidenceScore.codeQualityScore}%.`,
      `Evidence completeness score: ${repositoryEvidenceScore.evidenceCompletenessScore}%.`,
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
      ...repositoryEvidenceScore.positiveNotes,
    ];

    return {
      ...parsedRepositoryUrl,
      isValid: true,
      fetchStatus: "fetched",
      analyzedAt: new Date(),
      description: repository.description || "",
      defaultBranch: repository.default_branch,
      stars: repository.stargazers_count || 0,
      forks: repository.forks_count || 0,
      languages: Object.keys(languages || {}),
      readmeFound,
      readmeExcerpt: truncateLongText(readmeDocumentContent, 1500),
      recentCommits: Array.isArray(commits)
        ? commits.map((commit) => ({
            message: commit.commit?.message || "",
            author: commit.commit?.author?.name || "",
            date: commit.commit?.author?.date || "",
          }))
        : [],
      supportedFileCount: supportedSourceFiles.length,
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
      codeQualityScore: repositoryEvidenceScore.codeQualityScore,
      evidenceCompletenessScore: repositoryEvidenceScore.evidenceCompletenessScore,
      riskFlags: repositoryEvidenceScore.riskFlags,
      sampledSourceFiles,
      topLevelItems: repositoryFiles
        .filter((file) => !file.path.includes("/"))
        .slice(0, 12)
        .map((file) => file.path),
      codeQualityNotes: repositoryReviewNotes,
      summaryText: `${parsedRepositoryUrl.owner}/${parsedRepositoryUrl.repo} was verified and analyzed through the GitHub API. ${repositoryReviewNotes.join(" ")}`,
    };
  } catch (error) {
    throw new AppError(
      `GitHub repository could not be verified or analyzed: ${error.message}`,
      400,
    );
  }
}

// Practical task implementation review
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
