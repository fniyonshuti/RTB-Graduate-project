import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { runCommand } from '../utils/runCommand.js';

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function dockerArgs(localPath, command, { network = 'none' } = {}) {
  // Untrusted graduate code runs in a constrained container by default.
  // Dependency install can opt into network, while tests/builds stay offline.
  return [
    'run',
    '--rm',
    '--network',
    network,
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
    command,
  ];
}

async function runSafeCommand({
  name,
  localPath,
  command,
  args,
  shellCommand,
  dockerNetwork = 'none',
}) {
  const startedAt = Date.now();
  const result = env.enableUnsafeLocalRepositoryExecution
    ? await runCommand(command, args, {
        cwd: localPath,
        timeoutMs: env.repositoryAnalysisTimeoutMs,
      })
    : await runCommand('docker', dockerArgs(localPath, shellCommand, { network: dockerNetwork }), {
        timeoutMs: env.repositoryAnalysisTimeoutMs,
      });

  return {
    name,
    command: shellCommand || [command, ...args].join(' '),
    success: result.success,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: Date.now() - startedAt,
  };
}

async function runInstructorCommand(localPath, commandText) {
  const startedAt = Date.now();
  const result = env.enableUnsafeLocalRepositoryExecution
    ? await runCommand(
        process.platform === 'win32' ? 'cmd' : 'sh',
        process.platform === 'win32' ? ['/c', commandText] : ['-lc', commandText],
        {
          cwd: localPath,
          timeoutMs: env.repositoryAnalysisTimeoutMs,
        },
      )
    : await runCommand('docker', dockerArgs(localPath, commandText), {
        timeoutMs: env.repositoryAnalysisTimeoutMs,
      });

  return {
    name: 'Run instructor task tests',
    command: commandText,
    success: result.success,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: Date.now() - startedAt,
  };
}

async function writeInstructorTestFiles(localPath, testFiles = []) {
  const writtenFiles = [];

  for (const testFile of testFiles) {
    if (!testFile?.path || !testFile?.content) continue;

    const targetPath = path.resolve(localPath, testFile.path);
    const relativePath = path.relative(localPath, targetPath);

    // Instructor files are injected into the cloned repo, so reject paths that
    // would escape the repository directory.
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new AppError(`Unsafe instructor test path rejected: ${testFile.path}`, 400);
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, testFile.content, 'utf8');
    writtenFiles.push(testFile.path);
  }

  return writtenFiles;
}

async function checkDockerAvailability() {
  if (env.enableUnsafeLocalRepositoryExecution) {
    return {
      available: true,
      result: null,
    };
  }

  const result = await runCommand(
    'docker',
    ['version', '--format', '{{.Server.Version}}'],
    {
      timeoutMs: 10000,
    },
  ).catch((error) => ({
    success: false,
    exitCode: 1,
    stdout: '',
    stderr: error.message,
  }));

  return {
    available: result.success,
    result,
  };
}

export async function runRepositoryTests(localPath, analysis, practicalTask = {}) {
  const commandResults = [];
  const testCases = [];
  const securityNotes = [];
  const instructorTestFiles = practicalTask.automatedTestFiles || [];
  const instructorTestCommand = String(practicalTask.automatedTestCommand || '').trim();
  const hasInstructorTests =
    instructorTestFiles.length > 0 && instructorTestCommand.length > 0;

  if (analysis.projectType !== 'node') {
    // The execution engine currently knows how to run Node projects. Other
    // stacks still receive static review and must be validated by an assessor.
    return {
      executionMode: 'static_only',
      totalTestCases: 0,
      passedTestCases: 0,
      commandResults,
      testCases,
      assessorValidationRequired: true,
      securityNotes: ['Project type is not supported for automatic execution yet.'],
    };
  }

  if (!env.enableUnsafeLocalRepositoryExecution) {
    securityNotes.push(
      'Repository commands are executed through Docker isolation. Dependency installation may use network, while build and tests run without network access.',
    );
  } else {
    securityNotes.push(
      'Unsafe local repository execution is enabled. Use only in a disposable sandbox environment.',
    );
  }

  const hasTestScript = typeof analysis.packageScripts.test === 'string';
  const hasBuildScript = typeof analysis.packageScripts.build === 'string';
  let writtenInstructorTests = [];
  const dockerStatus = await checkDockerAvailability();

  if (!dockerStatus.available) {
    // Never fall back to local execution unless explicitly enabled in env;
    // failing closed avoids running untrusted repositories on the host machine.
    const message =
      dockerStatus.result?.stderr ||
      'Docker is not available. Start Docker Desktop or allow the current user to access Docker.';

    commandResults.push({
      name: 'Check Docker availability',
      command: 'docker version --format {{.Server.Version}}',
      success: false,
      exitCode: dockerStatus.result?.exitCode || 1,
      stdout: dockerStatus.result?.stdout || '',
      stderr: message,
      durationMs: 0,
    });

    testCases.push({
      id: 'docker-isolation',
      title: 'Docker isolation is available for safe repository execution',
      competency: 'deployment',
      passed: false,
      evidence: '',
      error: message,
    });

    return {
      executionMode: 'docker',
      totalTestCases: testCases.length,
      passedTestCases: 0,
      commandResults,
      testCases,
      assessorValidationRequired: true,
      securityNotes: [
        ...securityNotes,
        'The system did not run untrusted repository code because Docker isolation is unavailable.',
      ],
    };
  }

  try {
    commandResults.push(
      await runSafeCommand({
        name: 'Install dependencies',
        localPath,
        command: npmCommand(),
        args: ['install', '--ignore-scripts'],
        shellCommand: 'npm install --ignore-scripts',
        dockerNetwork: 'bridge',
      }),
    );
  } catch (error) {
    commandResults.push({
      name: 'Install dependencies',
      command: 'npm install --ignore-scripts',
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: error.message,
      durationMs: 0,
    });
  }

  if (hasInstructorTests) {
    try {
      // Hidden instructor tests are the strongest signal that the repository
      // satisfies the exact practical task behavior.
      writtenInstructorTests = await writeInstructorTestFiles(
        localPath,
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
      await runSafeCommand({
        name: 'Build project',
        localPath,
        command: npmCommand(),
        args: ['run', 'build', '--if-present'],
        shellCommand: 'npm run build --if-present',
      }).catch((error) => ({
        name: 'Build project',
        command: 'npm run build --if-present',
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        durationMs: 0,
      })),
    );
  }

  if (hasTestScript) {
    commandResults.push(
      await runSafeCommand({
        name: 'Run submitted automated tests',
        localPath,
        command: npmCommand(),
        args: ['test', '--', '--runInBand'],
        shellCommand: 'npm test -- --runInBand',
      }).catch((error) => ({
        name: 'Run submitted automated tests',
        command: 'npm test -- --runInBand',
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        durationMs: 0,
      })),
    );
  }

  if (hasInstructorTests && writtenInstructorTests.length > 0) {
    commandResults.push(
      await runInstructorCommand(localPath, instructorTestCommand).catch((error) => ({
        name: 'Run instructor task tests',
        command: instructorTestCommand,
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: error.message,
        durationMs: 0,
      })),
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
    evidence: installResult?.success ? 'npm install completed successfully.' : '',
    error: installResult?.success ? '' : installResult?.stderr || 'Dependency installation failed.',
  });

  if (hasBuildScript) {
    testCases.push({
      id: 'build-script',
      title: 'Project builds successfully',
      competency: 'deployment',
      passed: Boolean(buildResult?.success),
      evidence: buildResult?.success ? 'Build command completed successfully.' : '',
      error: buildResult?.success ? '' : buildResult?.stderr || 'Build failed.',
    });
  }

  testCases.push({
    id: 'submitted-automated-tests',
    title: 'Graduate-submitted automated tests pass',
    competency: 'testing',
    passed: Boolean(submittedTestResult?.success),
    evidence: submittedTestResult?.success ? 'npm test completed successfully.' : '',
    error: submittedTestResult?.success
      ? ''
      : hasTestScript
        ? submittedTestResult?.stderr || 'Submitted automated tests failed.'
        : 'No npm test script was found.',
  });

  testCases.push({
    id: 'instructor-task-tests',
    title: 'Instructor-defined practical task tests pass',
    competency: 'testing',
    passed: Boolean(instructorTestResult?.success),
    evidence: instructorTestResult?.success
      ? `Instructor tests passed. Files injected: ${writtenInstructorTests.join(', ')}.`
      : '',
    error: instructorTestResult?.success
      ? ''
      : hasInstructorTests
        ? instructorTestResult?.stderr || 'Instructor-defined tests failed.'
        : 'No instructor-defined task tests were configured for this practical task.',
  });

  return {
    executionMode: env.enableUnsafeLocalRepositoryExecution ? 'local' : 'docker',
    totalTestCases: testCases.length,
    passedTestCases: testCases.filter((test) => test.passed).length,
    commandResults,
    testCases,
    assessorValidationRequired: !hasTestScript || !hasInstructorTests,
    securityNotes,
  };
}
