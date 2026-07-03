import { AppError } from './errors.js';

const GITHUB_REPOSITORY_PATTERN =
  /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/)?$/;

export function parseGithubUrl(url = '') {
  const normalizedUrl = String(url || '').trim();
  const match = normalizedUrl.match(GITHUB_REPOSITORY_PATTERN);

  if (!match) {
    throw new AppError('GitHub repository URL must be a valid owner/repository link.', 400);
  }

  return {
    url: normalizedUrl,
    owner: match[1],
    repo: match[2],
    fullName: `${match[1]}/${match[2]}`,
    cloneUrl: `https://github.com/${match[1]}/${match[2]}.git`,
  };
}
