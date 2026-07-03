import { spawn } from 'node:child_process';
import { AppError } from './errors.js';

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
