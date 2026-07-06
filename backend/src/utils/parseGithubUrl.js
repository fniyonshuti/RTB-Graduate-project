import { AppError } from './errors.js';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

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
