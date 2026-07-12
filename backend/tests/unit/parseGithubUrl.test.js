import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseGithubUrl } from '../../src/services/githubService.js';

describe('parseGithubUrl', () => {
  it('parses an HTTPS GitHub repository URL', () => {
    assert.deepEqual(parseGithubUrl('https://github.com/openai/codex'), {
      url: 'https://github.com/openai/codex',
      owner: 'openai',
      repo: 'codex',
      fullName: 'openai/codex',
      cloneUrl: 'https://github.com/openai/codex.git',
    });
  });

  it('accepts .git suffixes and trims whitespace', () => {
    const parsed = parseGithubUrl('  https://www.github.com/example/project.git  ');

    assert.equal(parsed.owner, 'example');
    assert.equal(parsed.repo, 'project');
    assert.equal(parsed.cloneUrl, 'https://github.com/example/project.git');
  });

  it('throws an operational error for invalid repository URLs', () => {
    assert.throws(
      () => parseGithubUrl('https://gitlab.com/example/project'),
      {
        message: 'GitHub repository URL must be a valid owner/repository link.',
        statusCode: 400,
        isOperational: true,
      },
    );
  });
});
