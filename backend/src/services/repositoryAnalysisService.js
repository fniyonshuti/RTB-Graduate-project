import { AppError } from '../utils/errors.js';

const GITHUB_REPO_PATTERN =
  /^https?:\/\/(www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:\/)?$/;

const SUPPORTED_CODE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.html',
  '.css',
  '.scss',
  '.json',
  '.py',
  '.java',
  '.php',
  '.cs',
  '.cpp',
  '.c',
  '.sql',
  '.md',
]);

function getExtension(path = '') {
  const match = path.toLowerCase().match(/\.[a-z0-9]+$/);
  return match ? match[0] : '';
}

function withTimeout(ms = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
}

async function fetchGitHubJson(url) {
  const { controller, timeout } = withTimeout();

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'rtb-skills-gap-analysis-tool',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchGitHubText(url) {
  const { controller, timeout } = withTimeout();

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/plain',
        'User-Agent': 'rtb-skills-gap-analysis-tool',
      },
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

function compactText(value = '', maxLength = 1200) {
  return String(value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function fileLanguage(path = '') {
  const extension = getExtension(path);
  const map = {
    '.js': 'JavaScript',
    '.jsx': 'React JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'React TypeScript',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.json': 'JSON',
    '.py': 'Python',
    '.java': 'Java',
    '.php': 'PHP',
    '.cs': 'C#',
    '.cpp': 'C++',
    '.c': 'C',
    '.sql': 'SQL',
    '.md': 'Markdown',
  };

  return map[extension] || extension.replace('.', '').toUpperCase() || 'Text';
}

export function parseGitHubRepositoryUrl(url = '') {
  const trimmedUrl = String(url).trim();
  const match = trimmedUrl.match(GITHUB_REPO_PATTERN);

  if (!match) {
    return null;
  }

  return {
    url: trimmedUrl,
    owner: match[2],
    repo: match[3],
  };
}

export function validateGitHubRepositoryUrl(url = '') {
  if (!url) return null;

  const parsed = parseGitHubRepositoryUrl(url);

  if (!parsed) {
    throw new AppError('GitHub repository URL must be a valid GitHub repository link', 400);
  }

  return parsed;
}

export async function summarizeGitHubRepository(url = '') {
  const parsed = validateGitHubRepositoryUrl(url);

  if (!parsed) return null;

  const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;

  try {
    const repository = await fetchGitHubJson(base);
    const [languages, commits, tree] = await Promise.all([
      fetchGitHubJson(`${base}/languages`).catch(() => ({})),
      fetchGitHubJson(`${base}/commits?per_page=5`).catch(() => []),
      fetchGitHubJson(
        `${base}/git/trees/${repository.default_branch}?recursive=1`
      ).catch(() => ({ tree: [] })),
    ]);

    const files = Array.isArray(tree.tree)
      ? tree.tree.filter((item) => item.type === 'blob')
      : [];
    const supportedFiles = files.filter((file) =>
      SUPPORTED_CODE_EXTENSIONS.has(getExtension(file.path))
    );
    const extensionCounts = supportedFiles.reduce((counts, file) => {
      const extension = getExtension(file.path) || 'unknown';
      counts[extension] = (counts[extension] || 0) + 1;
      return counts;
    }, {});
    const supportedFileTypes = Object.entries(extensionCounts).map(
      ([extension, count]) => ({
        extension,
        count,
      })
    );
    const readmeFound = files.some((file) =>
      file.path.toLowerCase().split('/').pop()?.startsWith('readme')
    );
    const readmeFile = files.find((file) =>
      file.path.toLowerCase().split('/').pop()?.startsWith('readme')
    );
    const readmeUrl = readmeFile
      ? `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${repository.default_branch}/${readmeFile.path}`
      : '';
    const readmeContent = readmeUrl
      ? await fetchGitHubText(readmeUrl).catch(() => '')
      : '';
    const sampledSourceFiles = await Promise.all(
      supportedFiles.slice(0, 6).map(async (file) => {
        const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${repository.default_branch}/${file.path}`;
        const content = await fetchGitHubText(rawUrl).catch(() => '');

        return {
          path: file.path,
          language: fileLanguage(file.path),
          size: file.size || 0,
          excerpt: compactText(content, 900),
        };
      })
    );
    const notes = [
      readmeFound
        ? 'README file found for project explanation.'
        : 'README file was not detected and should be checked by the assessor.',
      supportedFiles.length > 0
        ? `${supportedFiles.length} supported code/documentation files detected.`
        : 'No supported code files were detected by automatic analysis.',
      Array.isArray(commits) && commits.length > 0
        ? `${commits.length} recent commit(s) available for assessor review.`
        : 'Recent commit history could not be confirmed automatically.',
    ];

    return {
      ...parsed,
      isValid: true,
      fetchStatus: 'fetched',
      analyzedAt: new Date(),
      description: repository.description || '',
      defaultBranch: repository.default_branch,
      stars: repository.stargazers_count || 0,
      forks: repository.forks_count || 0,
      languages: Object.keys(languages || {}),
      readmeFound,
      readmeExcerpt: compactText(readmeContent, 1500),
      recentCommits: Array.isArray(commits)
        ? commits.map((commit) => ({
            message: commit.commit?.message || '',
            author: commit.commit?.author?.name || '',
            date: commit.commit?.author?.date || '',
          }))
        : [],
      supportedFileCount: supportedFiles.length,
      supportedFileTypes,
      sampledSourceFiles,
      topLevelItems: files
        .filter((file) => !file.path.includes('/'))
        .slice(0, 12)
        .map((file) => file.path),
      codeQualityNotes: notes,
      summaryText: `${parsed.owner}/${parsed.repo} was verified and analyzed through the GitHub API. ${notes.join(' ')}`,
    };
  } catch (error) {
    throw new AppError(
      `GitHub repository could not be verified or analyzed: ${error.message}`,
      400
    );
  }
}
