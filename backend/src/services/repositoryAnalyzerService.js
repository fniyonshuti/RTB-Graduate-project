import fs from "node:fs/promises";
import path from "node:path";

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
