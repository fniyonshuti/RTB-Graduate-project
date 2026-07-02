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
  'docker-isolation': 8,
  'automated-tests-stage': 8,
  'docker-execution-stage': 6,
  'eslint-stage': 8,
  'security-scan-stage': 10,
  'assessor-review-stage': 8,
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
  assessorReviewStatus = 'pending',
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
      id: 'docker-execution-stage',
      title: 'Repository was executed safely through Docker',
      competency: 'deployment',
      weight: OBJECTIVE_CHECK_WEIGHTS['docker-execution-stage'],
      passed:
        testCases.some((check) => check.id === 'dependency-install' && check.passed) ||
        testCases.some((check) => check.id === 'build-script' && check.passed),
      evidence: 'Docker-based dependency/build execution completed.',
      error: 'Docker execution did not complete successfully.',
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
      id: 'assessor-review-stage',
      title: 'Assessor review is required for final validation',
      competency: 'documentation',
      weight: OBJECTIVE_CHECK_WEIGHTS['assessor-review-stage'],
      passed: assessorReviewStatus === 'approved',
      evidence: 'Assessor approved the repository assessment result.',
      error: 'Assessor review is still pending.',
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
