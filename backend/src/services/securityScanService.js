import { env } from '../config/env.js';
import { runCommand } from '../utils/runCommand.js';

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

function dockerArgs(localPath) {
  return [
    'run',
    '--rm',
    '--network',
    'none',
    '--memory',
    '512m',
    '--cpus',
    '1',
    '-v',
    `${localPath}:/workspace`,
    '-w',
    '/workspace',
    env.repositoryDockerImage,
    'sh',
    '-lc',
    'npm audit --json --audit-level=high',
  ];
}

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
    .map((file) => `${file.path}\n${file.excerpt || ''}`)
    .join('\n');

  return SECRET_PATTERNS.filter((rule) => rule.pattern.test(sourceText)).map(
    (rule) => rule.label,
  );
}

export async function runSecurityScan(localPath, analysis) {
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

  const command = env.enableUnsafeLocalRepositoryExecution
    ? process.platform === 'win32'
      ? 'npm.cmd'
      : 'npm'
    : 'docker';
  const args = env.enableUnsafeLocalRepositoryExecution
    ? ['audit', '--json', '--audit-level=high']
    : dockerArgs(localPath);
  const result = await runCommand(command, args, {
    cwd: localPath,
    timeoutMs: env.repositoryAnalysisTimeoutMs,
  }).catch((error) => ({
    success: false,
    stdout: '',
    stderr: error.message,
    exitCode: 1,
  }));
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
