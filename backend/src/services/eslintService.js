import dotenv from 'dotenv';
import { runCommand } from '../utils/runCommand.js';

dotenv.config({ quiet: true });

function dockerArgs(localPath) {
  const repositoryDockerImage = process.env.REPOSITORY_DOCKER_IMAGE || 'node:20-alpine';
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
    repositoryDockerImage,
    'sh',
    '-lc',
    'npx eslint . --format json',
  ];
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

export async function runEslint(localPath, analysis) {
  if (analysis.projectType !== 'node') {
    return {
      available: false,
      success: false,
      errors: 0,
      warnings: 0,
      output: 'ESLint was skipped because the project is not detected as a Node.js project.',
    };
  }

  const hasLintScript = typeof analysis.packageScripts.lint === 'string';
  const shellCommand = hasLintScript ? 'npm run lint -- --format json' : 'npx eslint . --format json';
  const enableUnsafeLocalRepositoryExecution =
    String(process.env.ENABLE_UNSAFE_LOCAL_REPOSITORY_EXECUTION || '').toLowerCase() === 'true';
  const repositoryAnalysisTimeoutMs =
    Number(process.env.REPOSITORY_ANALYSIS_TIMEOUT_MS) || 120000;
  const command = enableUnsafeLocalRepositoryExecution
    ? hasLintScript
      ? process.platform === 'win32'
        ? 'npm.cmd'
        : 'npm'
      : process.platform === 'win32'
        ? 'npx.cmd'
        : 'npx'
    : 'docker';
  const args = enableUnsafeLocalRepositoryExecution
    ? hasLintScript
      ? ['run', 'lint', '--', '--format', 'json']
      : ['eslint', '.', '--format', 'json']
    : dockerArgs(localPath);

  const result = await runCommand(command, args, {
    cwd: localPath,
    timeoutMs: repositoryAnalysisTimeoutMs,
  }).catch((error) => ({
    success: false,
    stdout: '',
    stderr: error.message,
    exitCode: 1,
  }));
  const parsed = parseEslintOutput(result.stdout);

  return {
    available: true,
    success: result.success,
    errors: parsed.errors,
    warnings: parsed.warnings,
    output: (result.stdout || result.stderr || `${shellCommand} produced no output.`).slice(-12000),
  };
}
