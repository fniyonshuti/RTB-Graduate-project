import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { parseGithubUrl } from '../utils/parseGithubUrl.js';
import { runCommand } from '../utils/runCommand.js';

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'rtb-skills-gap-analysis-tool',
  };

  if (env.githubToken) {
    headers.Authorization = `Bearer ${env.githubToken}`;
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
  if (!env.githubToken) return parsed.cloneUrl;
  return `https://x-access-token:${env.githubToken}@github.com/${parsed.owner}/${parsed.repo}.git`;
}

export async function verifyGithubRepository(repositoryUrl) {
  const parsed = parseGithubUrl(repositoryUrl);
  const { controller, timeout } = withGitHubTimeout();
  let response;

  try {
    response = await fetch(`${env.githubApiUrl}/repos/${parsed.owner}/${parsed.repo}`, {
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
  await fs.mkdir(env.tempRepositoryDir, { recursive: true });

  const folderName = `${repository.owner}-${repository.repo}-${crypto.randomUUID()}`;
  const destination = path.join(env.tempRepositoryDir, folderName);
  const cloneUrl = authenticatedCloneUrl(repository);

  const cloneResult = await runCommand(
    'git',
    ['clone', '--depth', '1', cloneUrl, destination],
    {
      timeoutMs: env.repositoryAnalysisTimeoutMs,
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
